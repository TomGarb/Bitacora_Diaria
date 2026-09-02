from datetime import datetime, date
from flask import Blueprint, render_template, request, jsonify, flash, redirect, url_for
from App.extensions import db
from App.auth import login_required, sub_admin_required, get_current_user
from App.Models.bitacora import Bitacora
from App.Models.region import Region
from App.Models.tarea import Tarea

bitacora_bp = Blueprint('bitacora', __name__)

@bitacora_bp.route('/bitacora')
@login_required
def index():
    user = get_current_user()
    region_id = user.region_id
    if not region_id:
        primera = Region.query.filter_by(activa=True).first()
        region_id = primera.id if primera else 1

    regiones = Region.query.filter_by(activa=True).all()
    region = db.session.get(Region, region_id)
    config = region.config if region else None

    # Lista de turnos configurados para la región
    turnos = config.turnos_config if (config and config.turnos_config) else []

    return render_template(
        'bitacora.html',
        user=user,
        region=region,
        regiones=regiones,
        config=config,
        turnos=turnos
    )

@bitacora_bp.route('/api/bitacoras', methods=['GET'])
@login_required
def listar_bitacoras():
    user = get_current_user()
    region_id = request.args.get('region_id', type=int) or user.region_id
    fecha_str = request.args.get('fecha')
    estado = request.args.get('estado')

    query = Bitacora.query
    if region_id:
        query = query.filter(Bitacora.region_id == region_id)
    if fecha_str:
        try:
            fecha_obj = datetime.strptime(fecha_str, '%Y-%m-%d').date()
            query = query.filter(Bitacora.fecha == fecha_obj)
        except ValueError:
            pass
    if estado:
        query = query.filter(Bitacora.estado == estado)

    bitacoras = query.order_by(Bitacora.fecha.desc(), Bitacora.id.desc()).all()
    return jsonify([b.to_dict(include_tareas=False) for b in bitacoras])

@bitacora_bp.route('/api/bitacoras/<int:bitacora_id>', methods=['GET'])
@login_required
def obtener_bitacora(bitacora_id):
    bitacora = db.get_or_404(Bitacora, bitacora_id)
    return jsonify(bitacora.to_dict(include_tareas=True))

@bitacora_bp.route('/api/bitacoras', methods=['POST'])
@login_required
def crear_bitacora():
    user = get_current_user()
    data = request.get_json() or {}

    region_id = data.get('region_id') or user.region_id or 1
    turno = data.get('turno', 'manana')
    fecha_str = data.get('fecha')
    
    fecha_obj = date.today()
    if fecha_str:
        try:
            fecha_obj = datetime.strptime(fecha_str, '%Y-%m-%d').date()
        except ValueError:
            return jsonify({'error': 'Formato de fecha inválido. Use YYYY-MM-DD'}), 400

    # Verificar si ya existe una bitácora abierta para la misma región, fecha y turno
    existente = Bitacora.query.filter_by(
        region_id=region_id,
        fecha=fecha_obj,
        turno=turno
    ).first()

    if existente:
        return jsonify({
            'error': f'Ya existe una bitácora registrada para la fecha {fecha_obj} en el turno "{turno}".',
            'bitacora_id': existente.id
        }), 409

    nueva = Bitacora(
        region_id=region_id,
        fecha=fecha_obj,
        turno=turno,
        estado='abierta',
        supervisor_id=user.id if user.is_sub_admin() else None
    )

    db.session.add(nueva)
    db.session.commit()

    return jsonify({
        'success': True,
        'message': f'Bitácora para turno {turno} abierta exitosamente.',
        'bitacora': nueva.to_dict(include_tareas=False)
    }), 201

@bitacora_bp.route('/api/bitacoras/<int:bitacora_id>/cerrar', methods=['PUT'])
@login_required
def cerrar_bitacora(bitacora_id):
    bitacora = db.get_or_404(Bitacora, bitacora_id)
    user = get_current_user()

    if not user.is_sub_admin():
        return jsonify({'error': 'Solo supervisores o administradores pueden cerrar el turno de bitácora'}), 403

    data = request.get_json() or {}
    observaciones = data.get('observaciones_cierre', '').strip()

    bitacora.estado = 'cerrada'
    bitacora.closed_at = datetime.utcnow()
    bitacora.supervisor_id = user.id
    bitacora.observaciones_cierre = observaciones

    db.session.commit()

    return jsonify({
        'success': True,
        'message': f'Bitácora #{bitacora.id} cerrada correctamente por {user.nombre_completo}.',
        'bitacora': bitacora.to_dict()
    })

@bitacora_bp.route('/api/bitacoras/<int:bitacora_id>/reabrir', methods=['PUT'])
@login_required
@sub_admin_required
def reabrir_bitacora(bitacora_id):
    bitacora = Bitacora.query.get_or_404(bitacora_id)
    bitacora.estado = 'abierta'
    bitacora.closed_at = None
    db.session.commit()
    return jsonify({
        'success': True,
        'message': f'Bitácora #{bitacora.id} reabierta con éxito.',
        'bitacora': bitacora.to_dict()
    })
