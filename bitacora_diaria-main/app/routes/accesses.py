from fastapi import APIRouter, Request, Depends, HTTPException
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session
from sqlalchemy import or_
from datetime import date as dt_date, time as dt_time, datetime
from pydantic import BaseModel
from typing import Optional
from uuid import UUID

from app.database import get_db
from app.models.shift import Access, AccessStatusEnum, AccessTypeEnum

router = APIRouter(prefix="/accesses", tags=["Accesses Management"])
templates = Jinja2Templates(directory="app/templates")

class AccessCreate(BaseModel):
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

@router.get("/")
async def render_accesses_manager(request: Request):
    return templates.TemplateResponse("accesses_manager.html", {"request": request})

@router.get("/api/active")
def get_active_accesses(db: Session = Depends(get_db)):
    today = datetime.utcnow().date()
    accesses = db.query(Access).filter(
        or_(
            Access.end_date >= today,
            Access.end_date == None
        )
    ).order_by(Access.start_date.asc()).all()
    
    result = []
    for a in accesses:
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
            "observations": a.observations or ""
        })
    return result

@router.post("/api")
def create_access(acc_data: AccessCreate, db: Session = Depends(get_db)):
    # Normalizamos los ENUMs para evitar el DataError de PostgreSQL
    safe_type = acc_data.type.capitalize()
    safe_status = acc_data.status.capitalize()

    new_acc = Access(
        ticket_number=acc_data.ticket_number,
        title=acc_data.title,
        client=acc_data.client,
        site=acc_data.site,
        type=AccessTypeEnum(safe_type),
        status=AccessStatusEnum(safe_status),
        request_date=acc_data.request_date,
        start_date=acc_data.start_date,
        start_time=acc_data.start_time,
        end_date=acc_data.end_date,
        end_time=acc_data.end_time,
        observations=acc_data.observations
    )
    db.add(new_acc)
    db.commit()
    return {"message": "Acceso creado"}

@router.put("/api/{acc_id}")
def update_access(acc_id: UUID, acc_data: AccessCreate, db: Session = Depends(get_db)):
    acc = db.query(Access).filter(Access.id == acc_id).first()
    if not acc:
        raise HTTPException(status_code=404, detail="Acceso no encontrado")
    
    # Normalizamos también en la actualización
    safe_type = acc_data.type.capitalize()
    safe_status = acc_data.status.capitalize()

    acc.ticket_number = acc_data.ticket_number
    acc.title = acc_data.title
    acc.client = acc_data.client
    acc.site = acc_data.site
    acc.type = AccessTypeEnum(safe_type)
    acc.status = AccessStatusEnum(safe_status)
    acc.request_date = acc_data.request_date
    acc.start_date = acc_data.start_date
    acc.start_time = acc_data.start_time
    acc.end_date = acc_data.end_date
    acc.end_time = acc_data.end_time
    acc.observations = acc_data.observations
    
    db.commit()
    return {"message": "Acceso actualizado"}

@router.delete("/api/{acc_id}")
def delete_access(acc_id: UUID, db: Session = Depends(get_db)):
    acc = db.query(Access).filter(Access.id == acc_id).first()
    if not acc:
        raise HTTPException(status_code=404, detail="Acceso no encontrado")
    db.delete(acc)
    db.commit()
    return {"message": "Acceso eliminado"}