from datetime import datetime, date, timezone
from flask import Blueprint, render_template, jsonify, request
from App.extensions import db
from App.Models.region import Region
from App.Models.bitacora import Bitacora
from App.Models.tarea import Tarea

tv_bp = Blueprint('tv', __name__)

# ==========================================
# VISTAS HTML PASIVAS PARA PANTALLAS DE TV
# ==========================================

@tv_bp.route('/tv/<int:region_id>/accesos')
def tv_accesos(region_id):
    region = db.session.get(Region, region_id)
    if not region:
        region = Region.query.filter_by(activa=True).first()
        region_id = region.id if region else 1
    return render_template('tv_accesos.html', region=region)

@tv_bp.route('/tv/<int:region_id>/credenciales')
def tv_credenciales(region_id):
    region = db.session.get(Region, region_id)
    if not region:
        region = Region.query.filter_by(activa=True).first()
        region_id = region.id if region else 1
    return render_template('tv_credenciales.html', region=region)

@tv_bp.route('/tv/<int:region_id>/planificadas')
def tv_planificadas(region_id):
    region = db.session.get(Region, region_id)
    if not region:
        region = Region.query.filter_by(activa=True).first()
        region_id = region.id if region else 1
    return render_template('tv_planificadas.html', region=region)


# ==========================================
# ENDPOINTS API JSON PARA FETCH / AUTO-REFRESH
# ==========================================

def _obtener_bitacora_region(region_id):
    """Obtiene la bitácora activa o más reciente de la región"""
    bitacora = Bitacora.query.filter_by(region_id=region_id, fecha=date.today()).order_by(Bitacora.id.desc()).first()
    if not bitacora:
        bitacora = Bitacora.query.filter_by(region_id=region_id).order_by(Bitacora.id.desc()).first()
    return bitacora

@tv_bp.route('/api/tv/<int:region_id>/accesos')
def api_tv_accesos(region_id):
    region = db.session.get(Region, region_id)
    if not region:
        return jsonify({'error': 'Región no encontrada'}), 404

    bitacora = _obtener_bitacora_region(region_id)
    if not bitacora:
        return jsonify({
            'region': region.to_dict(),
            'tecnicos': [],
            'equipos': [],
            'servidor_hora': datetime.now(timezone.utc).strftime('%H:%M:%S')
        })

    # Filtrar tareas de accesos y movimientos de equipos
    tareas = Tarea.query.filter(
        Tarea.bitacora_id == bitacora.id,
        Tarea.tipo_tarea.in_(['acceso_tecnicos', 'acceso_equipos', 'retiro_equipos'])
    ).order_by(Tarea.id.desc()).all()

    tecnicos = []
    equipos = []

    for t in tareas:
        campos = t.campos_extra or {}
        sala = campos.get('sala_datacenter', 'Sala Datacenter')
        hora_ini = t.fecha_programada_inicio.strftime('%H:%M') if t.fecha_programada_inicio else (t.created_at.strftime('%H:%M') if t.created_at else '--:--')
        hora_fin = t.fecha_programada_fin.strftime('%H:%M') if t.fecha_programada_fin else None

        item = {
            'id': t.id,
            'ticket': t.ticket,
            'cliente': t.cliente,
            'titulo': t.titulo,
            'descripcion': t.descripcion,
            'estado': t.estado,
            'sala': sala,
            'hora_inicio': hora_ini,
            'hora_fin': hora_fin,
            'tipo_tarea': t.tipo_tarea
        }

        if t.tipo_tarea == 'acceso_tecnicos':
            item['empresa'] = campos.get('empresa_tecnico') or t.cliente
            tecnicos.append(item)
        else:
            item['tipo_movimiento'] = 'Ingreso (Inbound)' if t.tipo_tarea == 'acceso_equipos' else 'Retiro (Outbound)'
            equipos.append(item)

    return jsonify({
        'region': region.to_dict(),
        'turno': bitacora.turno.upper() if bitacora else 'CENTRAL',
        'fecha': str(bitacora.fecha) if bitacora else str(date.today()),
        'servidor_hora': datetime.now(timezone.utc).strftime('%H:%M:%S'),
        'tecnicos': tecnicos,
        'equipos': equipos,
        'total_tecnicos': len(tecnicos),
        'total_equipos': len(equipos)
    })

@tv_bp.route('/api/tv/<int:region_id>/credenciales')
def api_tv_credenciales(region_id):
    region = db.session.get(Region, region_id)
    if not region:
        return jsonify({'error': 'Región no encontrada'}), 404

    bitacora = _obtener_bitacora_region(region_id)
    if not bitacora:
        return jsonify({
            'region': region.to_dict(),
            'credenciales': [],
            'servidor_hora': datetime.now(timezone.utc).strftime('%H:%M:%S')
        })

    # Filtrar tareas de credenciales especiales
    tareas = Tarea.query.filter(
        Tarea.bitacora_id == bitacora.id,
        Tarea.tipo_tarea == 'alta_credencial_especial'
    ).order_by(Tarea.id.desc()).all()

    credenciales = []
    ahora = datetime.utcnow()

    for t in tareas:
        campos = t.campos_extra or {}
        ticket_cli = campos.get('ticket_cliente', t.ticket)
        inicio = t.fecha_programada_inicio
        fin = t.fecha_programada_fin

        # Evaluar vigencia en tiempo real
        if inicio and fin:
            if inicio <= ahora <= fin:
                estado_vigencia = 'vigente'
            elif ahora < inicio:
                estado_vigencia = 'programada'
            else:
                estado_vigencia = 'finalizada'
        else:
            estado_vigencia = 'vigente' if t.estado in ['en_progreso', 'completada'] else 'programada'

        # Formato de horarios
        hora_ini_str = inicio.strftime('%H:%M') if inicio else '--:--'
        hora_fin_str = fin.strftime('%H:%M') if fin else '--:--'
        fecha_str = inicio.strftime('%d/%m/%Y') if inicio else str(bitacora.fecha)

        lista_creds = campos.get('credenciales_lista', [])
        if not lista_creds and campos.get('persona_propietaria'):
            lista_creds = [{
                'persona_propietaria': campos.get('persona_propietaria'),
                'codigo_alfanumerico': campos.get('codigo_alfanumerico', '---')
            }]

        for cred in lista_creds:
            credenciales.append({
                'tarea_id': t.id,
                'ticket': t.ticket,
                'cliente': t.cliente,
                'ticket_cliente': ticket_cli,
                'persona_propietaria': cred.get('persona_propietaria', 'Sin Nombre'),
                'codigo_alfanumerico': cred.get('codigo_alfanumerico', 'N/A'),
                'fecha': fecha_str,
                'hora_inicio': hora_ini_str,
                'hora_fin': hora_fin_str,
                'estado_vigencia': estado_vigencia,
                'estado_tarea': t.estado
            })

    # Ordenar: primero las vigentes ahora, luego programadas, al final finalizadas
    prioridad = {'vigente': 1, 'programada': 2, 'finalizada': 3}
    credenciales.sort(key=lambda c: prioridad.get(c['estado_vigencia'], 4))

    return jsonify({
        'region': region.to_dict(),
        'turno': bitacora.turno.upper() if bitacora else 'CENTRAL',
        'fecha': str(bitacora.fecha) if bitacora else str(date.today()),
        'servidor_hora': datetime.now(timezone.utc).strftime('%H:%M:%S'),
        'credenciales': credenciales,
        'total_activas': sum(1 for c in credenciales if c['estado_vigencia'] == 'vigente'),
        'total_credenciales': len(credenciales)
    })

@tv_bp.route('/api/tv/<int:region_id>/planificadas')
def api_tv_planificadas(region_id):
    region = db.session.get(Region, region_id)
    if not region:
        return jsonify({'error': 'Región no encontrada'}), 404

    bitacora = _obtener_bitacora_region(region_id)
    if not bitacora:
        return jsonify({
            'region': region.to_dict(),
            'planificadas': [],
            'servidor_hora': datetime.now(timezone.utc).strftime('%H:%M:%S')
        })

    # Filtrar todas las actividades programadas de la bitácora
    tareas = Tarea.query.filter(
        Tarea.bitacora_id == bitacora.id,
        db.or_(
            Tarea.es_actividad_programada == True,
            Tarea.tipo_tarea == 'mantenimiento'
        )
    ).all()

    ahora = datetime.utcnow()
    planificadas = []

    for t in tareas:
        inicio = t.fecha_programada_inicio or t.created_at
        fin = t.fecha_programada_fin
        campos = t.campos_extra or {}

        # Determinar sitio / sala
        sitio = campos.get('sitio_mantenimiento') or campos.get('sala_datacenter') or 'Datacenter General'

        # Determinar estado cronológico
        if fin and ahora > fin:
            estado_tiempo = 'pasada'
        elif inicio and ahora >= inicio:
            estado_tiempo = 'en_curso'
        else:
            estado_tiempo = 'proxima'

        hora_inicio_str = inicio.strftime('%H:%M') if inicio else '--:--'
        hora_fin_str = fin.strftime('%H:%M') if fin else '--:--'

        planificadas.append({
            'id': t.id,
            'ticket': t.ticket,
            'cliente': t.cliente,
            'titulo': t.titulo,
            'descripcion': t.descripcion,
            'tipo_tarea': t.tipo_tarea,
            'tipo_label': t.tipo_tarea.replace('_', ' ').upper(),
            'sitio': sitio,
            'hora_inicio': hora_inicio_str,
            'hora_fin': hora_fin_str,
            'estado': t.estado,
            'estado_tiempo': estado_tiempo,
            'timestamp_inicio': inicio.timestamp() if inicio else 0
        })

    # Ordenar cronológicamente por hora de inicio
    planificadas.sort(key=lambda p: p['timestamp_inicio'])

    return jsonify({
        'region': region.to_dict(),
        'turno': bitacora.turno.upper() if bitacora else 'CENTRAL',
        'fecha': str(bitacora.fecha) if bitacora else str(date.today()),
        'servidor_hora': datetime.now(timezone.utc).strftime('%H:%M:%S'),
        'planificadas': planificadas,
        'total_planificadas': len(planificadas),
        'en_curso_count': sum(1 for p in planificadas if p['estado_tiempo'] == 'en_curso')
    })
