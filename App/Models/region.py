from datetime import datetime
from App.extensions import db

class Region(db.Model):
    __tablename__ = 'regiones'

    id = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(100), unique=True, nullable=False, index=True)
    codigo = db.Column(db.String(20), unique=True, nullable=False)
    descripcion = db.Column(db.Text, nullable=True)
    activa = db.Column(db.Boolean, default=True, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relaciones
    config = db.relationship('RegionConfig', back_populates='region', uselist=False, cascade='all, delete-orphan')
    usuarios = db.relationship('Usuario', back_populates='region', lazy='dynamic')
    bitacoras = db.relationship('Bitacora', back_populates='region', lazy='dynamic', cascade='all, delete-orphan')

    def to_dict(self):
        return {
            'id': self.id,
            'nombre': self.nombre,
            'codigo': self.codigo,
            'descripcion': self.descripcion,
            'activa': self.activa,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'config': self.config.to_dict() if self.config else None
        }

    def __repr__(self):
        return f"<Region {self.nombre} ({self.codigo})>"
