/**
 * Tareas JS - Gestión dinámica de tareas, múltiples credenciales, notas de actualización y subtareas
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
  const labelInicio = document.getElementById('label-fecha-inicio');
  const labelFin = document.getElementById('label-fecha-fin');
  const inputInicio = document.getElementById('fecha_programada_inicio');
  const inputFin = document.getElementById('fecha_programada_fin');
  const groupTitulo = document.getElementById('form-group-titulo');
  const inputTitulo = document.getElementById('titulo');
  const subBuilderWrapper = document.getElementById('subtasks-builder-wrapper');

  // Limpiar campos de fecha y contenedores al cambiar de tipo
  if (!editingTaskId) {
    inputInicio.value = '';
    inputFin.value = '';
  }

  if (!tipo) {
    if (groupTitulo) groupTitulo.style.display = 'block';
    if (inputTitulo) inputTitulo.required = true;
    if (credBox) credBox.style.display = 'none';
    if (container) container.style.display = 'none';
    if (subBuilderWrapper) subBuilderWrapper.style.display = 'block';
    progCheckbox.checked = false;
    progCheckbox.disabled = false;
    datesBox.style.display = 'none';
    inputInicio.required = false;
    inputFin.required = false;
    return;
  }

  // 1. Manejo del Título (Ocultar para credenciales especiales, mostrar para el resto)
  if (tipo === 'alta_credencial_especial') {
    if (groupTitulo) groupTitulo.style.display = 'none';
    if (inputTitulo) {
      inputTitulo.required = false;
      inputTitulo.value = '';
    }
    if (subBuilderWrapper) subBuilderWrapper.style.display = 'none';
  } else {
    if (groupTitulo) groupTitulo.style.display = 'block';
    if (inputTitulo) inputTitulo.required = true;
    if (subBuilderWrapper) subBuilderWrapper.style.display = 'block';
  }

  // 2. Comportamiento de Actividad Programada por Tipo
  const esSiempreProgramada = ['alta_credencial_especial', 'acceso_equipos', 'retiro_equipos', 'acceso_tecnicos', 'mantenimiento'].includes(tipo);
  
  if (esSiempreProgramada) {
    progCheckbox.checked = true;
    progCheckbox.disabled = true;
    datesBox.style.display = 'grid';
    inputInicio.required = true;
    labelInicio.innerHTML = 'Fecha / Hora Inicio <span style="color:var(--danger)">* (Obligatoria)</span>';

    if (tipo === 'alta_credencial_especial' || tipo === 'mantenimiento') {
      labelFin.innerHTML = 'Fecha / Hora Fin <span style="color:var(--danger)">* (Obligatoria)</span>';
      inputFin.required = true;
    } else {
      labelFin.innerHTML = 'Fecha / Hora Fin <span style="color:var(--text-muted); font-size:0.75rem;">(Opcional)</span>';
      inputFin.required = false;
    }
  } else {
    progCheckbox.checked = false;
    progCheckbox.disabled = false;
    datesBox.style.display = 'none';
    inputInicio.required = false;
    inputFin.required = false;
    labelInicio.innerHTML = 'Fecha / Hora Inicio';
    labelFin.innerHTML = 'Fecha / Hora Fin';
  }

  // 3. MÓDULO DEDICADO: ALTA DE CREDENCIALES ESPECIALES MÚLTIPLES
  if (tipo === 'alta_credencial_especial') {
    credBox.style.display = 'block';
    if (container) container.style.display = 'none';
    if (!editingTaskId && document.querySelectorAll('.credential-row').length === 0) {
      agregarFilaCredencial();
    }
    return;
  } else {
    credBox.style.display = 'none';
  }

  // 4. OTROS CAMPOS DINÁMICOS (Salas de Datacenter, Sitios externos, etc.)
  let campos = (regionConfig && regionConfig.campos_extra && regionConfig.campos_extra[tipo]) || [];
  
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

let tabActivaPrincipal = 'operativas';

// Cambiar Pestaña Principal (Operativas / Credenciales / Planificadas)
function cambiarPestanaPrincipal(tab) {
  tabActivaPrincipal = tab;

  // Botones de pestañas
  const tabs = ['operativas', 'credenciales', 'planificadas'];
  tabs.forEach(t => {
    const btn = document.getElementById(`tab-btn-main-${t}`);
    const panel = document.getElementById(`panel-tab-${t}`);
    if (btn) {
      if (t === tab) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    }
    if (panel) {
      panel.style.display = (t === tab) ? 'block' : 'none';
    }
  });

  // Actualizar botón de creación en navbar
  const btnCrearLabel = document.getElementById('label-btn-crear-accion');
  if (btnCrearLabel) {
    if (tab === 'credenciales') {
      btnCrearLabel.textContent = 'Alta Credencial Especial';
    } else if (tab === 'planificadas') {
      btnCrearLabel.textContent = 'Cargar Tarea Planificada';
    } else {
      btnCrearLabel.textContent = 'Nueva Tarea Operativa';
    }
  }
}

function abrirModalSegunPestana() {
  if (tabActivaPrincipal === 'credenciales') {
    abrirModalNuevaTarea('alta_credencial_especial');
  } else if (tabActivaPrincipal === 'planificadas') {
    abrirModalNuevaTarea('acceso_equipos');
  } else {
    abrirModalNuevaTarea('manos_remotas');
  }
}

// Categorizar tareas para las 3 vistas
function categorizarTareas(tareas) {
  const operativas = [];
  const credenciales = [];
  const planificadas = [];

  tareas.forEach(tarea => {
    if (tarea.tipo_tarea === 'alta_credencial_especial') {
      credenciales.push(tarea);
    } else if (
      ['acceso_equipos', 'retiro_equipos', 'acceso_tecnicos', 'mantenimiento'].includes(tarea.tipo_tarea) ||
      tarea.es_actividad_programada === true
    ) {
      planificadas.push(tarea);
    } else {
      operativas.push(tarea);
    }
  });

  return { operativas, credenciales, planificadas };
}

function formatFechaHora(isoStr) {
  if (!isoStr) return '-';
  return isoStr.replace('T', ' ').substring(0, 16);
}

function obtenerEstadoVigencia(inicioStr, finStr) {
  if (!inicioStr) return { clase: 'badge-vigencia-activa', texto: 'Indefinida', icon: 'bi-infinity' };
  
  const ahora = new Date();
  const inicio = new Date(inicioStr.replace(' ', 'T'));
  const fin = finStr ? new Date(finStr.replace(' ', 'T')) : null;

  if (ahora < inicio) {
    return { clase: 'badge-vigencia-proxima', texto: 'Próxima', icon: 'bi-hourglass-split' };
  } else if (fin && ahora > fin) {
    return { clase: 'badge-vigencia-finalizada', texto: 'Finalizada / Vencida', icon: 'bi-x-circle' };
  } else {
    return { clase: 'badge-vigencia-activa', texto: 'Vigente / Activa', icon: 'bi-check-circle' };
  }
}

// 5. Cargar lista de tareas
async function cargarTareas() {
  const tbodyOp = document.getElementById('tbody-operativas');
  const tbodyCred = document.getElementById('tbody-credenciales');
  const tbodyPlan = document.getElementById('tbody-planificadas');

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
    if (tbodyOp) tbodyOp.innerHTML = '<tr><td colspan="7" style="text-align:center; color:var(--text-muted);">Cargando tareas operativas...</td></tr>';
    if (tbodyCred) tbodyCred.innerHTML = '<tr><td colspan="7" style="text-align:center; color:var(--text-muted);">Cargando credenciales especiales...</td></tr>';
    if (tbodyPlan) tbodyPlan.innerHTML = '<tr><td colspan="8" style="text-align:center; color:var(--text-muted);">Cargando tareas planificadas...</td></tr>';

    const tareas = await fetchAPI(`/api/tareas?${queryParams.toString()}`);
    currentTasks = tareas;

    const { operativas, credenciales, planificadas } = categorizarTareas(tareas);

    // Actualizar badges contadores en pestañas
    const badgeOp = document.getElementById('badge-count-operativas');
    const badgeCred = document.getElementById('badge-count-credenciales');
    const badgePlan = document.getElementById('badge-count-planificadas');
    if (badgeOp) badgeOp.textContent = operativas.length;
    if (badgeCred) badgeCred.textContent = credenciales.length;
    if (badgePlan) badgePlan.textContent = planificadas.length;

    // Renderizar tablas
    renderTablaOperativas(operativas);
    renderTablaCredenciales(credenciales);
    renderTablaPlanificadas(planificadas);
  } catch (error) {
    if (tbodyOp) tbodyOp.innerHTML = '<tr><td colspan="7" style="text-align:center; color:var(--danger);">Error al cargar tareas</td></tr>';
    if (tbodyCred) tbodyCred.innerHTML = '<tr><td colspan="7" style="text-align:center; color:var(--danger);">Error al cargar credenciales</td></tr>';
    if (tbodyPlan) tbodyPlan.innerHTML = '<tr><td colspan="8" style="text-align:center; color:var(--danger);">Error al cargar planificadas</td></tr>';
  }
}

// 6.1 Renderizar Tabla: Tareas Diarias Operativas
function renderTablaOperativas(tareas) {
  const tbody = document.getElementById('tbody-operativas');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (tareas.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:var(--text-muted); padding:1.5rem;">No se encontraron tareas operativas registradas</td></tr>';
    return;
  }

  tareas.forEach(tarea => {
    const tr = document.createElement('tr');

    let detalleAdicional = '';
    if (tarea.campos_extra?.sitio_externo) {
      detalleAdicional = `<div style="font-size:0.75rem; color:var(--text-muted);"><i class="bi bi-globe"></i> ${tarea.campos_extra.sitio_externo} (${tarea.campos_extra.cantidad_contactos || 0} contactos)</div>`;
    }

    const cantActualizaciones = tarea.actualizaciones ? tarea.actualizaciones.length : (tarea.total_actualizaciones || 0);
    const cantSubtareas = tarea.subtareas ? tarea.subtareas.length : (tarea.total_subtareas || 0);

    let badgesColaboracion = '';
    if (cantActualizaciones > 0) {
      badgesColaboracion += `<span class="badge" style="background:rgba(14,165,233,0.15); color:var(--primary); font-size:0.7rem; margin-right:4px;"><i class="bi bi-chat-dots"></i> ${cantActualizaciones} nota(s)</span>`;
    }
    if (cantSubtareas > 0) {
      badgesColaboracion += `<span class="badge" style="background:rgba(139,92,246,0.15); color:var(--purple); font-size:0.7rem;"><i class="bi bi-list-task"></i> ${cantSubtareas} sub.</span>`;
    }

    const tipoLabel = tarea.tipo_tarea.replace(/_/g, ' ');

    tr.innerHTML = `
      <td>
        <strong style="color:var(--primary); font-family:monospace;">${tarea.ticket}</strong>
        <div style="font-size:0.75rem; color:var(--text-muted);">${tarea.created_at ? tarea.created_at.substring(0, 16) : '-'}</div>
      </td>
      <td>
        <div><strong>${tarea.titulo}</strong></div>
        <div style="font-size:0.8rem; color:var(--text-secondary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:320px;">${tarea.descripcion}</div>
        ${detalleAdicional}
        <div style="margin-top:3px;">${badgesColaboracion}</div>
      </td>
      <td><span style="color:var(--text-primary); font-weight:500;">${tarea.cliente}</span></td>
      <td><span class="badge" style="background:var(--bg-surface-hover); color:var(--text-secondary); text-transform:capitalize;">${tipoLabel}</span></td>
      <td><span class="badge badge-${tarea.estado}">${tarea.estado.replace('_', ' ')}</span></td>
      <td><small style="color:var(--text-secondary);">${tarea.operador_nombre}</small></td>
      <td style="text-align: right;">
        <div style="display:inline-flex; gap:0.35rem;">
          <button class="btn btn-secondary btn-sm" onclick="abrirModalDetalle(${tarea.id})" title="Ver caso, notas y subtareas" style="padding:0.25rem 0.5rem;">
            <i class="bi bi-eye"></i>
          </button>
          <button class="btn btn-secondary btn-sm" onclick="editarTarea(${tarea.id})" title="Editar Tarea" style="padding:0.25rem 0.5rem;">
            <i class="bi bi-pencil"></i>
          </button>
          <button class="btn btn-danger btn-sm" onclick="eliminarTarea(${tarea.id})" title="Eliminar Tarea" style="padding:0.25rem 0.5rem;">
            <i class="bi bi-trash"></i>
          </button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// 6.2 Renderizar Tabla: Credenciales Especiales
function renderTablaCredenciales(tareas) {
  const tbody = document.getElementById('tbody-credenciales');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (tareas.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:var(--text-muted); padding:1.5rem;">No se encontraron credenciales especiales registradas</td></tr>';
    return;
  }

  tareas.forEach(tarea => {
    const tr = document.createElement('tr');

    const ticketCliente = tarea.campos_extra?.ticket_cliente || tarea.cliente || '-';
    
    // Lista de personas y códigos
    let personasHtml = '';
    const credList = tarea.campos_extra?.credenciales_lista || [];
    if (credList.length > 0) {
      personasHtml = '<div style="display:flex; flex-direction:column; gap:3px;">' + credList.map(c => `
        <div style="font-size:0.8rem; display:flex; align-items:center; gap:0.4rem;">
          <i class="bi bi-person-badge" style="color:var(--text-muted);"></i>
          <strong>${c.persona_propietaria}</strong>
          <span class="badge" style="font-family:monospace; background:rgba(14,165,233,0.15); color:var(--primary); font-size:0.75rem;">${c.codigo_alfanumerico}</span>
        </div>
      `).join('') + '</div>';
    } else if (tarea.campos_extra?.persona_propietaria) {
      personasHtml = `<div><strong>${tarea.campos_extra.persona_propietaria}</strong> <span class="badge" style="font-family:monospace; background:rgba(14,165,233,0.15); color:var(--primary); font-size:0.75rem;">${tarea.campos_extra.codigo_alfanumerico || ''}</span></div>`;
    } else {
      personasHtml = `<span style="color:var(--text-muted);">-</span>`;
    }

    const fInicio = formatFechaHora(tarea.fecha_programada_inicio);
    const fFin = formatFechaHora(tarea.fecha_programada_fin);
    const ventanaHtml = `
      <div style="font-size:0.78rem; line-height:1.3;">
        <div><i class="bi bi-play-circle" style="color:#34d399;"></i> <strong>Inicio:</strong> ${fInicio}</div>
        <div><i class="bi bi-stop-circle" style="color:#f87171;"></i> <strong>Fin:</strong> ${fFin}</div>
      </div>
    `;

    const vig = obtenerEstadoVigencia(tarea.fecha_programada_inicio, tarea.fecha_programada_fin);
    const vigBadge = `<span class="badge-vigencia ${vig.clase}"><i class="bi ${vig.icon}"></i> ${vig.texto}</span>`;

    tr.innerHTML = `
      <td>
        <strong style="color:var(--primary); font-family:monospace;">${tarea.ticket}</strong>
        <div style="font-size:0.75rem; color:var(--text-muted);">${tarea.created_at ? tarea.created_at.substring(0, 16) : '-'}</div>
      </td>
      <td>
        <span class="badge" style="background:rgba(56,189,248,0.1); border:1px solid rgba(56,189,248,0.3); color:#38bdf8; font-family:monospace;">${ticketCliente}</span>
        <div style="font-size:0.75rem; color:var(--text-secondary); margin-top:2px;">Cliente: ${tarea.cliente}</div>
      </td>
      <td>${personasHtml}</td>
      <td>${ventanaHtml}</td>
      <td>${vigBadge}</td>
      <td><small style="color:var(--text-secondary);">${tarea.operador_nombre}</small></td>
      <td style="text-align: right;">
        <div style="display:inline-flex; gap:0.35rem;">
          <button class="btn btn-secondary btn-sm" onclick="abrirModalDetalle(${tarea.id})" title="Ver caso y credenciales" style="padding:0.25rem 0.5rem;">
            <i class="bi bi-eye"></i>
          </button>
          <button class="btn btn-secondary btn-sm" onclick="editarTarea(${tarea.id})" title="Editar Credencial" style="padding:0.25rem 0.5rem;">
            <i class="bi bi-pencil"></i>
          </button>
          <button class="btn btn-danger btn-sm" onclick="eliminarTarea(${tarea.id})" title="Eliminar Credencial" style="padding:0.25rem 0.5rem;">
            <i class="bi bi-trash"></i>
          </button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// 6.3 Renderizar Tabla: Tareas Planificadas
function renderTablaPlanificadas(tareas) {
  const tbody = document.getElementById('tbody-planificadas');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (tareas.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; color:var(--text-muted); padding:1.5rem;">No se encontraron actividades planificadas registradas</td></tr>';
    return;
  }

  tareas.forEach(tarea => {
    const tr = document.createElement('tr');

    const tipoLabel = tarea.tipo_tarea.replace(/_/g, ' ');
    const ubicacion = tarea.campos_extra?.sala_datacenter || tarea.campos_extra?.sitio_mantenimiento || '-';

    const pInicio = formatFechaHora(tarea.fecha_programada_inicio);
    const pFin = tarea.fecha_programada_fin ? formatFechaHora(tarea.fecha_programada_fin) : 'Indefinida';
    const pVentana = `
      <div style="font-size:0.78rem; line-height:1.3;">
        <div><i class="bi bi-calendar-event"></i> <strong>Inicio:</strong> ${pInicio}</div>
        <div><i class="bi bi-calendar-check"></i> <strong>Fin:</strong> ${pFin}</div>
      </div>
    `;

    const vig = obtenerEstadoVigencia(tarea.fecha_programada_inicio, tarea.fecha_programada_fin);
    const vigBadge = `<span class="badge-vigencia ${vig.clase}" style="margin-top:3px; display:inline-block;"><i class="bi ${vig.icon}"></i> ${vig.texto}</span>`;

    tr.innerHTML = `
      <td>
        <strong style="color:var(--primary); font-family:monospace;">${tarea.ticket}</strong>
        <div style="font-size:0.75rem; color:var(--text-muted);">${tarea.created_at ? tarea.created_at.substring(0, 16) : '-'}</div>
      </td>
      <td>
        <div><strong>${tarea.titulo}</strong></div>
        <span class="badge badge-programada" style="background:var(--bg-surface-hover); color:var(--text-secondary); text-transform:capitalize;">${tipoLabel}</span>
      </td>
      <td><span style="color:var(--text-primary); font-weight:500;">${tarea.cliente}</span></td>
      <td>
        <div style="font-size:0.8rem; color:var(--text-secondary); display:flex; align-items:center; gap:0.3rem;">
          <i class="bi bi-geo-alt" style="color:var(--primary);"></i> ${ubicacion}
        </div>
      </td>
      <td>${pVentana}</td>
      <td>
        <span class="badge badge-${tarea.estado}">${tarea.estado.replace('_', ' ')}</span>
        <div>${vigBadge}</div>
      </td>
      <td><small style="color:var(--text-secondary);">${tarea.operador_nombre}</small></td>
      <td style="text-align: right;">
        <div style="display:inline-flex; gap:0.35rem;">
          <button class="btn btn-secondary btn-sm" onclick="abrirModalDetalle(${tarea.id})" title="Ver caso, notas y subtareas" style="padding:0.25rem 0.5rem;">
            <i class="bi bi-eye"></i>
          </button>
          <button class="btn btn-secondary btn-sm" onclick="editarTarea(${tarea.id})" title="Editar Tarea" style="padding:0.25rem 0.5rem;">
            <i class="bi bi-pencil"></i>
          </button>
          <button class="btn btn-danger btn-sm" onclick="eliminarTarea(${tarea.id})" title="Eliminar Tarea" style="padding:0.25rem 0.5rem;">
            <i class="bi bi-trash"></i>
          </button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// 7. Configuración de Event Listeners
function setupEventListeners() {
  document.getElementById('tipo_tarea')?.addEventListener('change', onTipoTareaChange);

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

  // Botones Builder en Formulario de Creación
  document.getElementById('btn-add-update-row')?.addEventListener('click', () => agregarFilaNota());
  document.getElementById('btn-add-subtask-row')?.addEventListener('click', () => agregarFilaSubtarea());

  // Formulario Tarea Submit
  document.getElementById('form-tarea')?.addEventListener('submit', guardarTarea);
}

// 8. Filas en Constructor de Modal de Creación
function agregarFilaNota(desc = '', estado = '') {
  const container = document.getElementById('subtasks-rows-container');
  if (!container) return;

  const row = document.createElement('div');
  row.className = 'note-entry-row';
  row.style.background = 'rgba(14, 165, 233, 0.08)';
  row.style.border = '1px solid rgba(14, 165, 233, 0.25)';
  row.style.borderRadius = 'var(--radius-sm)';
  row.style.padding = '0.5rem';
  row.style.marginBottom = '0.4rem';
  row.style.display = 'grid';
  row.style.gridTemplateColumns = '1fr 140px 32px';
  row.style.gap = '0.4rem';
  row.style.alignItems = 'center';

  row.innerHTML = `
    <input type="text" class="form-control form-control-sm note-desc" placeholder="Nota / Novedad de seguimiento del operador..." value="${desc}" required>
    <select class="form-select form-control-sm note-estado">
      <option value="">(Mismo estado)</option>
      <option value="pendiente" ${estado === 'pendiente' ? 'selected' : ''}>Pendiente</option>
      <option value="en_progreso" ${estado === 'en_progreso' ? 'selected' : ''}>En Progreso</option>
      <option value="completada" ${estado === 'completada' ? 'selected' : ''}>Completada</option>
      <option value="cancelada" ${estado === 'cancelada' ? 'selected' : ''}>Cancelada</option>
    </select>
    <button type="button" class="btn btn-danger btn-sm" onclick="this.closest('.note-entry-row').remove()" style="padding:0.2rem 0.35rem;" title="Eliminar nota">
      <i class="bi bi-x"></i>
    </button>
  `;
  container.appendChild(row);
}

function agregarFilaSubtarea(ticket = '', titulo = '', estado = 'pendiente', desc = '') {
  const container = document.getElementById('subtasks-rows-container');
  if (!container) return;

  const row = document.createElement('div');
  row.className = 'subtask-row';
  row.innerHTML = `
    <input type="text" class="form-control form-control-sm sub-ticket" placeholder="Ticket (ej: SUB-01)" value="${ticket}">
    <input type="text" class="form-control form-control-sm sub-titulo" placeholder="Título de subtarea" value="${titulo}">
    <select class="form-select form-control-sm sub-estado">
      <option value="pendiente" ${estado === 'pendiente' ? 'selected' : ''}>Pendiente</option>
      <option value="en_progreso" ${estado === 'en_progreso' ? 'selected' : ''}>En Progreso</option>
      <option value="completada" ${estado === 'completada' ? 'selected' : ''}>Completada</option>
      <option value="cancelada" ${estado === 'cancelada' ? 'selected' : ''}>Cancelada</option>
    </select>
    <button type="button" class="btn btn-danger btn-sm" onclick="this.closest('.subtask-row').remove()" style="padding:0.25rem 0.4rem;" title="Eliminar subtarea">
      <i class="bi bi-x"></i>
    </button>
    <div class="subtask-row-desc">
      <input type="text" class="form-control form-control-sm sub-desc" placeholder="Detalle técnico de subtarea..." value="${desc}">
    </div>
  `;
  container.appendChild(row);
}

function abrirModalNuevaTarea(tipoPredefinido = null) {
  editingTaskId = null;
  document.getElementById('form-tarea').reset();
  document.getElementById('modal-tarea-title').textContent = 'Nueva Tarea de Bitácora';
  document.getElementById('subtasks-rows-container').innerHTML = '';
  document.getElementById('credentials-rows-container').innerHTML = '';
  document.getElementById('credentials-module-box').style.display = 'none';
  document.getElementById('dynamic-fields-container').innerHTML = '';
  document.getElementById('fechas-programadas-box').style.display = 'none';
  document.getElementById('es_actividad_programada').disabled = false;
  document.getElementById('subtasks-builder-wrapper').style.display = 'block';

  if (tipoPredefinido) {
    const selectTipo = document.getElementById('tipo_tarea');
    if (selectTipo) {
      selectTipo.value = tipoPredefinido;
      onTipoTareaChange();
    }
  }

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
    // Renderizar campos extra dinámicos
    const container = document.getElementById('dynamic-fields-container');
    let camposExtra = (regionConfig && regionConfig.campos_extra && regionConfig.campos_extra[tarea.tipo_tarea]) || [];
    if (['acceso_equipos', 'retiro_equipos', 'acceso_tecnicos', 'mantenimiento'].includes(tarea.tipo_tarea)) {
      const salas = regionConfig.salas_datacenter || [];
      camposExtra = camposExtra.map(c => (c.nombre === 'sala_datacenter' || c.nombre === 'sitio_mantenimiento') ? { ...c, opciones: salas } : c);
    }
    renderDynamicFields(container, camposExtra, tarea.campos_extra || {});
  }

  // Subtareas y Actualizaciones
  const subContainer = document.getElementById('subtasks-rows-container');
  subContainer.innerHTML = '';
  (tarea.subtareas || []).forEach(sub => {
    agregarFilaSubtarea(sub.ticket, sub.titulo, sub.estado, sub.descripcion);
  });
  (tarea.actualizaciones || []).forEach(act => {
    agregarFilaNota(act.descripcion, act.estado);
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

  // Extraer subtareas y notas de seguimiento
  const subtareas = [];
  document.querySelectorAll('.subtask-row').forEach(row => {
    const t = row.querySelector('.sub-ticket')?.value.trim();
    const tit = row.querySelector('.sub-titulo')?.value.trim();
    const est = row.querySelector('.sub-estado')?.value;
    const desc = row.querySelector('.sub-desc')?.value.trim();
    if (t && tit) {
      subtareas.push({ tipo_entrada: 'subtarea', ticket: t, titulo: tit, estado: est, descripcion: desc });
    }
  });

  document.querySelectorAll('.note-entry-row').forEach(row => {
    const desc = row.querySelector('.note-desc')?.value.trim();
    const est = row.querySelector('.note-estado')?.value;
    if (desc) {
      subtareas.push({ tipo_entrada: 'actualizacion', descripcion: desc, estado: est || null });
    }
  });

  let tituloVal = document.getElementById('titulo').value.trim();
  if (tipo_tarea === 'alta_credencial_especial' && !tituloVal) {
    tituloVal = `Alta de Credenciales Especiales - ${campos_extra.ticket_cliente || document.getElementById('ticket').value.trim()}`;
  }

  const payload = {
    ticket: document.getElementById('ticket').value.trim(),
    titulo: tituloVal,
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
  if (!confirm('¿Está seguro de eliminar esta tarea?')) return;

  try {
    await fetchAPI(`/api/tareas/${id}`, { method: 'DELETE' });
    showToast('Tarea eliminada', 'info');
    await cargarTareas();
  } catch (error) {
    console.error(error);
  }
}

// 9. Modal de detalle con pestañas separadas de Actualizaciones y Subtareas
async function abrirModalDetalle(id) {
  try {
    const tarea = await fetchAPI(`/api/tareas/${id}`);
    if (!tarea) return;

    document.getElementById('detalle-ticket').textContent = tarea.ticket;
    document.getElementById('detalle-titulo').textContent = tarea.titulo;
    document.getElementById('detalle-cliente').textContent = tarea.cliente;
    document.getElementById('detalle-estado').innerHTML = `<span class="badge badge-${tarea.estado}">${tarea.estado.replace('_', ' ')}</span>`;
    document.getElementById('detalle-tipo').textContent = tarea.tipo_tarea.replace(/_/g, ' ');
    document.getElementById('detalle-operador').textContent = tarea.operador_nombre;
    document.getElementById('detalle-fecha').textContent = tarea.created_at || '-';
    document.getElementById('detalle-descripcion').textContent = tarea.descripcion;

    // Campos extra & credenciales
    const extraBox = document.getElementById('detalle-extra-box');
    const extraContainer = document.getElementById('detalle-campos-extra');
    extraContainer.innerHTML = '';
    
    if (tarea.tipo_tarea === 'alta_credencial_especial') {
      extraBox.style.display = 'block';
      const ticketCli = tarea.campos_extra?.ticket_cliente || 'N/A';
      extraContainer.innerHTML += `<div><strong>Ticket Cliente:</strong> ${ticketCli}</div>`;
      
      const creds = tarea.campos_extra?.credenciales_lista || [];
      if (creds.length > 0) {
        let tablaCreds = '<table style="width:100%; font-size:0.8rem; border-collapse:collapse; margin-top:0.3rem;"><tr style="background:rgba(255,255,255,0.05);"><th style="padding:4px; text-align:left;">Persona Asignada</th><th style="padding:4px; text-align:left;">Código Alfanumérico</th></tr>';
        creds.forEach(c => {
          tablaCreds += `<tr><td style="padding:4px; border-bottom:1px solid #334155;">${c.persona_propietaria}</td><td style="padding:4px; border-bottom:1px solid #334155; font-family:monospace; color:var(--primary);">${c.codigo_alfanumerico}</td></tr>`;
        });
        tablaCreds += '</table>';
        extraContainer.innerHTML += tablaCreds;
      }
      
      // Ocultar sección de colaboración en credenciales
      document.getElementById('detalle-collaboration-section').style.display = 'none';
    } else {
      document.getElementById('detalle-collaboration-section').style.display = 'block';
      
      if (tarea.campos_extra && Object.keys(tarea.campos_extra).length > 0) {
        extraBox.style.display = 'block';
        for (const [k, v] of Object.entries(tarea.campos_extra)) {
          if (typeof v !== 'object') {
            const div = document.createElement('div');
            div.innerHTML = `<strong>${k.replace(/_/g, ' ')}:</strong> ${v}`;
            extraContainer.appendChild(div);
          }
        }
      } else {
        extraBox.style.display = 'none';
      }

      // Renderizar pestañas
      renderActualizacionesEnDetalle(tarea);
      renderSubtareasEnDetalle(tarea);
      switchDetalleTab('actualizaciones');

      document.getElementById('form-nueva-actualizacion').dataset.tareaId = tarea.id;
      document.getElementById('form-nueva-subtarea').dataset.tareaId = tarea.id;
    }

    openModal('modal-detalle-tarea');
  } catch (error) {
    console.error(error);
  }
}

function switchDetalleTab(tab) {
  const btnAct = document.getElementById('tab-btn-actualizaciones');
  const btnSub = document.getElementById('tab-btn-subtareas');
  const panelAct = document.getElementById('panel-actualizaciones');
  const panelSub = document.getElementById('panel-subtareas');

  if (tab === 'actualizaciones') {
    btnAct.style.background = 'var(--bg-surface)';
    btnAct.style.borderColor = 'var(--border-color)';
    btnAct.style.borderBottom = 'none';
    btnAct.style.color = 'var(--primary)';
    btnAct.style.fontWeight = '700';

    btnSub.style.background = 'transparent';
    btnSub.style.borderColor = 'transparent';
    btnSub.style.color = 'var(--text-secondary)';
    btnSub.style.fontWeight = '600';

    panelAct.style.display = 'block';
    panelSub.style.display = 'none';
  } else {
    btnSub.style.background = 'var(--bg-surface)';
    btnSub.style.borderColor = 'var(--border-color)';
    btnSub.style.borderBottom = 'none';
    btnSub.style.color = 'var(--primary)';
    btnSub.style.fontWeight = '700';

    btnAct.style.background = 'transparent';
    btnAct.style.borderColor = 'transparent';
    btnAct.style.color = 'var(--text-secondary)';
    btnAct.style.fontWeight = '600';

    panelSub.style.display = 'block';
    panelAct.style.display = 'none';
  }
}

function renderActualizacionesEnDetalle(tarea) {
  const list = document.getElementById('detalle-actualizaciones-list');
  const countSpan = document.getElementById('count-actualizaciones');
  list.innerHTML = '';

  const actuals = tarea.actualizaciones || [];
  if (countSpan) countSpan.textContent = actuals.length;

  if (actuals.length === 0) {
    list.innerHTML = '<p style="color:var(--text-muted); font-size:0.85rem; padding:0.5rem 0;">No hay notas de seguimiento registradas. Agregue una actualización abajo para asentar novedades.</p>';
    return;
  }

  actuals.forEach(act => {
    const card = document.createElement('div');
    card.className = 'card';
    card.style.padding = '0.65rem 0.85rem';
    card.style.marginBottom = '0.5rem';
    card.style.background = 'rgba(30, 41, 59, 0.7)';
    card.style.borderLeft = '3px solid var(--primary)';
    
    card.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.25rem;">
        <div style="font-size:0.8rem; font-weight:700; color:var(--primary); display:flex; align-items:center; gap:0.4rem;">
          <i class="bi bi-person-circle"></i> ${act.operador_nombre || 'Operador'}
          <span style="font-size:0.75rem; font-weight:normal; color:var(--text-muted);">(${act.created_at || ''})</span>
        </div>
        <div style="display:flex; align-items:center; gap:0.4rem;">
          ${act.estado ? `<span class="badge badge-${act.estado}">${act.estado.replace('_', ' ')}</span>` : ''}
          <button class="btn btn-danger btn-sm" onclick="eliminarEntradaSeguimiento(${act.id}, ${tarea.id})" style="padding:0.15rem 0.35rem;" title="Eliminar nota">
            <i class="bi bi-trash"></i>
          </button>
        </div>
      </div>
      <div style="font-size:0.85rem; color:var(--text-primary); white-space:pre-wrap;">${act.descripcion}</div>
    `;
    list.appendChild(card);
  });
}

function renderSubtareasEnDetalle(tarea) {
  const list = document.getElementById('detalle-subtareas-list');
  const countSpan = document.getElementById('count-subtareas');
  list.innerHTML = '';

  const subtareas = tarea.subtareas || [];
  if (countSpan) countSpan.textContent = subtareas.length;

  if (subtareas.length === 0) {
    list.innerHTML = '<p style="color:var(--text-muted); font-size:0.85rem; padding:0.5rem 0;">No hay subtareas con ticket registradas para este caso.</p>';
    return;
  }

  subtareas.forEach(sub => {
    const item = document.createElement('div');
    item.className = 'card';
    item.style.padding = '0.65rem 0.85rem';
    item.style.marginBottom = '0.5rem';
    item.style.display = 'flex';
    item.style.justifyContent = 'space-between';
    item.style.alignItems = 'center';
    item.innerHTML = `
      <div>
        <strong style="color:var(--primary); font-size:0.85rem;">[${sub.ticket}]</strong> <span style="font-weight:600; font-size:0.85rem;">${sub.titulo}</span>
        <div style="font-size:0.75rem; color:var(--text-secondary); margin-top:2px;">${sub.descripcion || 'Sin comentarios adicionales.'}</div>
        ${sub.operador_nombre ? `<small style="color:var(--text-muted); font-size:0.7rem;">Cargado por: ${sub.operador_nombre}</small>` : ''}
      </div>
      <div style="display:flex; align-items:center; gap:0.5rem;">
        <span class="badge badge-${sub.estado}">${sub.estado.replace('_', ' ')}</span>
        <button class="btn btn-danger btn-sm" onclick="eliminarEntradaSeguimiento(${sub.id}, ${tarea.id})" style="padding:0.2rem 0.4rem;" title="Eliminar subtarea">
          <i class="bi bi-trash"></i>
        </button>
      </div>
    `;
    list.appendChild(item);
  });
}

async function agregarActualizacionDesdeDetalle(e) {
  e.preventDefault();
  const form = document.getElementById('form-nueva-actualizacion');
  const tareaId = form.dataset.tareaId;
  const descripcion = document.getElementById('act-desc-input').value.trim();
  const nuevoEstado = document.getElementById('act-estado-input').value;

  if (!descripcion) {
    showToast('El texto de la actualización es requerido', 'warning');
    return;
  }

  try {
    await fetchAPI(`/api/tareas/${tareaId}/actualizaciones`, {
      method: 'POST',
      body: JSON.stringify({
        tipo_entrada: 'actualizacion',
        descripcion: descripcion,
        estado: nuevoEstado || null
      })
    });
    showToast('Actualización registrada correctamente', 'success');
    form.reset();

    // Recargar detalle y lista
    const tareaActualizada = await fetchAPI(`/api/tareas/${tareaId}`);
    document.getElementById('detalle-estado').innerHTML = `<span class="badge badge-${tareaActualizada.estado}">${tareaActualizada.estado.replace('_', ' ')}</span>`;
    renderActualizacionesEnDetalle(tareaActualizada);
    renderSubtareasEnDetalle(tareaActualizada);
    await cargarTareas();
  } catch (error) {
    console.error(error);
  }
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
    showToast('Ticket y Título son requeridos para la subtarea', 'warning');
    return;
  }

  try {
    await fetchAPI(`/api/tareas/${tareaId}/subtareas`, {
      method: 'POST',
      body: JSON.stringify({
        tipo_entrada: 'subtarea',
        ticket,
        titulo,
        estado,
        descripcion
      })
    });
    showToast('Subtarea agregada', 'success');
    form.reset();
    
    // Recargar detalle y lista
    const tareaActualizada = await fetchAPI(`/api/tareas/${tareaId}`);
    renderActualizacionesEnDetalle(tareaActualizada);
    renderSubtareasEnDetalle(tareaActualizada);
    await cargarTareas();
  } catch (error) {
    console.error(error);
  }
}

async function eliminarEntradaSeguimiento(subId, tareaId) {
  if (!confirm('¿Está seguro de eliminar este registro?')) return;
  try {
    await fetchAPI(`/api/subtareas/${subId}`, { method: 'DELETE' });
    showToast('Registro eliminado', 'info');
    const tareaActualizada = await fetchAPI(`/api/tareas/${tareaId}`);
    renderActualizacionesEnDetalle(tareaActualizada);
    renderSubtareasEnDetalle(tareaActualizada);
    await cargarTareas();
  } catch (error) {
    console.error(error);
  }
}
