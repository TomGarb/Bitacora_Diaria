from fastapi import APIRouter, Request, Depends, File, UploadFile, Form
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session
from sqlalchemy import or_
from datetime import datetime, timedelta
import os
import shutil
import uuid
from app.models.shift import SystemFeedback
import httpx
import logging
from fastapi import APIRouter, Depends, BackgroundTasks     
from app.database import get_db
# Importamos TODOS los modelos, incluyendo Note
from app.models.shift import Case, Activity, Access, Credential, ExtraTask, Note, SentReport
from datetime import datetime, time, timedelta
from pydantic import BaseModel
from app.models.shift import Client, DataCenterEntity, ExternalCase
from app.models.shift import AppUser
from app.auth import get_current_user
from pydantic import BaseModel
from typing import Optional

router = APIRouter(prefix="/shift", tags=["Shift Dashboard"])
templates = Jinja2Templates(directory="app/templates")
logger = logging.getLogger("uvicorn.error")


def check_role(user_info: dict, required_role: str):
    roles = user_info.get("realm_access", {}).get("roles", [])
    return required_role in roles

@router.get("/")
async def render_dashboard(request: Request, user_info: dict = Depends(get_current_user)):
    # --- DEBUG TEMPORAL ---
    print(f"DEBUG USER INFO: {user_info}") 
    # Mira esto en la terminal cuando entres al dashboard
    
    # Probemos obtener el nombre directamente de varias fuentes comunes
    nombre_real = user_info.get("preferred_username") or user_info.get("name") or "Operador"
    
    return templates.TemplateResponse("dashboard.html", {
        "request": request,
        "user_name": nombre_real,
        "user_roles": user_info.get("realm_access", {}).get("roles", [])
    })

@router.get("/api/summary")
def get_dashboard_summary(db: Session = Depends(get_db)):
    now = datetime.utcnow()
    today = now.date()
    in_7_days = today + timedelta(days=7)
    yesterday = now - timedelta(hours=24)
    {
    "active_credentials": [...],
    "activities_today": [...],
    "reports_24h": [
        { "subject": "Planilla actualizaciones de turno 10/07/2026 - 15/07/2026", "sender": "tgarbossa@doc.lab" },
        { "subject": "Planilla actualizaciones de turno 05/07/2026 - 10/07/2026", "sender": "otro.operador@doc.lab" }
    ]
    }
    # Consultas
    cases = db.query(Case).filter(Case.created_at >= yesterday).order_by(Case.created_at.desc()).all()
    extras = db.query(ExtraTask).filter(ExtraTask.created_at >= yesterday).order_by(ExtraTask.created_at.desc()).all()
    act_today = db.query(Activity).filter(Activity.start_date == today).all()
    act_week = db.query(Activity).filter(Activity.start_date > today, Activity.start_date <= in_7_days).order_by(Activity.start_date.asc()).all()
    acc_week = db.query(Access).filter(Access.start_date <= in_7_days, or_(Access.end_date >= today, Access.end_date == None)).order_by(Access.start_date.asc()).all()
    creds = db.query(Credential).filter(Credential.is_active == True, or_(Credential.end_date >= today, Credential.end_date == None)).all()
    notes = db.query(Note).order_by(Note.created_at.desc()).all() # Traemos las notas

    # ==========================================
    # FORMATEADORES (Asegúrate de que estén TODOS)
    # ==========================================
    def fmt_basic(items):
        return [{"ticket": getattr(i, 'ticket_number', ''), "client": getattr(i, 'client', ''), "title": i.title, "observations": getattr(i, 'observations', ''), "status": getattr(i, 'status', None) and getattr(i, 'status').value} for i in items]
    
    def fmt_sched(items):
        return [{"ticket": i.ticket_number, "client": i.client, "title": i.title, "site": i.site, "date": i.start_date.isoformat(), "time": i.start_time.strftime("%H:%M"), "observations": i.observations or "", "status": i.status.value} for i in items]

    def fmt_extra(items):
        return [{"title": i.title, "time": f"{i.duration_hours}h {i.duration_minutes}m", "observations": i.observations or ""} for i in items]

    def fmt_cred(items):
        return [{"name": f"{c.first_name} {c.last_name}", "code": c.credential_code, "ticket": c.our_ticket, "client": c.client_ticket} for c in items]

    def fmt_note(items):
        return [{"title": i.title, "observations": i.observations, "priority": i.priority.value} for i in items]

    # ==========================================
    # RETORNO AL FRONTEND
    # ==========================================
    return {
        "cases_24h": fmt_basic(cases),
        "extra_24h": fmt_extra(extras),
        "activities_today": fmt_sched(act_today),
        "activities_week": fmt_sched(act_week),
        "accesses_week": fmt_sched(acc_week),
        "active_credentials": fmt_cred(creds),
        "notes": fmt_note(notes)
    }

def get_shift_info():
    now = datetime.now()
    current_time = now.time()
    current_day = now.weekday() # 0 = Lunes, 6 = Domingo
    
    # Lógica de Turnos
    shift_name = ""
    # Central: Lun-Vie 09:00 - 18:00
    if 0 <= current_day <= 4 and time(9, 0) <= current_time < time(18, 0):
        shift_name = "Central (09:00 - 18:00)"
    elif time(7, 0) <= current_time < time(15, 0):
        shift_name = "Mañana (07:00 - 15:00)"
    elif time(15, 0) <= current_time < time(23, 0):
        shift_name = "Tarde (15:00 - 23:00)"
    else:
        shift_name = "Noche (23:00 - 07:00)"

    # Lógica de Ciclo de 5 días (Fecha de referencia: 08/06/2026 - lunes)
    # Calculamos cuántos bloques de 5 días pasaron desde una fecha fija
    start_date = datetime(2026, 6, 8) 
    days_passed = (now - start_date).days
    cycle_number = (days_passed // 5) + 1
    
    return f"{shift_name} - Ciclo {cycle_number}"

# Actualiza tu endpoint /api/closed-shift-report para incluir esto:
@router.get("/api/closed-shift-report")
def get_closed_shift_report(db: Session = Depends(get_db)):
    now = datetime.utcnow()
    # Lógica de 9 horas para proteger el cambio de turno nocturno
    shift_start_window = now - timedelta(hours=9)
    today_date = now.date()

    # 1. Casos y Tareas Extra del turno (últimas 9 horas)
    cases_shift = db.query(Case).filter(Case.created_at >= shift_start_window).all()
    extras_shift = db.query(ExtraTask).filter(ExtraTask.created_at >= shift_start_window).all()
    
    # 2. Notas del turno (con su metadata de prioridad)
    notes_shift = db.query(Note).filter(Note.created_at >= shift_start_window).all()

    # 3. Elementos pendientes o activos (fecha de fin mayor a hoy o activos por bandera)
    pending_accesses = db.query(Access).filter(Access.end_date > today_date).all()
    pending_activities = db.query(Activity).filter(Activity.end_date > today_date).all()
    active_credentials = db.query(Credential).filter(
        (Credential.is_active == True) | (Credential.end_date > today_date)
    ).all()
    external_cases = db.query(ExternalCase).filter(ExternalCase.created_at >= shift_start_window).all()

    # Formateadores internos para el paquete del mail
    return {
        "window_info": {
            "start": shift_start_window.strftime("%d/%m %H:%M"),
            "end": now.strftime("%d/%m %H:%M")
        },
        "cases": [{"ticket": c.ticket_number, "client": c.client, "title": c.title, "status": c.status.value} for c in cases_shift],
        "extra_tasks": [{"title": t.title, "duration": f"{t.duration_hours}h {t.duration_minutes}m"} for t in extras_shift],
        "notes": [{"title": n.title, "priority": n.priority.value, "obs": n.observations} for n in notes_shift],
        "pending_accesses": [{"ticket": a.ticket_number, "client": a.client, "title": a.title, "until": a.end_date.isoformat()} for a in pending_accesses],
        "pending_activities": [{"ticket": ac.ticket_number, "client": ac.client, "title": ac.title, "until": ac.end_date.isoformat()} for ac in pending_activities],
        "active_credentials": [{"name": f"{cr.first_name} {cr.last_name}", "code": cr.credential_code, "client": cr.client_ticket} for cr in active_credentials],
        "external_cases": external_cases # <-- AGREGAR ESTA LÍNEA
    }

class ReportSavePayload(BaseModel):
    subject: str
    html_content: str

# Crear directorio de subidas si no existe
UPLOAD_DIR = "app/static/uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

# ==========================================
# MÓDULO DE FEEDBACK Y MENSAJERÍA
# ==========================================
UPLOAD_DIR = "app/static/uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

@router.post("/api/feedback")
async def submit_feedback(
    title: str = Form(...),
    task_type: str = Form(...),
    observations: str = Form(...),
    reported_by: str = Form("Operador"),
    file: UploadFile = File(None),
    db: Session = Depends(get_db)
):
    filename = None
    if file and file.filename:
        ext = file.filename.split(".")[-1]
        filename = f"{uuid.uuid4().hex}.{ext}"
        with open(os.path.join(UPLOAD_DIR, filename), "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

    new_feedback = SystemFeedback(
        task_type=task_type, title=title, observations=observations,
        attachment_filename=filename, reported_by=reported_by,
        admin_unread=True, user_unread=False
    )
    db.add(new_feedback)
    db.commit()

    # ---> ¡AQUÍ DISPARAMOS LA NOTIFICACIÓN A TEAMS! <---
    await send_teams_notification(
        task_type=task_type, 
        title=title, 
        observations=observations, 
        reported_by=reported_by
    )

    return {"message": "Reporte enviado exitosamente."}

@router.get("/api/feedback")
def get_feedbacks(user: str = "ADMIN", db: Session = Depends(get_db)):
    # Si es ADMIN trae todos, si es un usuario trae solo los suyos
    query = db.query(SystemFeedback)
    if user != "ADMIN":
        query = query.filter(SystemFeedback.reported_by == user)
    return query.order_by(SystemFeedback.created_at.desc()).all()

@router.put("/api/feedback/{fb_id}/resolve")
def resolve_feedback(fb_id: str, payload: dict, db: Session = Depends(get_db)):
    fb = db.query(SystemFeedback).filter(SystemFeedback.id == fb_id).first()
    if fb:
        fb.status = payload.get("status", fb.status)
        fb.admin_comment = payload.get("admin_comment", "")
        fb.user_unread = True  # Activamos la campana del operador
        fb.admin_unread = False # El admin ya lo atendió
        db.commit()
    return {"message": "Caso respondido"}

@router.put("/api/feedback/{fb_id}/read")
def mark_feedback_read(fb_id: str, role: str, db: Session = Depends(get_db)):
    fb = db.query(SystemFeedback).filter(SystemFeedback.id == fb_id).first()
    if fb:
        if role == "ADMIN": fb.admin_unread = False
        else: fb.user_unread = False
        db.commit()
    return {"message": "Marcado como leído"}

@router.get("/api/global-clients")
def get_global_clients(db: Session = Depends(get_db)):
    """Devuelve la lista de clientes activos para los autocompletados"""
    try:
        # Reemplaza 'Client' por el nombre exacto de tu clase SQLAlchemy de clientes
        clients = db.query(Client).order_by(Client.name.asc()).all()
        return [{"name": c.name} for c in clients]
    except Exception as e:
        # Respaldo por si la tabla tiene otro nombre
        return []

@router.get("/api/global-sites")
def get_global_sites(db: Session = Depends(get_db)):
    try:
        # IMPORTANTE: Asegúrate de que 'Site' sea el nombre de tu clase en master_data.py
        sites = db.query(DataCenterEntity).all()
        
        # Si tu columna se llama 'nombre' en vez de 'name', cambialo aquí abajo:
        return [{"name": s.name} for s in sites] 
    except Exception as e:
        print(f"❌ ERROR EN API SITIOS: {e}") # Esto te mostrará el error real en la terminal
        return []

async def send_teams_notification(task_type: str, title: str, observations: str, reported_by: str):
    """Envía un mensaje asincrónico a un canal de Teams."""
    
    # Reemplaza esto por la URL real que te dio Teams
    TEAMS_WEBHOOK_URL = "https://default0abdd59413d3401ea70419830f19e8.88.environment.api.powerplatform.com:443/powerautomate/automations/direct/cu/03/workflows/e8aba3cc890c44f1aa20fe0ea7472b9f/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=MDxWEsPjh5WSJvIdZyei9BuLKzILFT41W9vW6pK8xCA" 
    
    # Armamos el mensaje con formato Markdown básico soportado por Teams
    mensaje = (
        f"🚨 **Nuevo ticket en la Bitácora**\n\n"
        f"**Usuario:** {reported_by}\n"
        f"**Tipo:** {task_type}\n"
        f"**Título:** {title}\n"
        f"**Descripción:** {observations}"
    )

    payload = {
        "text": mensaje
    }

    try:
        # Usamos httpx para no bloquear FastAPI, igual que hicimos con los correos
        async with httpx.AsyncClient() as client:
            response = await client.post(TEAMS_WEBHOOK_URL, json=payload, timeout=10.0)
            
            if response.status_code in (200, 201, 202):
                print("✅ [TEAMS] Notificación enviada con éxito.", flush=True)
            else:
                print(f"❌ [TEAMS] Error al enviar (HTTP {response.status_code}): {response.text}", flush=True)
    except Exception as e:
        print(f"❌ [TEAMS] Fallo de red al notificar: {str(e)}", flush=True)

# ==========================================
# GESTIÓN DE USUARIOS Y PERMISOS
# ==========================================
@router.get("/api/users")
def get_app_users(db: Session = Depends(get_db)):
    return db.query(AppUser).order_by(AppUser.role.asc(), AppUser.username.asc()).all()

@router.post("/api/users")
def save_app_user(
    id: str = Form(""),
    username: str = Form(...),
    role: str = Form(...),
    db: Session = Depends(get_db)
):
    if id:
        user = db.query(AppUser).filter(AppUser.id == id).first()
        if user:
            # Validar que no cambie el nombre a uno que ya exista (que no sea él mismo)
            existing = db.query(AppUser).filter(AppUser.username == username, AppUser.id != id).first()
            if existing:
                raise HTTPException(status_code=400, detail="Ese nombre de usuario ya está en uso.")
            user.username = username
            user.role = role
    else:
        existing = db.query(AppUser).filter(AppUser.username == username).first()
        if existing:
            raise HTTPException(status_code=400, detail="El usuario ya existe.")
        
        new_user = AppUser(id=str(uuid.uuid4()), username=username, role=role)
        db.add(new_user)
    
    db.commit()
    return {"message": "Usuario guardado exitosamente."}

@router.delete("/api/users/{user_id}")
def delete_app_user(
    user_id: str, 
    db: Session = Depends(get_db),
    user_info: dict = Depends(get_current_user) # Inyectamos el usuario
):
    # Verificamos si es ADMIN
    if not check_role(user_info, "admin"):
        raise HTTPException(status_code=403, detail="No tienes permisos de administrador.")
    
    user = db.query(AppUser).filter(AppUser.id == user_id).first()
    if user:
        db.delete(user)
        db.commit()
    return {"message": "Usuario eliminado."}

@router.get("/tv-monitor")
def render_tv_dashboard(request: Request):
    """
    Renderiza la vista optimizada para SmartTVs o monitores de operaciones (NOC).
    No requiere controles de sesión interactivos para evitar caídas de pantalla fija.
    """
    return templates.TemplateResponse("tv_dashboard.html", {"request": request})


# 1. Quitamos from_email del modelo, ya no viene del front
class ReportSavePayload(BaseModel):
    subject: str
    html_content: str
    to_email: Optional[str] = ""  # Ya no es obligatorio que el frontend lo envíe
    cc_email: Optional[str] = ""

# --- 1. PEGAR ESTA FUNCIÓN AQUÍ (ARRIBA DEL ENDPOINT) ---
async def send_turbosmtp_email_async(subject: str, html_content: str, from_email: str, to_email: str, cc_email: str = ""):
    try:
        print(f"⏳ [SMTP] Conectando con API V2 para enviar a '{to_email}' desde '{from_email}'...", flush=True)
        
        url = "https://api.turbo-smtp.com/api/v2/mail/send"
        payload = {
            "from": from_email,
            "to": to_email,
            "subject": subject,
            "content": "Por favor, visualice este correo en un cliente que soporte formato HTML.",
            "html_content": html_content
        }
        if cc_email:
            payload["cc"] = cc_email
            
        headers = {
            "Accept": "application/json",
            "Content-Type": "application/json",
            "consumerKey": "b0f6b0e563edc3de6d1e",
            "consumerSecret": "pzasQA0Pt9f3XgJCm5oY"
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.post(url, json=payload, headers=headers, timeout=15.0)
            
            if response.status_code in (200, 201, 202):
                print(f"✅ [SMTP] Éxito. API respondió: {response.text}", flush=True)
            else:
                print(f"❌ [SMTP] Rechazo (HTTP {response.status_code}): {response.text}", flush=True)

    except Exception as e:
        print(f"❌ [SMTP] Fallo de red/ejecución: {str(e)}", flush=True)


# --- 2. TU ENDPOINT ACTUALIZADO ---
@router.post("/api/save-report")
async def save_shift_report(
    payload: ReportSavePayload, 
    request: Request,
    db: Session = Depends(get_db),
    user_info: dict = Depends(get_current_user)  # <-- ESTA ES LA LLAVE MÁGICA
):
    # A. Extraemos el NOMBRE del usuario desde el token inyectado
    nombre_operador = "Operador"
    
    if isinstance(user_info, dict):
        # Va a buscar tu nombre real (ej. Tomas Garbossa) o tu usuario (ej. tgarbossa)
        nombre_operador = user_info.get("name") or user_info.get("preferred_username") or "Operador"
    
    # B. Armamos el remitente con el formato: "Nombre" <correo@dominio.com>
    remitente_oficial = f'"{nombre_operador}" <bitacora-diaria@ctldocbaires.com>'
    
    # C. Forzamos el destinatario oficial
    destinatario_oficial = "dl-arg-dc-doc-eng@ciriontechnologies.com"

    # D. Guardamos en Base de Datos
    new_report = SentReport(
        subject=payload.subject,
        from_email=remitente_oficial,
        to_email=destinatario_oficial,
        html=payload.html_content 
    )
    db.add(new_report)
    db.commit()

    # E. Enviamos el correo a TurboSMTP
    print(f"🚀 INICIANDO LLAMADA A TURBOSMTP A NOMBRE DE {remitente_oficial}...", flush=True)
    await send_turbosmtp_email_async(
        subject=payload.subject, 
        html_content=payload.html_content,
        from_email=remitente_oficial,
        to_email=destinatario_oficial,
        cc_email=payload.cc_email
    )
    print(f"✅ LLAMADA A TURBOSMTP FINALIZADA.", flush=True)

    return {"message": "Reporte guardado y procesado."}