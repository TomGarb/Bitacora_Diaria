from flask import Blueprint, render_template, request, jsonify
from datetime import datetime
from App.extensions import db
from App.auth import login_required, admin_required, sub_admin_required, get_current_user
from App.Models.usuario import Usuario
from App.Models.region import Region
from App.Models.region_config import RegionConfig, TIPOS_TAREA_DEFAULT, CAMPOS_EXTRA_DEFAULT, TURNOS_DEFAULT, SALAS_DEFAULT

admin_bp = Blueprint('admin', __name__)

@admin_bp.route('/admin')
@login_required
@sub_admin_required
def index():
    user = get_current_user()
    if user.is_admin():
        regiones = Region.query.all()
        usuarios = Usuario.query.all()
    else:
        # Sub-admin sólo ve su región y usuarios de su región (excluyendo admins globales)
        regiones = Region.query.filter_by(id=user.region_id).all()
        usuarios = Usuario.query.filter(
            Usuario.region_id == user.region_id,
            Usuario.rol != 'admin'
        ).all()

    return render_template(
        'admin.html',
        user=user,
        regiones=regiones,
        usuarios=usuarios,
        es_admin_global=user.is_admin()
    )

# ==========================================
# API DE USUARIOS (CRUD COMPLETO)
# ==========================================

@admin_bp.route('/api/admin/usuarios', methods=['GET'])
@login_required
@sub_admin_required
def listar_usuarios():
    user = get_current_user()
    if user.is_admin():
        usuarios = Usuario.query.order_by(Usuario.id.asc()).all()
    else:
        usuarios = Usuario.query.filter(
            Usuario.region_id == user.region_id,
            Usuario.rol != 'admin'
        ).order_by(Usuario.id.asc()).all()

    return jsonify([u.to_dict() for u in usuarios])

@admin_bp.route('/api/admin/usuarios', methods=['POST'])
@login_required
@sub_admin_required
def crear_usuario():
    user = get_current_user()
    data = request.get_json() or {}
    
    username = data.get('username', '').strip()
    email = data.get('email', '').strip()
    nombre = data.get('nombre_completo', '').strip()
    password = data.get('password', 'demo123')
    rol = data.get('rol', 'operador')
    region_id = data.get('region_id')

    if not username or not email or not nombre:
        return jsonify({'error': 'Username, email y nombre completo son obligatorios'}), 400

    # Si es sub_admin, forzar su propia región y prohibir crear rol admin
    if not user.is_admin():
        region_id = user.region_id
        if rol == 'admin':
            rol = 'sub_admin'

    if Usuario.query.filter_by(username=username).first():
        return jsonify({'error': f'El usuario "{username}" ya existe'}), 409

    if Usuario.query.filter_by(email=email).first():
        return jsonify({'error': f'El email "{email}" ya está registrado'}), 409

    nuevo = Usuario(
        username=username,
        email=email,
        nombre_completo=nombre,
        rol=rol,
        region_id=region_id,
        activo=True
    )
    nuevo.set_password(password)

    db.session.add(nuevo)
    db.session.commit()

    return jsonify({
        'success': True,
        'message': f'Usuario {username} creado exitosamente.',
        'usuario': nuevo.to_dict()
    }), 201

@admin_bp.route('/api/admin/usuarios/<int:user_id>', methods=['PUT'])
@login_required
@sub_admin_required
def actualizar_usuario(user_id):
    current_u = get_current_user()
    usuario = db.get_or_404(Usuario, user_id)

    # Restricciones para Sub-admin
    if not current_u.is_admin():
        if usuario.region_id != current_u.region_id or usuario.rol == 'admin':
            return jsonify({'error': 'No tiene permisos para modificar usuarios de otra región o administradores'}), 403

    data = request.get_json() or {}

    if 'nombre_completo' in data and data['nombre_completo']:
        usuario.nombre_completo = data['nombre_completo'].strip()
    if 'email' in data and data['email']:
        usuario.email = data['email'].strip()
    
    if 'rol' in data:
        nuevo_rol = data['rol']
        if not current_u.is_admin() and nuevo_rol == 'admin':
            return jsonify({'error': 'No tiene permisos para asignar el rol de Administrador Global'}), 403
        usuario.rol = nuevo_rol

    if 'region_id' in data and current_u.is_admin():
        usuario.region_id = data['region_id']

    if 'activo' in data:
        usuario.activo = bool(data['activo'])
    
    if 'password' in data and data['password']:
        usuario.set_password(data['password'])

    db.session.commit()
    return jsonify({
        'success': True,
        'message': f'Perfil y permisos de {usuario.username} actualizados correctamente.',
        'usuario': usuario.to_dict()
    })

@admin_bp.route('/api/admin/usuarios/<int:user_id>', methods=['DELETE'])
@login_required
@sub_admin_required
def eliminar_usuario(user_id):
    current_u = get_current_user()
    usuario = db.get_or_404(Usuario, user_id)

    if usuario.id == current_u.id:
        return jsonify({'error': 'No puede eliminar su propia cuenta en sesión'}), 400

    if not current_u.is_admin():
        if usuario.region_id != current_u.region_id or usuario.rol == 'admin':
            return jsonify({'error': 'No tiene permisos para eliminar usuarios de otra región o administradores'}), 403

    db.session.delete(usuario)
    db.session.commit()
    return jsonify({
        'success': True,
        'message': f'Usuario {usuario.username} eliminado correctamente.'
    })


# ==========================================
# API DE REGIONES (ADMIN GLOBAL)
# ==========================================

@admin_bp.route('/api/admin/regiones', methods=['GET'])
@login_required
@sub_admin_required
def listar_regiones():
    user = get_current_user()
    if user.is_admin():
        regiones = Region.query.order_by(Region.id.asc()).all()
    else:
        regiones = Region.query.filter_by(id=user.region_id).all()
    return jsonify([r.to_dict() for r in regiones])

@admin_bp.route('/api/admin/regiones', methods=['POST'])
@login_required
@admin_required
def crear_region():
    data = request.get_json() or {}
    nombre = data.get('nombre', '').strip()
    codigo = data.get('codigo', '').strip().upper()
    descripcion = data.get('descripcion', '').strip()

    if not nombre or not codigo:
        return jsonify({'error': 'Nombre y código de región son obligatorios'}), 400

    if Region.query.filter_by(codigo=codigo).first():
        return jsonify({'error': f'La región con código "{codigo}" ya existe'}), 409

    nueva = Region(nombre=nombre, codigo=codigo, descripcion=descripcion, activa=True)
    db.session.add(nueva)
    db.session.flush()

    config = RegionConfig(
        region_id=nueva.id,
        tipos_tarea_habilitados=[t["id"] for t in TIPOS_TAREA_DEFAULT],
        campos_extra=CAMPOS_EXTRA_DEFAULT,
        turnos_config=TURNOS_DEFAULT,
        salas_datacenter=SALAS_DEFAULT
    )
    db.session.add(config)
    db.session.commit()

    return jsonify({
        'success': True,
        'message': f'Región {nombre} ({codigo}) creada exitosamente con configuración por defecto.',
        'region': nueva.to_dict()
    }), 201

@admin_bp.route('/api/admin/regiones/<int:region_id>', methods=['PUT'])
@login_required
@admin_required
def actualizar_region(region_id):
    region = db.get_or_404(Region, region_id)
    data = request.get_json() or {}

    if 'nombre' in data: region.nombre = data['nombre'].strip()
    if 'codigo' in data: region.codigo = data['codigo'].strip().upper()
    if 'descripcion' in data: region.descripcion = data['descripcion'].strip()
    if 'activa' in data: region.activa = bool(data['activa'])

    db.session.commit()
    return jsonify({
        'success': True,
        'message': f'Región {region.nombre} actualizada.',
        'region': region.to_dict()
    })
