import io
import csv
from datetime import datetime, date
from flask import Blueprint, render_template, request, jsonify, Response
from App.extensions import db
from App.auth import login_required, get_current_user
from App.Models.tarea import Tarea, ESTADOS_TAREA
from App.Models.bitacora import Bitacora
from App.Models.region import Region
from App.Models.region_config import RegionConfig, TIPOS_TAREA_DEFAULT

historico_bp = Blueprint('historico', __name__)

CATEGORIAS_MAPPING = {
    'normal': ['manos_remotas', 'manos_inteligentes', 'virtualizacion', 'restore', 'backup', 'snapshot', 'incidente'],
    'personal': ['acceso_tecnicos'],
    'equipamiento': ['acceso_equipos', 'retiro_equipos'],
    'mantenimientos': ['mantenimiento'],
    'credenciales': ['alta_credencial_especial'],
    'externos': ['manejo_sitio_externo'],
    'notas': ['nota_de_turno'],
    'extras': ['tarea_extra']
}

@historico_bp.route('/historico')
@login_required
def index():
    user = get_current_user()
    region_id = user.region_id
    if not region_id:
        primera = Region.query.filter_by(activa=True).first()
        region_id = primera.id if primera else 1

    region = db.session.get(Region, region_id)
    
    if user.rol == 'admin':
        regiones = Region.query.filter_by(activa=True).all()
    else:
        regiones = [region] if region else []

    return render_template(
        'historico.html',
        user=user,
        region=region,
        regiones=regiones,
        estados=ESTADOS_TAREA
    )

@historico_bp.route('/api/historico', methods=['GET'])
@login_required
def listar_historico():
    user = get_current_user()
    
    # Parámetros de filtrado
    fecha_desde = request.args.get('fecha_desde', '').strip()
    fecha_hasta = request.args.get('fecha_hasta', '').strip()
    region_id = request.args.get('region_id', type=int)
    estado = request.args.get('estado', '').strip()
    tipo_tarea = request.args.get('tipo_tarea', '').strip()
    categoria = request.args.get('categoria', '').strip()
    search = request.args.get('q', '').strip()
    export_csv = request.args.get('export', '').lower() == 'csv'

    query = Tarea.query.join(Bitacora).join(Region)

    # Aislamiento regional según permisos
    if user.rol == 'admin':
        if region_id:
            query = query.filter(Bitacora.region_id == region_id)
    else:
        # Sub-admins y operadores solo ven su región asignada
        query = query.filter(Bitacora.region_id == user.region_id)

    # Filtros de fecha
    if fecha_desde:
        try:
            f_desde = datetime.strptime(fecha_desde, '%Y-%m-%d').date()
            query = query.filter(Bitacora.fecha >= f_desde)
        except ValueError:
            pass

    if fecha_hasta:
        try:
            f_hasta = datetime.strptime(fecha_hasta, '%Y-%m-%d').date()
            query = query.filter(Bitacora.fecha <= f_hasta)
        except ValueError:
            pass

    # Filtro por estado
    if estado:
        query = query.filter(Tarea.estado == estado)

    # Filtro por tipo específico
    if tipo_tarea:
        query = query.filter(Tarea.tipo_tarea == tipo_tarea)

    # Filtro por una de las 8 categorías temáticas
    if categoria and categoria in CATEGORIAS_MAPPING:
        tipos_en_cat = CATEGORIAS_MAPPING[categoria]
        query = query.filter(Tarea.tipo_tarea.in_(tipos_en_cat))

    # Búsqueda libre
    if search:
        search_pat = f"%{search}%"
        query = query.filter(
            db.or_(
                Tarea.ticket.ilike(search_pat),
                Tarea.titulo.ilike(search_pat),
                Tarea.cliente.ilike(search_pat),
                Tarea.descripcion.ilike(search_pat)
            )
        )

    # Orden cronológico descendente
    tareas = query.order_by(Bitacora.fecha.desc(), Tarea.id.desc()).all()

    # Si se solicita exportación en CSV
    if export_csv:
        output = io.StringIO()
        writer = csv.writer(output, delimiter=',', quoting=csv.QUOTE_MINIMAL)
        # Encabezados
        writer.writerow([
            'ID', 'Ticket', 'Fecha Bitacora', 'Turno', 'Sede/Region', 
            'Tipo Tarea', 'Titulo', 'Cliente', 'Estado', 'Operador', 
            'Descripcion', 'Fecha Prog. Inicio', 'Fecha Prog. Fin', 'Creado El'
        ])
        for t in tareas:
            bit = t.bitacora
            reg = bit.region if bit else None
            writer.writerow([
                t.id,
                t.ticket,
                str(bit.fecha) if bit else '',
                bit.turno if bit else '',
                reg.nombre if reg else '',
                t.tipo_tarea,
                t.titulo,
                t.cliente,
                t.estado,
                t.operador.nombre_completo if t.operador else '',
                t.descripcion.replace('\n', ' ') if t.descripcion else '',
                t.fecha_programada_inicio.strftime('%Y-%m-%d %H:%M') if t.fecha_programada_inicio else '',
                t.fecha_programada_fin.strftime('%Y-%m-%d %H:%M') if t.fecha_programada_fin else '',
                t.created_at.strftime('%Y-%m-%d %H:%M:%S') if t.created_at else ''
            ])
        
        filename = f"historico_casos_doc_{date.today().strftime('%Y%m%d')}.csv"
        return Response(
            output.getvalue().encode('utf-8-sig'),
            mimetype="text/csv",
            headers={"Content-Disposition": f"attachment;filename={filename}"}
        )

    # Respuesta JSON enriquecida
    resultado = []
    for t in tareas:
        t_dict = t.to_dict(include_subtareas=True)
        t_dict['bitacora_fecha'] = str(t.bitacora.fecha) if t.bitacora else None
        t_dict['bitacora_turno'] = t.bitacora.turno if t.bitacora else None
        t_dict['bitacora_estado'] = t.bitacora.estado if t.bitacora else None
        t_dict['region_nombre'] = t.bitacora.region.nombre if (t.bitacora and t.bitacora.region) else 'General'
        t_dict['region_codigo'] = t.bitacora.region.codigo if (t.bitacora and t.bitacora.region) else 'DOC'
        resultado.append(t_dict)

    return jsonify(resultado)
