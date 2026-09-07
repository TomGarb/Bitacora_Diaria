from flask import Blueprint, render_template, jsonify
from App.extensions import db
from App.auth import login_required, get_current_user
from App.Models.usuario import Usuario
from App.Models.region import Region
from App.Models.tarea import Tarea

perfil_bp = Blueprint('perfil', __name__)

TIPOS_CASOS_NORMALES = ['manos_remotas', 'manos_inteligentes', 'virtualizacion', 'restore', 'backup', 'snapshot', 'incidente']

@perfil_bp.route('/perfil')
@login_required
def index():
    user = get_current_user()
    region = db.session.get(Region, user.region_id) if user.region_id else None
    
    # Calcular total de casos normales (solamente los normales no planificados)
    total_casos_normales = Tarea.query.filter(
        Tarea.operador_id == user.id,
        Tarea.tipo_tarea.in_(TIPOS_CASOS_NORMALES),
        Tarea.es_actividad_programada == False
    ).count()

    return render_template(
        'perfil.html',
        user=user,
        region=region,
        total_casos_normales=total_casos_normales
    )

@perfil_bp.route('/api/perfil/equipo', methods=['GET'])
@login_required
def obtener_equipo():
    user = get_current_user()
    region_id = user.region_id

    # 1. Total de casos normales (solamente los normales no planificados)
    total_casos_normales = Tarea.query.filter(
        Tarea.operador_id == user.id,
        Tarea.tipo_tarea.in_(TIPOS_CASOS_NORMALES),
        Tarea.es_actividad_programada == False
    ).count()

    if not region_id:
        return jsonify({
            'usuario': user.to_dict(),
            'sitio': 'Global / Todas las Sedes',
            'sitio_codigo': 'ALL',
            'total_casos_normales': total_casos_normales,
            'region': None,
            'supervisores': [],
            'companeros_sitio': [],
            'companeros': [],
            'mis_equipos': []
        })

    region = db.session.get(Region, region_id)

    # 2. Supervisores de la sede (rol == 'sub_admin')
    supervisores = Usuario.query.filter_by(
        region_id=region_id,
        rol='sub_admin',
        activo=True
    ).order_by(Usuario.nombre_completo.asc()).all()

    # 3. Compañeros operadores de la misma sede (rol == 'operador', excluyendo al usuario actual)
    companeros_sitio = Usuario.query.filter(
        Usuario.region_id == region_id,
        Usuario.rol == 'operador',
        Usuario.activo == True,
        Usuario.id != user.id
    ).order_by(Usuario.nombre_completo.asc()).all()

    # 4. Equipos / Grupos de trabajo a los que pertenece el usuario actual con compañeros específicos
    mis_equipos = []
    for eq in user.equipos.filter_by(activo=True):
        companeros_del_equipo = [
            m.to_dict() for m in eq.miembros.filter(Usuario.id != user.id, Usuario.activo == True).order_by(Usuario.nombre_completo.asc())
        ]
        mis_equipos.append({
            'id': eq.id,
            'nombre': eq.nombre,
            'descripcion': eq.descripcion,
            'total_miembros': eq.miembros.filter_by(activo=True).count(),
            'companeros_equipo': companeros_del_equipo
        })

    return jsonify({
        'usuario': user.to_dict(),
        'sitio': region.nombre if region else 'Global',
        'sitio_codigo': region.codigo if region else 'DOC',
        'total_casos_normales': total_casos_normales,
        'region': region.to_dict() if region else None,
        'mis_equipos': mis_equipos,
        'supervisores': [s.to_dict() for s in supervisores],
        'companeros_sitio': [c.to_dict() for c in companeros_sitio],
        'companeros': [c.to_dict() for c in companeros_sitio] # Retrocompatibilidad
    })

