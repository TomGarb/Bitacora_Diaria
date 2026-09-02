from datetime import date, datetime
from flask import Blueprint, render_template, jsonify, session, request
from sqlalchemy import func
from App.extensions import db
from App.auth import login_required, get_current_user
from App.Models.bitacora import Bitacora
from App.Models.tarea import Tarea
from App.Models.subtarea import Subtarea
from App.Models.region import Region
from App.Models.region_config import RegionConfig

dashboard_bp = Blueprint('dashboard', __name__)

@dashboard_bp.route('/')
@dashboard_bp.route('/dashboard')
@login_required
def index():
    user = get_current_user()
    region_id = user.region_id
    
    # Si el usuario no tiene región asignada (ej: Admin global), tomar la primera región activa
    if not region_id:
        primera_region = Region.query.filter_by(activa=True).first()
        region_id = primera_region.id if primera_region else 1

    region = db.session.get(Region, region_id)
    config = region.config if region else None
    
    # Obtener bitácora activa de hoy (o la más reciente)
    bitacora_actual = Bitacora.query.filter_by(
        region_id=region_id,
        fecha=date.today(),
        estado='abierta'
    ).order_by(Bitacora.id.desc()).first()

    if not bitacora_actual:
        # Buscar la última bitácora registrada de la región
        bitacora_actual = Bitacora.query.filter_by(
            region_id=region_id
        ).order_by(Bitacora.id.desc()).first()

    return render_template(
        'dashboard.html',
        user=user,
        region=region,
        config=config,
        bitacora_actual=bitacora_actual
    )

@dashboard_bp.route('/api/dashboard/stats')
@login_required
def get_stats():
    user = get_current_user()
    region_id = request.args.get('region_id', type=int) or user.region_id
    
    if not region_id:
        primera = Region.query.filter_by(activa=True).first()
        region_id = primera.id if primera else 1

    # Obtener bitácora activa o más reciente
    bitacora = Bitacora.query.filter_by(
        region_id=region_id,
        fecha=date.today(),
        estado='abierta'
    ).order_by(Bitacora.id.desc()).first()

    if not bitacora:
        bitacora = Bitacora.query.filter_by(region_id=region_id).order_by(Bitacora.id.desc()).first()

    if not bitacora:
        return jsonify({
            'bitacora': None,
            'kpis': {
                'total_tareas': 0,
                'pendientes': 0,
                'en_progreso': 0,
                'completadas': 0,
                'canceladas': 0,
                'programadas': 0,
                'mis_tareas': 0
            },
            'distribucion_tipos': {},
            'ultimas_tareas': []
        })

    # Consultar tareas de la bitácora
    tareas_query = Tarea.query.filter_by(bitacora_id=bitacora.id)
    
    total_tareas = tareas_query.count()
    pendientes = tareas_query.filter_by(estado='pendiente').count()
    en_progreso = tareas_query.filter_by(estado='en_progreso').count()
    completadas = tareas_query.filter_by(estado='completada').count()
    canceladas = tareas_query.filter_by(estado='cancelada').count()
    programadas = tareas_query.filter_by(es_actividad_programada=True).count()
    mis_tareas = tareas_query.filter_by(operador_id=user.id).count()

    # Distribución por tipo de tarea
    tipos_counts = db.session.query(
        Tarea.tipo_tarea,
        func.count(Tarea.id)
    ).filter(Tarea.bitacora_id == bitacora.id).group_by(Tarea.tipo_tarea).all()

    distribucion_tipos = {tipo: count for tipo, count in tipos_counts}

    # Últimas 6 tareas recientes
    ultimas_tareas = [t.to_dict() for t in tareas_query.order_by(Tarea.id.desc()).limit(6).all()]

    return jsonify({
        'bitacora': bitacora.to_dict(),
        'kpis': {
            'total_tareas': total_tareas,
            'pendientes': pendientes,
            'en_progreso': en_progreso,
            'completadas': completadas,
            'canceladas': canceladas,
            'programadas': programadas,
            'mis_tareas': mis_tareas
        },
        'distribucion_tipos': distribucion_tipos,
        'ultimas_tareas': ultimas_tareas
    })
