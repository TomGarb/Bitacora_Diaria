from datetime import datetime, date
from App.extensions import db

class Bitacora(db.Model):
    __tablename__ = 'bitacoras'

    id = db.Column(db.Integer, primary_key=True)
    region_id = db.Column(db.Integer, db.ForeignKey('regiones.id', ondelete='CASCADE'), nullable=False, index=True)
    fecha = db.Column(db.Date, nullable=False, default=date.today, index=True)
    turno = db.Column(db.String(30), nullable=False, default='manana') # 'manana', 'tarde', 'noche', 'central', etc.
    estado = db.Column(db.String(20), nullable=False, default='abierta') # 'abierta', 'cerrada'
    supervisor_id = db.Column(db.Integer, db.ForeignKey('usuarios.id', ondelete='SET NULL'), nullable=True)
    observaciones_cierre = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    closed_at = db.Column(db.DateTime, nullable=True)

    # Relaciones
    region = db.relationship('Region', back_populates='bitacoras')
    supervisor = db.relationship('Usuario', back_populates='bitacoras_supervisadas')
    tareas = db.relationship('Tarea', back_populates='bitacora', lazy='dynamic', cascade='all, delete-orphan')

    def to_dict(self, include_tareas=False):
        data = {
            'id': self.id,
            'region_id': self.region_id,
            'region_nombre': self.region.nombre if self.region else None,
            'fecha': self.fecha.strftime('%Y-%m-%d') if self.fecha else None,
            'turno': self.turno,
            'estado': self.estado,
            'supervisor_id': self.supervisor_id,
            'supervisor_nombre': self.supervisor.nombre_completo if self.supervisor else None,
            'observaciones_cierre': self.observaciones_cierre,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'closed_at': self.closed_at.isoformat() if self.closed_at else None,
            'total_tareas': self.tareas.count() if self.id else 0
        }
        if include_tareas:
            data['tareas'] = [t.to_dict() for t in self.tareas.all()]
        return data

    def __repr__(self):
        return f"<Bitacora {self.id} - Region {self.region_id} - Fecha {self.fecha} - Turno {self.turno}>"
