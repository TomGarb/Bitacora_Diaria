import enum
import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, DateTime, Date, Time, Boolean, Integer, Enum, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()

# --- 1. TIPOS ENUMERADOS ---
class CaseStatusEnum(enum.Enum):
    CANCELADO = 'Cancelado'
    PAUSADO = 'Pausado'
    RESUELTO = 'Resuelto'
    EN_PROGRESO = 'En progreso'

class ActivityTypeEnum(enum.Enum):
    MANTENIMIENTO = 'Mantenimiento'
    MANOS_REMOTAS = 'Manos remotas'

# --- 2. MODELOS (Tablas) ---
class Case(Base):
    __tablename__ = 'cases'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    ticket_number = Column(String(100), nullable=False)
    title = Column(String(255), nullable=False)
    client = Column(String(255), nullable=False)
    observations = Column(Text, nullable=True)
    status = Column(Enum(CaseStatusEnum), default=CaseStatusEnum.EN_PROGRESO, nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    # Relación con subtareas
    subtasks = relationship("Subtask", back_populates="case", cascade="all, delete-orphan")

class Subtask(Base):
    __tablename__ = 'subtasks'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    case_id = Column(UUID(as_uuid=True), ForeignKey('cases.id', ondelete='CASCADE'), nullable=False)
    subtask_number = Column(String(100), nullable=False)
    title = Column(String(255), nullable=False)
    observations = Column(Text, nullable=True)
    status = Column(Enum(CaseStatusEnum), default=CaseStatusEnum.EN_PROGRESO, nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    case = relationship("Case", back_populates="subtasks")

class SentReport(Base):
    __tablename__ = "sent_reports"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    date = Column(String)
    subject = Column(String)
    html = Column(Text)
    from_email = Column(String)  # <-- Aquí encapsulamos el remitente
    to_email = Column(String)
    cc_email = Column(String)

class ActivityStatusEnum(enum.Enum):
    PENDIENTE = 'Pendiente'
    EN_PROGRESO = 'En progreso'
    COMPLETADO = 'Completado'
    CANCELADO = 'Cancelado'
    SIN_ESTADO = 'Sin estado'

class ActivityTypeEnum(enum.Enum):
    MANTENIMIENTO = 'Mantenimiento'
    MANOS_REMOTAS = 'Manos remotas'

class Activity(Base):
    __tablename__ = 'activities'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    ticket_number = Column(String(100), nullable=False)
    title = Column(String(255), nullable=False)
    client = Column(String(255), nullable=False)
    site = Column(String(255), nullable=True)
    status = Column(Enum(ActivityStatusEnum), default=ActivityStatusEnum.PENDIENTE, nullable=False)
    type = Column(Enum(ActivityTypeEnum), default=ActivityTypeEnum.MANTENIMIENTO, nullable=False)
    
    request_date = Column(Date, nullable=False)
    start_date = Column(Date, nullable=False)
    start_time = Column(Time, nullable=False)
    end_date = Column(Date, nullable=True)
    end_time = Column(Time, nullable=True)
    
    observations = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    
    # === NUEVO CAMPO AÑADIDO ===
    is_approved = Column(Boolean, default=False)

class AccessStatusEnum(enum.Enum):
    PENDIENTE = 'Pendiente'
    EN_PROGRESO = 'En progreso'
    COMPLETADO = 'Completado'
    CANCELADO = 'Cancelado'
    SIN_ESTADO = 'Sin estado'

class AccessTypeEnum(enum.Enum):
    INGRESO_PERSONAL = 'Ingreso de personal'
    INGRESO_ELEMENTOS = 'Ingreso de elementos'
    RETIRO_ELEMENTOS = 'Retiro de elementos'

class Access(Base):
    __tablename__ = 'accesses'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    ticket_number = Column(String(100), nullable=False)
    title = Column(String(255), nullable=False)
    client = Column(String(255), nullable=False)
    site = Column(String(255), nullable=True)
    status = Column(Enum(AccessStatusEnum), default=AccessStatusEnum.PENDIENTE, nullable=False)
    type = Column(Enum(AccessTypeEnum), nullable=False)
    
    request_date = Column(Date, nullable=False)
    start_date = Column(Date, nullable=False)
    start_time = Column(Time, nullable=False)
    end_date = Column(Date, nullable=True)
    end_time = Column(Time, nullable=True)
    
    observations = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

class Credential(Base):
    __tablename__ = 'credentials'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    first_name = Column(String(150), nullable=False)
    last_name = Column(String(150), nullable=False)
    our_ticket = Column(String(100), nullable=False)
    client_ticket = Column(String(100), nullable=False)
    credential_code = Column(String(100), nullable=False)
    
    received_date = Column(Date, nullable=False)
    start_date = Column(Date, nullable=False)
    start_time = Column(Time, nullable=False)
    end_date = Column(Date, nullable=True)
    end_time = Column(Time, nullable=True)
    
    authorized_by = Column(String(255), nullable=False)
    observations = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True) # Para ocultarlas sin borrarlas
    
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

class ExtraTask(Base):
    __tablename__ = 'extra_tasks'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title = Column(String(255), nullable=False)
    duration_hours = Column(Integer, nullable=False, default=0)
    duration_minutes = Column(Integer, nullable=False, default=0)
    observations = Column(Text, nullable=True)
    
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

class NotePriorityEnum(enum.Enum):
    ALTA = 'Alta'
    MEDIA = 'Media'
    BAJA = 'Baja'

class Note(Base):
    __tablename__ = 'notes'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title = Column(String(255), nullable=False)
    priority = Column(Enum(NotePriorityEnum), default=NotePriorityEnum.MEDIA, nullable=False)
    observations = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

class Client(Base):
    __tablename__ = "clients"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, nullable=False)
    code = Column(String, unique=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

class DataCenterEntity(Base):
    __tablename__ = "datacenters"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, unique=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

class SystemFeedback(Base):
    __tablename__ = "system_feedback"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    task_type = Column(String, nullable=False)
    title = Column(String, nullable=False)
    observations = Column(Text, nullable=False)
    attachment_filename = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    status = Column(String, default="Pendiente") # Pendiente, En Proceso, Resuelto
    
    # Nuevos campos para la mensajería y notificaciones
    reported_by = Column(String, default="Operador")
    admin_comment = Column(Text, nullable=True)
    user_unread = Column(Boolean, default=False)  # ¿El operador tiene respuesta sin leer?
    admin_unread = Column(Boolean, default=True)  # ¿El admin tiene un ticket nuevo sin leer?
    

class ExternalCase(Base):
    __tablename__ = "external_cases"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    ticket_number = Column(String, nullable=False)
    client = Column(String, nullable=False)
    reason = Column(String, nullable=False) # Motivo
    status = Column(String, default="Pendiente")
    contact_count = Column(Integer, default=0) # Cantidad Mails/Llamados
    updates = Column(Text, nullable=True) # Actualizaciones
    site = Column(String, nullable=False) # 'Chile' o 'Miami'
    created_at = Column(DateTime, default=datetime.utcnow)

class AppUser(Base):
    __tablename__ = "app_users"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    username = Column(String, unique=True, nullable=False)
    role = Column(String, default="Operador")
    created_at = Column(DateTime, default=datetime.utcnow)

class ShiftMetrics(Base):
    __tablename__ = "shift_metrics"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    operator_name = Column(String, nullable=False)
    shift = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Métricas Dinámicas (Cantidad 'c' y Tiempo 't' para cada una)
    sh_aws_c = Column(Integer, default=0)
    sh_aws_t = Column(Integer, default=0)
    sh_c = Column(Integer, default=0)
    sh_t = Column(Integer, default=0)
    rh_c = Column(Integer, default=0)
    rh_t = Column(Integer, default=0)
    inout_c = Column(Integer, default=0)
    inout_t = Column(Integer, default=0)
    inc_c = Column(Integer, default=0)
    inc_t = Column(Integer, default=0)
    inc_aws_c = Column(Integer, default=0)
    inc_aws_t = Column(Integer, default=0)
    calls_c = Column(Integer, default=0)
    calls_t = Column(Integer, default=0)
    mails_c = Column(Integer, default=0)
    mails_t = Column(Integer, default=0)
    td_c = Column(Integer, default=0)
    td_t = Column(Integer, default=0)
    acc_c = Column(Integer, default=0)
    acc_t = Column(Integer, default=0)
    trad_c = Column(Integer, default=0)
    trad_t = Column(Integer, default=0)
    pta_c = Column(Integer, default=0)
    pta_t = Column(Integer, default=0)
    mop_c = Column(Integer, default=0)
    mop_t = Column(Integer, default=0)
    abm_c = Column(Integer, default=0)
    abm_t = Column(Integer, default=0)
    eti_c = Column(Integer, default=0)
    eti_t = Column(Integer, default=0)
    chi_c = Column(Integer, default=0)
    chi_t = Column(Integer, default=0)
    mia_c = Column(Integer, default=0)
    mia_t = Column(Integer, default=0)
    te_c = Column(Integer, default=0)
    te_t = Column(Integer, default=0)