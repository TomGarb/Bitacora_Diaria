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

    # Creación automática de tablas si es necesario
    with app.app_context():
        try:
            db.create_all()
        except Exception as e:
            app.logger.warning(f"No se pudieron crear tablas automáticamente al iniciar: {e}")

    return app
