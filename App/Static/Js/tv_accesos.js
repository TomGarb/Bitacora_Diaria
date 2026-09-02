/**
 * TV Accesos JS - Dashboard pasivo de Accesos y Movimiento de Equipos
 */

const REFRESH_INTERVAL_MS = 30000; // Refresco cada 30 segundos
const SCROLL_STEP_DELAY_MS = 3500; // Paso de carrusel cada 3.5 segundos

let regionId = 1;
let tecnicosScrollInterval = null;
let equiposScrollInterval = null;

document.addEventListener('DOMContentLoaded', () => {
  regionId = document.getElementById('tv-region-id')?.value || 1;
  
  // 1. Reloj en vivo
  iniciarReloj();

  // 2. Carga inicial de datos
  cargarDatosAccesos();

  // 3. Temporizador de refresco periódico
  setInterval(cargarDatosAccesos, REFRESH_INTERVAL_MS);
});

function iniciarReloj() {
  const clockEl = document.getElementById('tv-clock');
  function update() {
    const now = new Date();
    const h = String(now.getHours()).padStart(2, '0');
    const m = String(now.getMinutes()).padStart(2, '0');
    const s = String(now.getSeconds()).padStart(2, '0');
    if (clockEl) clockEl.textContent = `${h}:${m}:${s}`;
  }
  update();
  setInterval(update, 1000);
}

async function cargarDatosAccesos() {
  try {
    const res = await fetch(`/api/tv/${regionId}/accesos`);
    if (!res.ok) return;
    const data = await res.json();

    // Actualizar badges
    document.getElementById('count-tecnicos').textContent = data.total_tecnicos || 0;
    document.getElementById('count-equipos').textContent = data.total_equipos || 0;
    if (data.turno) document.getElementById('tv-shift-label').textContent = `TURNO ${data.turno}`;

    // Renderizar columna técnicos
    renderTecnicos(data.tecnicos || []);

    // Renderizar columna equipos
    renderEquipos(data.equipos || []);

  } catch (error) {
    console.error('Error actualizando TV Accesos:', error);
  }
}

function renderTecnicos(lista) {
  const wrapper = document.getElementById('tecnicos-wrapper');
  if (!wrapper) return;

  clearInterval(tecnicosScrollInterval);
  wrapper.style.transform = 'translateY(0px)';
  wrapper.innerHTML = '';

  if (lista.length === 0) {
    wrapper.innerHTML = `
      <div class="tv-empty-box">
        <i class="bi bi-shield-check" style="font-size:2.5rem; color:var(--tv-neon-cyan);"></i>
        <div>Sin accesos de técnicos registrados para hoy</div>
      </div>
    `;
    return;
  }

  lista.forEach(t => {
    const card = document.createElement('div');
    card.className = 'tv-card';
    card.innerHTML = `
      <div class="tv-card-top">
        <span class="tv-card-ticket"><i class="bi bi-ticket-detailed"></i> ${t.ticket}</span>
        <span class="tv-card-time"><i class="bi bi-clock"></i> ${t.hora_inicio} ${t.hora_fin ? 'a ' + t.hora_fin : ''}</span>
      </div>
      <div class="tv-card-main">
        <div class="tv-card-empresa">${t.empresa || t.cliente}</div>
        <div class="tv-card-sala"><i class="bi bi-door-open-fill"></i> ${t.sala}</div>
      </div>
      <div class="tv-card-details">${t.titulo} ${t.descripcion ? '— ' + t.descripcion : ''}</div>
    `;
    wrapper.appendChild(card);
  });

  // Configurar auto-scroll si excede
  configurarAutoScroll('viewport-tecnicos', 'tecnicos-wrapper', (int) => { tecnicosScrollInterval = int; });
}

function renderEquipos(lista) {
  const wrapper = document.getElementById('equipos-wrapper');
  if (!wrapper) return;

  clearInterval(equiposScrollInterval);
  wrapper.style.transform = 'translateY(0px)';
  wrapper.innerHTML = '';

  if (lista.length === 0) {
    wrapper.innerHTML = `
      <div class="tv-empty-box">
        <i class="bi bi-box-seam" style="font-size:2.5rem; color:var(--tv-neon-green);"></i>
        <div>Sin movimientos de equipos programados para hoy</div>
      </div>
    `;
    return;
  }

  lista.forEach(eq => {
    const isInbound = eq.tipo_tarea === 'acceso_equipos';
    const card = document.createElement('div');
    card.className = `tv-card ${isInbound ? 'inbound' : 'outbound'}`;
    const badgeColor = isInbound ? 'var(--tv-neon-green)' : 'var(--tv-neon-amber)';

    card.innerHTML = `
      <div class="tv-card-top">
        <span class="tv-card-ticket" style="color:${badgeColor};"><i class="bi bi-box-arrow-${isInbound ? 'in-down' : 'up-right'}"></i> ${eq.tipo_movimiento}</span>
        <span class="tv-card-time"><i class="bi bi-clock"></i> ${eq.hora_inicio} ${eq.hora_fin ? 'a ' + eq.hora_fin : ''}</span>
      </div>
      <div class="tv-card-main">
        <div class="tv-card-empresa">${eq.cliente} [${eq.ticket}]</div>
        <div class="tv-card-sala"><i class="bi bi-door-open-fill"></i> ${eq.sala}</div>
      </div>
      <div class="tv-card-details">${eq.titulo} ${eq.descripcion ? '— ' + eq.descripcion : ''}</div>
    `;
    wrapper.appendChild(card);
  });

  // Configurar auto-scroll si excede
  configurarAutoScroll('viewport-equipos', 'equipos-wrapper', (int) => { equiposScrollInterval = int; });
}

function configurarAutoScroll(viewportId, wrapperId, saveIntervalCallback) {
  const viewport = document.getElementById(viewportId);
  const wrapper = document.getElementById(wrapperId);
  if (!viewport || !wrapper) return;

  setTimeout(() => {
    const vHeight = viewport.clientHeight;
    const wHeight = wrapper.scrollHeight;

    if (wHeight > vHeight) {
      let currentOffset = 0;
      const scrollStep = 130; // Desplazamiento aproximado por tarjeta
      const maxScroll = wHeight - vHeight + 40;

      const interval = setInterval(() => {
        currentOffset += scrollStep;
        if (currentOffset > maxScroll) {
          currentOffset = 0;
        }
        wrapper.style.transform = `translateY(-${currentOffset}px)`;
      }, SCROLL_STEP_DELAY_MS);

      saveIntervalCallback(interval);
    }
  }, 1000);
}
