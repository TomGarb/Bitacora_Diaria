from fastapi import APIRouter, Request, Depends, HTTPException
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session
from sqlalchemy import or_
from datetime import date as dt_date, time as dt_time, datetime
from pydantic import BaseModel
from typing import Optional, List
from uuid import UUID

from app.database import get_db
from app.models.shift import Credential

router = APIRouter(prefix="/credentials", tags=["Credentials Management"])
templates = Jinja2Templates(directory="app/templates")

# --- Esquemas Pydantic ---
class CredentialPerson(BaseModel):
    first_name: str
    last_name: str
    credential_code: str

class CredentialBulkCreate(BaseModel):
    our_ticket: str
    client_ticket: str
    received_date: dt_date
    start_date: dt_date
    start_time: dt_time
    end_date: Optional[dt_date] = None
    end_time: Optional[dt_time] = None
    authorized_by: str
    observations: Optional[str] = None
    people: List[CredentialPerson] # ¡Lista de ingresantes!

class CredentialSingleUpdate(BaseModel):
    our_ticket: str
    client_ticket: str
    first_name: str
    last_name: str
    credential_code: str
    received_date: dt_date
    start_date: dt_date
    start_time: dt_time
    end_date: Optional[dt_date] = None
    end_time: Optional[dt_time] = None
    authorized_by: str
    observations: Optional[str] = None

@router.get("/")
async def render_credentials_manager(request: Request):
    return templates.TemplateResponse("credentials_manager.html", {"request": request})

@router.get("/api/active")
def get_active_credentials(db: Session = Depends(get_db)):
    today = datetime.utcnow().date()
    # Trae activos Y (que no hayan vencido O que no tengan fecha fin)
    creds = db.query(Credential).filter(
        Credential.is_active == True,
        or_(Credential.end_date >= today, Credential.end_date == None)
    ).order_by(Credential.start_date.asc()).all()
    
    result = []
    for c in creds:
        result.append({
            "id": str(c.id),
            "our_ticket": c.our_ticket,
            "client_ticket": c.client_ticket,
            "first_name": c.first_name,
            "last_name": c.last_name,
            "credential_code": c.credential_code,
            "received_date": c.received_date.isoformat() if c.received_date else "",
            "start_date": c.start_date.isoformat() if c.start_date else "",
            "start_time": c.start_time.strftime("%H:%M") if c.start_time else "",
            "end_date": c.end_date.isoformat() if c.end_date else "",
            "end_time": c.end_time.strftime("%H:%M") if c.end_time else "",
            "authorized_by": c.authorized_by,
            "observations": c.observations or ""
        })
    return result

@router.post("/api/bulk")
def create_bulk_credentials(payload: CredentialBulkCreate, db: Session = Depends(get_db)):
    count = 0
    for person in payload.people:
        new_cred = Credential(
            first_name=person.first_name,
            last_name=person.last_name,
            credential_code=person.credential_code,
            our_ticket=payload.our_ticket,
            client_ticket=payload.client_ticket,
            received_date=payload.received_date,
            start_date=payload.start_date,
            start_time=payload.start_time,
            end_date=payload.end_date,
            end_time=payload.end_time,
            authorized_by=payload.authorized_by,
            observations=payload.observations
        )
        db.add(new_cred)
        count += 1
    db.commit()
    return {"message": f"{count} credenciales creadas exitosamente."}

@router.put("/api/{cred_id}")
def update_credential(cred_id: UUID, payload: CredentialSingleUpdate, db: Session = Depends(get_db)):
    cred = db.query(Credential).filter(Credential.id == cred_id).first()
    if not cred: raise HTTPException(status_code=404, detail="Credencial no encontrada")
    
    for key, value in payload.dict().items():
        setattr(cred, key, value)
        
    db.commit()
    return {"message": "Credencial actualizada"}

@router.put("/api/{cred_id}/deactivate")
def deactivate_credential(cred_id: UUID, db: Session = Depends(get_db)):
    cred = db.query(Credential).filter(Credential.id == cred_id).first()
    if cred:
        cred.is_active = False
        db.commit()
    return {"message": "Credencial inactivada"}

@router.delete("/api/{cred_id}")
def delete_credential(cred_id: UUID, db: Session = Depends(get_db)):
    cred = db.query(Credential).filter(Credential.id == cred_id).first()
    if cred:
        db.delete(cred)
        db.commit()
    return {"message": "Eliminada físicamente"}