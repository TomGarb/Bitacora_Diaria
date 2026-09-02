from datetime import datetime
from werkzeug.security import generate_password_hash, check_password_hash
from App.extensions import db

class Usuario(db.Model):
    __tablename__ = 'usuarios'

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False, index=True)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    nombre_completo = db.Column(db.String(120), nullable=False)
    rol = db.Column(db.String(30), nullable=False, default='operador') # 'admin', 'sub_admin', 'operador'
    region_id = db.Column(db.Integer, db.ForeignKey('regiones.id', ondelete='SET NULL'), nullable=True)
    keycloak_sub = db.Column(db.String(100), unique=True, nullable=True) # Preparado para Keycloak ID
    activo = db.Column(db.Boolean, default=True, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relaciones
    region = db.relationship('Region', back_populates='usuarios')
    tareas_creadas = db.relationship('Tarea', back_populates='operador', lazy='dynamic')
    bitacoras_supervisadas = db.relationship('Bitacora', back_populates='supervisor', lazy='dynamic')

    def set_password(self, password: str):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password: str) -> bool:
        return check_password_hash(self.password_hash, password)

    def is_admin(self) -> bool:
        return self.rol == 'admin'

    def is_sub_admin(self) -> bool:
        return self.rol in ['admin', 'sub_admin']

    def to_dict(self):
        return {
            'id': self.id,
            'username': self.username,
            'email': self.email,
            'nombre_completo': self.nombre_completo,
            'rol': self.rol,
            'region_id': self.region_id,
            'region_nombre': self.region.nombre if self.region else None,
            'keycloak_sub': self.keycloak_sub,
            'activo': self.activo,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

    def __repr__(self):
        return f"<Usuario {self.username} ({self.rol}) - Region: {self.region_id}>"
