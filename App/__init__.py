import os
from flask import Flask
from App.config import config_by_name
from App.extensions import db
from App.Routes import register_blueprints
from App.auth import get_current_user

def create_app(config_name=None):
    if not config_name:
        config_name = os.getenv('FLASK_ENV', 'development')

    app = Flask(
        __name__,
        template_folder='Templates',
        static_folder='Static'
    )

    # Cargar configuración
    config_obj = config_by_name.get(config_name, config_by_name['default'])
    app.config.from_object(config_obj)

    # Inicializar extensiones
    db.init_app(app)

    # Inyectar variables globales en templates Jinja2
    @app.context_processor
    def inject_globals():
        user = get_current_user()
        return {
            'current_user': user,
            'app_name': 'DOC Bitácora Diaria',
            'app_version': '1.0.0'
        }

    # Registrar rutas y blueprints
    register_blueprints(app)

    # Creación automática de tablas y migración ligera de columnas si es necesario
    with app.app_context():
        try:
            db.create_all()
            
            # Verificación y migración ligera de columnas para SQLite local de desarrollo
            from sqlalchemy import text
            with db.engine.connect() as conn:
                try:
                    # Chequear si existe la tabla region_configs y si le faltan columnas
                    result = conn.execute(text("PRAGMA table_info(region_configs);"))
                    columns = [row[1] for row in result.fetchall()]
                    if columns:
                        if 'salas_datacenter' not in columns:
                            conn.execute(text("ALTER TABLE region_configs ADD COLUMN salas_datacenter JSON DEFAULT '[]';"))
                        if 'tipos_tarea_custom' not in columns:
                            conn.execute(text("ALTER TABLE region_configs ADD COLUMN tipos_tarea_custom JSON DEFAULT '[]';"))
                        conn.commit()
                except Exception:
                    pass
        except Exception as e:
            app.logger.warning(f"No se pudieron crear tablas automáticamente al iniciar: {e}")

    return app
