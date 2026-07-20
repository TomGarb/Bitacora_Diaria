from fastapi import APIRouter, Request, Depends, HTTPException
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from pydantic import BaseModel
from typing import Optional
from uuid import UUID

from app.database import get_db
from app.models.shift import ExtraTask

router = APIRouter(prefix="/extra-tasks", tags=["Extra Tasks Management"])
templates = Jinja2Templates(directory="app/templates")

# --- Esquemas Pydantic ---
class ExtraTaskCreate(BaseModel):
    title: str
    duration_hours: int
    duration_minutes: int
    observations: Optional[str] = None

@router.get("/")
async def render_extra_tasks_manager(request: Request):
    return templates.TemplateResponse("extra_tasks_manager.html", {"request": request})

@router.get("/api/recent")
def get_recent_extra_tasks(db: Session = Depends(get_db)):
    """Obtiene las tareas extras de las últimas 24 horas"""
    time_threshold = datetime.utcnow() - timedelta(hours=24)
    tasks = db.query(ExtraTask).filter(ExtraTask.created_at >= time_threshold).order_by(ExtraTask.created_at.desc()).all()
    
    result = []
    for t in tasks:
        result.append({
            "id": str(t.id),
            "title": t.title,
            "duration_hours": t.duration_hours,
            "duration_minutes": t.duration_minutes,
            "observations": t.observations or ""
        })
    return result

@router.post("/api")
def create_extra_task(task_data: ExtraTaskCreate, db: Session = Depends(get_db)):
    new_task = ExtraTask(
        title=task_data.title,
        duration_hours=task_data.duration_hours,
        duration_minutes=task_data.duration_minutes,
        observations=task_data.observations
    )
    db.add(new_task)
    db.commit()
    return {"message": "Tarea extra creada"}

@router.put("/api/{task_id}")
def update_extra_task(task_id: UUID, task_data: ExtraTaskCreate, db: Session = Depends(get_db)):
    task = db.query(ExtraTask).filter(ExtraTask.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Tarea no encontrada")
    
    task.title = task_data.title
    task.duration_hours = task_data.duration_hours
    task.duration_minutes = task_data.duration_minutes
    task.observations = task_data.observations
    
    db.commit()
    return {"message": "Tarea actualizada"}

@router.delete("/api/{task_id}")
def delete_extra_task(task_id: UUID, db: Session = Depends(get_db)):
    task = db.query(ExtraTask).filter(ExtraTask.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Tarea no encontrada")
    db.delete(task)
    db.commit()
    return {"message": "Tarea eliminada"}