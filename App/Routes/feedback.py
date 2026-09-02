from flask import Blueprint, render_template, request, jsonify
from datetime import datetime
from App.extensions import db
from App.auth import login_required, get_current_user, sub_admin_required
from App.Models.feedback import Feedback, TIPOS_FEEDBACK, ESTADOS_FEEDBACK
from App.Models.region import Region

feedback_bp = Blueprint('feedback', __name__)

@feedback_bp.route('/feedback')
@login_required
def index():
    user = get_current_user()
    region = db.session.get(Region, user.region_id) if user.region_id else None
    return render_template(
        'feedback.html',
        user=user,
        region=region,
        tipos=TIPOS_FEEDBACK,
        estados=ESTADOS_FEEDBACK
    )

@feedback_bp.route('/api/feedbacks', methods=['GET'])
@login_required
def listar_feedbacks():
    user = get_current_user()
    tipo = request.args.get('tipo')
    estado = request.args.get('estado')

    query = Feedback.query

    # Regla de acceso a feedbacks:
    # Operador: ve solo los reportes creados por él
    # Sub-admin: ve todos los reportes de su región
    # Admin: ve reportes de todas las regiones
    if user.rol == 'operador':
        query = query.filter(Feedback.usuario_id == user.id)
    elif user.rol == 'sub_admin' and user.region_id:
        query = query.filter(Feedback.region_id == user.region_id)

    if tipo:
        query = query.filter(Feedback.tipo == tipo)
    if estado:
        query = query.filter(Feedback.estado == estado)

    feedbacks = query.order_by(Feedback.id.desc()).all()
    return jsonify([f.to_dict() for f in feedbacks])

@feedback_bp.route('/api/feedbacks', methods=['POST'])
@login_required
def crear_feedback():
    user = get_current_user()
    data = request.get_json() or {}

    asunto = data.get('asunto', '').strip()
    mensaje = data.get('mensaje', '').strip()
    tipo = data.get('tipo', 'error_sistema')

    if not asunto or not mensaje:
        return jsonify({'error': 'El asunto y la descripción detallada son obligatorios'}), 400

    nuevo = Feedback(
        usuario_id=user.id,
        region_id=user.region_id,
        tipo=tipo,
        asunto=asunto,
        mensaje=mensaje,
        estado='pendiente'
    )

    db.session.add(nuevo)
    db.session.commit()

    return jsonify({
        'success': True,
        'message': 'Reporte de feedback enviado exitosamente. Será revisado por los supervisores.',
        'feedback': nuevo.to_dict()
    }), 201

@feedback_bp.route('/api/feedbacks/<int:feedback_id>/responder', methods=['PUT'])
@login_required
@sub_admin_required
def responder_feedback(feedback_id):
    fb = db.get_or_404(Feedback, feedback_id)
    user = get_current_user()

    # Si es sub_admin verificar que sea de su región
    if not user.is_admin() and fb.region_id != user.region_id:
        return jsonify({'error': 'No tiene permisos para gestionar reportes de otra región'}), 403

    data = request.get_json() or {}
    
    if 'estado' in data:
        fb.estado = data['estado']
    if 'respuesta_admin' in data:
        fb.respuesta_admin = data['respuesta_admin'].strip()

    fb.updated_at = datetime.utcnow()
    db.session.commit()

    return jsonify({
        'success': True,
        'message': 'Estado y respuesta del reporte actualizados.',
        'feedback': fb.to_dict()
    })
