from fastapi import APIRouter, Request, Depends, HTTPException
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from pydantic import BaseModel
from typing import Optional
from uuid import UUID

from app.database import get_db
from app.models.shift import Case, Subtask, CaseStatusEnum

router = APIRouter(prefix="/cases", tags=["Cases Management"])
templates = Jinja2Templates(directory="app/templates")

class CaseCreate(BaseModel):
    ticket_number: str
    title: str
    client: str
    observations: Optional[str] = None
    status: str

class SubtaskCreate(BaseModel):
    subtask_number: str
    title: str
    observations: Optional[str] = None
    status: str

@router.get("/")
async def render_cases_manager(request: Request):
    return templates.TemplateResponse("cases_manager.html", {"request": request})

@router.get("/api/recent")
def get_recent_cases(db: Session = Depends(get_db)):
    time_threshold = datetime.utcnow() - timedelta(hours=24)
    cases = db.query(Case).filter(Case.created_at >= time_threshold).order_by(Case.created_at.desc()).all()
    
    result = []
    for c in cases:
        subtasks_list = [{"id": str(st.id), "subtask_number": st.subtask_number, "title": st.title, "status": st.status.value} for st in c.subtasks]
        result.append({
            "id": str(c.id),
            "ticket_number": c.ticket_number,
            "title": c.title,
            "client": c.client,
            "observations": c.observations,
            "status": c.status.value,
            "subtasks": subtasks_list
        })
    return result

# RUTA POST: Exactamente "/api" (sin barra al final)
@router.post("/api")
def create_case(case_data: CaseCreate, db: Session = Depends(get_db)):
    # CORRECCIÓN 1: Usar case_data en lugar de payload
    estado_seguro = case_data.status.capitalize() 
    
    new_case = Case(
        ticket_number=case_data.ticket_number,
        title=case_data.title,
        client=case_data.client,
        observations=case_data.observations,
        # CORRECCIÓN 2: Castear al ENUM correcto
        status=CaseStatusEnum(estado_seguro),
        created_at=datetime.utcnow()
    )
    db.add(new_case)
    db.commit()
    db.refresh(new_case)
    return {"message": "Caso creado con éxito", "id": new_case.id}

@router.put("/api/{case_id}")
def update_case(case_id: UUID, case_data: CaseCreate, db: Session = Depends(get_db)):
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Caso no encontrado")
    
    case.ticket_number = case_data.ticket_number
    case.title = case_data.title
    case.client = case_data.client
    case.observations = case_data.observations
    
    # CORRECCIÓN 3: Blindar el ENUM en la actualización
    estado_seguro = case_data.status.capitalize()
    case.status = CaseStatusEnum(estado_seguro)
    
    db.commit()
    return {"message": "Caso actualizado"}

@router.delete("/api/{case_id}")
def delete_case(case_id: UUID, db: Session = Depends(get_db)):
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Caso no encontrado")
    db.delete(case)
    db.commit()
    return {"message": "Caso eliminado"}

@router.post("/api/{case_id}/subtasks")
def add_subtask(case_id: UUID, subtask_data: SubtaskCreate, db: Session = Depends(get_db)):
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Caso padre no encontrado")
        
    # CORRECCIÓN 4: Blindar el ENUM en las subtareas
    estado_seguro = subtask_data.status.capitalize()
    
    new_subtask = Subtask(
        case_id=case.id,
        subtask_number=subtask_data.subtask_number,
        title=subtask_data.title,
        observations=subtask_data.observations,
        status=CaseStatusEnum(estado_seguro)
    )
    db.add(new_subtask)
    db.commit()
    return {"message": "Subtarea creada"}