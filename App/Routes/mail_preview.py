from datetime import date, datetime
from flask import Blueprint, render_template, request, jsonify
from App.extensions import db
from App.auth import login_required, get_current_user
from App.Models.bitacora import Bitacora
from App.Models.tarea import Tarea
from App.Models.region import Region

mail_preview_bp = Blueprint('mail_preview', __name__)

@mail_preview_bp.route('/mail-preview')
@login_required
def index():
    user = get_current_user()
    region_id = user.region_id
    if not region_id:
        primera = Region.query.filter_by(activa=True).first()
        region_id = primera.id if primera else 1

    region = db.session.get(Region, region_id)
    config = region.config if region else None

    # Obtener bitácora activa o seleccionada
    bitacora_id = request.args.get('bitacora_id', type=int)
    if bitacora_id:
        bitacora = db.session.get(Bitacora, bitacora_id)
    else:
        bitacora = Bitacora.query.filter_by(region_id=region_id, fecha=date.today()).order_by(Bitacora.id.desc()).first()
        if not bitacora:
            bitacora = Bitacora.query.filter_by(region_id=region_id).order_by(Bitacora.id.desc()).first()

    return render_template(
        'mail_preview.html',
        user=user,
        region=region,
        config=config,
        bitacora=bitacora
    )

@mail_preview_bp.route('/api/mail-preview/data')
@login_required
def get_mail_data():
    user = get_current_user()
    bitacora_id = request.args.get('bitacora_id', type=int)

    if not bitacora_id:
        # Bitácora de hoy
        bitacora = Bitacora.query.filter_by(region_id=user.region_id or 1, fecha=date.today()).order_by(Bitacora.id.desc()).first()
        if not bitacora:
            bitacora = Bitacora.query.filter_by(region_id=user.region_id or 1).order_by(Bitacora.id.desc()).first()
    else:
        bitacora = db.get_or_404(Bitacora, bitacora_id)

    if not bitacora:
        return jsonify({
            'bitacora': None,
            'tareas': [],
            'mensaje': 'No hay bitácora disponible para generar el resumen.'
        })

    # Regla de visibilidad estricta:
    # El operador solo debe ver sus propios casos cargados,
    # EXCEPTO cuando se trate de actividades programadas (es_actividad_programada == True), donde debe ver todos.
    # Los supervisores y admins pueden ver todos si lo desean.
    
    query = Tarea.query.filter(Tarea.bitacora_id == bitacora.id)
    
    if user.rol == 'operador':
        query = query.filter(
            db.or_(
                Tarea.operador_id == user.id,
                Tarea.es_actividad_programada == True
            )
        )

    tareas = query.order_by(Tarea.es_actividad_programada.desc(), Tarea.id.asc()).all()
    tareas_dict = [t.to_dict(include_subtareas=True) for t in tareas]

    # Estadísticas para el resumen del email
    total = len(tareas_dict)
    completadas = sum(1 for t in tareas_dict if t['estado'] == 'completada')
    pendientes = sum(1 for t in tareas_dict if t['estado'] == 'pendiente')
    en_progreso = sum(1 for t in tareas_dict if t['estado'] == 'en_progreso')
    programadas = sum(1 for t in tareas_dict if t['es_actividad_programada'])

    return jsonify({
        'bitacora': bitacora.to_dict(),
        'region_nombre': bitacora.region.nombre if bitacora.region else 'N/A',
        'destinatarios_sugeridos': f'doc-{bitacora.region.codigo.lower() if bitacora.region else "ops"}@datacenter.corp',
        'asunto': f"[DOC BITACORA] Resumen de Turno {bitacora.turno.upper()} - {bitacora.fecha} ({bitacora.region.nombre if bitacora.region else ''})",
        'estadisticas': {
            'total': total,
            'completadas': completadas,
            'pendientes': pendientes,
            'en_progreso': en_progreso,
            'programadas': programadas
        },
        'tareas': tareas_dict,
        'generado_por': user.nombre_completo,
        'generado_en': datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC'),
        'es_vista_operador': (user.rol == 'operador')
    })
