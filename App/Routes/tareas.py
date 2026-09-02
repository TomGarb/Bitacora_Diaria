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
    required_fields = ['ticket', 'cliente', 'estado', 'descripcion', 'tipo_tarea']
    if data.get('tipo_tarea') != 'alta_credencial_especial':
        required_fields.append('titulo')

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

    # Tipo de tarea y reglas específicas
    tipo_tarea = data.get('tipo_tarea')
    es_programada = bool(data.get('es_actividad_programada', False))
    
    # Credenciales especiales, equipos, técnicos y mantenimientos son siempre programados por definición
    if tipo_tarea in ['alta_credencial_especial', 'acceso_equipos', 'retiro_equipos', 'acceso_tecnicos', 'mantenimiento']:
        es_programada = True

    # Parseo y validación de fechas
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

        # Validaciones específicas de fechas por tipo
        if tipo_tarea == 'alta_credencial_especial' and (not inicio_prog or not fin_prog):
            return jsonify({'error': 'Las fechas y horas de inicio Y de finalización son obligatorias para Alta de Credenciales Especiales'}), 400

        if tipo_tarea in ['acceso_equipos', 'retiro_equipos', 'acceso_tecnicos'] and not inicio_prog:
            return jsonify({'error': 'La fecha y hora de inicio es obligatoria para ingresos/retiros de equipos y acceso de técnicos'}), 400
        
        if tipo_tarea == 'mantenimiento' and (not inicio_prog or not fin_prog):
            return jsonify({'error': 'Las fechas y horas de inicio Y de finalización son obligatorias para Mantenimientos'}), 400

    # Campos extra dinámicos
    campos_extra = data.get('campos_extra', {})
    
    # 1. Validación específica para alta_credencial_especial
    if tipo_tarea == 'alta_credencial_especial':
        if not campos_extra.get('ticket_cliente'):
            return jsonify({'error': 'El Ticket de Cliente es obligatorio para Alta de Credenciales Especiales'}), 400
        
        credenciales_lista = campos_extra.get('credenciales_lista', [])
        # Soporte para compatibilidad si venían en campos planos o en lista
        if not credenciales_lista and campos_extra.get('persona_propietaria') and campos_extra.get('codigo_alfanumerico'):
            credenciales_lista = [{
                'persona_propietaria': campos_extra.get('persona_propietaria'),
                'codigo_alfanumerico': campos_extra.get('codigo_alfanumerico')
            }]
            campos_extra['credenciales_lista'] = credenciales_lista

        if not credenciales_lista or len(credenciales_lista) == 0:
            return jsonify({'error': 'Debe ingresar al menos una credencial (Persona asignada y Código Alfanumérico)'}), 400

    # 2. Validación de salas para equipos y técnicos
    if tipo_tarea in ['acceso_equipos', 'retiro_equipos', 'acceso_tecnicos']:
        if not campos_extra.get('sala_datacenter'):
            return jsonify({'error': 'Debe especificar la Sala de Datacenter donde ingresan/retiran equipos o técnicos'}), 400

    # 3. Validación de sitio para mantenimientos
    if tipo_tarea == 'mantenimiento':
        if not campos_extra.get('sitio_mantenimiento'):
            return jsonify({'error': 'Debe especificar el Sitio de Trabajo (DC o Subestación) para el Mantenimiento'}), 400

    # 4. Validación para manejo de sitios externos
    if tipo_tarea == 'manejo_sitio_externo':
        if not campos_extra.get('sitio_externo'):
            return jsonify({'error': 'Debe especificar el Sitio Externo (ej: Chile, Miami)'}), 400
        if campos_extra.get('cantidad_contactos') is None or str(campos_extra.get('cantidad_contactos')).strip() == '':
            return jsonify({'error': 'Debe indicar la cantidad de contactos que tuvieron con nosotros'}), 400

    # Título: obligatorio para la mayoría, auto-completado para credenciales especiales
    titulo = (data.get('titulo') or '').strip()
    if tipo_tarea == 'alta_credencial_especial' and not titulo:
        ticket_cli = campos_extra.get('ticket_cliente', data.get('ticket', '').strip())
        titulo = f"Alta de Credenciales Especiales - {ticket_cli}"
    elif not titulo:
        return jsonify({'error': 'El título de la tarea es obligatorio'}), 400

    nueva_tarea = Tarea(
        bitacora_id=bitacora_id,
        operador_id=user.id,
        tipo_tarea=tipo_tarea,
        ticket=data.get('ticket').strip(),
        titulo=titulo,
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
