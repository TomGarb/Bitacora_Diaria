from datetime import datetime, date
from flask import Blueprint, render_template, request, jsonify, flash, redirect, url_for
from App.extensions import db
from App.auth import login_required, get_current_user
from App.Models.tarea import Tarea, ESTADOS_TAREA
from App.Models.subtarea import Subtarea
from App.Models.bitacora import Bitacora
from App.Models.region import Region
from App.Models.region_config import RegionConfig, TIPOS_TAREA_DEFAULT

tareas_bp = Blueprint('tareas', __name__)

@tareas_bp.route('/tareas')
@login_required
def index():
    user = get_current_user()
    region_id = user.region_id
    if not region_id:
        primera = Region.query.filter_by(activa=True).first()
        region_id = primera.id if primera else 1

    region = db.session.get(Region, region_id)
    config = region.config if region else None
    
    # Bitácora actual o seleccionada
    bitacora_id = request.args.get('bitacora_id', type=int)
    if bitacora_id:
        bitacora = db.session.get(Bitacora, bitacora_id)
    else:
        bitacora = Bitacora.query.filter_by(region_id=region_id, fecha=date.today(), estado='abierta').order_by(Bitacora.id.desc()).first()
        if not bitacora:
            bitacora = Bitacora.query.filter_by(region_id=region_id).order_by(Bitacora.id.desc()).first()

    return render_template(
        'tareas.html',
        user=user,
        region=region,
        config=config,
        bitacora=bitacora,
        estados=ESTADOS_TAREA,
        catalogo_tipos=TIPOS_TAREA_DEFAULT
    )

@tareas_bp.route('/api/tareas', methods=['GET'])
@login_required
def listar_tareas():
    user = get_current_user()
    bitacora_id = request.args.get('bitacora_id', type=int)
    tipo_tarea = request.args.get('tipo_tarea')
    estado = request.args.get('estado')
    operador_id = request.args.get('operador_id', type=int)
    solo_mis_tareas = request.args.get('mis_tareas', '').lower() == 'true'
    solo_programadas = request.args.get('programadas', '').lower() == 'true'
    search = request.args.get('q', '').strip()

    query = Tarea.query

    if bitacora_id:
        query = query.filter(Tarea.bitacora_id == bitacora_id)
    elif user.region_id:
        # Filtrar por bitácoras de la región del usuario si no se especifica bitácora
        query = query.join(Bitacora).filter(Bitacora.region_id == user.region_id)

    if solo_mis_tareas:
        query = query.filter(Tarea.operador_id == user.id)
    elif operador_id:
        query = query.filter(Tarea.operador_id == operador_id)

    if tipo_tarea:
        query = query.filter(Tarea.tipo_tarea == tipo_tarea)

    if estado:
        query = query.filter(Tarea.estado == estado)

    if solo_programadas:
        query = query.filter(Tarea.es_actividad_programada == True)

    if search:
        search_pattern = f"%{search}%"
        query = query.filter(
            db.or_(
                Tarea.ticket.ilike(search_pattern),
                Tarea.titulo.ilike(search_pattern),
                Tarea.cliente.ilike(search_pattern),
                Tarea.descripcion.ilike(search_pattern)
            )
        )

    tareas = query.order_by(Tarea.id.desc()).all()
    return jsonify([t.to_dict(include_subtareas=True) for t in tareas])

@tareas_bp.route('/api/tareas/<int:tarea_id>', methods=['GET'])
@login_required
def obtener_tarea(tarea_id):
    tarea = db.get_or_404(Tarea, tarea_id)
    return jsonify(tarea.to_dict(include_subtareas=True))

@tareas_bp.route('/api/tareas', methods=['POST'])
@login_required
def crear_tarea():
    user = get_current_user()
    data = request.get_json() or {}

    # Validaciones obligatorias de campos base
    required_fields = ['ticket', 'titulo', 'cliente', 'estado', 'descripcion', 'tipo_tarea']
    missing = [field for field in required_fields if not data.get(field)]
    if missing:
        return jsonify({'error': f'Faltan campos obligatorios: {", ".join(missing)}'}), 400

    # Obtener o asignar bitácora
    bitacora_id = data.get('bitacora_id')
    if not bitacora_id:
        # Buscar bitácora abierta de hoy
        bitacora = Bitacora.query.filter_by(
            region_id=user.region_id or 1,
            fecha=date.today(),
            estado='abierta'
        ).first()
        if not bitacora:
            # Crear bitácora automáticamente si no existe
            bitacora = Bitacora(
                region_id=user.region_id or 1,
                fecha=date.today(),
                turno='manana',
                estado='abierta',
                supervisor_id=user.id if user.is_sub_admin() else None
            )
            db.session.add(bitacora)
            db.session.flush()
        bitacora_id = bitacora.id

    # Parseo de fechas programadas si aplica
    es_programada = bool(data.get('es_actividad_programada', False))
    inicio_prog = None
    fin_prog = None
    if es_programada:
        if data.get('fecha_programada_inicio'):
            try:
                inicio_prog = datetime.fromisoformat(data['fecha_programada_inicio'].replace('Z', ''))
            except Exception:
                pass
        if data.get('fecha_programada_fin'):
            try:
                fin_prog = datetime.fromisoformat(data['fecha_programada_fin'].replace('Z', ''))
            except Exception:
                pass

    # Campos extra dinámicos
    campos_extra = data.get('campos_extra', {})
    
    # Validación específica para alta_credencial_especial si aplica
    if data.get('tipo_tarea') == 'alta_credencial_especial':
        # Validar persona_propietaria, ticket_cliente, codigo_alfanumerico
        for req_field in ['persona_propietaria', 'ticket_cliente', 'codigo_alfanumerico']:
            if not campos_extra.get(req_field):
                return jsonify({'error': f'El campo extra "{req_field}" es requerido para Alta de Credencial Especial'}), 400

    nueva_tarea = Tarea(
        bitacora_id=bitacora_id,
        operador_id=user.id,
        tipo_tarea=data.get('tipo_tarea'),
        ticket=data.get('ticket').strip(),
        titulo=data.get('titulo').strip(),
        cliente=data.get('cliente').strip(),
        estado=data.get('estado', 'pendiente'),
        descripcion=data.get('descripcion').strip(),
        es_actividad_programada=es_programada,
        fecha_programada_inicio=inicio_prog,
        fecha_programada_fin=fin_prog,
        campos_extra=campos_extra
    )

    db.session.add(nueva_tarea)
    db.session.flush()

    # Procesar subtareas opcionales enviadas en la creación
    subtareas_data = data.get('subtareas', [])
    for sub in subtareas_data:
        if sub.get('ticket') and sub.get('titulo'):
            nueva_sub = Subtarea(
                tarea_id=nueva_tarea.id,
                ticket=sub.get('ticket').strip(),
                titulo=sub.get('titulo').strip(),
                estado=sub.get('estado', 'pendiente'),
                descripcion=sub.get('descripcion', '').strip()
            )
            db.session.add(nueva_sub)

    db.session.commit()
    return jsonify({
        'success': True,
        'message': 'Tarea creada exitosamente',
        'tarea': nueva_tarea.to_dict(include_subtareas=True)
    }), 201

@tareas_bp.route('/api/tareas/<int:tarea_id>', methods=['PUT'])
@login_required
def actualizar_tarea(tarea_id):
    tarea = db.get_or_404(Tarea, tarea_id)
    user = get_current_user()

    # Permitir edición si es el creador, supervisor o admin
    if not (user.is_sub_admin() or tarea.operador_id == user.id):
        return jsonify({'error': 'No tiene permisos para editar esta tarea'}), 403

    data = request.get_json() or {}

    if 'ticket' in data: tarea.ticket = data['ticket'].strip()
    if 'titulo' in data: tarea.titulo = data['titulo'].strip()
    if 'cliente' in data: tarea.cliente = data['cliente'].strip()
    if 'estado' in data: tarea.estado = data['estado']
    if 'descripcion' in data: tarea.descripcion = data['descripcion'].strip()
    if 'tipo_tarea' in data: tarea.tipo_tarea = data['tipo_tarea']
    
    if 'es_actividad_programada' in data:
        tarea.es_actividad_programada = bool(data['es_actividad_programada'])
    
    if 'fecha_programada_inicio' in data:
        if data['fecha_programada_inicio']:
            try:
                tarea.fecha_programada_inicio = datetime.fromisoformat(data['fecha_programada_inicio'].replace('Z', ''))
            except Exception:
                pass
        else:
            tarea.fecha_programada_inicio = None

    if 'fecha_programada_fin' in data:
        if data['fecha_programada_fin']:
            try:
                tarea.fecha_programada_fin = datetime.fromisoformat(data['fecha_programada_fin'].replace('Z', ''))
            except Exception:
                pass
        else:
            tarea.fecha_programada_fin = None

    if 'campos_extra' in data:
        # Actualizar o mezclar campos extra
        current_extra = dict(tarea.campos_extra or {})
        current_extra.update(data['campos_extra'])
        tarea.campos_extra = current_extra

    tarea.updated_at = datetime.utcnow()
    db.session.commit()

    return jsonify({
        'success': True,
        'message': 'Tarea actualizada correctamente',
        'tarea': tarea.to_dict(include_subtareas=True)
    })

@tareas_bp.route('/api/tareas/<int:tarea_id>', methods=['DELETE'])
@login_required
def eliminar_tarea(tarea_id):
    tarea = db.get_or_404(Tarea, tarea_id)
    user = get_current_user()

    if not (user.is_sub_admin() or tarea.operador_id == user.id):
        return jsonify({'error': 'No tiene permisos para eliminar esta tarea'}), 403

    db.session.delete(tarea)
    db.session.commit()
    return jsonify({'success': True, 'message': 'Tarea eliminada exitosamente'})
