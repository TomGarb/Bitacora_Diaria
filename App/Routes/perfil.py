from flask import Blueprint, render_template, jsonify
from App.extensions import db
from App.auth import login_required, get_current_user
from App.Models.usuario import Usuario
from App.Models.region import Region

perfil_bp = Blueprint('perfil', __name__)

@perfil_bp.route('/perfil')
@login_required
def index():
    user = get_current_user()
    region = db.session.get(Region, user.region_id) if user.region_id else None
    return render_template('perfil.html', user=user, region=region)

@perfil_bp.route('/api/perfil/equipo', methods=['GET'])
@login_required
def obtener_equipo():
    user = get_current_user()
    region_id = user.region_id

    if not region_id:
        # Si el usuario no tiene región fija
        return jsonify({
            'usuario': user.to_dict(),
            'region': None,
            'supervisores': [],
            'companeros': []
        })

    region = db.session.get(Region, region_id)

    # 1. Supervisores de la sede (rol == 'sub_admin')
    supervisores = Usuario.query.filter_by(
        region_id=region_id,
        rol='sub_admin',
        activo=True
    ).order_by(Usuario.nombre_completo.asc()).all()

    # 2. Compañeros operadores de la misma sede (rol == 'operador', excluyendo al propio usuario si se desea o marcándolo)
    companeros = Usuario.query.filter(
        Usuario.region_id == region_id,
        Usuario.rol == 'operador',
        Usuario.activo == True,
        Usuario.id != user.id
    ).order_by(Usuario.nombre_completo.asc()).all()

    return jsonify({
        'usuario': user.to_dict(),
        'region': region.to_dict() if region else None,
        'supervisores': [s.to_dict() for s in supervisores],
        'companeros': [c.to_dict() for c in companeros]
    })
