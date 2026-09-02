from App.Routes.auth_routes import auth_bp
from App.Routes.dashboard import dashboard_bp
from App.Routes.tareas import tareas_bp
from App.Routes.subtareas import subtareas_bp
from App.Routes.bitacora import bitacora_bp
from App.Routes.config_region import config_region_bp
from App.Routes.mail_preview import mail_preview_bp
from App.Routes.admin import admin_bp
from App.Routes.perfil import perfil_bp
from App.Routes.feedback import feedback_bp

def register_blueprints(app):
    """Registra todos los blueprints de la aplicación"""
    app.register_blueprint(auth_bp)
    app.register_blueprint(dashboard_bp)
    app.register_blueprint(tareas_bp)
    app.register_blueprint(subtareas_bp)
    app.register_blueprint(bitacora_bp)
    app.register_blueprint(config_region_bp)
    app.register_blueprint(mail_preview_bp)
    app.register_blueprint(admin_bp)
    app.register_blueprint(perfil_bp)
    app.register_blueprint(feedback_bp)
