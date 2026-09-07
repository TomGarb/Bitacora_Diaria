/**
 * Salas DC JS - Gestión dinámica de salas y sitios físicos por operadores del DC
 */

document.addEventListener('DOMContentLoaded', () => {
  cargarSalasRegion();
});

async function cargarSalasRegion() {
  const regionId = document.getElementById('salas-region-id')?.value;
  if (!regionId) return;

  const container = document.getElementById('salas-list-container');
  if (!container) return;
  container.innerHTML = '<div style="color:var(--text-muted); font-size:0.85rem;">Cargando salas del Datacenter...</div>';

  try {
    const data = await fetchAPI(`/api/config/${regionId}`);
    if (!data || !data.config) return;

    const salas = data.config.salas_datacenter || [];
    container.innerHTML = '';

    if (salas.length === 0) {
      container.innerHTML = '<div style="color:var(--text-muted); font-size:0.85rem;">No hay salas configuradas. Agregue la primera sala abajo.</div>';
    } else {
      salas.forEach((sala, index) => {
        agregarFilaSala(sala, index + 1);
      });
    }

    // Actualizar título de la sede si aplica
    if (data.region && document.getElementById('nombre-region-label')) {
      document.getElementById('nombre-region-label').textContent = data.region.nombre;
    }
  } catch (error) {
    container.innerHTML = '<div style="color:var(--danger); font-size:0.85rem;">Error al cargar las salas.</div>';
  }
}

function agregarFilaSala(nombre = '', idx = null) {
  const container = document.getElementById('salas-list-container');
  if (!container) return;

  // Si había mensaje de "no hay salas", limpiarlo
  if (container.children.length === 1 && container.children[0].tagName === 'DIV' && !container.children[0].classList.contains('sala-item-row')) {
    container.innerHTML = '';
  }

  const row = document.createElement('div');
  row.className = 'sala-item-row';
  row.innerHTML = `
    <span class="sala-badge-idx"><i class="bi bi-geo-alt"></i></span>
    <input type="text" class="form-control form-control-sm sala-input" placeholder="Nombre descriptivo (ej: Sala A - Servidores, Jaula 02, MMR, Subestación)" value="${nombre}" required>
    <button type="button" class="btn btn-danger btn-sm" onclick="eliminarFilaSala(this)" title="Eliminar sala" style="padding:0.25rem 0.45rem;">
      <i class="bi bi-trash"></i>
    </button>
  `;

  container.appendChild(row);
  actualizarIndicesSalas();
  
  if (!nombre) {
    row.querySelector('.sala-input')?.focus();
  }
}

function eliminarFilaSala(btn) {
  const row = btn.closest('.sala-item-row');
  if (row) {
    row.remove();
    actualizarIndicesSalas();
  }
}

function actualizarIndicesSalas() {
  const rows = document.querySelectorAll('#salas-list-container .sala-item-row');
  rows.forEach((r, i) => {
    const badge = r.querySelector('.sala-badge-idx');
    if (badge) badge.textContent = `#${i + 1}`;
  });
}

async function guardarSalas() {
  const regionId = document.getElementById('salas-region-id')?.value;
  if (!regionId) return;

  const inputs = document.querySelectorAll('#salas-list-container .sala-input');
  const salas = [];

  inputs.forEach(inp => {
    const val = inp.value.trim();
    if (val && !salas.includes(val)) {
      salas.push(val);
    }
  });

  if (salas.length === 0) {
    showToast('Debe ingresar al menos una sala o sitio para el Datacenter', 'warning');
    return;
  }

  const btn = document.getElementById('btn-guardar-salas');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="bi bi-arrow-repeat spin"></i> Guardando...';
  }

  try {
    const res = await fetchAPI(`/api/config/${regionId}/salas`, {
      method: 'PUT',
      body: JSON.stringify({ salas_datacenter: salas })
    });

    if (res && res.success) {
      showToast('Salas del Datacenter guardadas exitosamente', 'success');
      await cargarSalasRegion();
    }
  } catch (error) {
    console.error(error);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i class="bi bi-check2-circle"></i> Guardar y Aplicar Salas';
    }
  }
}

function cambiarRegionAdmin(newRegionId) {
  const holder = document.getElementById('salas-region-id');
  if (holder) {
    holder.value = newRegionId;
    cargarSalasRegion();
  }
}
