from fastapi import APIRouter, Request, Depends, HTTPException
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from pydantic import BaseModel
from uuid import UUID

from app.database import get_db
from app.models.shift import Note, NotePriorityEnum

router = APIRouter(prefix="/notes", tags=["Notes Management"])
templates = Jinja2Templates(directory="app/templates")

class NoteCreate(BaseModel):
    title: str
    priority: str
    observations: str

@router.get("/")
async def render_notes_manager(request: Request):
    return templates.TemplateResponse("notes_manager.html", {"request": request})

@router.get("/api/recent")
def get_recent_notes(db: Session = Depends(get_db)):
    """Obtiene las notas de las últimas 24 horas"""
    time_threshold = datetime.utcnow() - timedelta(hours=24)
    notes = db.query(Note).filter(Note.created_at >= time_threshold).order_by(Note.created_at.desc()).all()
    
    result = []
    for n in notes:
        result.append({
            "id": str(n.id),
            "title": n.title,
            "priority": n.priority.value,
            "observations": n.observations,
            "created_at": n.created_at.strftime("%H:%M")
        })
    return result

@router.post("/api")
def create_note(note_data: NoteCreate, db: Session = Depends(get_db)):
    new_note = Note(
        title=note_data.title,
        priority=NotePriorityEnum(note_data.priority),
        observations=note_data.observations,
        created_at=datetime.utcnow()
    )
    db.add(new_note)
    db.commit()
    return {"message": "Nota creada con éxito"}

@router.put("/api/{note_id}")
def update_note(note_id: UUID, note_data: NoteCreate, db: Session = Depends(get_db)):
    note = db.query(Note).filter(Note.id == note_id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Nota no encontrada")
    
    note.title = note_data.title
    note.priority = NotePriorityEnum(note_data.priority)
    note.observations = note_data.observations
    
    db.commit()
    return {"message": "Nota actualizada"}

@router.delete("/api/{note_id}")
def delete_note(note_id: UUID, db: Session = Depends(get_db)):
    note = db.query(Note).filter(Note.id == note_id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Nota no encontrada")
    db.delete(note)
    db.commit()
    return {"message": "Nota eliminada"}