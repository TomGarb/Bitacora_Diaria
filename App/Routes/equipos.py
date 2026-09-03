from flask import Blueprint, request, jsonify
from datetime import datetime
from App.extensions import db
from App.auth import login_required, sub_admin_required, get_current_user
from App.Models.equipo import Equipo
from App.Models.usuario import Usuario
from App.Models.region import Region

equipos_bp = Blueprint('equipos', __name__)

@equipos_bp.route('/api/equipos', methods=['GET'])
@login_required
def listar_equipos():
    """
    Lista los equipos de trabajo activos.
    Para operadores y sub-admins, se limita a los equipos de su región.
    Para admin global, puede ver todos o filtrar por ?region_id=X.
    """
    user = get_current_user()
    region_id = request.args.get('region_id', type=int)

    if not user.is_admin():
        region_id = user.region_id

    query = Equipo.query.filter_by(activo=True)
    if region_id:
        query = query.filter_by(region_id=region_id)

    equipos = query.order_by(Equipo.id.asc()).all()
    return jsonify([e.to_dict() for e in equipos])

@equipos_bp.route('/api/equipos', methods=['POST'])
@login_required
@sub_admin_required
def crear_equipo():
    """
    Crea un nuevo equipo / grupo de trabajo en la sede.
    """
    user = get_current_user()
    data = request.get_json() or {}

    nombre = data.get('nombre', '').strip()
    descripcion = data.get('descripcion', '').strip()
    region_id = data.get('region_id')
    miembros_ids = data.get('miembros_ids', [])

    if not nombre:
        return jsonify({'error': 'El nombre del equipo es obligatorio'}), 400

    # Sub-admin solo puede crear en su propia región
    if not user.is_admin():
        region_id = user.region_id

    if not region_id:
        return jsonify({'error': 'Debe especificar una región válida'}), 400

    region = db.session.get(Region, region_id)
    if not region:
        return jsonify({'error': 'Región no encontrada'}), 404

    # Verificar si ya existe un equipo con ese nombre en la región
    existente = Equipo.query.filter_by(nombre=nombre, region_id=region_id, activo=True).first()
    if existente:
        return jsonify({'error': f'Ya existe un equipo llamado "{nombre}" en esta sede'}), 409

    nuevo_equipo = Equipo(
        nombre=nombre,
        descripcion=descripcion,
        region_id=region_id,
        activo=True
    )

    # Asignar miembros iniciales
    if miembros_ids:
        usuarios = Usuario.query.filter(
            Usuario.id.in_(miembros_ids),
            Usuario.region_id == region_id
        ).all()
        for u in usuarios:
            nuevo_equipo.miembros.append(u)

    db.session.add(nuevo_equipo)
    db.session.commit()

    return jsonify({
        'success': True,
        'message': f'Equipo "{nombre}" creado exitosamente.',
        'equipo': nuevo_equipo.to_dict()
    }), 201

@equipos_bp.route('/api/equipos/<int:equipo_id>', methods=['PUT'])
@login_required
@sub_admin_required
def actualizar_equipo(equipo_id):
    """
    Modifica los datos y la lista de operadores asignados al equipo.
    """
    user = get_current_user()
    equipo = db.get_or_404(Equipo, equipo_id)

    # Sub-admin solo puede modificar equipos de su región
    if not user.is_admin() and equipo.region_id != user.region_id:
        return jsonify({'error': 'No tiene permisos para modificar equipos de otra región'}), 403

    data = request.get_json() or {}

    if 'nombre' in data and data['nombre']:
        nuevo_nombre = data['nombre'].strip()
        # Verificar duplicado
        duplicado = Equipo.query.filter(
            Equipo.nombre == nuevo_nombre,
            Equipo.region_id == equipo.region_id,
            Equipo.id != equipo.id,
            Equipo.activo == True
        ).first()
        if duplicado:
            return jsonify({'error': f'Ya existe otro equipo con el nombre "{nuevo_nombre}" en esta sede'}), 409
        equipo.nombre = nuevo_nombre

    if 'descripcion' in data:
        equipo.descripcion = data['descripcion'].strip()

    if 'activo' in data:
        equipo.activo = bool(data['activo'])

    # Actualizar miembros
    if 'miembros_ids' in data:
        miembros_ids = data['miembros_ids']
        # Limpiar miembros actuales y asociar los nuevos
        usuarios = Usuario.query.filter(
            Usuario.id.in_(miembros_ids),
            Usuario.region_id == equipo.region_id
        ).all()
        
        equipo.miembros = []
        for u in usuarios:
            equipo.miembros.append(u)

    db.session.commit()
    return jsonify({
        'success': True,
        'message': f'Equipo "{equipo.nombre}" actualizado exitosamente.',
        'equipo': equipo.to_dict()
    })

@equipos_bp.route('/api/equipos/<int:equipo_id>', methods=['DELETE'])
@login_required
@sub_admin_required
def eliminar_equipo(equipo_id):
    """
    Elimina un equipo de trabajo.
    """
    user = get_current_user()
    equipo = db.get_or_404(Equipo, equipo_id)

    if not user.is_admin() and equipo.region_id != user.region_id:
        return jsonify({'error': 'No tiene permisos para eliminar equipos de otra región'}), 403

    nombre = equipo.nombre
    db.session.delete(equipo)
    db.session.commit()

    return jsonify({
        'success': True,
        'message': f'Equipo "{nombre}" eliminado correctamente.'
    })
