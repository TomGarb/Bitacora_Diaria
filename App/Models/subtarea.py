from datetime import datetime
from App.extensions import db

class Subtarea(db.Model):
    __tablename__ = 'subtareas'

    id = db.Column(db.Integer, primary_key=True)
    tarea_id = db.Column(db.Integer, db.ForeignKey('tareas.id', ondelete='CASCADE'), nullable=False, index=True)
    ticket = db.Column(db.String(80), nullable=False)
    titulo = db.Column(db.String(200), nullable=False)
    estado = db.Column(db.String(30), nullable=False, default='pendiente') # 'pendiente', 'en_progreso', 'completada', 'cancelada'
    descripcion = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relación
    tarea = db.relationship('Tarea', back_populates='subtareas')

    def to_dict(self):
        return {
            'id': self.id,
            'tarea_id': self.tarea_id,
            'ticket': self.ticket,
            'titulo': self.titulo,
            'estado': self.estado,
            'descripcion': self.descripcion or '',
            'created_at': self.created_at.strftime('%Y-%m-%d %H:%M:%S') if self.created_at else None,
            'updated_at': self.updated_at.strftime('%Y-%m-%d %H:%M:%S') if self.updated_at else None
        }

    def __repr__(self):
        return f"<Subtarea #{self.id} Tarea:{self.tarea_id} {self.ticket} - {self.titulo}>"
