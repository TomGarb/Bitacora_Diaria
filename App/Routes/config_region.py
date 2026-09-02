from flask import Blueprint, render_template, request, jsonify, flash, redirect, url_for
from datetime import datetime
from App.extensions import db
from App.auth import login_required, sub_admin_required, get_current_user
from App.Models.region import Region
from App.Models.region_config import RegionConfig, TIPOS_TAREA_DEFAULT, CAMPOS_EXTRA_DEFAULT, TURNOS_DEFAULT

config_region_bp = Blueprint('config_region', __name__)

@config_region_bp.route('/config')
@login_required
@sub_admin_required
def index():
    user = get_current_user()
    region_id = user.region_id
    if not region_id:
        primera = Region.query.filter_by(activa=True).first()
        region_id = primera.id if primera else 1

    region = db.get_or_404(Region, region_id)
    regiones_disponibles = Region.query.filter_by(activa=True).all() if user.is_admin() else [region]
    
    config = region.config
    if not config:
        config = RegionConfig(
            region_id=region.id,
            tipos_tarea_habilitados=[t["id"] for t in TIPOS_TAREA_DEFAULT],
            campos_extra=CAMPOS_EXTRA_DEFAULT,
            turnos_config=TURNOS_DEFAULT
        )
        db.session.add(config)
        db.session.commit()

    return render_template(
        'config_region.html',
        user=user,
        region=region,
        regiones=regiones_disponibles,
        config=config,
        catalogo_tipos=TIPOS_TAREA_DEFAULT
    )

@config_region_bp.route('/api/config/<int:region_id>', methods=['GET'])
@login_required
def obtener_config(region_id):
    region = db.get_or_404(Region, region_id)
    config = region.config
    if not config:
        config = RegionConfig(
            region_id=region.id,
            tipos_tarea_habilitados=[t["id"] for t in TIPOS_TAREA_DEFAULT],
            campos_extra=CAMPOS_EXTRA_DEFAULT,
            turnos_config=TURNOS_DEFAULT
        )
        db.session.add(config)
        db.session.commit()

    return jsonify({
        'region': {
            'id': region.id,
            'nombre': region.nombre,
            'codigo': region.codigo
        },
        'config': config.to_dict()
    })

@config_region_bp.route('/api/config/<int:region_id>', methods=['PUT'])
@login_required
@sub_admin_required
def guardar_config(region_id):
    user = get_current_user()
    if not user.is_admin() and user.region_id != region_id:
        return jsonify({'error': 'No tiene permisos para modificar la configuración de otra región'}), 403

    region = db.get_or_404(Region, region_id)
    config = region.config
    if not config:
        config = RegionConfig(region_id=region.id)
        db.session.add(config)

    data = request.get_json() or {}

    if 'tipos_tarea_habilitados' in data:
        # Asegurarse de que sea una lista de strings
        config.tipos_tarea_habilitados = list(data['tipos_tarea_habilitados'])

    if 'campos_extra' in data:
        config.campos_extra = dict(data['campos_extra'])

    if 'turnos_config' in data:
        config.turnos_config = list(data['turnos_config'])

    if 'config_ui' in data:
        current_ui = dict(config.config_ui or {})
        current_ui.update(data['config_ui'])
        config.config_ui = current_ui

    config.updated_at = datetime.utcnow()
    db.session.commit()

    return jsonify({
        'success': True,
        'message': f'Configuración de la región "{region.nombre}" actualizada en caliente con éxito.',
        'config': config.to_dict()
    })
