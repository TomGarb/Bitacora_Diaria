from datetime import datetime
from App.extensions import db

TIPOS_FEEDBACK = ['error_sistema', 'modificacion_tarea', 'sugerencia_mejora', 'otro']
ESTADOS_FEEDBACK = ['pendiente', 'en_revision', 'resuelto', 'descartado']

class Feedback(db.Model):
    __tablename__ = 'feedbacks'

    id = db.Column(db.Integer, primary_key=True)
    usuario_id = db.Column(db.Integer, db.ForeignKey('usuarios.id', ondelete='CASCADE'), nullable=False)
    region_id = db.Column(db.Integer, db.ForeignKey('regiones.id', ondelete='SET NULL'), nullable=True)
    tipo = db.Column(db.String(40), nullable=False, default='error_sistema') # error_sistema, modificacion_tarea, sugerencia_mejora, otro
    asunto = db.Column(db.String(150), nullable=False)
    mensaje = db.Column(db.Text, nullable=False)
    estado = db.Column(db.String(30), nullable=False, default='pendiente') # pendiente, en_revision, resuelto, descartado
    respuesta_admin = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relaciones
    usuario = db.relationship('Usuario', backref=db.backref('feedbacks_enviados', lazy='dynamic'))
    region = db.relationship('Region', backref=db.backref('feedbacks_region', lazy='dynamic'))

    def to_dict(self):
        return {
            'id': self.id,
            'usuario_id': self.usuario_id,
            'usuario_nombre': self.usuario.nombre_completo if self.usuario else 'Desconocido',
            'usuario_username': self.usuario.username if self.usuario else None,
            'usuario_rol': self.usuario.rol if self.usuario else None,
            'region_id': self.region_id,
            'region_nombre': self.region.nombre if self.region else 'Sin región',
            'tipo': self.tipo,
            'asunto': self.asunto,
            'mensaje': self.mensaje,
            'estado': self.estado,
            'respuesta_admin': self.respuesta_admin,
            'created_at': self.created_at.strftime('%Y-%m-%d %H:%M:%S') if self.created_at else None,
            'updated_at': self.updated_at.strftime('%Y-%m-%d %H:%M:%S') if self.updated_at else None
        }

    def __repr__(self):
        return f"<Feedback #{self.id} [{self.tipo}] - {self.asunto}>"
