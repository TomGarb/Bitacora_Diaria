/**
 * Config Region JS - Editor en caliente de configuración para Supervisores DOC (sub-admin)
 */

let currentRegionId = null;
let currentConfig = null;
let selectedTaskTypeForFields = 'alta_credencial_especial';
let listaEquiposRegionCache = [];
let editingCustomTypeId = null;

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
    // Guardar campos actuales antes de cambiar de tipo
    guardarCamposDelTipoEnMemoria();
    selectedTaskTypeForFields = e.target.value;
    renderCamposExtraEditor();
  });

  // Botón crear nuevo tipo de tarea custom
  document.getElementById('btn-crear-tipo-custom')?.addEventListener('click', abrirModalCrearTipoCustom);

  // Botón agregar campo extra
  document.getElementById('btn-add-extra-field')?.addEventListener('click', () => agregarFilaCampoExtra());

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
    listaEquiposRegionCache = data.equipos_disponibles || [];
    
    // 1. Título UI y tema
    document.getElementById('cfg-titulo-ui').value = currentConfig.config_ui?.titulo_bitacora || 'Bitácora de Centro de Operaciones';

    // 2. Renderizar cuadrícula de tipos de tarea
    renderTaskTypesGrid();

    // 3. Renderizar dropdown de tipos para el editor de campos
    renderTaskTypesDropdownForFields();

    // 4. Renderizar editor de campos extra para el tipo seleccionado
    renderCamposExtraEditor();

    // 5. Renderizar turnos operativos
    renderTurnosEditor();

    // 6. Renderizar salas de Datacenter
    renderSalasEditor();

  } catch (error) {
    console.error('Error al cargar configuración:', error);
  }
}

// 1. Renderizar Cuadrícula de Tipos de Tareas (Default + Custom)
function renderTaskTypesGrid() {
  const container = document.getElementById('task-type-grid-container');
  if (!container || !currentConfig) return;

  container.innerHTML = '';
  const catalogo = currentConfig.catalogo_completo_tipos || [];
  const habilitados = currentConfig.tipos_tarea_habilitados || [];

  catalogo.forEach(t => {
    const isSelected = habilitados.includes(t.id);
    const isCustom = !!t.es_custom;

    const card = document.createElement('div');
    card.className = `task-type-toggle-card ${isSelected ? 'selected' : ''}`;
    card.dataset.typeId = t.id;
    card.dataset.isCustom = isCustom ? 'true' : 'false';
    card.onclick = () => toggleTaskType(card);

    card.innerHTML = `
      <input type="checkbox" class="type-checkbox" value="${t.id}" ${isSelected ? 'checked' : ''} style="pointer-events:none;">
      <i class="bi ${t.icono || 'bi-card-checklist'}" style="font-size: 1.25rem; color: var(--primary);"></i>
      <div style="flex: 1; min-width: 0;">
        <div style="display:flex; align-items:center; gap:0.35rem;">
          <strong style="font-size:0.875rem; color:var(--text-primary); display:block; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${t.nombre}</strong>
          ${isCustom ? '<span class="badge" style="background:rgba(59,130,246,0.2); color:#60a5fa; font-size:0.65rem; padding:1px 4px;">Custom</span>' : ''}
        </div>
        <small style="font-size:0.75rem; color:var(--text-muted);">${t.id}</small>
      </div>
      ${isCustom ? `
        <div class="custom-card-actions" onclick="event.stopPropagation();" style="display:flex; gap:0.25rem;">
          <button type="button" class="btn btn-secondary btn-sm" onclick="editarTipoCustom('${t.id}')" style="padding:0.15rem 0.35rem;" title="Editar tipo">
            <i class="bi bi-pencil"></i>
          </button>
          <button type="button" class="btn btn-danger btn-sm" onclick="eliminarTipoCustom('${t.id}')" style="padding:0.15rem 0.35rem;" title="Eliminar tipo">
            <i class="bi bi-trash"></i>
          </button>
        </div>
      ` : ''}
    `;

    container.appendChild(card);
  });
}

// 2. Dropdown de tipos para la sección de campos
function renderTaskTypesDropdownForFields() {
  const select = document.getElementById('select-task-type-for-fields');
  if (!select || !currentConfig) return;

  const catalogo = currentConfig.catalogo_completo_tipos || [];
  select.innerHTML = '';

  let existeSeleccionado = false;

  catalogo.forEach(t => {
    const opt = document.createElement('option');
    opt.value = t.id;
    opt.textContent = `${t.nombre}${t.es_custom ? ' (Personalizado)' : ''}`;
    if (t.id === selectedTaskTypeForFields) {
      opt.selected = true;
      existeSeleccionado = true;
    }
    select.appendChild(opt);
  });

  if (!existeSeleccionado && catalogo.length > 0) {
    selectedTaskTypeForFields = catalogo[0].id;
    select.value = selectedTaskTypeForFields;
  }
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

// ==========================================
// MODAL: CREAR / EDITAR TIPO DE TAREA CUSTOM
// ==========================================

function abrirModalCrearTipoCustom() {
  editingCustomTypeId = null;
  document.getElementById('form-tipo-custom').reset();
  document.getElementById('modal-tipo-custom-title').textContent = 'Nuevo Tipo de Tarea Personalizada';
  document.getElementById('custom-type-id').disabled = false;
  openModal('modal-tipo-custom');
}

function autoGenerarIdTecnico() {
  if (editingCustomTypeId) return;
  const nombre = document.getElementById('custom-type-nombre').value;
  const idInput = document.getElementById('custom-type-id');
  const idGenerado = nombre.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
  idInput.value = idGenerado;
}

function editarTipoCustom(id) {
  const customTipos = currentConfig.tipos_tarea_custom || [];
  const tipo = customTipos.find(t => t.id === id);
  if (!tipo) return;

  editingCustomTypeId = id;
  document.getElementById('modal-tipo-custom-title').textContent = `Editar Tipo: ${tipo.nombre}`;
  document.getElementById('custom-type-nombre').value = tipo.nombre;
  document.getElementById('custom-type-id').value = tipo.id;
  document.getElementById('custom-type-id').disabled = true;
  document.getElementById('custom-type-icono').value = tipo.icono || 'bi-hdd-fill';
  document.getElementById('custom-type-desc').value = tipo.descripcion || '';
  document.getElementById('custom-type-programada').checked = !!tipo.es_programada_default;

  openModal('modal-tipo-custom');
}

function guardarModalTipoCustom(e) {
  e.preventDefault();
  const nombre = document.getElementById('custom-type-nombre').value.trim();
  const id = document.getElementById('custom-type-id').value.trim().toLowerCase();
  const icono = document.getElementById('custom-type-icono').value;
  const descripcion = document.getElementById('custom-type-desc').value.trim();
  const esProgramada = document.getElementById('custom-type-programada').checked;

  if (!nombre || !id) {
    showToast('Nombre e Identificador técnico son obligatorios', 'warning');
    return;
  }

  currentConfig.tipos_tarea_custom = currentConfig.tipos_tarea_custom || [];
  currentConfig.tipos_tarea_habilitados = currentConfig.tipos_tarea_habilitados || [];
  currentConfig.campos_extra = currentConfig.campos_extra || {};

  if (editingCustomTypeId) {
    // Edición
    const index = currentConfig.tipos_tarea_custom.findIndex(t => t.id === editingCustomTypeId);
    if (index !== -1) {
      currentConfig.tipos_tarea_custom[index].nombre = nombre;
      currentConfig.tipos_tarea_custom[index].icono = icono;
      currentConfig.tipos_tarea_custom[index].descripcion = descripcion;
      currentConfig.tipos_tarea_custom[index].es_programada_default = esProgramada;
    }
  } else {
    // Creación nueva
    // Validar ID duplicado
    const yaExiste = (currentConfig.catalogo_completo_tipos || []).some(t => t.id === id);
    if (yaExiste) {
      showToast(`El identificador técnico "${id}" ya está en uso. Elija otro.`, 'warning');
      return;
    }

    const nuevoTipo = {
      id,
      nombre,
      icono,
      descripcion,
      es_programada_default: esProgramada,
      es_custom: true
    };

    currentConfig.tipos_tarea_custom.push(nuevoTipo);
    // Habilitar por defecto al crearla
    if (!currentConfig.tipos_tarea_habilitados.includes(id)) {
      currentConfig.tipos_tarea_habilitados.push(id);
    }
    if (!currentConfig.campos_extra[id]) {
      currentConfig.campos_extra[id] = [];
    }

    // Seleccionar de inmediato en el editor de campos
    selectedTaskTypeForFields = id;
  }

  // Reconstruir catálogo completo
  const defaults = (currentConfig.catalogo_completo_tipos || []).filter(t => !t.es_custom);
  currentConfig.catalogo_completo_tipos = [...defaults, ...currentConfig.tipos_tarea_custom];

  closeModal('modal-tipo-custom');
  renderTaskTypesGrid();
  renderTaskTypesDropdownForFields();
  renderCamposExtraEditor();
  showToast(`Tipo de tarea "${nombre}" configurada. Puede agregar sus campos personalizados a continuación.`, 'success');
}

function eliminarTipoCustom(id) {
  if (!confirm(`¿Está seguro de eliminar el tipo de tarea personalizada "${id}" de esta región?`)) return;

  currentConfig.tipos_tarea_custom = (currentConfig.tipos_tarea_custom || []).filter(t => t.id !== id);
  currentConfig.tipos_tarea_habilitados = (currentConfig.tipos_tarea_habilitados || []).filter(tId => tId !== id);
  if (currentConfig.campos_extra && currentConfig.campos_extra[id]) {
    delete currentConfig.campos_extra[id];
  }

  const defaults = (currentConfig.catalogo_completo_tipos || []).filter(t => !t.es_custom);
  currentConfig.catalogo_completo_tipos = [...defaults, ...currentConfig.tipos_tarea_custom];

  if (selectedTaskTypeForFields === id) {
    selectedTaskTypeForFields = defaults.length > 0 ? defaults[0].id : '';
  }

  renderTaskTypesGrid();
  renderTaskTypesDropdownForFields();
  renderCamposExtraEditor();
  showToast('Tipo de tarea personalizada eliminada', 'info');
}

// ==========================================
// EDITOR DE CAMPOS EXTRA PERSONALIZADOS
// ==========================================

function guardarCamposDelTipoEnMemoria() {
  if (!currentConfig || !selectedTaskTypeForFields) return;
  currentConfig.campos_extra = currentConfig.campos_extra || {};

  const campos = [];
  document.querySelectorAll('#extra-fields-editor-container .extra-field-row').forEach(row => {
    const nombre = row.querySelector('.field-nombre')?.value.trim();
    const label = row.querySelector('.field-label')?.value.trim();
    const tipo = row.querySelector('.field-tipo')?.value;
    const requerido = row.querySelector('.field-requerido')?.checked;
    const opcionesStr = row.querySelector('.field-opciones-input')?.value.trim();

    if (nombre && label) {
      const campoObj = { nombre, label, tipo, requerido };
      if (tipo === 'select' && opcionesStr) {
        campoObj.opciones = opcionesStr.split(',').map(s => s.trim()).filter(Boolean);
      }
      campos.push(campoObj);
    }
  });

  currentConfig.campos_extra[selectedTaskTypeForFields] = campos;
}

function renderCamposExtraEditor() {
  const container = document.getElementById('extra-fields-editor-container');
  if (!container || !currentConfig) return;

  container.innerHTML = '';
  const campos = (currentConfig.campos_extra && currentConfig.campos_extra[selectedTaskTypeForFields]) || [];

  if (campos.length === 0) {
    container.innerHTML = '<p style="color:var(--text-muted); font-size:0.85rem; padding:0.5rem 0;">No hay campos adicionales configurados para este tipo. Utiliza los campos base (Ticket, Título, Cliente, Estado, Descripción). Haga clic en <strong>"+ Agregar Campo Personalizado"</strong> para añadir campos específicos.</p>';
  } else {
    campos.forEach(c => {
      agregarFilaCampoExtra(c.nombre, c.label, c.tipo, c.requerido, c.opciones);
    });
  }
}

function agregarFilaCampoExtra(nombre = '', label = '', tipo = 'text', requerido = false, opciones = []) {
  const container = document.getElementById('extra-fields-editor-container');
  if (!container) return;

  if (container.querySelector('p')) container.innerHTML = '';

  const opcionesStr = Array.isArray(opciones) ? opciones.join(', ') : '';

  const row = document.createElement('div');
  row.className = 'extra-field-row';

  row.innerHTML = `
    <div class="extra-field-main-grid">
      <div>
        <label class="form-label" style="font-size:0.7rem; margin-bottom:0.2rem;">Identificador / Nombre Técnico</label>
        <input type="text" class="form-control form-control-sm field-nombre" placeholder="ej: nro_serie_disco" value="${nombre}" required oninput="if(!this.dataset.manual) { this.value = this.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'); }">
      </div>
      <div>
        <label class="form-label" style="font-size:0.7rem; margin-bottom:0.2rem;">Etiqueta Visible para Operador</label>
        <input type="text" class="form-control form-control-sm field-label" placeholder="ej: N° de Serie del Disco" value="${label}" required>
      </div>
      <div>
        <label class="form-label" style="font-size:0.7rem; margin-bottom:0.2rem;">Tipo de Campo</label>
        <select class="form-select form-control-sm field-tipo" onchange="toggleOpcionesSelectRow(this)">
          <option value="text" ${tipo === 'text' ? 'selected' : ''}>Texto Simple</option>
          <option value="number" ${tipo === 'number' ? 'selected' : ''}>Número</option>
          <option value="textarea" ${tipo === 'textarea' ? 'selected' : ''}>Texto Largo</option>
          <option value="select" ${tipo === 'select' ? 'selected' : ''}>Desplegable (Select)</option>
          <option value="datetime" ${tipo === 'datetime' ? 'selected' : ''}>Fecha y Hora</option>
          <option value="date" ${tipo === 'date' ? 'selected' : ''}>Solo Fecha</option>
          <option value="checkbox" ${tipo === 'checkbox' ? 'selected' : ''}>Casilla (Checkbox)</option>
        </select>
      </div>
      <div style="display:flex; align-items:center; gap:0.35rem; margin-top:0.8rem;">
        <input type="checkbox" class="field-requerido" ${requerido ? 'checked' : ''} style="cursor:pointer;">
        <span style="font-size:0.75rem; color:var(--text-secondary); cursor:pointer;">Obligatorio</span>
      </div>
      <div style="text-align:right;">
        <button type="button" class="btn btn-danger btn-sm" onclick="this.closest('.extra-field-row').remove()" style="margin-top:0.8rem; padding:0.25rem 0.4rem;" title="Eliminar campo">
          <i class="bi bi-trash"></i>
        </button>
      </div>
    </div>
    
    <!-- Fila condicional de opciones para tipo select -->
    <div class="extra-field-options-row" style="display: ${tipo === 'select' ? 'flex' : 'none'};">
      <i class="bi bi-list-nested" style="color:var(--primary); font-size:1.1rem;"></i>
      <div style="flex:1;">
        <input type="text" class="form-control form-control-sm field-opciones-input" placeholder="Opciones separadas por coma (ej: SAS 10K, SATA SSD, NVMe Gen4)" value="${opcionesStr}">
      </div>
      <button type="button" class="btn btn-secondary btn-sm" onclick="cargarSalasEnOpciones(this)" style="font-size:0.75rem; white-space:nowrap;">
        <i class="bi bi-building"></i> Usar Salas DC
      </button>
    </div>
  `;

  container.appendChild(row);
}

function toggleOpcionesSelectRow(selectEl) {
  const row = selectEl.closest('.extra-field-row');
  const optRow = row.querySelector('.extra-field-options-row');
  if (optRow) {
    optRow.style.display = (selectEl.value === 'select') ? 'flex' : 'none';
  }
}

function cargarSalasEnOpciones(btn) {
  const optRow = btn.closest('.extra-field-options-row');
  const input = optRow.querySelector('.field-opciones-input');
  const salas = currentConfig.salas_datacenter || [];
  if (salas.length > 0) {
    input.value = salas.join(', ');
    showToast('Salas de Datacenter cargadas en las opciones', 'info');
  } else {
    showToast('No hay salas de Datacenter configuradas en la sección 4', 'warning');
  }
}

// ==========================================
// EDITOR DE TURNOS Y SALAS
// ==========================================

function renderSalasEditor() {
  const container = document.getElementById('salas-editor-container');
  if (!container || !currentConfig) return;

  container.innerHTML = '';
  const salas = currentConfig.salas_datacenter || [];

  if (salas.length === 0) {
    container.innerHTML = '<p style="color:var(--text-muted); font-size:0.85rem;">No hay salas configuradas para esta región.</p>';
  } else {
    salas.forEach(sala => {
      agregarFilaSala(sala);
    });
  }
}

function agregarFilaSala(nombre = '') {
  const container = document.getElementById('salas-editor-container');
  if (!container) return;

  if (container.querySelector('p')) container.innerHTML = '';

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

function renderTurnosEditor() {
  const container = document.getElementById('shifts-editor-container');
  if (!container || !currentConfig) return;

  container.innerHTML = '';
  const turnos = currentConfig.turnos_config || [];

  turnos.forEach(t => {
    agregarFilaTurno(t.id, t.nombre, t.horario, t.dias, t.equipo_id, t.activo !== false);
  });
}

function agregarFilaTurno(id = '', nombre = '', horario = '', dias = 'Lunes a Domingo', equipoId = null, activo = true) {
  const container = document.getElementById('shifts-editor-container');
  if (!container) return;

  let opcionesEquipos = '<option value="">Todos los Equipos (Toda la Sede)</option>';
  listaEquiposRegionCache.forEach(eq => {
    const isSelected = (equipoId && parseInt(equipoId) === eq.id) ? 'selected' : '';
    opcionesEquipos += `<option value="${eq.id}" ${isSelected}>${eq.nombre}</option>`;
  });

  const card = document.createElement('div');
  card.className = 'shift-config-card';
  card.style.display = 'grid';
  card.style.gridTemplateColumns = '1.2fr 1fr 1fr 1.2fr 40px';
  card.style.gap = '0.6rem';
  card.style.alignItems = 'center';

  card.innerHTML = `
    <div>
      <label class="form-label" style="font-size:0.7rem; margin-bottom:0.2rem;">Nombre Turno</label>
      <input type="text" class="form-control form-control-sm shift-nombre" placeholder="Ej: Mañana" value="${nombre}" required>
      <input type="hidden" class="shift-id" value="${id || nombre.toLowerCase().replace(/ /g, '_')}">
    </div>
    <div>
      <label class="form-label" style="font-size:0.7rem; margin-bottom:0.2rem;">Rango Horario</label>
      <input type="text" class="form-control form-control-sm shift-horario" placeholder="Ej: 07:00 a 15:00" value="${horario}" required>
    </div>
    <div>
      <label class="form-label" style="font-size:0.7rem; margin-bottom:0.2rem;">Días Aplicables</label>
      <input type="text" class="form-control form-control-sm shift-dias" placeholder="Ej: Lunes a Domingo" value="${dias}" required>
    </div>
    <div>
      <label class="form-label" style="font-size:0.7rem; margin-bottom:0.2rem;">Grupo / Equipo Aplicable</label>
      <select class="form-select form-control-sm shift-equipo">
        ${opcionesEquipos}
      </select>
    </div>
    <div style="text-align:right;">
      <button type="button" class="btn btn-danger btn-sm" onclick="this.closest('.shift-config-card').remove()" style="margin-top:0.9rem; padding:0.3rem 0.5rem;" title="Eliminar Turno">
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
  document.querySelectorAll('#task-type-grid-container .task-type-toggle-card .type-checkbox:checked').forEach(cb => {
    tiposHabilitados.push(cb.value);
  });

  if (tiposHabilitados.length === 0) {
    showToast('Debe habilitar al menos un tipo de tarea para la región', 'warning');
    return;
  }

  // 2. Guardar campos del tipo actualmente seleccionado en memoria
  guardarCamposDelTipoEnMemoria();

  // 3. Turnos de la región con asignación de equipo
  const turnosConfig = [];
  document.querySelectorAll('.shift-config-card').forEach(card => {
    const id = card.querySelector('.shift-id')?.value.trim();
    const nombre = card.querySelector('.shift-nombre')?.value.trim();
    const horario = card.querySelector('.shift-horario')?.value.trim();
    const dias = card.querySelector('.shift-dias')?.value.trim();
    const equipoIdVal = card.querySelector('.shift-equipo')?.value;
    const equipoId = equipoIdVal ? parseInt(equipoIdVal) : null;
    const eqObj = listaEquiposRegionCache.find(e => e.id === equipoId);
    const equipoNombre = eqObj ? eqObj.nombre : 'Toda la Sede';

    if (nombre && horario) {
      turnosConfig.push({
        id: id || nombre.toLowerCase().replace(/ /g, '_'),
        nombre,
        horario,
        dias,
        equipo_id: equipoId,
        equipo_nombre: equipoNombre,
        activo: true
      });
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
    tipos_tarea_custom: currentConfig.tipos_tarea_custom || [],
    tipos_tarea_habilitados: tiposHabilitados,
    campos_extra: currentConfig.campos_extra || {},
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
    renderTaskTypesGrid();
    renderTaskTypesDropdownForFields();
  } catch (error) {
    // Error capturado en fetchAPI
  }
}
