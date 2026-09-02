from flask import Blueprint, request, jsonify
from datetime import datetime
from App.extensions import db
from App.auth import login_required, get_current_user
from App.Models.tarea import Tarea
from App.Models.subtarea import Subtarea

subtareas_bp = Blueprint('subtareas', __name__)

@subtareas_bp.route('/api/tareas/<int:tarea_id>/subtareas', methods=['POST'])
@login_required
def crear_subtarea(tarea_id):
    tarea = db.get_or_404(Tarea, tarea_id)
    data = request.get_json() or {}

    ticket = data.get('ticket', '').strip()
    titulo = data.get('titulo', '').strip()
    estado = data.get('estado', 'pendiente')
    descripcion = data.get('descripcion', '').strip()

    if not ticket or not titulo:
        return jsonify({'error': 'Ticket y Título son requeridos para la subtarea'}), 400

    subtarea = Subtarea(
        tarea_id=tarea.id,
        ticket=ticket,
        titulo=titulo,
        estado=estado,
        descripcion=descripcion
    )
    db.session.add(subtarea)
    db.session.commit()

    return jsonify({
        'success': True,
        'message': 'Subtarea creada exitosamente',
        'subtarea': subtarea.to_dict()
    }), 201

@subtareas_bp.route('/api/subtareas/<int:subtarea_id>', methods=['PUT'])
@login_required
def actualizar_subtarea(subtarea_id):
    subtarea = db.get_or_404(Subtarea, subtarea_id)
    data = request.get_json() or {}

    if 'ticket' in data: subtarea.ticket = data['ticket'].strip()
    if 'titulo' in data: subtarea.titulo = data['titulo'].strip()
    if 'estado' in data: subtarea.estado = data['estado']
    if 'descripcion' in data: subtarea.descripcion = data['descripcion'].strip()

    subtarea.updated_at = datetime.utcnow()
    db.session.commit()

    return jsonify({
        'success': True,
        'message': 'Subtarea actualizada correctamente',
        'subtarea': subtarea.to_dict()
    })

@subtareas_bp.route('/api/subtareas/<int:subtarea_id>', methods=['DELETE'])
@login_required
def eliminar_subtarea(subtarea_id):
    subtarea = db.get_or_404(Subtarea, subtarea_id)
    db.session.delete(subtarea)
    db.session.commit()
    return jsonify({'success': True, 'message': 'Subtarea eliminada correctamente'})
