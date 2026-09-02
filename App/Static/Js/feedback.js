/**
 * Feedback JS - Envío, visualización y resolución de reportes de error o sugerencias
 */

let currentFeedbacks = [];

document.addEventListener('DOMContentLoaded', () => {
  cargarFeedbacks();
  setupEventListeners();
});

function setupEventListeners() {
  document.getElementById('form-nuevo-feedback')?.addEventListener('submit', enviarFeedback);
  document.getElementById('form-responder-feedback')?.addEventListener('submit', guardarRespuestaFeedback);
  
  document.getElementById('filter-fb-tipo')?.addEventListener('change', cargarFeedbacks);
  document.getElementById('filter-fb-estado')?.addEventListener('change', cargarFeedbacks);
}

async function cargarFeedbacks() {
  const container = document.getElementById('feedbacks-container');
  if (!container) return;

  const tipo = document.getElementById('filter-fb-tipo')?.value || '';
  const estado = document.getElementById('filter-fb-estado')?.value || '';
  const params = new URLSearchParams({ tipo, estado });

  try {
    container.innerHTML = '<div style="color:var(--text-muted); text-align:center; padding:1.5rem;">Cargando reportes...</div>';
    const feedbacks = await fetchAPI(`/api/feedbacks?${params.toString()}`);
    currentFeedbacks = feedbacks;

    if (!feedbacks || feedbacks.length === 0) {
      container.innerHTML = '<div style="color:var(--text-muted); text-align:center; padding:2rem;">No hay reportes de feedback registrados con los filtros seleccionados.</div>';
      return;
    }

    container.innerHTML = '';
    const esSupervisorOAdmin = document.getElementById('es-supervisor-holder')?.value === 'true';

    feedbacks.forEach(fb => {
      const card = document.createElement('div');
      card.className = 'feedback-card';

      const tipoLabel = fb.tipo.replace(/_/g, ' ').toUpperCase();
      let respuestaHtml = '';
      if (fb.respuesta_admin) {
        respuestaHtml = `
          <div class="feedback-response-box">
            <strong style="color:var(--success); font-size:0.8rem;"><i class="bi bi-reply-fill"></i> Respuesta de Supervisión / Admin:</strong>
            <div style="font-size:0.85rem; margin-top:2px; color:var(--text-primary);">${fb.respuesta_admin}</div>
          </div>
        `;
      }

      let btnGestionar = '';
      if (esSupervisorOAdmin) {
        btnGestionar = `
          <button class="btn btn-secondary btn-sm" onclick="abrirModalResponderFeedback(${fb.id})" style="font-size:0.75rem; padding:0.25rem 0.6rem;">
            <i class="bi bi-pencil-square"></i> Gestionar / Responder
          </button>
        `;
      }

      card.innerHTML = `
        <div class="feedback-header">
          <div>
            <div class="feedback-title">${fb.asunto}</div>
            <div class="feedback-meta">
              <span><i class="bi bi-person"></i> ${fb.usuario_nombre} (${fb.usuario_rol})</span>
              <span><i class="bi bi-geo-alt"></i> ${fb.region_nombre}</span>
              <span><i class="bi bi-calendar"></i> ${fb.created_at || ''}</span>
            </div>
          </div>
          <div style="display:flex; flex-direction:column; align-items:flex-end; gap:0.4rem;">
            <div style="display:flex; gap:0.4rem;">
              <span class="badge fb-badge-${fb.tipo}">${tipoLabel}</span>
              <span class="badge badge-${fb.estado}">${fb.estado.replace('_', ' ').toUpperCase()}</span>
            </div>
            ${btnGestionar}
          </div>
        </div>
        <div class="feedback-body">${fb.mensaje}</div>
        ${respuestaHtml}
      `;
      container.appendChild(card);
    });

  } catch (error) {
    container.innerHTML = '<div style="color:var(--danger); text-align:center; padding:1.5rem;">Error al cargar los reportes de feedback.</div>';
  }
}

async function enviarFeedback(e) {
  e.preventDefault();

  const tipo = document.getElementById('fb-tipo').value;
  const asunto = document.getElementById('fb-asunto').value.trim();
  const mensaje = document.getElementById('fb-mensaje').value.trim();

  if (!asunto || !mensaje) {
    showToast('El asunto y la descripción son obligatorios', 'warning');
    return;
  }

  try {
    const res = await fetchAPI('/api/feedbacks', {
      method: 'POST',
      body: JSON.stringify({ tipo, asunto, mensaje })
    });

    if (res && res.success) {
      showToast(res.message, 'success');
      document.getElementById('form-nuevo-feedback').reset();
      closeModal('modal-nuevo-feedback');
      await cargarFeedbacks();
    }
  } catch (error) {
    console.error(error);
  }
}

function abrirModalNuevoFeedback() {
  document.getElementById('form-nuevo-feedback').reset();
  openModal('modal-nuevo-feedback');
}

function abrirModalResponderFeedback(id) {
  const fb = currentFeedbacks.find(f => f.id === id);
  if (!fb) return;

  document.getElementById('resp-fb-id').value = fb.id;
  document.getElementById('resp-fb-titulo').textContent = fb.asunto;
  document.getElementById('resp-fb-usuario').textContent = `${fb.usuario_nombre} (${fb.region_nombre})`;
  document.getElementById('resp-fb-mensaje').textContent = fb.mensaje;
  document.getElementById('resp-fb-estado').value = fb.estado;
  document.getElementById('resp-fb-texto').value = fb.respuesta_admin || '';

  openModal('modal-responder-feedback');
}

async function guardarRespuestaFeedback(e) {
  e.preventDefault();

  const id = document.getElementById('resp-fb-id').value;
  const estado = document.getElementById('resp-fb-estado').value;
  const respuesta = document.getElementById('resp-fb-texto').value.trim();

  try {
    const res = await fetchAPI(`/api/feedbacks/${id}/responder`, {
      method: 'PUT',
      body: JSON.stringify({ estado, respuesta_admin: respuesta })
    });

    if (res && res.success) {
      showToast('Respuesta guardada exitosamente', 'success');
      closeModal('modal-responder-feedback');
      await cargarFeedbacks();
    }
  } catch (error) {
    console.error(error);
  }
}
