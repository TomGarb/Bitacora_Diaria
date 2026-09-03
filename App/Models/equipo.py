from datetime import datetime
from App.extensions import db

# Tabla intermedia de asociación Muchos a Muchos entre Usuario y Equipo
usuario_equipos = db.Table(
    'usuario_equipos',
    db.Column('usuario_id', db.Integer, db.ForeignKey('usuarios.id', ondelete='CASCADE'), primary_key=True),
    db.Column('equipo_id', db.Integer, db.ForeignKey('equipos.id', ondelete='CASCADE'), primary_key=True)
)

class Equipo(db.Model):
    """
    Modelo de Equipos / Grupos de Trabajo por Datacenter/Región.
    Ej: 'Equipo Virtualización', 'Equipo Manos Remotas', 'Equipo Backups'.
    """
    __tablename__ = 'equipos'

    id = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(100), nullable=False)
    descripcion = db.Column(db.Text, nullable=True)
    region_id = db.Column(db.Integer, db.ForeignKey('regiones.id', ondelete='CASCADE'), nullable=False)
    activo = db.Column(db.Boolean, default=True, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    # Relación con Región
    region = db.relationship('Region', backref=db.backref('equipos', lazy='dynamic', cascade='all, delete-orphan'))

    # Relación Muchos a Muchos con Usuarios
    miembros = db.relationship(
        'Usuario',
        secondary=usuario_equipos,
        backref=db.backref('equipos', lazy='dynamic'),
        lazy='dynamic'
    )

    def to_dict(self, include_members=True):
        data = {
            'id': self.id,
            'nombre': self.nombre,
            'descripcion': self.descripcion,
            'region_id': self.region_id,
            'region_nombre': self.region.nombre if self.region else 'Sin Región',
            'activo': self.activo,
            'created_at': self.created_at.strftime('%Y-%m-%d %H:%M:%S') if self.created_at else None,
            'total_miembros': self.miembros.count()
        }
        if include_members:
            data['miembros'] = [{
                'id': u.id,
                'username': u.username,
                'nombre_completo': u.nombre_completo,
                'email': u.email,
                'rol': u.rol
            } for u in self.miembros]
        return data

    def __repr__(self):
        return f'<Equipo {self.nombre} (Región {self.region_id})>'
