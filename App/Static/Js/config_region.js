/**
 * Config Region JS - Editor en caliente de configuración para Supervisores DOC (sub-admin)
 */

let currentRegionId = null;
let currentConfig = null;
let selectedTaskTypeForFields = 'alta_credencial_especial';

document.addEventListener('DOMContentLoaded', () => {
  currentRegionId = document.getElementById('config-region-id')?.value;
  if (currentRegionId) {
    cargarConfiguracion(currentRegionId);
  }

  document.getElementById('selector-region-admin')?.addEventListener('change', (e) => {
    if (e.target.value) {
      currentRegionId = e.target.value;
      cargarConfiguracion(currentRegionId);
    }
  });

  // Selector de tipo de tarea para configurar campos extra
  document.getElementById('select-task-type-for-fields')?.addEventListener('change', (e) => {
    selectedTaskTypeForFields = e.target.value;
    renderCamposExtraEditor();
  });

  // Botón agregar campo extra
  document.getElementById('btn-add-extra-field')?.addEventListener('click', agregarFilaCampoExtra);

  // Botón agregar turno
  document.getElementById('btn-add-shift-row')?.addEventListener('click', () => agregarFilaTurno());

  // Botón agregar sala
  document.getElementById('btn-add-sala-row')?.addEventListener('click', () => agregarFilaSala());

  // Formulario principal de guardado
  document.getElementById('form-config-region')?.addEventListener('submit', guardarConfiguracion);
});

async function cargarConfiguracion(regionId) {
  try {
    const data = await fetchAPI(`/api/config/${regionId}`);
    if (!data || !data.config) return;

    currentConfig = data.config;
    
    // 1. Título UI y tema
    document.getElementById('cfg-titulo-ui').value = currentConfig.config_ui?.titulo_bitacora || 'Bitácora de Centro de Operaciones';

    // 2. Marcar checkboxes de tipos habilitados
    const habilitados = currentConfig.tipos_tarea_habilitados || [];
    document.querySelectorAll('.task-type-toggle-card').forEach(card => {
      const checkbox = card.querySelector('.type-checkbox');
      const typeId = checkbox?.value;
      if (habilitados.includes(typeId)) {
        checkbox.checked = true;
        card.classList.add('selected');
      } else {
        checkbox.checked = false;
        card.classList.remove('selected');
      }
    });

    // 3. Renderizar campos extra del tipo seleccionado
    renderCamposExtraEditor();

    // 4. Renderizar turnos
    renderTurnosEditor();

    // 5. Renderizar salas
    renderSalasEditor();

  } catch (error) {
    console.error('Error cargando configuración:', error);
  }
}

// Renderizador del editor de salas
function renderSalasEditor() {
  const container = document.getElementById('salas-editor-container');
  if (!container || !currentConfig) return;

  container.innerHTML = '';
  const salas = currentConfig.salas_datacenter || [];

  salas.forEach(s => agregarFilaSala(s));
}

function agregarFilaSala(nombre = '') {
  const container = document.getElementById('salas-editor-container');
  if (!container) return;

  const row = document.createElement('div');
  row.style.display = 'flex';
  row.style.gap = '0.5rem';
  row.style.alignItems = 'center';

  row.innerHTML = `
    <input type="text" class="form-control form-control-sm sala-nombre" placeholder="Nombre de sala / subestación (ej: Sala A, Subestación 1)" value="${nombre}" required>
    <button type="button" class="btn btn-danger btn-sm" onclick="this.parentElement.remove()" style="padding:0.25rem 0.4rem;">
      <i class="bi bi-trash"></i>
    </button>
  `;
  container.appendChild(row);
}

// Toggle visual para las tarjetas de tipos de tareas
function toggleTaskType(card) {
  const checkbox = card.querySelector('.type-checkbox');
  checkbox.checked = !checkbox.checked;
  if (checkbox.checked) {
    card.classList.add('selected');
  } else {
    card.classList.remove('selected');
  }
}

// Renderizador del editor de campos extra para el tipo seleccionado
function renderCamposExtraEditor() {
  const container = document.getElementById('extra-fields-editor-container');
  if (!container || !currentConfig) return;

  container.innerHTML = '';
  const campos = (currentConfig.campos_extra && currentConfig.campos_extra[selectedTaskTypeForFields]) || [];

  if (campos.length === 0) {
    container.innerHTML = '<p style="color:var(--text-muted); font-size:0.85rem; padding:0.5rem 0;">Este tipo de tarea utiliza actualmente solo los campos estándar (Ticket, Título, Cliente, Estado, Descripción).</p>';
  } else {
    campos.forEach(c => {
      agregarFilaCampoExtra(c.nombre, c.label, c.tipo, c.requerido);
    });
  }
}

function agregarFilaCampoExtra(nombre = '', label = '', tipo = 'text', requerido = true) {
  const container = document.getElementById('extra-fields-editor-container');
  if (!container) return;

  // Si había texto de vacío, limpiarlo
  if (container.querySelector('p')) container.innerHTML = '';

  const row = document.createElement('div');
  row.className = 'card';
  row.style.padding = '0.75rem';
  row.style.marginBottom = '0.5rem';
  row.style.display = 'grid';
  row.style.gridTemplateColumns = '1fr 1fr 120px 100px 36px';
  row.style.gap = '0.5rem';
  row.style.alignItems = 'center';

  row.innerHTML = `
    <div>
      <input type="text" class="form-control form-control-sm field-nombre" placeholder="Nombre técnico (ej: ticket_cliente)" value="${nombre}" required>
    </div>
    <div>
      <input type="text" class="form-control form-control-sm field-label" placeholder="Etiqueta visible (ej: Ticket de Cliente)" value="${label}" required>
    </div>
    <div>
      <select class="form-select form-control-sm field-tipo">
        <option value="text" ${tipo === 'text' ? 'selected' : ''}>Texto</option>
        <option value="number" ${tipo === 'number' ? 'selected' : ''}>Número</option>
        <option value="textarea" ${tipo === 'textarea' ? 'selected' : ''}>Texto Largo</option>
      </select>
    </div>
    <div style="display:flex; align-items:center; gap:0.3rem;">
      <input type="checkbox" class="field-requerido" ${requerido ? 'checked' : ''}>
      <span style="font-size:0.75rem; color:var(--text-secondary);">Obligatorio</span>
    </div>
    <button type="button" class="btn btn-danger btn-sm" onclick="this.parentElement.remove()" style="padding:0.25rem;">
      <i class="bi bi-trash"></i>
    </button>
  `;
  container.appendChild(row);
}

// Renderizador del editor de turnos
function renderTurnosEditor() {
  const container = document.getElementById('shifts-editor-container');
  if (!container || !currentConfig) return;

  container.innerHTML = '';
  const turnos = currentConfig.turnos_config || [];

  turnos.forEach(t => {
    agregarFilaTurno(t.id, t.nombre, t.horario, t.dias, t.activo !== false);
  });
}

function agregarFilaTurno(id = '', nombre = '', horario = '', dias = 'Lunes a Domingo', activo = true) {
  const container = document.getElementById('shifts-editor-container');
  if (!container) return;

  const card = document.createElement('div');
  card.className = 'shift-config-card';
  card.innerHTML = `
    <div>
      <label class="form-label" style="font-size:0.7rem;">Nombre Turno</label>
      <input type="text" class="form-control form-control-sm shift-nombre" placeholder="Ej: Mañana" value="${nombre}" required>
      <input type="hidden" class="shift-id" value="${id || nombre.toLowerCase().replace(/ /g, '_')}">
    </div>
    <div>
      <label class="form-label" style="font-size:0.7rem;">Rango Horario</label>
      <input type="text" class="form-control form-control-sm shift-horario" placeholder="Ej: 07:00 a 15:00" value="${horario}" required>
    </div>
    <div>
      <label class="form-label" style="font-size:0.7rem;">Días Aplicables</label>
      <input type="text" class="form-control form-control-sm shift-dias" placeholder="Ej: Lunes a Domingo" value="${dias}" required>
    </div>
    <div style="text-align:right;">
      <button type="button" class="btn btn-danger btn-sm" onclick="this.closest('.shift-config-card').remove()" style="margin-top:1rem; padding:0.3rem;">
        <i class="bi bi-trash"></i>
      </button>
    </div>
  `;
  container.appendChild(card);
}

// Guardar Configuración Dinámica completa
async function guardarConfiguracion(e) {
  e.preventDefault();
  if (!currentRegionId) return;

  // 1. Tipos habilitados
  const tiposHabilitados = [];
  document.querySelectorAll('.task-type-toggle-card .type-checkbox:checked').forEach(cb => {
    tiposHabilitados.push(cb.value);
  });

  if (tiposHabilitados.length === 0) {
    showToast('Debe habilitar al menos un tipo de tarea para la región', 'warning');
    return;
  }

  // 2. Campos extra dinámicos
  const camposExtraActuales = currentConfig.campos_extra || {};
  const camposDelTipo = [];
  
  document.querySelectorAll('#extra-fields-editor-container > div').forEach(row => {
    const nombre = row.querySelector('.field-nombre')?.value.trim();
    const label = row.querySelector('.field-label')?.value.trim();
    const tipo = row.querySelector('.field-tipo')?.value;
    const requerido = row.querySelector('.field-requerido')?.checked;

    if (nombre && label) {
      camposDelTipo.push({ nombre, label, tipo, requerido });
    }
  });

  camposExtraActuales[selectedTaskTypeForFields] = camposDelTipo;

  // 3. Turnos de la región
  const turnosConfig = [];
  document.querySelectorAll('.shift-config-card').forEach(card => {
    const id = card.querySelector('.shift-id')?.value.trim();
    const nombre = card.querySelector('.shift-nombre')?.value.trim();
    const horario = card.querySelector('.shift-horario')?.value.trim();
    const dias = card.querySelector('.shift-dias')?.value.trim();

    if (nombre && horario) {
      turnosConfig.push({ id: id || nombre.toLowerCase().replace(/ /g, '_'), nombre, horario, dias, activo: true });
    }
  });

  // 4. Salas de Datacenter de la región
  const salasDatacenter = [];
  document.querySelectorAll('#salas-editor-container .sala-nombre').forEach(input => {
    const s = input.value.trim();
    if (s) salasDatacenter.push(s);
  });

  // 5. UI config
  const configUI = {
    titulo_bitacora: document.getElementById('cfg-titulo-ui').value.trim()
  };

  const payload = {
    tipos_tarea_habilitados: tiposHabilitados,
    campos_extra: camposExtraActuales,
    turnos_config: turnosConfig,
    salas_datacenter: salasDatacenter,
    config_ui: configUI
  };

  try {
    const res = await fetchAPI(`/api/config/${currentRegionId}`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    });

    showToast('¡Configuración de la región actualizada en caliente con éxito!', 'success');
    currentConfig = res.config;
  } catch (error) {
    // Error capturado en fetchAPI
  }
}
