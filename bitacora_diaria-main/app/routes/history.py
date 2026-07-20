from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session
from fastapi.templating import Jinja2Templates
from app.database import get_db

# Importamos las tablas requeridas
from app.models.shift import Case, ExtraTask, Note, Subtask, SentReport, ExternalCase

router = APIRouter(prefix="/history", tags=["History Log"])
templates = Jinja2Templates(directory="app/templates")

@router.get("/")
async def render_history(request: Request):
    # Nota: Asegúrate de que el nombre coincida con tu archivo real (history.html o history_manager.html)
    return templates.TemplateResponse("history_manager.html", {"request": request})

@router.get("/api/data")
def get_history_data(db: Session = Depends(get_db)):
    history = []
    default_user = "Admin Local" # Placeholder hasta tener Login
    default_shift = "Mañana 07:00 - 15:00"

    # 1. Extraer Casos
    cases = db.query(Case).all()
    for c in cases:
        history.append({
            "type": "Caso",
            "ticket": c.ticket_number,
            "title": c.title,
            "observations": c.observations or "Sin observaciones",
            "created_at": c.created_at.isoformat() if c.created_at else "",
            "modified_at": c.created_at.isoformat() if c.created_at else "",
            "created_by": default_user,
            "modified_by": default_user,
            "shift": default_shift
        })

    # 2. Extraer Subtareas
    subtasks = db.query(Subtask).all()
    for s in subtasks:
        # CORRECCIÓN 1: La relación se llama 'case', no 'parent_case'
        parent_ticket = s.case.ticket_number if s.case else "Huérfana"
        history.append({
            "type": "Subtarea",
            "ticket": f"{parent_ticket} (Sub: {s.subtask_number})",
            "title": s.title,
            "observations": s.observations or "Sin observaciones",
            "created_at": s.created_at.isoformat() if s.created_at else "",
            "modified_at": s.created_at.isoformat() if s.created_at else "",
            "created_by": default_user,
            "modified_by": default_user,
            "shift": default_shift
        })

    # 3. Extraer Tareas Extra
    extras = db.query(ExtraTask).all()
    for e in extras:
        history.append({
            "type": "Tarea Extra",
            "ticket": "N/A",
            "title": e.title,
            "observations": e.observations or "Sin observaciones",
            "created_at": e.created_at.isoformat() if e.created_at else "",
            "modified_at": e.created_at.isoformat() if e.created_at else "",
            "created_by": default_user,
            "modified_by": default_user,
            "shift": default_shift
        })

    # 4. Extraer Notas
    notes = db.query(Note).all()
    for n in notes:
        history.append({
            "type": "Nota",
            "ticket": "N/A",
            "title": n.title,
            "observations": n.observations or "Sin observaciones",
            "created_at": n.created_at.isoformat() if n.created_at else "",
            "modified_at": n.created_at.isoformat() if n.created_at else "",
            "created_by": default_user,
            "modified_by": default_user,
            "shift": default_shift
        })
# 5. Extraer Casos Externos (Chile/Miami)
    ext_cases = db.query(ExternalCase).all()
    for c in ext_cases:
        history.append({
            "type": f"Externo {c.site}", # Mostrará "Externo Chile" o "Externo Miami"
            "ticket": c.ticket_number,
            "title": f"[{c.client}] {c.reason}",
            "observations": c.updates or "Sin actualizaciones",
            "created_at": c.created_at.isoformat() if c.created_at else "",
            "modified_at": c.created_at.isoformat() if c.created_at else "",
            "created_by": default_user,
            "modified_by": default_user,
            "shift": default_shift
        })
    # CORRECCIÓN 2: Ahora este bloque está debidamente indentado dentro de get_history_data
    history.sort(key=lambda x: x["created_at"], reverse=True)
    return history


@router.get("/api/reports")
def get_sent_reports(db: Session = Depends(get_db)):
    reports = db.query(SentReport).all()
    
    # Encapsulamos los datos en una lista de diccionarios clara para el JSON
    return [
        {
            "id": r.id,
            "date": r.date,
            "subject": r.subject,
            "html": r.html,
            "from_email": r.from_email or "Desconocido",  # <-- Propiedad clave para el frontend
            "to_email": r.to_email,
            "cc_email": r.cc_email
        }
        for r in reports
    ]

@router.delete("/api/reports/{report_id}")
def delete_sent_report(report_id: str, db: Session = Depends(get_db)):
    """
    Elimina un reporte enviado del histórico usando un ID de tipo string (UUID).
    """
    # Buscamos el reporte comparando el id como string/uuid
    report_to_delete = db.query(SentReport).filter(SentReport.id == report_id).first()
    
    if not report_to_delete:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail="El reporte solicitado no existe o ya fue eliminado."
        )
    
    db.delete(report_to_delete)
    db.commit()
    
    print(f"🗑️ [HISTORIAL] Reporte UUID {report_id} eliminado exitosamente.", flush=True)
    return {"message": "Reporte eliminado con éxito"}