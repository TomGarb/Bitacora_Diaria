from datetime import datetime
from App.extensions import db

class Subtarea(db.Model):
    __tablename__ = 'subtareas'

    id = db.Column(db.Integer, primary_key=True)
    tarea_id = db.Column(db.Integer, db.ForeignKey('tareas.id', ondelete='CASCADE'), nullable=False, index=True)
    operador_id = db.Column(db.Integer, db.ForeignKey('usuarios.id', ondelete='SET NULL'), nullable=True, index=True)
    tipo_entrada = db.Column(db.String(30), nullable=False, default='subtarea', index=True) # 'subtarea' o 'actualizacion'
    ticket = db.Column(db.String(80), nullable=True) # Obligatorio solo si tipo_entrada == 'subtarea'
    titulo = db.Column(db.String(200), nullable=True)
    estado = db.Column(db.String(30), nullable=True, default='pendiente') # 'pendiente', 'en_progreso', 'completada', 'cancelada'
    descripcion = db.Column(db.Text, nullable=False) # Contenido de la actualización o detalle de la subtarea
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relaciones
    tarea = db.relationship('Tarea', back_populates='subtareas')
    operador = db.relationship('Usuario', foreign_keys=[operador_id])

    def to_dict(self):
        return {
            'id': self.id,
            'tarea_id': self.tarea_id,
            'operador_id': self.operador_id,
            'operador_nombre': self.operador.nombre_completo if self.operador else 'Operador',
            'operador_username': self.operador.username if self.operador else None,
            'tipo_entrada': self.tipo_entrada or 'subtarea',
            'ticket': self.ticket,
            'titulo': self.titulo,
            'estado': self.estado,
            'descripcion': self.descripcion or '',
            'created_at': self.created_at.strftime('%Y-%m-%d %H:%M:%S') if self.created_at else None,
            'updated_at': self.updated_at.strftime('%Y-%m-%d %H:%M:%S') if self.updated_at else None
        }

    def __repr__(self):
        return f"<Subtarea #{self.id} [{self.tipo_entrada}] Tarea:{self.tarea_id} - {self.ticket or 'Nota'}>"
