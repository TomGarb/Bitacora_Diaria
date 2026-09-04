from datetime import datetime
from App.extensions import db

ESTADOS_TAREA = ['pendiente', 'en_progreso', 'completada', 'cancelada']

class Tarea(db.Model):
    __tablename__ = 'tareas'

    id = db.Column(db.Integer, primary_key=True)
    bitacora_id = db.Column(db.Integer, db.ForeignKey('bitacoras.id', ondelete='CASCADE'), nullable=False, index=True)
    operador_id = db.Column(db.Integer, db.ForeignKey('usuarios.id', ondelete='CASCADE'), nullable=False, index=True)
    tipo_tarea = db.Column(db.String(60), nullable=False, index=True)
    ticket = db.Column(db.String(80), nullable=False, index=True)
    titulo = db.Column(db.String(200), nullable=False)
    cliente = db.Column(db.String(120), nullable=False)
    estado = db.Column(db.String(30), nullable=False, default='pendiente') # 'pendiente', 'en_progreso', 'completada', 'cancelada'
    descripcion = db.Column(db.Text, nullable=False)
    
    # Actividad programada
    es_actividad_programada = db.Column(db.Boolean, default=False, nullable=False)
    fecha_programada_inicio = db.Column(db.DateTime, nullable=True)
    fecha_programada_fin = db.Column(db.DateTime, nullable=True)
    
    # Campos extra dinámicos en formato JSON (ej: alta_credencial_especial: persona_propietaria, ticket_cliente, codigo_alfanumerico)
    campos_extra = db.Column(db.JSON, nullable=False, default=dict)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relaciones
    bitacora = db.relationship('Bitacora', back_populates='tareas')
    operador = db.relationship('Usuario', back_populates='tareas_creadas')
    subtareas = db.relationship('Subtarea', back_populates='tarea', lazy='dynamic', cascade='all, delete-orphan')

    def to_dict(self, include_subtareas=True):
        from App.Models.subtarea import Subtarea
        data = {
            'id': self.id,
            'bitacora_id': self.bitacora_id,
            'operador_id': self.operador_id,
            'operador_nombre': self.operador.nombre_completo if self.operador else 'Desconocido',
            'operador_username': self.operador.username if self.operador else None,
            'tipo_tarea': self.tipo_tarea,
            'ticket': self.ticket,
            'titulo': self.titulo,
            'cliente': self.cliente,
            'estado': self.estado,
            'descripcion': self.descripcion,
            'es_actividad_programada': self.es_actividad_programada,
            'fecha_programada_inicio': self.fecha_programada_inicio.strftime('%Y-%m-%d %H:%M') if self.fecha_programada_inicio else None,
            'fecha_programada_fin': self.fecha_programada_fin.strftime('%Y-%m-%d %H:%M') if self.fecha_programada_fin else None,
            'campos_extra': self.campos_extra or {},
            'created_at': self.created_at.strftime('%Y-%m-%d %H:%M:%S') if self.created_at else None,
            'updated_at': self.updated_at.strftime('%Y-%m-%d %H:%M:%S') if self.updated_at else None,
            'total_subtareas': self.subtareas.filter(Subtarea.tipo_entrada != 'actualizacion').count() if self.id else 0,
            'total_actualizaciones': self.subtareas.filter_by(tipo_entrada='actualizacion').count() if self.id else 0
        }
        if include_subtareas:
            all_entries = [s.to_dict() for s in self.subtareas.order_by(Subtarea.id.asc()).all()]
            data['subtareas'] = [s for s in all_entries if s.get('tipo_entrada') != 'actualizacion']
            data['actualizaciones'] = [s for s in all_entries if s.get('tipo_entrada') == 'actualizacion']
            data['todas_las_entradas'] = all_entries
        return data

    def __repr__(self):
        return f"<Tarea #{self.id} [{self.tipo_tarea}] {self.ticket} - {self.titulo}>"
