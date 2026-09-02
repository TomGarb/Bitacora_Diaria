from functools import wraps
from flask import session, redirect, url_for, flash, request, jsonify, g
from App.extensions import db
from App.Models.usuario import Usuario

def get_current_user():
    """
    Obtiene el usuario actual desde la sesión.
    Arquitectura preparada para Keycloak:
    En producción con Keycloak, este helper validará el JWT Token / cabecera Authorization
    y mapeará el claim 'sub' al usuario en la BD.
    """
    user_id = session.get('user_id')
    if not user_id:
        return None
    
    # Cachear en g para no consultar la base de datos varias veces por request
    if not hasattr(g, 'current_user') or g.current_user is None or g.current_user.id != user_id:
        g.current_user = db.session.get(Usuario, user_id)
    return g.current_user

def login_required(f):
    """Decorator para exigir inicio de sesión"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        user = get_current_user()
        if not user or not user.activo:
            if request.is_json or request.path.startswith('/api/'):
                return jsonify({'error': 'No autenticado. Inicie sesión.'}), 401
            flash('Por favor inicie sesión para acceder a esta página.', 'warning')
            return redirect(url_for('auth.login', next=request.url))
        return f(*args, **kwargs)
    return decorated_function

def role_required(*allowed_roles):
    """Decorator para verificar permisos por rol (ej: 'admin', 'sub_admin', 'operador')"""
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            user = get_current_user()
            if not user or not user.activo:
                if request.is_json or request.path.startswith('/api/'):
                    return jsonify({'error': 'No autenticado.'}), 401
                return redirect(url_for('auth.login'))
            
            if user.rol not in allowed_roles:
                if request.is_json or request.path.startswith('/api/'):
                    return jsonify({'error': 'Acceso denegado: permisos insuficientes.'}), 403
                flash('No tiene permisos para acceder a esta sección.', 'danger')
                return redirect(url_for('dashboard.index'))
            return f(*args, **kwargs)
        return decorated_function
    return decorator

def sub_admin_required(f):
    """Permite acceso a administradores y supervisores (sub-admin)"""
    return role_required('admin', 'sub_admin')(f)

def admin_required(f):
    """Permite acceso exclusivo a administradores globales"""
    return role_required('admin')(f)
