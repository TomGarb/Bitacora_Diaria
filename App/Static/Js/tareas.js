/**
 * Tareas JS - Gestión dinámica de tareas, múltiples credenciales y subtareas
 */

let regionConfig = null;
let currentTasks = [];
let editingTaskId = null;

document.addEventListener('DOMContentLoaded', async () => {
  await cargarConfiguracionRegion();
  await cargarTareas();
  setupEventListeners();
});

// 1. Cargar Configuración Dinámica de la Región (Tipos, Salas, Turnos, Campos)
async function cargarConfiguracionRegion() {
  try {
    const regionId = document.getElementById('region-id-holder')?.value;
    if (!regionId) return;

    const data = await fetchAPI(`/api/config/${regionId}`);
    if (data && data.config) {
      regionConfig = data.config;
      actualizarSelectorTipos();
    }
  } catch (error) {
    console.error('Error cargando configuración de región:', error);
  }
}

// 2. Dropdown de tipos según configuración de la región
function actualizarSelectorTipos() {
  const select = document.getElementById('tipo_tarea');
  const filterSelect = document.getElementById('filter-tipo');
  if (!select || !regionConfig) return;

  const habilitados = regionConfig.tipos_tarea_habilitados || [];
  const catalogo = regionConfig.catalogo_completo_tipos || [];

  select.innerHTML = '<option value="">-- Seleccione Tipo de Tarea --</option>';
  if (filterSelect) filterSelect.innerHTML = '<option value="">Todos los tipos</option>';

  catalogo.forEach(item => {
    if (habilitados.includes(item.id)) {
      const opt = document.createElement('option');
      opt.value = item.id;
      opt.textContent = item.nombre;
      select.appendChild(opt);

      if (filterSelect) {
        const fOpt = document.createElement('option');
        fOpt.value = item.id;
        fOpt.textContent = item.nombre;
        filterSelect.appendChild(fOpt);
      }
    }
  });
}

// 3. Renderizar campos dinámicos y comportamientos al cambiar el tipo de tarea
function onTipoTareaChange() {
  const tipo = document.getElementById('tipo_tarea').value;
  const container = document.getElementById('dynamic-fields-container');
  const credBox = document.getElementById('credentials-module-box');
  const progCheckbox = document.getElementById('es_actividad_programada');
  const datesBox = document.getElementById('fechas-programadas-box');
  const labelFin = document.getElementById('label-fecha-fin');

  if (!tipo) {
    if (credBox) credBox.style.display = 'none';
    if (container) container.style.display = 'none';
    return;
  }

  // Comportamiento de Actividad Programada por Tipo
  const esSiempreProgramada = ['acceso_equipos', 'retiro_equipos', 'acceso_tecnicos', 'mantenimiento'].includes(tipo);
  
  if (esSiempreProgramada) {
    progCheckbox.checked = true;
    progCheckbox.disabled = true;
    datesBox.style.display = 'grid';

    if (tipo === 'mantenimiento') {
      labelFin.innerHTML = 'Fecha / Hora Fin <span style="color:var(--danger)">* (Obligatoria)</span>';
      document.getElementById('fecha_programada_fin').required = true;
    } else {
      labelFin.innerHTML = 'Fecha / Hora Fin <span style="color:var(--text-muted); font-size:0.75rem;">(Opcional)</span>';
      document.getElementById('fecha_programada_fin').required = false;
    }
  } else {
    progCheckbox.disabled = false;
    datesBox.style.display = progCheckbox.checked ? 'grid' : 'none';
    labelFin.innerHTML = 'Fecha / Hora Fin';
    document.getElementById('fecha_programada_fin').required = false;
  }

  // MÓDULO DEDICADO: ALTA DE CREDENCIALES ESPECIALES MÚLTIPLES
  if (tipo === 'alta_credencial_especial') {
    credBox.style.display = 'block';
    if (container) container.style.display = 'none';
    // Si no tiene filas, agregar una inicial
    if (document.querySelectorAll('.credential-row').length === 0) {
      agregarFilaCredencial();
    }
    return;
  } else {
    credBox.style.display = 'none';
  }

  // OTROS CAMPOS DINÁMICOS (Salas de Datacenter, Sitios externos, etc.)
  let campos = (regionConfig && regionConfig.campos_extra && regionConfig.campos_extra[tipo]) || [];
  
  // Si es equipos/técnicos/mantenimiento, inyectar salas actualizadas de la región si es select
  if (['acceso_equipos', 'retiro_equipos', 'acceso_tecnicos', 'mantenimiento'].includes(tipo)) {
    const salas = regionConfig.salas_datacenter || [];
    campos = campos.map(c => {
      if (c.nombre === 'sala_datacenter' || c.nombre === 'sitio_mantenimiento') {
        return { ...c, opciones: salas };
      }
      return c;
    });
  }

  renderDynamicFields(container, campos);
}

// 4. Múltiples Credenciales
function agregarFilaCredencial(persona = '', codigo = '') {
  const container = document.getElementById('credentials-rows-container');
  if (!container) return;

  const row = document.createElement('div');
  row.className = 'credential-row';
  row.innerHTML = `
    <div>
      <input type="text" class="form-control form-control-sm cred-persona" placeholder="Nombre y Apellido de la persona" value="${persona}" required>
    </div>
    <div>
      <input type="text" class="form-control form-control-sm cred-codigo" placeholder="Código alfanumérico (ej: CRD-9901)" value="${codigo}" required>
    </div>
    <div>
      <button type="button" class="btn btn-danger btn-sm" onclick="this.closest('.credential-row').remove()" style="padding:0.25rem 0.4rem;" title="Eliminar fila">
        <i class="bi bi-x"></i>
      </button>
    </div>
  `;
  container.appendChild(row);
}

// 5. Cargar lista de tareas
async function cargarTareas() {
  const tbody = document.getElementById('tareas-tbody');
  if (!tbody) return;

  const filterTipo = document.getElementById('filter-tipo')?.value || '';
  const filterEstado = document.getElementById('filter-estado')?.value || '';
  const filterSoloMis = document.getElementById('filter-mis-tareas')?.checked || false;
  const filterProgramadas = document.getElementById('filter-programadas')?.checked || false;
  const filterSearch = document.getElementById('search-task')?.value || '';

  const queryParams = new URLSearchParams({
    tipo_tarea: filterTipo,
    estado: filterEstado,
    mis_tareas: filterSoloMis,
    programadas: filterProgramadas,
    q: filterSearch
  });

  try {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:var(--text-muted);">Cargando tareas...</td></tr>';
    const tareas = await fetchAPI(`/api/tareas?${queryParams.toString()}`);
    currentTasks = tareas;
    renderTablaTareas(tareas);
  } catch (error) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:var(--danger);">Error al cargar tareas</td></tr>';
  }
}

// 6. Renderizar tabla de tareas
function renderTablaTareas(tareas) {
  const tbody = document.getElementById('tareas-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (tareas.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:var(--text-muted); padding:2rem;">No se encontraron tareas registradas con los filtros aplicados.</td></tr>';
    return;
  }

  tareas.forEach(t => {
    const tr = document.createElement('tr');
    const tipoLabel = t.tipo_tarea.replace(/_/g, ' ');

    // Construir tags de campos extra y credenciales múltiples
    let extraFieldsHtml = '';
    if (t.tipo_tarea === 'alta_credencial_especial' && t.campos_extra) {
      const ticketCli = t.campos_extra.ticket_cliente ? `Ticket Cliente: <strong>${t.campos_extra.ticket_cliente}</strong>` : '';
      const creds = t.campos_extra.credenciales_lista || [];
      
      let listaPersonas = '';
      if (creds.length > 0) {
        listaPersonas = creds.map(c => `<span class="extra-field-tag"><i class="bi bi-person"></i> ${c.persona_propietaria} (<strong>${c.codigo_alfanumerico}</strong>)</span>`).join(' ');
      } else if (t.campos_extra.persona_propietaria) {
        listaPersonas = `<span class="extra-field-tag"><i class="bi bi-person"></i> ${t.campos_extra.persona_propietaria} (<strong>${t.campos_extra.codigo_alfanumerico || ''}</strong>)</span>`;
      }

      extraFieldsHtml = `
        <div style="font-size:0.75rem; color:var(--text-secondary); margin-top:0.3rem;">${ticketCli}</div>
        <div class="extra-fields-badge-box">${listaPersonas}</div>
      `;
    } else if (t.campos_extra && Object.keys(t.campos_extra).length > 0) {
      extraFieldsHtml = '<div class="extra-fields-badge-box">';
      for (const [k, v] of Object.entries(t.campos_extra)) {
        if (v && typeof v !== 'object') {
          const kLabel = k.replace(/_/g, ' ');
          extraFieldsHtml += `<span class="extra-field-tag" title="${kLabel}: ${v}"><strong>${kLabel}:</strong> ${v}</span>`;
        }
      }
      extraFieldsHtml += '</div>';
    }

    // Badge subtareas
    const subtareasBadge = t.total_subtareas > 0 
      ? `<span class="subtask-badge-count" title="${t.total_subtareas} subtareas / comentarios"><i class="bi bi-list-nested"></i> ${t.total_subtareas}</span>` 
      : '';

    // Fecha programada
    const programadaHtml = t.es_actividad_programada
      ? `<span class="badge badge-programada" title="${t.fecha_programada_inicio || ''} ${t.fecha_programada_fin ? 'a ' + t.fecha_programada_fin : ''}"><i class="bi bi-clock-history"></i> ${t.fecha_programada_inicio ? t.fecha_programada_inicio.split(' ')[1] : 'Programada'}</span>`
      : '<span style="color:var(--text-muted); font-size:0.75rem;">No</span>';

    tr.innerHTML = `
      <td>
        <strong style="color:var(--primary); font-size:0.95rem;">${t.ticket}</strong>
        <div style="font-size:0.75rem; color:var(--text-muted);">${t.created_at || ''}</div>
      </td>
      <td style="max-width: 320px;">
        <div style="font-weight:600; color:var(--text-primary);">${t.titulo}</div>
        <div style="font-size:0.8rem; color:var(--text-secondary); margin-top:2px;">${t.descripcion}</div>
        ${extraFieldsHtml}
      </td>
      <td><strong>${t.cliente}</strong></td>
      <td>
        <span class="badge badge-programada" style="background:var(--bg-surface-hover); color:var(--text-secondary);">${tipoLabel}</span>
      </td>
      <td>
        <span class="badge badge-${t.estado}">${t.estado.replace('_', ' ')}</span>
        <div style="margin-top:4px;">${subtareasBadge}</div>
      </td>
      <td>${programadaHtml}</td>
      <td style="text-align: right;">
        <button class="btn btn-secondary btn-sm" onclick="abrirModalDetalle(${t.id})" title="Ver / Gestionar Subtareas">
          <i class="bi bi-eye"></i>
        </button>
        <button class="btn btn-secondary btn-sm" onclick="editarTarea(${t.id})" title="Editar Tarea">
          <i class="bi bi-pencil"></i>
        </button>
        <button class="btn btn-danger btn-sm" onclick="eliminarTarea(${t.id})" title="Eliminar">
          <i class="bi bi-trash"></i>
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// 7. Setup de Event Listeners
function setupEventListeners() {
  document.getElementById('tipo_tarea')?.addEventListener('change', onTipoTareaChange);
  
  // Toggle de campos de actividad programada
  document.getElementById('es_actividad_programada')?.addEventListener('change', (e) => {
    const datesBox = document.getElementById('fechas-programadas-box');
    if (datesBox) {
      datesBox.style.display = e.target.checked ? 'grid' : 'none';
    }
  });

  // Filtros
  ['filter-tipo', 'filter-estado', 'filter-mis-tareas', 'filter-programadas'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', cargarTareas);
  });

  let searchTimeout;
  document.getElementById('search-task')?.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(cargarTareas, 350);
  });

  // Botón agregar credencial
  document.getElementById('btn-add-credential-row')?.addEventListener('click', () => agregarFilaCredencial());

  // Botón Agregar Subtarea
  document.getElementById('btn-add-subtask-row')?.addEventListener('click', () => agregarFilaSubtarea());

  // Formulario Tarea Submit
  document.getElementById('form-tarea')?.addEventListener('submit', guardarTarea);
}

// 8. Subtareas en Modal de Creación/Edición
function agregarFilaSubtarea(ticket = '', titulo = '', estado = 'pendiente', desc = '') {
  const container = document.getElementById('subtasks-rows-container');
  if (!container) return;

  const row = document.createElement('div');
  row.className = 'subtask-row';
  row.innerHTML = `
    <input type="text" class="form-control form-control-sm sub-ticket" placeholder="Ticket" value="${ticket}">
    <input type="text" class="form-control form-control-sm sub-titulo" placeholder="Título de subtarea" value="${titulo}">
    <select class="form-select form-control-sm sub-estado">
      <option value="pendiente" ${estado === 'pendiente' ? 'selected' : ''}>Pendiente</option>
      <option value="en_progreso" ${estado === 'en_progreso' ? 'selected' : ''}>En Progreso</option>
      <option value="completada" ${estado === 'completada' ? 'selected' : ''}>Completada</option>
      <option value="cancelada" ${estado === 'cancelada' ? 'selected' : ''}>Cancelada</option>
    </select>
    <button type="button" class="btn btn-danger btn-sm" onclick="this.closest('.subtask-row').remove()" style="padding:0.25rem 0.4rem;">
      <i class="bi bi-x"></i>
    </button>
    <div class="subtask-row-desc">
      <input type="text" class="form-control form-control-sm sub-desc" placeholder="Comentarios u observaciones de avance del operador..." value="${desc}">
    </div>
  `;
  container.appendChild(row);
}

function abrirModalNuevaTarea() {
  editingTaskId = null;
  document.getElementById('form-tarea').reset();
  document.getElementById('modal-tarea-title').textContent = 'Nueva Tarea de Bitácora';
  document.getElementById('subtasks-rows-container').innerHTML = '';
  document.getElementById('credentials-rows-container').innerHTML = '';
  document.getElementById('credentials-module-box').style.display = 'none';
  document.getElementById('dynamic-fields-container').innerHTML = '';
  document.getElementById('fechas-programadas-box').style.display = 'none';
  document.getElementById('es_actividad_programada').disabled = false;
  openModal('modal-tarea');
}

function editarTarea(id) {
  const tarea = currentTasks.find(t => t.id === id);
  if (!tarea) return;

  editingTaskId = id;
  document.getElementById('modal-tarea-title').textContent = `Editar Tarea #${tarea.id} - ${tarea.ticket}`;
  document.getElementById('ticket').value = tarea.ticket;
  document.getElementById('titulo').value = tarea.titulo;
  document.getElementById('cliente').value = tarea.cliente;
  document.getElementById('estado').value = tarea.estado;
  document.getElementById('descripcion').value = tarea.descripcion;
  document.getElementById('tipo_tarea').value = tarea.tipo_tarea;

  // Disparar cambio de tipo
  onTipoTareaChange();
  
  // Actividad programada
  const progCheckbox = document.getElementById('es_actividad_programada');
  progCheckbox.checked = tarea.es_actividad_programada;
  const datesBox = document.getElementById('fechas-programadas-box');
  datesBox.style.display = tarea.es_actividad_programada ? 'grid' : 'none';

  if (tarea.fecha_programada_inicio) {
    document.getElementById('fecha_programada_inicio').value = tarea.fecha_programada_inicio.replace(' ', 'T');
  }
  if (tarea.fecha_programada_fin) {
    document.getElementById('fecha_programada_fin').value = tarea.fecha_programada_fin.replace(' ', 'T');
  }

  // Cargar credenciales si aplica
  if (tarea.tipo_tarea === 'alta_credencial_especial' && tarea.campos_extra) {
    document.getElementById('cred-ticket-cliente').value = tarea.campos_extra.ticket_cliente || '';
    const container = document.getElementById('credentials-rows-container');
    container.innerHTML = '';
    
    const creds = tarea.campos_extra.credenciales_lista || [];
    if (creds.length > 0) {
      creds.forEach(c => agregarFilaCredencial(c.persona_propietaria, c.codigo_alfanumerico));
    } else if (tarea.campos_extra.persona_propietaria) {
      agregarFilaCredencial(tarea.campos_extra.persona_propietaria, tarea.campos_extra.codigo_alfanumerico);
    }
  } else {
    // Renderizar campos extra dinámicos con valores guardados
    const container = document.getElementById('dynamic-fields-container');
    let camposExtra = (regionConfig && regionConfig.campos_extra && regionConfig.campos_extra[tarea.tipo_tarea]) || [];
    if (['acceso_equipos', 'retiro_equipos', 'acceso_tecnicos', 'mantenimiento'].includes(tarea.tipo_tarea)) {
      const salas = regionConfig.salas_datacenter || [];
      camposExtra = camposExtra.map(c => (c.nombre === 'sala_datacenter' || c.nombre === 'sitio_mantenimiento') ? { ...c, opciones: salas } : c);
    }
    renderDynamicFields(container, camposExtra, tarea.campos_extra || {});
  }

  // Subtareas
  const subContainer = document.getElementById('subtasks-rows-container');
  subContainer.innerHTML = '';
  (tarea.subtareas || []).forEach(sub => {
    agregarFilaSubtarea(sub.ticket, sub.titulo, sub.estado, sub.descripcion);
  });

  openModal('modal-tarea');
}

async function guardarTarea(e) {
  e.preventDefault();

  const tipo_tarea = document.getElementById('tipo_tarea').value;
  if (!tipo_tarea) {
    showToast('Debe seleccionar un tipo de tarea', 'warning');
    return;
  }

  let campos_extra = {};

  // Extraer credenciales si es alta_credencial_especial
  if (tipo_tarea === 'alta_credencial_especial') {
    const ticketCliente = document.getElementById('cred-ticket-cliente')?.value.trim();
    if (!ticketCliente) {
      showToast('El Ticket de Cliente es obligatorio para Credenciales', 'warning');
      return;
    }

    const credenciales_lista = [];
    document.querySelectorAll('.credential-row').forEach(row => {
      const persona = row.querySelector('.cred-persona')?.value.trim();
      const codigo = row.querySelector('.cred-codigo')?.value.trim();
      if (persona && codigo) {
        credenciales_lista.push({ persona_propietaria: persona, codigo_alfanumerico: codigo });
      }
    });

    if (credenciales_lista.length === 0) {
      showToast('Debe ingresar al menos una persona con su código alfanumérico', 'warning');
      return;
    }

    campos_extra = {
      ticket_cliente: ticketCliente,
      credenciales_lista: credenciales_lista
    };
  } else {
    const extraFieldsContainer = document.getElementById('dynamic-fields-container');
    campos_extra = extractDynamicFields(extraFieldsContainer);
  }

  // Extraer subtareas
  const subtareas = [];
  document.querySelectorAll('.subtask-row').forEach(row => {
    const t = row.querySelector('.sub-ticket')?.value.trim();
    const tit = row.querySelector('.sub-titulo')?.value.trim();
    const est = row.querySelector('.sub-estado')?.value;
    const desc = row.querySelector('.sub-desc')?.value.trim();
    if (t && tit) {
      subtareas.push({ ticket: t, titulo: tit, estado: est, descripcion: desc });
    }
  });

  const payload = {
    ticket: document.getElementById('ticket').value.trim(),
    titulo: document.getElementById('titulo').value.trim(),
    cliente: document.getElementById('cliente').value.trim(),
    estado: document.getElementById('estado').value,
    descripcion: document.getElementById('descripcion').value.trim(),
    tipo_tarea: tipo_tarea,
    es_actividad_programada: document.getElementById('es_actividad_programada').checked,
    fecha_programada_inicio: document.getElementById('fecha_programada_inicio').value || null,
    fecha_programada_fin: document.getElementById('fecha_programada_fin').value || null,
    campos_extra: campos_extra,
    subtareas: subtareas
  };

  try {
    if (editingTaskId) {
      await fetchAPI(`/api/tareas/${editingTaskId}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });
      showToast('Tarea actualizada correctamente', 'success');
    } else {
      await fetchAPI('/api/tareas', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      showToast('Tarea creada exitosamente', 'success');
    }

    closeModal('modal-tarea');
    await cargarTareas();
  } catch (error) {
    // Error ya mostrado por fetchAPI
  }
}

async function eliminarTarea(id) {
  if (!confirm('¿Está seguro de eliminar esta tarea y todas sus subtareas?')) return;

  try {
    await fetchAPI(`/api/tareas/${id}`, { method: 'DELETE' });
    showToast('Tarea eliminada', 'info');
    await cargarTareas();
  } catch (error) {
    console.error(error);
  }
}

// Modal de detalle y gestión de subtareas
async function abrirModalDetalle(id) {
  try {
    const tarea = await fetchAPI(`/api/tareas/${id}`);
    if (!tarea) return;

    document.getElementById('detalle-ticket').textContent = tarea.ticket;
    document.getElementById('detalle-titulo').textContent = tarea.titulo;
    document.getElementById('detalle-cliente').textContent = tarea.cliente;
    document.getElementById('detalle-estado').innerHTML = `<span class="badge badge-${tarea.estado}">${tarea.estado}</span>`;
    document.getElementById('detalle-tipo').textContent = tarea.tipo_tarea.replace(/_/g, ' ');
    document.getElementById('detalle-operador').textContent = tarea.operador_nombre;
    document.getElementById('detalle-descripcion').textContent = tarea.descripcion;

    // Campos extra & credenciales
    const extraContainer = document.getElementById('detalle-campos-extra');
    extraContainer.innerHTML = '';
    
    if (tarea.tipo_tarea === 'alta_credencial_especial' && tarea.campos_extra) {
      const ticketCli = tarea.campos_extra.ticket_cliente || 'N/A';
      extraContainer.innerHTML += `<div><strong>Ticket Cliente:</strong> ${ticketCli}</div>`;
      
      const creds = tarea.campos_extra.credenciales_lista || [];
      if (creds.length > 0) {
        let tablaCreds = '<table style="width:100%; font-size:0.8rem; border-collapse:collapse; margin-top:0.3rem;"><tr style="background:rgba(255,255,255,0.05);"><th style="padding:4px; text-align:left;">Persona Asignada</th><th style="padding:4px; text-align:left;">Código Alfanumérico</th></tr>';
        creds.forEach(c => {
          tablaCreds += `<tr><td style="padding:4px; border-bottom:1px solid #334155;">${c.persona_propietaria}</td><td style="padding:4px; border-bottom:1px solid #334155; font-family:monospace; color:var(--primary);">${c.codigo_alfanumerico}</td></tr>`;
        });
        tablaCreds += '</table>';
        extraContainer.innerHTML += tablaCreds;
      }
    } else if (tarea.campos_extra && Object.keys(tarea.campos_extra).length > 0) {
      for (const [k, v] of Object.entries(tarea.campos_extra)) {
        if (typeof v !== 'object') {
          const div = document.createElement('div');
          div.innerHTML = `<strong>${k.replace(/_/g, ' ')}:</strong> ${v}`;
          extraContainer.appendChild(div);
        }
      }
    } else {
      extraContainer.innerHTML = '<span style="color:var(--text-muted);">Sin campos adicionales</span>';
    }

    // Subtareas
    renderSubtareasEnDetalle(tarea);

    // Preparar form para nueva subtarea
    document.getElementById('form-nueva-subtarea').dataset.tareaId = tarea.id;
    openModal('modal-detalle-tarea');
  } catch (error) {
    console.error(error);
  }
}

function renderSubtareasEnDetalle(tarea) {
  const list = document.getElementById('detalle-subtareas-list');
  list.innerHTML = '';

  if (!tarea.subtareas || tarea.subtareas.length === 0) {
    list.innerHTML = '<p style="color:var(--text-muted); font-size:0.85rem;">No hay subtareas registradas para esta tarea.</p>';
    return;
  }

  tarea.subtareas.forEach(sub => {
    const item = document.createElement('div');
    item.className = 'card';
    item.style.padding = '0.75rem';
    item.style.marginBottom = '0.5rem';
    item.style.display = 'flex';
    item.style.justifyContent = 'space-between';
    item.style.alignItems = 'center';
    item.innerHTML = `
      <div>
        <strong>${sub.ticket}:</strong> ${sub.titulo}
        <div style="font-size:0.75rem; color:var(--text-secondary); margin-top:2px;">${sub.descripcion || 'Sin comentarios adicionales.'}</div>
      </div>
      <div style="display:flex; align-items:center; gap:0.5rem;">
        <span class="badge badge-${sub.estado}">${sub.estado}</span>
        <button class="btn btn-danger btn-sm" onclick="eliminarSubtarea(${sub.id}, ${tarea.id})" style="padding:0.2rem 0.4rem;">
          <i class="bi bi-trash"></i>
        </button>
      </div>
    `;
    list.appendChild(item);
  });
}

async function agregarSubtareaDesdeDetalle(e) {
  e.preventDefault();
  const form = document.getElementById('form-nueva-subtarea');
  const tareaId = form.dataset.tareaId;
  const ticket = document.getElementById('sub-ticket-input').value.trim();
  const titulo = document.getElementById('sub-titulo-input').value.trim();
  const estado = document.getElementById('sub-estado-input').value;
  const descripcion = document.getElementById('sub-desc-input').value.trim();

  if (!ticket || !titulo) {
    showToast('Ticket y Título son requeridos', 'warning');
    return;
  }

  try {
    await fetchAPI(`/api/tareas/${tareaId}/subtareas`, {
      method: 'POST',
      body: JSON.stringify({ ticket, titulo, estado, descripcion })
    });
    showToast('Subtarea agregada', 'success');
    form.reset();
    
    // Recargar detalle
    const tareaActualizada = await fetchAPI(`/api/tareas/${tareaId}`);
    renderSubtareasEnDetalle(tareaActualizada);
    await cargarTareas();
  } catch (error) {
    console.error(error);
  }
}

async function eliminarSubtarea(subId, tareaId) {
  if (!confirm('¿Eliminar esta subtarea?')) return;
  try {
    await fetchAPI(`/api/subtareas/${subId}`, { method: 'DELETE' });
    showToast('Subtarea eliminada', 'info');
    const tareaActualizada = await fetchAPI(`/api/tareas/${tareaId}`);
    renderSubtareasEnDetalle(tareaActualizada);
    await cargarTareas();
  } catch (error) {
    console.error(error);
  }
}
