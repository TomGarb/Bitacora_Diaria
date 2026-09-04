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
    if not db_url or db_url.strip() == '':
        return f"sqlite:///{base_dir / 'bitacora_dev.db'}"
    
    # Si es PostgreSQL, verificar si la conexión es realmente válida y autenticable
    if db_url.startswith('postgresql'):
        try:
            import psycopg2
            # Intentar conexión real rápida (1 segundo de timeout)
            conn = psycopg2.connect(db_url, connect_timeout=1)
            conn.close()
            return db_url
        except Exception:
            print("[AVISO] No se pudo conectar al servidor PostgreSQL configurado (credenciales o base de datos no disponible).")
            print(f"         -> Usando SQLite local de desarrollo ({base_dir / 'bitacora_dev.db'}).")
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
