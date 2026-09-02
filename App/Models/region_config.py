import json
from datetime import datetime
from App.extensions import db

# Catálogo maestro de todos los tipos de tareas estándar disponibles en el sistema
TIPOS_TAREA_DEFAULT = [
    {"id": "manos_remotas", "nombre": "Manos Remotas", "icono": "bi-wrench-adjustable"},
    {"id": "manos_inteligentes", "nombre": "Manos Inteligentes", "icono": "bi-cpu"},
    {"id": "acceso_equipos", "nombre": "Acceso de Equipos", "icono": "bi-box-arrow-in-right"},
    {"id": "retiro_equipos", "nombre": "Retiro de Equipos", "icono": "bi-box-arrow-right"},
    {"id": "acceso_tecnicos", "nombre": "Acceso de Técnicos", "icono": "bi-person-badge"},
    {"id": "restore", "nombre": "Restores", "icono": "bi-arrow-counterclockwise"},
    {"id": "backup", "nombre": "Backups", "icono": "bi-hdd-network"},
    {"id": "snapshot", "nombre": "Snapshots", "icono": "bi-camera"},
    {"id": "mantenimiento", "nombre": "Mantenimientos", "icono": "bi-tools"},
    {"id": "nota_de_turno", "nombre": "Notas de Turno", "icono": "bi-journal-text"},
    {"id": "tarea_extra", "nombre": "Tareas Extras Aplicadas", "icono": "bi-plus-circle-dotted"},
    {"id": "virtualizacion", "nombre": "Virtualizaciones", "icono": "bi-diagram-3"},
    {"id": "incidente", "nombre": "Incidentes", "icono": "bi-exclamation-triangle"},
    {"id": "manejo_sitio_externo", "nombre": "Manejo de Sitios Externos", "icono": "bi-globe2"},
    {"id": "alta_credencial_especial", "nombre": "Alta de Credenciales Especiales", "icono": "bi-key"}
]

# Campos extra predeterminados (como alta_credencial_especial)
CAMPOS_EXTRA_DEFAULT = {
    "alta_credencial_especial": [
        {"nombre": "persona_propietaria", "label": "Persona Propietaria", "tipo": "text", "requerido": True},
        {"nombre": "ticket_cliente", "label": "Ticket de Cliente", "tipo": "text", "requerido": True},
        {"nombre": "codigo_alfanumerico", "label": "Código Alfanumérico Asociado", "tipo": "text", "requerido": True}
    ]
}

# Turnos estándar configurados
TURNOS_DEFAULT = [
    {"id": "manana", "nombre": "Mañana", "horario": "07:00 a 15:00", "dias": "Lunes a Domingo", "activo": True},
    {"id": "tarde", "nombre": "Tarde", "horario": "15:00 a 23:00", "dias": "Lunes a Domingo", "activo": True},
    {"id": "noche", "nombre": "Noche", "horario": "23:00 a 07:00", "dias": "Lunes a Domingo", "activo": True},
    {"id": "central", "nombre": "Central", "horario": "09:00 a 18:00", "dias": "Lunes a Viernes", "activo": True}
]

class RegionConfig(db.Model):
    __tablename__ = 'region_configs'

    id = db.Column(db.Integer, primary_key=True)
    region_id = db.Column(db.Integer, db.ForeignKey('regiones.id', ondelete='CASCADE'), unique=True, nullable=False)
    
    # Lista de IDs de tipos de tareas habilitados para esta región: ["manos_remotas", "backup", ...]
    tipos_tarea_habilitados = db.Column(db.JSON, nullable=False, default=lambda: [t["id"] for t in TIPOS_TAREA_DEFAULT])
    
    # Diccionario de campos extra por tipo: {"alta_credencial_especial": [...]}
    campos_extra = db.Column(db.JSON, nullable=False, default=lambda: CAMPOS_EXTRA_DEFAULT)
    
    # Configuración de turnos personalizada por región
    turnos_config = db.Column(db.JSON, nullable=False, default=lambda: TURNOS_DEFAULT)
    
    # Configuración estética o de UI específica
    config_ui = db.Column(db.JSON, nullable=False, default=lambda: {
        "titulo_bitacora": "Bitácora de Centro de Operaciones",
        "tema_color": "#1e293b",
        "permitir_subtareas": True,
        "notificaciones_activas": True
    })
    
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relación
    region = db.relationship('Region', back_populates='config')

    def to_dict(self):
        return {
            'id': self.id,
            'region_id': self.region_id,
            'tipos_tarea_habilitados': self.tipos_tarea_habilitados or [],
            'campos_extra': self.campos_extra or {},
            'turnos_config': self.turnos_config or [],
            'config_ui': self.config_ui or {},
            'catalogo_completo_tipos': TIPOS_TAREA_DEFAULT,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

    def __repr__(self):
        return f"<RegionConfig para Region {self.region_id}>"
