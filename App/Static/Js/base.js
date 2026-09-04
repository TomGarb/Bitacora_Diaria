/**
 * Base JS - Utilidades compartidas para la Bitácora DOC
 */

// Toast notifications
function showToast(message, type = 'info', duration = 4000) {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  let icon = 'bi-info-circle';
  if (type === 'success') icon = 'bi-check-circle-fill';
  if (type === 'danger') icon = 'bi-exclamation-triangle-fill';
  if (type === 'warning') icon = 'bi-exclamation-circle-fill';

  toast.innerHTML = `
    <i class="bi ${icon}"></i>
    <span>${message}</span>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// Wrapper para llamadas Fetch API
async function fetchAPI(url, options = {}) {
  const defaultHeaders = {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  };

  options.headers = { ...defaultHeaders, ...options.headers };

  try {
    const response = await fetch(url, options);
    const data = await response.json();

    if (!response.ok) {
      const errorMsg = data.error || data.message || `Error en la solicitud (${response.status})`;
      showToast(errorMsg, 'danger');
      throw new Error(errorMsg);
    }

    return data;
  } catch (error) {
    console.error('Fetch error:', error);
    throw error;
  }
}

// Controladores de Modales
function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('active');
    document.body.style.overflow = '';
  }
}

// Cerrar modales con clic fuera o botón de cierre
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.modal-overlay').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeModal(modal.id);
      }
    });

    const closeBtn = modal.querySelector('.modal-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => closeModal(modal.id));
    }
  });
});

// Renderizador dinámico de campos extra (según configuración de región)
function renderDynamicFields(container, fieldsList = [], values = {}) {
  if (!container) return;
  container.innerHTML = '';

  if (!fieldsList || fieldsList.length === 0) {
    container.style.display = 'none';
    return;
  }

  container.style.display = 'block';
  
  const header = document.createElement('h4');
  header.style.fontSize = '0.9rem';
  header.style.color = 'var(--text-secondary)';
  header.style.marginBottom = '0.75rem';
  header.style.borderBottom = '1px dashed var(--border-color)';
  header.style.paddingBottom = '0.25rem';
  header.innerHTML = '<i class="bi bi-sliders"></i> Campos Específicos Requeridos';
  container.appendChild(header);

  fieldsList.forEach(field => {
    const formGroup = document.createElement('div');
    formGroup.className = 'form-group';
    formGroup.style.marginBottom = '0.75rem';

    const val = values[field.nombre] !== undefined ? values[field.nombre] : '';

    if (field.tipo === 'checkbox') {
      const label = document.createElement('label');
      label.style.display = 'flex';
      label.style.alignItems = 'center';
      label.style.gap = '0.5rem';
      label.style.fontSize = '0.875rem';
      label.style.cursor = 'pointer';
      label.style.color = 'var(--text-primary)';

      const input = document.createElement('input');
      input.type = 'checkbox';
      input.className = 'dynamic-field';
      input.name = field.nombre;
      input.dataset.fieldName = field.nombre;
      input.checked = (val === true || val === 'true' || val === 1 || val === '1');

      label.appendChild(input);
      const span = document.createElement('span');
      span.innerHTML = `${field.label || field.nombre} ${field.requerido ? '<span style="color:var(--danger)">*</span>' : ''}`;
      label.appendChild(span);

      formGroup.appendChild(label);
    } else {
      const label = document.createElement('label');
      label.className = 'form-label';
      label.innerHTML = `${field.label || field.nombre} ${field.requerido ? '<span style="color:var(--danger)">*</span>' : ''}`;
      formGroup.appendChild(label);

      let input;
      if (field.tipo === 'select') {
        input = document.createElement('select');
        input.className = 'form-select dynamic-field';
        input.name = field.nombre;
        input.dataset.fieldName = field.nombre;
        input.required = !!field.requerido;
        
        const defaultOpt = document.createElement('option');
        defaultOpt.value = '';
        defaultOpt.textContent = '-- Seleccionar --';
        input.appendChild(defaultOpt);

        (field.opciones || []).forEach(opt => {
          const option = document.createElement('option');
          option.value = opt;
          option.textContent = opt;
          if (String(opt) === String(val)) option.selected = true;
          input.appendChild(option);
        });
      } else if (field.tipo === 'textarea') {
        input = document.createElement('textarea');
        input.className = 'form-control dynamic-field';
        input.name = field.nombre;
        input.dataset.fieldName = field.nombre;
        input.required = !!field.requerido;
        input.rows = 2;
        input.value = val;
        input.placeholder = `Ingrese ${field.label || field.nombre}...`;
      } else if (field.tipo === 'datetime' || field.tipo === 'datetime-local') {
        input = document.createElement('input');
        input.type = 'datetime-local';
        input.className = 'form-control dynamic-field';
        input.name = field.nombre;
        input.dataset.fieldName = field.nombre;
        input.required = !!field.requerido;
        input.value = val ? String(val).replace(' ', 'T') : '';
      } else if (field.tipo === 'date') {
        input = document.createElement('input');
        input.type = 'date';
        input.className = 'form-control dynamic-field';
        input.name = field.nombre;
        input.dataset.fieldName = field.nombre;
        input.required = !!field.requerido;
        input.value = val;
      } else if (field.tipo === 'number') {
        input = document.createElement('input');
        input.type = 'number';
        input.className = 'form-control dynamic-field';
        input.name = field.nombre;
        input.dataset.fieldName = field.nombre;
        input.required = !!field.requerido;
        input.value = val;
        input.placeholder = `Ingrese ${field.label || field.nombre}...`;
      } else {
        input = document.createElement('input');
        input.type = 'text';
        input.className = 'form-control dynamic-field';
        input.name = field.nombre;
        input.dataset.fieldName = field.nombre;
        input.required = !!field.requerido;
        input.value = val;
        input.placeholder = `Ingrese ${field.label || field.nombre}...`;
      }

      formGroup.appendChild(input);
    }

    container.appendChild(formGroup);
  });
}

// Extraer valores de campos dinámicos
function extractDynamicFields(container) {
  const data = {};
  if (!container) return data;
  
  const inputs = container.querySelectorAll('.dynamic-field');
  inputs.forEach(input => {
    const name = input.dataset.fieldName;
    if (name) {
      if (input.type === 'checkbox') {
        data[name] = input.checked;
      } else if (input.type === 'number') {
        data[name] = input.value !== '' ? Number(input.value) : '';
      } else {
        data[name] = input.value.trim();
      }
    }
  });
  return data;
}
