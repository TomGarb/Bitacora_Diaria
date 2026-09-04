from flask import Blueprint, request, jsonify
from datetime import datetime
from App.extensions import db
from App.auth import login_required, get_current_user
from App.Models.tarea import Tarea, ESTADOS_TAREA
from App.Models.subtarea import Subtarea

subtareas_bp = Blueprint('subtareas', __name__)

@subtareas_bp.route('/api/tareas/<int:tarea_id>/subtareas', methods=['POST'])
@subtareas_bp.route('/api/tareas/<int:tarea_id>/actualizaciones', methods=['POST'])
@login_required
def crear_subtarea_o_actualizacion(tarea_id):
    tarea = db.get_or_404(Tarea, tarea_id)
    user = get_current_user()
    data = request.get_json() or {}

    tipo_entrada = data.get('tipo_entrada', 'subtarea')
    # Si fue llamado desde la ruta /actualizaciones, forzar tipo_entrada
    if request.path.endswith('/actualizaciones'):
        tipo_entrada = 'actualizacion'

    descripcion = data.get('descripcion', '').strip()
    if not descripcion:
        return jsonify({'error': 'La descripción o detalle de la entrada es obligatorio'}), 400

    if tipo_entrada == 'actualizacion':
        nuevo_estado = data.get('estado') or data.get('nuevo_estado_tarea')
        titulo = data.get('titulo', '').strip() or 'Nota de Seguimiento'
        
        subtarea = Subtarea(
            tarea_id=tarea.id,
            operador_id=user.id,
            tipo_entrada='actualizacion',
            ticket=None,
            titulo=titulo,
            estado=nuevo_estado or tarea.estado,
            descripcion=descripcion
        )
        db.session.add(subtarea)

        # Actualizar estado de la tarea matriz si se especificó
        if nuevo_estado and nuevo_estado in ESTADOS_TAREA:
            tarea.estado = nuevo_estado
            tarea.updated_at = datetime.utcnow()

        db.session.commit()

        return jsonify({
            'success': True,
            'message': 'Actualización agregada exitosamente',
            'entrada': subtarea.to_dict(),
            'tarea_estado': tarea.estado
        }), 201

    else:
        # Modo Subtarea con Ticket
        ticket = data.get('ticket', '').strip()
        titulo = data.get('titulo', '').strip()
        estado = data.get('estado', 'pendiente')

        if not ticket or not titulo:
            return jsonify({'error': 'Ticket y Título son requeridos para dar de alta una subtarea'}), 400

        subtarea = Subtarea(
            tarea_id=tarea.id,
            operador_id=user.id,
            tipo_entrada='subtarea',
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
            'entrada': subtarea.to_dict()
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
        'message': 'Entrada actualizada correctamente',
        'subtarea': subtarea.to_dict()
    })

@subtareas_bp.route('/api/subtareas/<int:subtarea_id>', methods=['DELETE'])
@login_required
def eliminar_subtarea(subtarea_id):
    subtarea = db.get_or_404(Subtarea, subtarea_id)
    db.session.delete(subtarea)
    db.session.commit()
    return jsonify({'success': True, 'message': 'Entrada eliminada correctamente'})
