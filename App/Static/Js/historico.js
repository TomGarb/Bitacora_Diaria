/**
 * Histórico JS - Consulta, auditoría y segmentación en 8 pestañas temáticas
 */

let currentTasks = [];
let tabActiva = 'normal';

const CATEGORIAS_DEF = {
  normal: ['manos_remotas', 'manos_inteligentes', 'virtualizacion', 'restore', 'backup', 'snapshot', 'incidente'],
  personal: ['acceso_tecnicos'],
  equipamiento: ['acceso_equipos', 'retiro_equipos'],
  mantenimientos: ['mantenimiento'],
  credenciales: ['alta_credencial_especial'],
  externos: ['manejo_sitio_externo'],
  notas: ['nota_de_turno'],
  extras: ['tarea_extra']
};

document.addEventListener('DOMContentLoaded', () => {
  // Preset inicial: Últimos 30 días
  aplicarPresetFecha('mes', false);
  setupEventListeners();
  cargarHistorico();
});

function setupEventListeners() {
  ['filter-fecha-desde', 'filter-fecha-hasta', 'filter-estado', 'filter-region'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', () => cargarHistorico());
  });

  let searchTimeout;
  document.getElementById('search-input')?.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(cargarHistorico, 350);
  });
}

// 1. Presets Rápidos de Fechas
function aplicarPresetFecha(preset, recargar = true) {
  const hoy = new Date();
  const inputDesde = document.getElementById('filter-fecha-desde');
  const inputHasta = document.getElementById('filter-fecha-hasta');

  // Actualizar estilo visual de los botones de preset
  document.querySelectorAll('.date-preset-btn').forEach(btn => btn.classList.remove('active'));

  if (preset === 'hoy') {
    const hoyStr = hoy.toISOString().split('T')[0];
    inputDesde.value = hoyStr;
    inputHasta.value = hoyStr;
    event?.target?.classList?.add('active');
  } else if (preset === '7dias') {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    inputDesde.value = d.toISOString().split('T')[0];
    inputHasta.value = hoy.toISOString().split('T')[0];
    event?.target?.classList?.add('active');
  } else if (preset === 'mes') {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    inputDesde.value = d.toISOString().split('T')[0];
    inputHasta.value = hoy.toISOString().split('T')[0];
    const btnMes = document.querySelector('.date-preset-btn:nth-child(4)');
    if (btnMes) btnMes.classList.add('active');
  } else if (preset === 'todo') {
    inputDesde.value = '';
    inputHasta.value = '';
    event?.target?.classList?.add('active');
  }

  if (recargar) {
    cargarHistorico();
  }
}

function limpiarFiltros() {
  document.getElementById('search-input').value = '';
  document.getElementById('filter-fecha-desde').value = '';
  document.getElementById('filter-fecha-hasta').value = '';
  document.getElementById('filter-estado').value = '';
  document.querySelectorAll('.date-preset-btn').forEach(btn => btn.classList.remove('active'));
  cargarHistorico();
}

// 2. Cambio entre las 8 Pestañas
function cambiarPestanaHistorico(tab) {
  tabActiva = tab;
  const tabs = ['normal', 'personal', 'equipamiento', 'mantenimientos', 'credenciales', 'externos', 'notas', 'extras'];
  
  tabs.forEach(t => {
    const btn = document.getElementById(`tab-btn-${t}`);
    const panel = document.getElementById(`panel-${t}`);
    if (btn) {
      if (t === tab) btn.classList.add('active');
      else btn.classList.remove('active');
    }
    if (panel) {
      panel.style.display = (t === tab) ? 'block' : 'none';
    }
  });
}

// 3. Cargar datos históricos desde la API
async function cargarHistorico() {
  const fDesde = document.getElementById('filter-fecha-desde')?.value || '';
  const fHasta = document.getElementById('filter-fecha-hasta')?.value || '';
  const estado = document.getElementById('filter-estado')?.value || '';
  const regionId = document.getElementById('filter-region')?.value || '';
  const q = document.getElementById('search-input')?.value.trim() || '';

  const queryParams = new URLSearchParams({
    fecha_desde: fDesde,
    fecha_hasta: fHasta,
    estado: estado,
    region_id: regionId,
    q: q
  });

  // Poner estado de carga en todas las tablas
  Object.keys(CATEGORIAS_DEF).forEach(cat => {
    const tbody = document.getElementById(`tbody-${cat}`);
    if (tbody) {
      tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; color:var(--text-muted); padding:1.2rem;">Cargando histórico...</td></tr>';
    }
  });

  try {
    const data = await fetchAPI(`/api/historico?${queryParams.toString()}`);
    currentTasks = data || [];

    // Categorizar en los 8 grupos
    const grupos = {
      normal: [],
      personal: [],
      equipamiento: [],
      mantenimientos: [],
      credenciales: [],
      externos: [],
      notas: [],
      extras: []
    };

    currentTasks.forEach(tarea => {
      const tipo = tarea.tipo_tarea;
      let colocado = false;

      for (const [cat, lista] of Object.entries(CATEGORIAS_DEF)) {
        if (lista.includes(tipo)) {
          grupos[cat].push(tarea);
          colocado = true;
          break;
        }
      }
      if (!colocado) {
        grupos.normal.push(tarea);
      }
    });

    // Actualizar badges contadores de las 8 pestañas
    Object.keys(grupos).forEach(cat => {
      const badge = document.getElementById(`badge-count-${cat}`);
      if (badge) badge.textContent = grupos[cat].length;
    });

    // Renderizar tablas
    renderTablaNormal(grupos.normal);
    renderTablaPersonal(grupos.personal);
    renderTablaEquipamiento(grupos.equipamiento);
    renderTablaMantenimientos(grupos.mantenimientos);
    renderTablaCredenciales(grupos.credenciales);
    renderTablaExternos(grupos.externos);
    renderTablaNotas(grupos.notas);
    renderTablaExtras(grupos.extras);

  } catch (error) {
    console.error('Error cargando histórico:', error);
  }
}

// 4. Renderizadores de Tablas Especializadas

function formatFecha(isoStr) {
  if (!isoStr) return '-';
  return isoStr.replace('T', ' ').substring(0, 16);
}

function renderAccionBtn(id) {
  return `
    <button class="btn btn-secondary btn-sm" onclick="abrirModalDetalleHistorico(${id})" title="Ver auditoría y seguimiento completo" style="padding:0.25rem 0.5rem;">
      <i class="bi bi-eye"></i> Detalle
    </button>
  `;
}

// 4.1 Caso Normal
function renderTablaNormal(tareas) {
  const tbody = document.getElementById('tbody-normal');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (tareas.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; color:var(--text-muted); padding:1.5rem;">No se encontraron casos operativos en el período seleccionado.</td></tr>';
    return;
  }

  tareas.forEach(t => {
    const tr = document.createElement('tr');
    const tipoLabel = t.tipo_tarea.replace(/_/g, ' ');
    const cantAct = t.actualizaciones?.length || t.total_actualizaciones || 0;
    const cantSub = t.subtareas?.length || t.total_subtareas || 0;
    let badges = '';
    if (cantAct > 0) badges += `<span class="badge" style="background:rgba(14,165,233,0.15); color:var(--primary); font-size:0.7rem; margin-right:4px;"><i class="bi bi-chat-dots"></i> ${cantAct}</span>`;
    if (cantSub > 0) badges += `<span class="badge" style="background:rgba(139,92,246,0.15); color:var(--purple); font-size:0.7rem;"><i class="bi bi-list-task"></i> ${cantSub}</span>`;

    tr.innerHTML = `
      <td>
        <strong style="color:var(--primary); font-family:monospace;">${t.ticket}</strong>
        <div style="font-size:0.75rem; color:var(--text-muted);">${formatFecha(t.created_at)}</div>
      </td>
      <td>
        <div style="font-size:0.8rem; font-weight:600;">${t.bitacora_fecha || '-'}</div>
        <small style="color:var(--text-secondary); text-transform:capitalize;">Turno: ${t.bitacora_turno || '-'}</small>
      </td>
      <td>
        <div><strong>${t.titulo}</strong></div>
        <div style="font-size:0.8rem; color:var(--text-secondary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:280px;">${t.descripcion}</div>
        <div style="margin-top:2px;">${badges}</div>
      </td>
      <td><span style="color:var(--text-primary); font-weight:500;">${t.cliente}</span></td>
      <td><span class="badge" style="background:var(--bg-surface-hover); color:var(--text-secondary); text-transform:capitalize;">${tipoLabel}</span></td>
      <td><span class="badge badge-${t.estado}">${t.estado.replace('_', ' ')}</span></td>
      <td><small style="color:var(--text-secondary);">${t.operador_nombre}</small></td>
      <td style="text-align: right;">${renderAccionBtn(t.id)}</td>
    `;
    tbody.appendChild(tr);
  });
}

// 4.2 Ingreso de Personal
function renderTablaPersonal(tareas) {
  const tbody = document.getElementById('tbody-personal');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (tareas.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; color:var(--text-muted); padding:1.5rem;">No se encontraron ingresos de personal en el período seleccionado.</td></tr>';
    return;
  }

  tareas.forEach(t => {
    const tr = document.createElement('tr');
    const sala = t.campos_extra?.sala_datacenter || 'Datacenter General';
    const empresa = t.campos_extra?.empresa_tecnico || t.cliente || '-';

    tr.innerHTML = `
      <td>
        <strong style="color:var(--primary); font-family:monospace;">${t.ticket}</strong>
        <div style="font-size:0.75rem; color:var(--text-muted);">${formatFecha(t.created_at)}</div>
      </td>
      <td>
        <div style="font-size:0.8rem; font-weight:600;">${t.bitacora_fecha || '-'}</div>
        <small style="color:var(--text-secondary); text-transform:capitalize;">${t.bitacora_turno || '-'}</small>
      </td>
      <td>
        <strong>${empresa}</strong>
        <div style="font-size:0.75rem; color:var(--text-secondary);">${t.titulo}</div>
      </td>
      <td><i class="bi bi-geo-alt" style="color:var(--primary);"></i> ${sala}</td>
      <td style="font-size:0.8rem; color:var(--text-secondary); max-width:240px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${t.descripcion}</td>
      <td><span class="badge badge-${t.estado}">${t.estado.replace('_', ' ')}</span></td>
      <td><small style="color:var(--text-secondary);">${t.operador_nombre}</small></td>
      <td style="text-align: right;">${renderAccionBtn(t.id)}</td>
    `;
    tbody.appendChild(tr);
  });
}

// 4.3 Ingreso / Egreso Equipamiento
function renderTablaEquipamiento(tareas) {
  const tbody = document.getElementById('tbody-equipamiento');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (tareas.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; color:var(--text-muted); padding:1.5rem;">No se registraron movimientos de equipamiento.</td></tr>';
    return;
  }

  tareas.forEach(t => {
    const tr = document.createElement('tr');
    const esIngreso = t.tipo_tarea === 'acceso_equipos';
    const sentidoBadge = esIngreso
      ? `<span class="badge" style="background:rgba(16,185,129,0.15); color:#34d399;"><i class="bi bi-box-arrow-in-right"></i> Ingreso</span>`
      : `<span class="badge" style="background:rgba(239,68,68,0.15); color:#f87171;"><i class="bi bi-box-arrow-right"></i> Retiro</span>`;
    const sala = t.campos_extra?.sala_datacenter || '-';

    tr.innerHTML = `
      <td>
        <strong style="color:var(--primary); font-family:monospace;">${t.ticket}</strong>
        <div style="font-size:0.75rem; color:var(--text-muted);">${formatFecha(t.created_at)}</div>
      </td>
      <td>
        <div style="font-size:0.8rem; font-weight:600;">${t.bitacora_fecha || '-'}</div>
        <small style="color:var(--text-secondary);">${t.bitacora_turno || '-'}</small>
      </td>
      <td>${sentidoBadge}</td>
      <td><strong>${t.cliente}</strong></td>
      <td><i class="bi bi-geo-alt" style="color:var(--primary);"></i> ${sala}</td>
      <td style="font-size:0.8rem; color:var(--text-secondary); max-width:220px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${t.titulo} - ${t.descripcion}</td>
      <td><span class="badge badge-${t.estado}">${t.estado.replace('_', ' ')}</span></td>
      <td><small style="color:var(--text-secondary);">${t.operador_nombre}</small></td>
      <td style="text-align: right;">${renderAccionBtn(t.id)}</td>
    `;
    tbody.appendChild(tr);
  });
}

// 4.4 Mantenimientos
function renderTablaMantenimientos(tareas) {
  const tbody = document.getElementById('tbody-mantenimientos');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (tareas.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; color:var(--text-muted); padding:1.5rem;">No se encontraron mantenimientos en el período.</td></tr>';
    return;
  }

  tareas.forEach(t => {
    const tr = document.createElement('tr');
    const sitio = t.campos_extra?.sitio_mantenimiento || t.campos_extra?.sala_datacenter || 'Datacenter';
    const pInicio = formatFecha(t.fecha_programada_inicio);
    const pFin = t.fecha_programada_fin ? formatFecha(t.fecha_programada_fin) : 'Indefinida';

    tr.innerHTML = `
      <td>
        <strong style="color:var(--primary); font-family:monospace;">${t.ticket}</strong>
        <div style="font-size:0.75rem; color:var(--text-muted);">${formatFecha(t.created_at)}</div>
      </td>
      <td>
        <div style="font-size:0.8rem; font-weight:600;">${t.bitacora_fecha || '-'}</div>
        <small style="color:var(--text-secondary);">${t.bitacora_turno || '-'}</small>
      </td>
      <td>
        <strong>${t.titulo}</strong>
        <div style="font-size:0.75rem; color:var(--text-muted);">${t.cliente}</div>
      </td>
      <td><i class="bi bi-tools" style="color:#fbbf24;"></i> ${sitio}</td>
      <td style="font-size:0.78rem;">
        <div><i class="bi bi-clock"></i> ${pInicio}</div>
        <div><i class="bi bi-clock-history"></i> ${pFin}</div>
      </td>
      <td><span class="badge badge-${t.estado}">${t.estado.replace('_', ' ')}</span></td>
      <td><small style="color:var(--text-secondary);">${t.operador_nombre}</small></td>
      <td style="text-align: right;">${renderAccionBtn(t.id)}</td>
    `;
    tbody.appendChild(tr);
  });
}

// 4.5 Credenciales
function renderTablaCredenciales(tareas) {
  const tbody = document.getElementById('tbody-credenciales');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (tareas.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:var(--text-muted); padding:1.5rem;">No se encontraron credenciales especiales históricas.</td></tr>';
    return;
  }

  tareas.forEach(t => {
    const tr = document.createElement('tr');
    const ticketCliente = t.campos_extra?.ticket_cliente || t.cliente || '-';
    
    // Lista de personas y códigos
    let personasHtml = '';
    const credList = t.campos_extra?.credenciales_lista || [];
    if (credList.length > 0) {
      personasHtml = '<div style="display:flex; flex-direction:column; gap:2px;">' + credList.map(c => `
        <div style="font-size:0.8rem;">
          <strong>${c.persona_propietaria}</strong>: <span class="badge" style="font-family:monospace; background:rgba(14,165,233,0.15); color:var(--primary); font-size:0.75rem;">${c.codigo_alfanumerico}</span>
        </div>
      `).join('') + '</div>';
    } else if (t.campos_extra?.persona_propietaria) {
      personasHtml = `<div><strong>${t.campos_extra.persona_propietaria}</strong> <span class="badge" style="font-family:monospace; color:var(--primary); font-size:0.75rem;">${t.campos_extra.codigo_alfanumerico || ''}</span></div>`;
    } else {
      personasHtml = `<span style="color:var(--text-muted);">-</span>`;
    }

    const fInicio = formatFecha(t.fecha_programada_inicio);
    const fFin = formatFecha(t.fecha_programada_fin);
    const vig = (t.fecha_programada_fin && new Date(t.fecha_programada_fin.replace(' ', 'T')) < new Date())
      ? '<span class="badge-vigencia badge-vigencia-finalizada"><i class="bi bi-x-circle"></i> Vencida</span>'
      : '<span class="badge-vigencia badge-vigencia-activa"><i class="bi bi-check-circle"></i> Vigente</span>';

    tr.innerHTML = `
      <td>
        <strong style="color:var(--primary); font-family:monospace;">${t.ticket}</strong>
        <div style="font-size:0.75rem; color:var(--text-muted);">${formatFecha(t.created_at)}</div>
      </td>
      <td>
        <span class="badge" style="background:rgba(56,189,248,0.1); border:1px solid rgba(56,189,248,0.3); color:#38bdf8; font-family:monospace;">${ticketCliente}</span>
        <div style="font-size:0.75rem; color:var(--text-secondary); margin-top:2px;">Cliente: ${t.cliente}</div>
      </td>
      <td>${personasHtml}</td>
      <td style="font-size:0.78rem;">
        <div>Ini: ${fInicio}</div>
        <div>Fin: ${fFin}</div>
      </td>
      <td>${vig}</td>
      <td><small style="color:var(--text-secondary);">${t.operador_nombre}</small></td>
      <td style="text-align: right;">${renderAccionBtn(t.id)}</td>
    `;
    tbody.appendChild(tr);
  });
}

// 4.6 Casos Externos
function renderTablaExternos(tareas) {
  const tbody = document.getElementById('tbody-externos');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (tareas.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; color:var(--text-muted); padding:1.5rem;">No se encontraron registros de sitios externos.</td></tr>';
    return;
  }

  tareas.forEach(t => {
    const tr = document.createElement('tr');
    const sitio = t.campos_extra?.sitio_externo || 'Sitio Remoto';
    const contactos = t.campos_extra?.cantidad_contactos || 0;

    tr.innerHTML = `
      <td>
        <strong style="color:var(--primary); font-family:monospace;">${t.ticket}</strong>
        <div style="font-size:0.75rem; color:var(--text-muted);">${formatFecha(t.created_at)}</div>
      </td>
      <td>
        <div style="font-size:0.8rem; font-weight:600;">${t.bitacora_fecha || '-'}</div>
        <small style="color:var(--text-secondary);">${t.bitacora_turno || '-'}</small>
      </td>
      <td><strong style="color:var(--primary);"><i class="bi bi-globe"></i> ${sitio}</strong></td>
      <td><span class="badge" style="background:rgba(14,165,233,0.15); color:var(--primary); font-weight:700;">${contactos} contacto(s)</span></td>
      <td>
        <div><strong>${t.cliente}</strong></div>
        <div style="font-size:0.75rem; color:var(--text-muted);">${t.titulo}</div>
      </td>
      <td><span class="badge badge-${t.estado}">${t.estado.replace('_', ' ')}</span></td>
      <td><small style="color:var(--text-secondary);">${t.operador_nombre}</small></td>
      <td style="text-align: right;">${renderAccionBtn(t.id)}</td>
    `;
    tbody.appendChild(tr);
  });
}

// 4.7 Notas de Turno
function renderTablaNotas(tareas) {
  const tbody = document.getElementById('tbody-notas');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (tareas.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:var(--text-muted); padding:1.5rem;">No se encontraron notas de turno registradas.</td></tr>';
    return;
  }

  tareas.forEach(t => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>
        <strong style="color:var(--primary); font-family:monospace;">${t.ticket}</strong>
        <div style="font-size:0.75rem; color:var(--text-muted);">${formatFecha(t.created_at)}</div>
      </td>
      <td><strong>${t.bitacora_fecha || '-'}</strong></td>
      <td><span class="badge" style="background:var(--bg-surface-hover); color:var(--text-secondary); text-transform:capitalize;">${t.bitacora_turno || '-'}</span></td>
      <td><strong>${t.operador_nombre}</strong></td>
      <td>
        <div style="font-weight:600; font-size:0.85rem; margin-bottom:2px;">${t.titulo}</div>
        <div style="font-size:0.8rem; color:var(--text-secondary); white-space:pre-wrap; max-height:80px; overflow-y:auto;">${t.descripcion}</div>
      </td>
      <td style="text-align: right;">${renderAccionBtn(t.id)}</td>
    `;
    tbody.appendChild(tr);
  });
}

// 4.8 Tareas Extras
function renderTablaExtras(tareas) {
  const tbody = document.getElementById('tbody-extras');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (tareas.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; color:var(--text-muted); padding:1.5rem;">No se encontraron tareas extras en el período.</td></tr>';
    return;
  }

  tareas.forEach(t => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>
        <strong style="color:var(--primary); font-family:monospace;">${t.ticket}</strong>
        <div style="font-size:0.75rem; color:var(--text-muted);">${formatFecha(t.created_at)}</div>
      </td>
      <td>
        <div style="font-size:0.8rem; font-weight:600;">${t.bitacora_fecha || '-'}</div>
        <small style="color:var(--text-secondary);">${t.bitacora_turno || '-'}</small>
      </td>
      <td><strong>${t.cliente}</strong></td>
      <td><div><strong>${t.titulo}</strong></div></td>
      <td style="font-size:0.8rem; color:var(--text-secondary); max-width:240px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${t.descripcion}</td>
      <td><span class="badge badge-${t.estado}">${t.estado.replace('_', ' ')}</span></td>
      <td><small style="color:var(--text-secondary);">${t.operador_nombre}</small></td>
      <td style="text-align: right;">${renderAccionBtn(t.id)}</td>
    `;
    tbody.appendChild(tr);
  });
}

// 5. Modal Detalle Histórico y Auditoría
function abrirModalDetalleHistorico(id) {
  const tarea = currentTasks.find(t => t.id === id);
  if (!tarea) return;

  document.getElementById('hist-ticket').textContent = tarea.ticket;
  document.getElementById('hist-titulo').textContent = tarea.titulo;
  document.getElementById('hist-cliente').textContent = tarea.cliente;
  document.getElementById('hist-tipo').textContent = tarea.tipo_tarea.replace(/_/g, ' ');
  document.getElementById('hist-estado').innerHTML = `<span class="badge badge-${tarea.estado}">${tarea.estado.replace('_', ' ')}</span>`;
  document.getElementById('hist-region').textContent = tarea.region_nombre || 'DOC General';
  document.getElementById('hist-bitacora').textContent = `${tarea.bitacora_fecha || '-'} (${tarea.bitacora_turno || '-'})`;
  document.getElementById('hist-operador').textContent = tarea.operador_nombre || '-';
  document.getElementById('hist-fecha').textContent = tarea.created_at || '-';
  document.getElementById('hist-descripcion').textContent = tarea.descripcion || '-';

  // Campos extra
  const extraBox = document.getElementById('hist-extra-box');
  const extraContainer = document.getElementById('hist-campos-extra');
  extraContainer.innerHTML = '';

  if (tarea.tipo_tarea === 'alta_credencial_especial' && tarea.campos_extra) {
    extraBox.style.display = 'block';
    extraContainer.innerHTML += `<div><strong>Ticket Cliente:</strong> ${tarea.campos_extra.ticket_cliente || '-'}</div>`;
    const creds = tarea.campos_extra.credenciales_lista || [];
    if (creds.length > 0) {
      let tabla = '<table style="width:100%; font-size:0.8rem; margin-top:0.3rem;"><tr style="background:rgba(255,255,255,0.05);"><th style="padding:4px; text-align:left;">Persona</th><th style="padding:4px; text-align:left;">Código</th></tr>';
      creds.forEach(c => {
        tabla += `<tr><td style="padding:4px; border-bottom:1px solid #334155;">${c.persona_propietaria}</td><td style="padding:4px; border-bottom:1px solid #334155; font-family:monospace; color:var(--primary);">${c.codigo_alfanumerico}</td></tr>`;
      });
      tabla += '</table>';
      extraContainer.innerHTML += tabla;
    }
  } else if (tarea.campos_extra && Object.keys(tarea.campos_extra).length > 0) {
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

  // Lista de novedades cronológicas y subtareas
  const list = document.getElementById('hist-seguimiento-list');
  list.innerHTML = '';
  const todasEntradas = tarea.todas_las_entradas || [];

  if (todasEntradas.length === 0) {
    list.innerHTML = '<p style="font-size:0.8rem; color:var(--text-muted); margin:0;">No se registraron actualizaciones ni subtareas para este caso.</p>';
  } else {
    todasEntradas.forEach(ent => {
      const card = document.createElement('div');
      card.className = 'card';
      card.style.padding = '0.5rem 0.75rem';
      card.style.background = 'rgba(30, 41, 59, 0.5)';
      card.style.borderLeft = ent.tipo_entrada === 'actualizacion' ? '3px solid var(--primary)' : '3px solid var(--purple)';
      
      const badgeTipo = ent.tipo_entrada === 'actualizacion'
        ? `<span class="badge" style="background:rgba(14,165,233,0.15); color:var(--primary); font-size:0.7rem;"><i class="bi bi-chat-dots"></i> Actualización</span>`
        : `<span class="badge" style="background:rgba(139,92,246,0.15); color:var(--purple); font-size:0.7rem;"><i class="bi bi-list-task"></i> Subtarea [${ent.ticket}]</span>`;

      card.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.25rem;">
          <div>${badgeTipo} <span style="font-size:0.75rem; color:var(--text-muted);">por ${ent.operador_nombre || 'Operador'} (${ent.created_at || ''})</span></div>
          ${ent.estado ? `<span class="badge badge-${ent.estado}" style="font-size:0.7rem;">${ent.estado}</span>` : ''}
        </div>
        <div style="font-size:0.825rem; color:var(--text-primary); white-space:pre-wrap;">${ent.titulo ? `<strong>${ent.titulo}:</strong> ` : ''}${ent.descripcion || ''}</div>
      `;
      list.appendChild(card);
    });
  }

  openModal('modal-detalle-historico');
}

// 6. Exportar CSV con los filtros actuales
function exportarCSV() {
  const fDesde = document.getElementById('filter-fecha-desde')?.value || '';
  const fHasta = document.getElementById('filter-fecha-hasta')?.value || '';
  const estado = document.getElementById('filter-estado')?.value || '';
  const regionId = document.getElementById('filter-region')?.value || '';
  const q = document.getElementById('search-input')?.value.trim() || '';

  const queryParams = new URLSearchParams({
    fecha_desde: fDesde,
    fecha_hasta: fHasta,
    estado: estado,
    region_id: regionId,
    q: q,
    categoria: tabActiva,
    export: 'csv'
  });

  window.location.href = `/api/historico?${queryParams.toString()}`;
}
