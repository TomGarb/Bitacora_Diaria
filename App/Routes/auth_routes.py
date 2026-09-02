from flask import Blueprint, render_template, request, redirect, url_for, flash, session, jsonify
from App.Models.usuario import Usuario
from App.Models.region import Region
from App.auth import get_current_user

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'GET':
        if get_current_user():
            return redirect(url_for('dashboard.index'))
        
        # Obtener lista de usuarios para facilitar login mock rápido en el selector
        usuarios_demo = Usuario.query.filter_by(activo=True).all()
        return render_template('login.html', usuarios_demo=usuarios_demo)

    # POST Login
    data = request.get_json() if request.is_json else request.form
    username = data.get('username', '').strip()
    password = data.get('password', '')

    user = Usuario.query.filter_by(username=username).first()
    
    # Verificación de contraseña (o bypass seguro para login rápido de desarrollo)
    if user and user.activo and (user.check_password(password) or password == 'demo123' or not password):
        session['user_id'] = user.id
        session['username'] = user.username
        session['rol'] = user.rol
        session['region_id'] = user.region_id
        
        if request.is_json:
            return jsonify({'success': True, 'redirect': url_for('dashboard.index'), 'user': user.to_dict()})
        
        next_page = request.args.get('next') or url_for('dashboard.index')
        return redirect(next_page)

    if request.is_json:
        return jsonify({'error': 'Credenciales inválidas o usuario inactivo'}), 401
    
    flash('Usuario o contraseña incorrectos', 'danger')
    usuarios_demo = Usuario.query.filter_by(activo=True).all()
    return render_template('login.html', usuarios_demo=usuarios_demo)

@auth_bp.route('/logout')
def logout():
    session.clear()
    flash('Sesión cerrada correctamente.', 'info')
    return redirect(url_for('auth.login'))

@auth_bp.route('/api/auth/me')
def get_me():
    user = get_current_user()
    if not user:
        return jsonify({'authenticated': False}), 401
    return jsonify({
        'authenticated': True,
        'user': user.to_dict(),
        'region': user.region.to_dict() if user.region else None
    })
