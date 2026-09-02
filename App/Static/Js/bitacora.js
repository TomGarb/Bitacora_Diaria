/**
 * Bitacora JS - Gestión de aperturas, cierres de turnos y bitácoras diarias
 */

let closingBitacoraId = null;

document.addEventListener('DOMContentLoaded', () => {
  cargarBitacoras();

  document.getElementById('form-nueva-bitacora')?.addEventListener('submit', guardarNuevaBitacora);
  document.getElementById('form-cerrar-bitacora')?.addEventListener('submit', confirmarCierreBitacora);
  document.getElementById('filter-region')?.addEventListener('change', cargarBitacoras);
  document.getElementById('filter-estado-bitacora')?.addEventListener('change', cargarBitacoras);
});

async function cargarBitacoras() {
  const container = document.getElementById('bitacoras-list-container');
  if (!container) return;

  const regionId = document.getElementById('filter-region')?.value || '';
  const estado = document.getElementById('filter-estado-bitacora')?.value || '';

  const params = new URLSearchParams({
    region_id: regionId,
    estado: estado
  });

  try {
    container.innerHTML = '<div style="text-align:center; padding:2rem; color:var(--text-muted);">Cargando registros...</div>';
    const bitacoras = await fetchAPI(`/api/bitacoras?${params.toString()}`);
    renderBitacoras(bitacoras);
  } catch (error) {
    container.innerHTML = '<div style="text-align:center; padding:2rem; color:var(--danger);">Error cargando bitácoras</div>';
  }
}

function renderBitacoras(bitacoras) {
  const container = document.getElementById('bitacoras-list-container');
  if (!container) return;
  container.innerHTML = '';

  if (bitacoras.length === 0) {
    container.innerHTML = '<div style="text-align:center; padding:2rem; color:var(--text-muted);">No se encontraron bitácoras para los filtros seleccionados.</div>';
    return;
  }

  bitacoras.forEach(b => {
    const card = document.createElement('div');
    card.className = `bitacora-card ${b.estado}`;

    const isAbierta = b.estado === 'abierta';
    const badgeEstado = isAbierta 
      ? '<span class="badge badge-completada"><i class="bi bi-circle-fill"></i> Abierta / En Curso</span>'
      : '<span class="badge" style="background:var(--bg-main); color:var(--text-muted);"><i class="bi bi-lock-fill"></i> Cerrada</span>';

    card.innerHTML = `
      <div>
        <div class="bitacora-title">
          <span>Turno ${b.turno.toUpperCase()}</span>
          ${badgeEstado}
        </div>
        <div class="bitacora-details">
          <div><i class="bi bi-calendar3"></i> <strong>Fecha:</strong> ${b.fecha}</div>
          <div><i class="bi bi-geo-alt"></i> <strong>Región:</strong> ${b.region_nombre || 'N/A'}</div>
          <div><i class="bi bi-stack"></i> <strong>Total Tareas:</strong> ${b.total_tareas}</div>
          ${b.supervisor_nombre ? `<div><i class="bi bi-person-badge"></i> <strong>Supervisor:</strong> ${b.supervisor_nombre}</div>` : ''}
        </div>
        ${b.observaciones_cierre ? `<div style="font-size:0.8rem; color:var(--text-secondary); margin-top:0.5rem; background:rgba(0,0,0,0.2); padding:0.4rem 0.6rem; border-radius:4px;"><strong>Novedades de cierre:</strong> ${b.observaciones_cierre}</div>` : ''}
      </div>

      <div style="display:flex; align-items:center; gap:0.5rem;">
        <a href="/tareas?bitacora_id=${b.id}" class="btn btn-secondary btn-sm">
          <i class="bi bi-list-check"></i> Ver Tareas
        </a>
        <a href="/mail-preview?bitacora_id=${b.id}" class="btn btn-secondary btn-sm" title="Vista Previa Mail">
          <i class="bi bi-envelope-paper"></i> Resumen Mail
        </a>
        ${isAbierta ? `
          <button class="btn btn-danger btn-sm" onclick="solicitarCierreBitacora(${b.id})">
            <i class="bi bi-lock"></i> Cerrar Turno
          </button>
        ` : `
          <button class="btn btn-secondary btn-sm" onclick="reabrirBitacora(${b.id})" title="Reabrir bitácora (Supervisores)">
            <i class="bi bi-unlock"></i> Reabrir
          </button>
        `}
      </div>
    `;
    container.appendChild(card);
  });
}

function abrirModalNuevaBitacora() {
  document.getElementById('form-nueva-bitacora').reset();
  openModal('modal-nueva-bitacora');
}

async function guardarNuevaBitacora(e) {
  e.preventDefault();
  const turno = document.getElementById('nuevo-turno').value;
  const fecha = document.getElementById('nueva-fecha').value;
  const region_id = document.getElementById('nueva-region-id')?.value;

  try {
    await fetchAPI('/api/bitacoras', {
      method: 'POST',
      body: JSON.stringify({ turno, fecha, region_id: parseInt(region_id) })
    });
    showToast('Bitácora abierta exitosamente', 'success');
    closeModal('modal-nueva-bitacora');
    await cargarBitacoras();
  } catch (error) {
    // Error ya mostrado por fetchAPI
  }
}

function solicitarCierreBitacora(id) {
  closingBitacoraId = id;
  document.getElementById('form-cerrar-bitacora').reset();
  openModal('modal-cerrar-bitacora');
}

async function confirmarCierreBitacora(e) {
  e.preventDefault();
  if (!closingBitacoraId) return;

  const observaciones = document.getElementById('observaciones-cierre').value.trim();

  try {
    await fetchAPI(`/api/bitacoras/${closingBitacoraId}/cerrar`, {
      method: 'PUT',
      body: JSON.stringify({ observaciones_cierre: observaciones })
    });
    showToast('Turno cerrado correctamente', 'success');
    closeModal('modal-cerrar-bitacora');
    await cargarBitacoras();
  } catch (error) {
    // Error mostrado por fetchAPI
  }
}

async function reabrirBitacora(id) {
  if (!confirm('¿Desea reabrir esta bitácora para permitir nuevas cargas y modificaciones?')) return;
  try {
    await fetchAPI(`/api/bitacoras/${id}/reabrir`, { method: 'PUT' });
    showToast('Bitácora reabierta', 'success');
    await cargarBitacoras();
  } catch (error) {
    console.error(error);
  }
}
