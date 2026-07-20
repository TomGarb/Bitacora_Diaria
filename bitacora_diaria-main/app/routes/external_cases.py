from fastapi import APIRouter, Request, Depends, Form
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.shift import ExternalCase
from datetime import datetime, timedelta
import uuid

router = APIRouter(prefix="/external-cases", tags=["Sitios Externos"])
templates = Jinja2Templates(directory="app/templates")

@router.get("/")
def render_external_cases(request: Request):
    return templates.TemplateResponse("external_cases.html", {"request": request})

@router.get("/api/list")
def get_external_cases(db: Session = Depends(get_db)):
    # Límite de 9 horas (un turno estándar extendido)
    time_limit = datetime.utcnow() - timedelta(hours=9)
    
    # Traer solo los casos creados o modificados en las últimas 9 horas
    return db.query(ExternalCase).filter(ExternalCase.created_at >= time_limit).order_by(ExternalCase.created_at.desc()).all()

@router.post("/api/save")
def save_external_case(
    id: str = Form(""),
    ticket_number: str = Form(...),
    client: str = Form(...),
    reason: str = Form(...),
    status: str = Form(...),
    contact_count: int = Form(0),
    updates: str = Form(""),
    site: str = Form(...),
    db: Session = Depends(get_db)
):
    if id: # Si hay ID, es una actualización
        case = db.query(ExternalCase).filter(ExternalCase.id == id).first()
        if case:
            case.ticket_number = ticket_number
            case.client = client
            case.reason = reason
            case.status = status
            case.contact_count = contact_count
            case.updates = updates
            case.site = site
            # ACTUALIZAMOS LA FECHA: Esto lo trae al frente del turno actual
            case.created_at = datetime.utcnow() 
    else: # Si no hay ID, es un caso nuevo
        new_case = ExternalCase(
            id=str(uuid.uuid4()),
            ticket_number=ticket_number,
            client=client,
            reason=reason,
            status=status,
            contact_count=contact_count,
            updates=updates,
            site=site,
            created_at=datetime.utcnow()
        )
        db.add(new_case)
    
    db.commit()
    return {"message": "Caso guardado exitosamente"}

@router.delete("/api/delete/{case_id}")
def delete_external_case(case_id: str, db: Session = Depends(get_db)):
    case = db.query(ExternalCase).filter(ExternalCase.id == case_id).first()
    if case:
        db.delete(case)
        db.commit()
    return {"message": "Caso eliminado"}