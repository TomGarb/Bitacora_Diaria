/**
 * Subtareas JS - Gestión modular de subtareas
 */

// Utilidad para cambiar estado de subtarea rápidamente
async function cambiarEstadoSubtarea(subtareaId, nuevoEstado, callback) {
  try {
    const res = await fetchAPI(`/api/subtareas/${subtareaId}`, {
      method: 'PUT',
      body: JSON.stringify({ estado: nuevoEstado })
    });
    showToast('Estado de subtarea actualizado', 'success');
    if (callback) callback(res.subtarea);
  } catch (error) {
    console.error('Error actualizando subtarea:', error);
  }
}
