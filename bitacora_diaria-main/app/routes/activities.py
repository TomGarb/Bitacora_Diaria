from fastapi import APIRouter, Request, Depends, HTTPException
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session
from sqlalchemy import or_
from datetime import date as dt_date, time as dt_time, datetime
from pydantic import BaseModel
from typing import Optional
from uuid import UUID

from app.database import get_db
from app.models.shift import Activity, ActivityStatusEnum, ActivityTypeEnum

router = APIRouter(prefix="/activities", tags=["Activities Management"])
templates = Jinja2Templates(directory="app/templates")

# --- Esquemas Pydantic ---
class ActivityCreate(BaseModel):
    ticket_number: str
    title: str
    client: str
    site: Optional[str] = None
    type: str
    status: str
    request_date: dt_date
    start_date: dt_date
    start_time: dt_time
    end_date: Optional[dt_date] = None
    end_time: Optional[dt_time] = None
    observations: Optional[str] = None
    is_approved: Optional[bool] = False  # <-- NUEVO: Permitimos recibir la aprobación

@router.get("/")
async def render_activities_manager(request: Request):
    return templates.TemplateResponse("activities_manager.html", {"request": request})

@router.get("/api/active")
def get_active_activities(db: Session = Depends(get_db)):
    """Obtiene las planificadas cuya fecha de fin no ha expirado, o no tienen fecha fin"""
    today = datetime.utcnow().date()
    
    activities = db.query(Activity).filter(
        or_(
            Activity.end_date >= today,
            Activity.end_date == None
        )
    ).order_by(Activity.start_date.asc()).all()
    
    result = []
    for a in activities:
        result.append({
            "id": str(a.id),
            "ticket_number": a.ticket_number,
            "title": a.title,
            "client": a.client,
            "site": a.site or "",
            "type": a.type.value,
            "status": a.status.value,
            "request_date": a.request_date.isoformat() if a.request_date else "",
            "start_date": a.start_date.isoformat() if a.start_date else "",
            "start_time": a.start_time.strftime("%H:%M") if a.start_time else "",
            "end_date": a.end_date.isoformat() if a.end_date else "",
            "end_time": a.end_time.strftime("%H:%M") if a.end_time else "",
            "observations": a.observations or "",
            "is_approved": a.is_approved  # <-- NUEVO: Lo exponemos a la vista
        })
    return result

@router.post("/api")
def create_activity(act_data: ActivityCreate, db: Session = Depends(get_db)):
    # Blindamos los ENUMs (Ej: si llega "MANTENIMIENTO", lo pasa a "Mantenimiento")
    safe_type = act_data.type.capitalize()
    safe_status = act_data.status.capitalize()

    new_act = Activity(
        ticket_number=act_data.ticket_number,
        title=act_data.title,
        client=act_data.client,
        site=act_data.site,
        type=ActivityTypeEnum(safe_type),
        status=ActivityStatusEnum(safe_status),
        request_date=act_data.request_date,
        start_date=act_data.start_date,
        start_time=act_data.start_time,
        end_date=act_data.end_date,
        end_time=act_data.end_time,
        observations=act_data.observations,
        is_approved=act_data.is_approved  # <-- NUEVO: Lo guardamos en la DB
    )
    db.add(new_act)
    db.commit()
    return {"message": "Planificación creada"}

@router.put("/api/{act_id}")
def update_activity(act_id: UUID, act_data: ActivityCreate, db: Session = Depends(get_db)):
    act = db.query(Activity).filter(Activity.id == act_id).first()
    if not act:
        raise HTTPException(status_code=404, detail="Planificación no encontrada")
    
    safe_type = act_data.type.capitalize()
    safe_status = act_data.status.capitalize()

    act.ticket_number = act_data.ticket_number
    act.title = act_data.title
    act.client = act_data.client
    act.site = act_data.site
    act.type = ActivityTypeEnum(safe_type)
    act.status = ActivityStatusEnum(safe_status)
    act.request_date = act_data.request_date
    act.start_date = act_data.start_date
    act.start_time = act_data.start_time
    act.end_date = act_data.end_date
    act.end_time = act_data.end_time
    act.observations = act_data.observations
    act.is_approved = act_data.is_approved  # <-- NUEVO: Actualizamos el estado
    
    db.commit()
    return {"message": "Planificación actualizada"}

@router.delete("/api/{act_id}")
def delete_activity(act_id: UUID, db: Session = Depends(get_db)):
    act = db.query(Activity).filter(Activity.id == act_id).first()
    if not act:
        raise HTTPException(status_code=404, detail="Planificación no encontrada")
    db.delete(act)
    db.commit()
    return {"message": "Planificación eliminada"}