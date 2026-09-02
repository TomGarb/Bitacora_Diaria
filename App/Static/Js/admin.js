/**
 * Admin JS - Gestión global de usuarios y regiones
 */

document.addEventListener('DOMContentLoaded', () => {
  setupTabs();
  cargarUsuarios();
  cargarRegiones();

  document.getElementById('form-nuevo-usuario')?.addEventListener('submit', guardarNuevoUsuario);
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

// 1. USUARIOS
async function cargarUsuarios() {
  const tbody = document.getElementById('usuarios-tbody');
  if (!tbody) return;

  try {
    const usuarios = await fetchAPI('/api/admin/usuarios');
    tbody.innerHTML = '';

    usuarios.forEach(u => {
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
      `;
      tbody.appendChild(tr);
    });
  } catch (error) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:var(--danger);">Error cargando usuarios</td></tr>';
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

// 2. REGIONES
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
