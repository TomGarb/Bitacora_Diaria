/**
 * Admin JS - Gestión de usuarios, perfiles, permisos, equipos y regiones (CRUD)
 */

let listaUsuariosCache = [];
let listaEquiposCache = [];
let esAdminGlobal = false;
let currentUserId = null;

document.addEventListener('DOMContentLoaded', () => {
  esAdminGlobal = document.getElementById('es-admin-global')?.value === '1';
  currentUserId = parseInt(document.getElementById('current-user-id')?.value || 0);

  setupTabs();
  cargarUsuarios();
  cargarEquipos();
  if (esAdminGlobal) {
    cargarRegiones();
  }

  document.getElementById('form-nuevo-usuario')?.addEventListener('submit', guardarNuevoUsuario);
  document.getElementById('form-editar-usuario')?.addEventListener('submit', guardarEdicionUsuario);
  document.getElementById('form-equipo')?.addEventListener('submit', guardarEquipo);
  document.getElementById('form-nueva-region')?.addEventListener('submit', guardarNuevaRegion);
});

function setupTabs() {
  document.querySelectorAll('.admin-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.admin-tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.admin-tab-content').forEach(c => c.classList.remove('active'));

      btn.classList.add('active');
      const target = btn.dataset.tab;
      document.getElementById(target)?.classList.add('active');
    });
  });
}

// ==========================================
// 1. USUARIOS & PERMISOS (CRUD)
// ==========================================
async function cargarUsuarios() {
  const tbody = document.getElementById('usuarios-tbody');
  if (!tbody) return;

  try {
    const usuarios = await fetchAPI('/api/admin/usuarios');
    listaUsuariosCache = usuarios || [];
    tbody.innerHTML = '';

    if (listaUsuariosCache.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:var(--text-muted);">No hay usuarios registrados en esta sede.</td></tr>';
      return;
    }

    listaUsuariosCache.forEach(u => {
      const tr = document.createElement('tr');
      const badgeRol = `<span class="badge role-${u.rol}">${u.rol}</span>`;
      const estadoBadge = u.activo ? '<span class="badge badge-completada">Activo</span>' : '<span class="badge badge-cancelada">Inactivo</span>';

      tr.innerHTML = `
        <td><strong>${u.id}</strong></td>
        <td>
          <strong>${u.username}</strong>
          <div style="font-size:0.75rem; color:var(--text-secondary);">${u.email}</div>
        </td>
        <td>${u.nombre_completo}</td>
        <td>${badgeRol}</td>
        <td>${u.region_nombre || '<span style="color:var(--text-muted);">Global (Sin región)</span>'}</td>
        <td>${estadoBadge}</td>
        <td style="text-align:right;">
          <button class="btn btn-secondary btn-sm" onclick="abrirModalEditarUsuario(${u.id})" title="Editar perfil y permisos">
            <i class="bi bi-pencil-square"></i> Editar
          </button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (error) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:var(--danger);">Error cargando usuarios</td></tr>';
  }
}

function abrirModalNuevoUsuario() {
  document.getElementById('form-nuevo-usuario').reset();
  openModal('modal-nuevo-usuario');
}

async function guardarNuevoUsuario(e) {
  e.preventDefault();
  const payload = {
    username: document.getElementById('user-username').value.trim(),
    email: document.getElementById('user-email').value.trim(),
    nombre_completo: document.getElementById('user-nombre').value.trim(),
    password: document.getElementById('user-password').value || 'demo123',
    rol: document.getElementById('user-rol').value,
    region_id: document.getElementById('user-region').value ? parseInt(document.getElementById('user-region').value) : null
  };

  try {
    await fetchAPI('/api/admin/usuarios', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    showToast('Usuario creado exitosamente', 'success');
    closeModal('modal-nuevo-usuario');
    await cargarUsuarios();
  } catch (error) {
    // Error ya mostrado por fetchAPI
  }
}

function abrirModalEditarUsuario(userId) {
  const u = listaUsuariosCache.find(x => x.id === userId);
  if (!u) return;

  document.getElementById('edit-user-id').value = u.id;
  document.getElementById('edit-user-username').value = u.username;
  document.getElementById('edit-user-email').value = u.email;
  document.getElementById('edit-user-nombre').value = u.nombre_completo;
  document.getElementById('edit-user-rol').value = u.rol;
  if (document.getElementById('edit-user-region')) {
    document.getElementById('edit-user-region').value = u.region_id || '';
  }
  document.getElementById('edit-user-activo').value = u.activo ? '1' : '0';
  document.getElementById('edit-user-password').value = '';

  const btnEliminar = document.getElementById('btn-eliminar-usuario');
  if (btnEliminar) {
    btnEliminar.style.display = (u.id === currentUserId) ? 'none' : 'inline-flex';
  }

  openModal('modal-editar-usuario');
}

async function guardarEdicionUsuario(e) {
  e.preventDefault();
  const userId = document.getElementById('edit-user-id').value;
  if (!userId) return;

  const payload = {
    email: document.getElementById('edit-user-email').value.trim(),
    nombre_completo: document.getElementById('edit-user-nombre').value.trim(),
    rol: document.getElementById('edit-user-rol').value,
    activo: document.getElementById('edit-user-activo').value === '1'
  };

  const regEl = document.getElementById('edit-user-region');
  if (regEl && !regEl.disabled && regEl.value) {
    payload.region_id = parseInt(regEl.value);
  }

  const pass = document.getElementById('edit-user-password').value;
  if (pass) {
    payload.password = pass;
  }

  try {
    await fetchAPI(`/api/admin/usuarios/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
    showToast('Perfil y permisos actualizados', 'success');
    closeModal('modal-editar-usuario');
    await cargarUsuarios();
  } catch (error) {
    // Error capturado por fetchAPI
  }
}

async function confirmarEliminarUsuario() {
  const userId = document.getElementById('edit-user-id').value;
  const username = document.getElementById('edit-user-username').value;
  if (!userId) return;

  if (!confirm(`¿Está seguro de eliminar definitivamente al usuario "${username}"? Esta acción no se puede deshacer.`)) {
    return;
  }

  try {
    await fetchAPI(`/api/admin/usuarios/${userId}`, {
      method: 'DELETE'
    });
    showToast(`Usuario ${username} eliminado`, 'success');
    closeModal('modal-editar-usuario');
    await cargarUsuarios();
  } catch (error) {
    // Error capturado
  }
}

// ==========================================
// 2. EQUIPOS / GRUPOS DE TRABAJO (CRUD)
// ==========================================
async function cargarEquipos() {
  const tbody = document.getElementById('equipos-tbody');
  if (!tbody) return;

  try {
    const equipos = await fetchAPI('/api/equipos');
    listaEquiposCache = equipos || [];
    tbody.innerHTML = '';

    if (listaEquiposCache.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:var(--text-muted);">No hay grupos o equipos configurados en esta sede.</td></tr>';
      return;
    }

    listaEquiposCache.forEach(eq => {
      const tr = document.createElement('tr');
      const miembrosChips = (eq.miembros && eq.miembros.length > 0)
        ? eq.miembros.map(m => `<span class="badge" style="background:rgba(14,165,233,0.15); color:var(--primary); margin:2px;"><i class="bi bi-person"></i> ${m.nombre_completo}</span>`).join(' ')
        : '<span style="color:var(--text-muted); font-size:0.8rem;">Sin miembros asignados</span>';

      tr.innerHTML = `
        <td><strong>${eq.id}</strong></td>
        <td><strong style="color:var(--primary); font-size:1.05rem;"><i class="bi bi-diagram-3-fill"></i> ${eq.nombre}</strong></td>
        <td><span class="badge" style="background:rgba(148,163,184,0.15); color:var(--text-primary);">${eq.region_nombre}</span></td>
        <td><small style="color:var(--text-secondary);">${eq.descripcion || '—'}</small></td>
        <td>${miembrosChips}</td>
        <td><strong style="font-size:1.1rem; color:var(--text-primary);">${eq.total_miembros}</strong></td>
        <td style="text-align:right;">
          <button class="btn btn-secondary btn-sm" onclick="abrirModalEditarEquipo(${eq.id})" title="Modificar miembros y datos" style="margin-right:0.35rem;">
            <i class="bi bi-pencil-square"></i> Editar
          </button>
          <button class="btn btn-danger btn-sm" onclick="confirmarEliminarEquipo(${eq.id}, '${eq.nombre}')" title="Eliminar equipo">
            <i class="bi bi-trash"></i>
          </button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (error) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:var(--danger);">Error cargando equipos</td></tr>';
  }
}

function renderOperadoresCheckboxes(seleccionadosIds = [], regionId = null) {
  const container = document.getElementById('equipo-operadores-list');
  if (!container) return;
  container.innerHTML = '';

  // Filtrar operadores de la región
  const operadores = listaUsuariosCache.filter(u => {
    if (regionId && u.region_id && u.region_id !== regionId) return false;
    return u.rol === 'operador' || u.rol === 'sub_admin';
  });

  if (operadores.length === 0) {
    container.innerHTML = '<div style="color:var(--text-muted); font-size:0.85rem;">No hay operadores registrados en esta región para asignar.</div>';
    return;
  }

  operadores.forEach(op => {
    const isChecked = seleccionadosIds.includes(op.id);
    const div = document.createElement('label');
    div.style.display = 'flex';
    div.style.alignItems = 'center';
    div.style.gap = '0.6rem';
    div.style.cursor = 'pointer';
    div.style.fontSize = '0.9rem';
    div.style.color = 'var(--text-primary)';

    div.innerHTML = `
      <input type="checkbox" class="chk-operador-equipo" value="${op.id}" ${isChecked ? 'checked' : ''} style="width:16px; height:16px; accent-color:var(--primary);">
      <span><strong>${op.nombre_completo}</strong> <small style="color:var(--text-secondary);">(${op.username} - ${op.rol})</small></span>
    `;
    container.appendChild(div);
  });
}

function abrirModalNuevoEquipo() {
  document.getElementById('form-equipo').reset();
  document.getElementById('equipo-id').value = '';
  document.getElementById('modal-equipo-titulo').innerHTML = '<i class="bi bi-diagram-3-fill"></i> Crear Grupo / Equipo de Trabajo';
  
  const regEl = document.getElementById('equipo-region');
  const regId = regEl && regEl.value ? parseInt(regEl.value) : null;
  renderOperadoresCheckboxes([], regId);

  openModal('modal-equipo');
}

function abrirModalEditarEquipo(equipoId) {
  const eq = listaEquiposCache.find(x => x.id === equipoId);
  if (!eq) return;

  document.getElementById('equipo-id').value = eq.id;
  document.getElementById('equipo-nombre').value = eq.nombre;
  document.getElementById('equipo-desc').value = eq.descripcion || '';
  if (document.getElementById('equipo-region')) {
    document.getElementById('equipo-region').value = eq.region_id;
  }
  document.getElementById('modal-equipo-titulo').innerHTML = `<i class="bi bi-pencil-square"></i> Modificar Equipo — ${eq.nombre}`;

  const miembrosIds = (eq.miembros || []).map(m => m.id);
  renderOperadoresCheckboxes(miembrosIds, eq.region_id);

  openModal('modal-equipo');
}

async function guardarEquipo(e) {
  e.preventDefault();
  const equipoId = document.getElementById('equipo-id').value;
  const isEditing = !!equipoId;

  // Obtener IDs seleccionados
  const checkboxes = document.querySelectorAll('.chk-operador-equipo:checked');
  const miembrosIds = Array.from(checkboxes).map(c => parseInt(c.value));

  const payload = {
    nombre: document.getElementById('equipo-nombre').value.trim(),
    descripcion: document.getElementById('equipo-desc').value.trim(),
    miembros_ids: miembrosIds
  };

  const regEl = document.getElementById('equipo-region');
  if (regEl && regEl.value) {
    payload.region_id = parseInt(regEl.value);
  }

  try {
    const url = isEditing ? `/api/equipos/${equipoId}` : '/api/equipos';
    const method = isEditing ? 'PUT' : 'POST';

    await fetchAPI(url, {
      method: method,
      body: JSON.stringify(payload)
    });

    showToast(isEditing ? 'Equipo actualizado' : 'Equipo creado con éxito', 'success');
    closeModal('modal-equipo');
    await cargarEquipos();
  } catch (error) {
    // Error capturado
  }
}

async function confirmarEliminarEquipo(equipoId, nombre) {
  if (!confirm(`¿Está seguro de eliminar el equipo "${nombre}"? Los operadores no se eliminarán pero perderán la asignación a este grupo.`)) {
    return;
  }

  try {
    await fetchAPI(`/api/equipos/${equipoId}`, {
      method: 'DELETE'
    });
    showToast(`Equipo "${nombre}" eliminado`, 'success');
    await cargarEquipos();
  } catch (error) {
    // Error capturado
  }
}

// ==========================================
// 3. REGIONES (ADMIN GLOBAL)
// ==========================================
async function cargarRegiones() {
  const tbody = document.getElementById('regiones-tbody');
  if (!tbody) return;

  try {
    const regiones = await fetchAPI('/api/admin/regiones');
    tbody.innerHTML = '';

    regiones.forEach(r => {
      const tr = document.createElement('tr');
      const estadoBadge = r.activa ? '<span class="badge badge-completada">Activa</span>' : '<span class="badge badge-cancelada">Inactiva</span>';

      tr.innerHTML = `
        <td><strong>${r.id}</strong></td>
        <td><strong style="color:var(--primary); font-size:1rem;">${r.codigo}</strong></td>
        <td>${r.nombre}</td>
        <td><small style="color:var(--text-secondary);">${r.descripcion || '-'}</small></td>
        <td>${estadoBadge}</td>
        <td style="text-align:right;">
          <a href="/config?region_id=${r.id}" class="btn btn-secondary btn-sm" title="Configurar frontend de esta región">
            <i class="bi bi-sliders"></i> Configurar
          </a>
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (error) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:var(--danger);">Error cargando regiones</td></tr>';
  }
}

function abrirModalNuevaRegion() {
  document.getElementById('form-nueva-region').reset();
  openModal('modal-nueva-region');
}

async function guardarNuevaRegion(e) {
  e.preventDefault();
  const payload = {
    codigo: document.getElementById('reg-codigo').value.trim().toUpperCase(),
    nombre: document.getElementById('reg-nombre').value.trim(),
    descripcion: document.getElementById('reg-desc').value.trim()
  };

  try {
    await fetchAPI('/api/admin/regiones', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    showToast('Región creada con configuración base', 'success');
    closeModal('modal-nueva-region');
    await cargarRegiones();
  } catch (error) {
    // Error mostrado por fetchAPI
  }
}
