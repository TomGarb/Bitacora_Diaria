import os
import sys
from pathlib import Path
from dotenv import load_dotenv

# Cargar variables de entorno desde .env
base_dir = Path(__file__).resolve().parent.parent
load_dotenv(base_dir / '.env')

def get_database_uri():
    db_url = os.getenv('DATABASE_URL')
    
    # Si no se especifica, usar SQLite local
    if not db_url:
        return f"sqlite:///{base_dir / 'bitacora_dev.db'}"
    
    # Si es PostgreSQL, verificar si el host es alcanzable en desarrollo
    if db_url.startswith('postgresql'):
        try:
            import socket
            import urllib.parse
            parsed = urllib.parse.urlparse(db_url)
            host = parsed.hostname or 'localhost'
            port = parsed.port or 5432
            
            # Chequeo rápido de conexión con timeout de 0.5s
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(0.5)
            result = sock.connect_ex((host, port))
            sock.close()
            
            if result == 0:
                return db_url
            else:
                print(f"[AVISO] Servidor PostgreSQL en {host}:{port} no disponible. Usando SQLite local de desarrollo.")
                return f"sqlite:///{base_dir / 'bitacora_dev.db'}"
        except Exception:
            return f"sqlite:///{base_dir / 'bitacora_dev.db'}"
            
    return db_url

class Config:
    """Configuración base común"""
    SECRET_KEY = os.getenv('SECRET_KEY', 'default-dev-secret-doc-ops-2026')
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_DATABASE_URI = get_database_uri()

class DevelopmentConfig(Config):
    """Configuración de desarrollo"""
    DEBUG = True
    FLASK_ENV = 'development'

class ProductionConfig(Config):
    """Configuración de producción"""
    DEBUG = False
    FLASK_ENV = 'production'
    # En producción siempre se respeta la URL configurada
    SQLALCHEMY_DATABASE_URI = os.getenv('DATABASE_URL')

class TestingConfig(Config):
    """Configuración de pruebas"""
    TESTING = True
    SQLALCHEMY_DATABASE_URI = 'sqlite:///:memory:'

config_by_name = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'testing': TestingConfig,
    'default': DevelopmentConfig
}
