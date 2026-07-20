let dashboardData = {};
let reportDataPayload = {};

// Detectar si la página está dentro de un Iframe
if (window.self !== window.top) {
    document.documentElement.classList.add('is-iframe');
}

// INICIALIZACIÓN GLOBAL
document.addEventListener("DOMContentLoaded", async () => {
    setHeaderInfo();
    restoreShift();

    // Escuchar cambios en los inputs para el Live Preview
    const metricsBody = document.getElementById("metrics-body");
    if(metricsBody) metricsBody.addEventListener("input", updateLivePreview);

    // NUEVO: Escuchar el cuadro de notas del relevo
    const shiftNotes = document.getElementById("shift-notes");
    if(shiftNotes) shiftNotes.addEventListener("input", updateLivePreview);

    // Cargar datos asíncronamente
    await fetchDashboardData();
    await fetchReportPayload();
    
    // Iniciar sistema de notificaciones de Mesa de Ayuda
    checkNotifications();
    setInterval(checkNotifications, 30000);
});

function setHeaderInfo() {
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    let dateStr = new Date().toLocaleDateString('es-ES', options);
    const dateEl = document.getElementById("current-date");
    if (dateEl) dateEl.innerText = dateStr.charAt(0).toUpperCase() + dateStr.slice(1);
}

// ==========================================================================
// 1. CARGA DEL BLOQUE SUPERIOR (Resumen 24hs)
// ==========================================================================
async function fetchDashboardData() {
    try {
        const res = await fetch("/shift/api/summary");
        dashboardData = await res.json();

        fillList("w-cases", dashboardData.cases_24h, formatCase, "border-cases");
        fillList("w-act-today", dashboardData.activities_today, formatSched, "border-act-today");
        fillList("w-creds", dashboardData.active_credentials, formatCred, "border-creds");
    } catch (error) { console.error("Error cargando resumen 24hs:", error); }
}

function fillList(elementId, items, formatFn, borderClass) {
    const ul = document.getElementById(elementId);
    if (!ul) return;
    if (!items || items.length === 0) { ul.innerHTML = "<li class='empty-msg' style='color:#64748b; font-style:italic;'>Sin registros recientes</li>"; return; }
    ul.innerHTML = items.map(i => `<li class="${borderClass}" style="margin-bottom:10px; border-bottom:1px solid #e2e8f0; padding-bottom:10px; list-style:none;">${formatFn(i)}</li>`).join('');
}

function formatCase(i) {
    return `<strong>${i.ticket}</strong> - <span style="color:#64748b;">${i.client}</span> <span class="badge ${i.status ? i.status.replace(" ", "-") : ''}">${i.status || ''}</span><br>
            <small style="display:block; margin-top:4px;">${i.title}</small>`;
}
function formatSched(i) {
    return `<strong>${i.ticket}</strong> <span class="badge ${i.status ? i.status.replace(" ", "-") : ''}">${i.status || ''}</span><br>
            <small style="display:block; margin-top:4px;">📍 ${i.site || 'N/A'} | ⏰ ${i.time} hs</small>`;
}
function formatCred(i) {
    return `👤 <strong>${i.name}</strong> (<strong style="color:#8b5cf6;">${i.code}</strong>)<br>
            <small style="display:block; margin-top:4px;">Tkt: ${i.ticket}</small>`;
}

// ==========================================================================
// 2. CARGA DEL PAYLOAD Y LIVE PREVIEW
// ==========================================================================
async function fetchReportPayload() {
    try {
        const res = await fetch("/shift/api/closed-shift-report");
        reportDataPayload = await res.json();
        updateLivePreview(); // Primer renderizado automático
    } catch (error) {
        console.error("Error al obtener la data del reporte:", error);
    }
}

const safeVal = (id) => {
    const el = document.getElementById(id);
    return el ? (el.value || "0") : "0";
};

function buildMetricsObject() {
    return {
        sh_aws: { c: safeVal('c-sh-aws'), t: safeVal('t-sh-aws') },
        sh: { c: safeVal('c-sh'), t: safeVal('t-sh') },
        rh: { c: safeVal('c-rh'), t: safeVal('t-rh') },
        inout: { c: safeVal('c-inout'), t: safeVal('t-inout') },
        inc: { c: safeVal('c-inc'), t: safeVal('t-inc') },
        inc_aws: { c: safeVal('c-inc-aws'), t: safeVal('t-inc-aws') },
        calls: { c: safeVal('c-calls'), t: safeVal('t-calls') },
        mails: { c: safeVal('c-mails'), t: safeVal('t-mails') },
        td: { c: safeVal('c-td'), t: safeVal('t-td') },
        acc: { c: safeVal('c-acc'), t: safeVal('t-acc') },
        trad: { c: safeVal('c-trad'), t: safeVal('t-trad') },
        pta: { c: safeVal('c-pta'), t: safeVal('t-pta') },
        mop: { c: safeVal('c-mop'), t: safeVal('t-mop') },
        abm: { c: safeVal('c-abm'), t: safeVal('t-abm') },
        eti: { c: safeVal('c-eti'), t: safeVal('t-eti') },
        chi: { c: safeVal('c-chi'), t: safeVal('t-chi') },
        mia: { c: safeVal('c-mia'), t: safeVal('t-mia') },
        te: { c: safeVal('c-te'), t: safeVal('t-te') }
    };
}

function updateLivePreview() {
    if(!reportDataPayload.cases) return; // Evitar renderizar si la API aún no cargó
    const m = buildMetricsObject();
    buildEmailTemplatePreview(m);
}

function saveShift() {
    const selector = document.getElementById("shift-selector");
    if(selector) localStorage.setItem("selectedShift", selector.value);
}

function restoreShift() {
    const savedShift = localStorage.getItem("selectedShift");
    const selector = document.getElementById("shift-selector");
    if (savedShift && selector) selector.value = savedShift;
}

// ==========================================================================
// 3. CONSOLIDACIÓN Y ENVÍO DEL TURNO
// ==========================================================================
function validateAndSend() {
    const selector = document.getElementById("shift-selector");
    if (!selector || selector.value === "") {
        if (typeof showNotification === 'function') showNotification('error', '⚠️ Seleccione su turno antes de enviar.');
        else alert('Seleccione su turno antes de enviar.');
        if(selector) selector.focus();
        return;
    }

    // Validar que al menos se haya cargado algo de TIEMPO
    const timeInputs = document.querySelectorAll("input[id^='t-']");
    let totalTime = 0;
    timeInputs.forEach(input => {
        totalTime += parseInt(input.value || 0);
    });

    if (totalTime === 0) {
        if (typeof showNotification === 'function') showNotification('error', '⛔ No puedes cerrar el turno con 0 minutos. Debes declarar los tiempos invertidos en las tareas.');
        else alert('Debes declarar los tiempos invertidos.');
        return;
    }

    confirmAndSendEmail();
}

function switchTab(tabName) {
    const tabMetrics = document.getElementById('tab-metrics');
    const tabDest = document.getElementById('tab-dest');
    const btnMetrics = document.getElementById('btn-tab-metrics');
    const btnDest = document.getElementById('btn-tab-dest');

    if (tabName === 'metrics') {
        tabMetrics.style.display = 'flex';
        tabDest.style.display = 'none';

        btnMetrics.style.background = '#8b5cf6';
        btnMetrics.style.color = 'white';
        btnDest.style.background = '#f1f5f9';
        btnDest.style.color = '#475569';
    } else {
        tabMetrics.style.display = 'none';
        tabDest.style.display = 'block';

        btnDest.style.background = '#8b5cf6';
        btnDest.style.color = 'white';
        btnMetrics.style.background = '#f1f5f9';
        btnMetrics.style.color = '#475569';
    }
}

async function confirmAndSendEmail() {
    const btn = document.getElementById("btn-final-close");
    if(btn) {
        btn.innerText = "Procesando...";
        btn.disabled = true;
    }

    const previewHtml = document.getElementById("email-preview-container").innerHTML;
    const turnoSeleccionado = document.getElementById("shift-selector").value;

    let logicalDate = new Date();
    if (turnoSeleccionado.includes("Noche") && logicalDate.getHours() < 12) {
        logicalDate.setDate(logicalDate.getDate() - 1);
    }

    const baseDate = new Date(2026, 6, 10);
    const targetDate = new Date(logicalDate.getFullYear(), logicalDate.getMonth(), logicalDate.getDate());
    const diffTime = targetDate.getTime() - baseDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    const cycleIndex = Math.floor(diffDays / 5);

    const startDate = new Date(baseDate);
    startDate.setDate(baseDate.getDate() + (cycleIndex * 5));
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 5);

    const formatStr = (d) => String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear();
    const subject = `Planilla actualizaciones de turno ${formatStr(startDate)} - ${formatStr(endDate)}`;

    const emailTo = document.getElementById("email-to").value.trim();
    const emailCc = document.getElementById("email-cc").value.trim();

    if (!emailTo) {
        if (typeof showNotification === 'function') showNotification('error', "⚠️ El campo de destinatario principal (Para) es obligatorio.");
        switchTab('dest');
        if(btn) { btn.innerText = "🚀 Consolidar y Enviar"; btn.disabled = false; }
        return;
    }

    const m = buildMetricsObject();
    await saveMetricsToDatabase(m);

    try {
        const res = await fetch("/shift/api/save-report", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                subject: subject,
                html_content: previewHtml,
                to_email: emailTo,
                cc_email: emailCc
            })
        });

        if (res.ok) {
            if (typeof showNotification === 'function') showNotification('success', "✅ ¡Reporte consolidado y en proceso de envío!");
            document.querySelectorAll(".metric-in").forEach(input => input.value = "0");
            updateLivePreview();
        } else {
            if (typeof showNotification === 'function') showNotification('error', "❌ Error al procesar el reporte en el servidor.");
        }
    } catch (err) {
        if (typeof showNotification === 'function') showNotification('error', "❌ Error de conexión al enviar.");
    } finally {
        if(btn) {
            btn.innerText = "🚀 Consolidar y Enviar";
            btn.disabled = false;
        }
    }
}

async function saveMetricsToDatabase(m) {
    const selector = document.getElementById("shift-selector");
    const payload = {
        operator_name: getCurrentUserName(),
        shift: selector ? selector.value : "No especificado",
        metrics: m
    };
    try {
        await fetch("/metrics/api/save", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
    } catch (e) { console.error("Error guardando métricas", e); }
}

// ==========================================================================
// 4. RENDERIZADO DEL CORREO (VISTA PREVIA)
// ==========================================================================
function buildEmailTemplatePreview(m) {
    const previewContainer = document.getElementById("email-preview-container");
    if(!previewContainer) return;

    const turnoSeleccionado = document.getElementById("shift-selector").value || "[Turno no seleccionado]";
    const fechaHoy = new Date().toLocaleDateString('es-ES', {day: '2-digit', month: 'short'});

    // CAPTURAMOS EL TEXTO DEL RELEVO
    const notasRelevo = document.getElementById("shift-notes") ? document.getElementById("shift-notes").value.trim() : "";
    let cartelRelevoHtml = "";

    if (notasRelevo !== "") {
        cartelRelevoHtml = `
        <div style="background-color: #FEF3C7; border-left: 4px solid #F59E0B; padding: 12px; margin-top: 15px; margin-bottom: 15px; border-radius: 4px; color: #92400E; font-family: sans-serif;">
            <strong style="font-size: 14px; text-transform: uppercase;">⚠️ Atención Relevo / Novedades:</strong>
            <div style="margin-top: 5px; font-size: 13px;">${notasRelevo.replace(/\n/g, '<br>')}</div>
        </div>`;
    }

    // Notas
    let notasHtml = '';
    const prioridades = ['Alta', 'Media', 'Baja'];
    prioridades.forEach(pri => {
        const notasPri = (reportDataPayload.notes || []).filter(n => n.priority === pri);
        if (notasPri.length > 0) {
            let borderColor = pri === 'Alta' ? '#D13438' : (pri === 'Media' ? '#CA5010' : '#107C41');
            let bgColor = pri === 'Alta' ? '#FDE7E9' : (pri === 'Media' ? '#FDF3F0' : '#EBF3EC');
            let listItems = notasPri.map(n => `<li style='margin-left:0cm; margin-bottom: 4px; color: #000000;'><b>${n.title}:</b> ${n.obs}</li>`).join('');
            notasHtml += `
            <div style='margin-top: 5px; margin-bottom: 12px; border-left: 4px solid ${borderColor}; background-color: ${bgColor}; padding: 10px; border-radius: 4px;'>
                <strong style='color: ${borderColor}; font-size: 14px; display: block; margin-bottom: 6px; text-transform: uppercase;'>${pri}</strong>
                <ul style='margin: 0; padding-left: 20px; width: 100%; color: #000000;' type=disc>${listItems}</ul>
            </div>`;
        }
    });

    // Casos
    let casosHtml = '';
    if (reportDataPayload.cases && reportDataPayload.cases.length > 0) {
        casosHtml = reportDataPayload.cases.map(c => `
        <tr style='background-color:#FFFFFF; color:#000000;'>
            <td colspan='3'>${c.ticket}</td><td>${c.client}</td><td colspan='13'>${c.title}</td><td colspan='2'>${c.status}</td><td colspan='15' style='text-align:left;'>Reportado en turno</td>
        </tr>`).join('');
    }

    // Tareas Planificadas
    let proximosHtml = '';
    if (reportDataPayload.pending_activities && reportDataPayload.pending_activities.length > 0) {
        let trs = reportDataPayload.pending_activities.map(a => {
            const dateStr = a.until ? a.until.split('T')[0] : '';
            return `
            <tr style='height:20pt; background-color:#FFFFFF; color:#000000;'>
                <td colspan=3 style='white-space:nowrap;'>${a.ticket}</td>
                <td>${a.client}</td><td colspan=13>${a.title}</td><td colspan=2>Pendiente</td>
                <td colspan=3>-</td><td colspan=2>${dateStr}</td><td colspan=2>-</td>
                <td colspan=2>${dateStr}</td><td colspan=2>-</td><td>-</td><td colspan=3 style='text-align:left;'>Planificado</td>
            </tr>`;
        }).join('');
        proximosHtml = `<tr style='height:15.75pt'><td colspan=34 bgcolor="#A02B93" class="bg-prox-main" style='color:white; font-weight:bold; border-top:none;'>Tareas Planificadas y próximos</td></tr>
                        <tr style='height:15.75pt;'>
                            <td colspan=3 bgcolor="#D86DCD" class='header-sub bg-prox-sub'>CS/REQ/RITM/INC/SCTASK</td><td bgcolor="#D86DCD" class='header-sub bg-prox-sub'>Cliente</td><td colspan=13 bgcolor="#D86DCD" class='header-sub bg-prox-sub'>Titulo</td><td colspan=2 bgcolor="#D86DCD" class='header-sub bg-prox-sub'>Estado</td><td colspan=3 bgcolor="#D86DCD" class='header-sub bg-prox-sub'>Fecha de solicitud</td><td colspan=2 bgcolor="#D86DCD" class='header-sub bg-prox-sub'>Fecha Inicio</td><td colspan=2 bgcolor="#D86DCD" class='header-sub bg-prox-sub'>Hora Inicio</td><td colspan=2 bgcolor="#D86DCD" class='header-sub bg-prox-sub'>Fecha de Fin</td><td colspan=2 bgcolor="#D86DCD" class='header-sub bg-prox-sub'>Hora de Fin</td><td bgcolor="#D86DCD" class='header-sub bg-prox-sub'>DC/EN/SUB</td><td colspan=3 bgcolor="#D86DCD" class='header-sub bg-prox-sub'>Observaciones</td>
                        </tr>${trs}`;
    }

    // Accesos
    let accesosHtml = '';
    if (reportDataPayload.pending_accesses && reportDataPayload.pending_accesses.length > 0) {
        let trs = reportDataPayload.pending_accesses.map(a => `
            <tr style='height:20pt; background-color:#FFFFFF; color:#000000;'>
                <td colspan=3 style='white-space:nowrap;'>${a.ticket}</td><td>${a.client}</td><td colspan=13>${a.title}</td><td colspan=2>Pendiente</td><td colspan=3>-</td><td colspan=2>-</td><td colspan=2>-</td><td colspan=2>-</td><td colspan=2>-</td><td>-</td><td colspan=3 style='text-align:left;'>Acceso Activo</td>
            </tr>`).join('');
        accesosHtml = `<tr style='height:15.75pt'><td colspan=34 bgcolor="#DA0000" class="bg-acc-main" style='color:white; font-weight:bold; border-top:none;'>In/Out y Accesos</td></tr>
                       <tr style='height:22.25pt;'>
                            <td colspan=3 bgcolor="#FF9999" class='header-sub bg-acc-sub'>CS/REQ/RITM/INC/SCTASK</td><td bgcolor="#FF9999" class='header-sub bg-acc-sub'>Cliente</td><td colspan=13 bgcolor="#FF9999" class='header-sub bg-acc-sub'>Titulo</td><td colspan=2 bgcolor="#FF9999" class='header-sub bg-acc-sub'>Estado</td><td colspan=3 bgcolor="#FF9999" class='header-sub bg-acc-sub'>Fecha de solicitud</td><td colspan=2 bgcolor="#FF9999" class='header-sub bg-acc-sub'>Fecha Inicio</td><td colspan=2 bgcolor="#FF9999" class='header-sub bg-acc-sub'>Hora Inicio</td><td colspan=2 bgcolor="#FF9999" class='header-sub bg-acc-sub'>Fecha de Fin</td><td colspan=2 bgcolor="#FF9999" class='header-sub bg-acc-sub'>Hora de Fin</td><td bgcolor="#FF9999" class='header-sub bg-acc-sub'>DC</td><td colspan=3 bgcolor="#FF9999" class='header-sub bg-acc-sub'>Observaciones</td>
                       </tr>${trs}`;
    }

    // Tareas Extras
    let extrasHtml = '';
    if (reportDataPayload.extra_tasks && reportDataPayload.extra_tasks.length > 0) {
        let trs = reportDataPayload.extra_tasks.map(e => `
            <tr style='height:20pt; background-color:#FFFFFF; color:#000000;'><td colspan=8>${e.title}</td><td colspan=4>${e.duration}</td><td colspan=22 style='text-align:left;'>-</td></tr>`).join('');
        extrasHtml = `<tr style='height:15.75pt'><td colspan=34 bgcolor="#607D8B" class="bg-extra-main" style='color:white; font-weight:bold; border-top:none;'>Tareas Extra</td></tr>
                      <tr style='height:15pt;'>
                          <td colspan=8 bgcolor="#CFD8DC" class='header-sub bg-extra-sub'>Título</td><td colspan=4 bgcolor="#CFD8DC" class='header-sub bg-extra-sub'>Tiempo</td><td colspan=22 bgcolor="#CFD8DC" class='header-sub bg-extra-sub'>ACTUALIZACIONES - INDICACIONES - PENDIENTES – OBSERVACIONES</td>
                      </tr>${trs}`;
    }

    // Casos Externos
    let externosHtml = '';
    if (reportDataPayload.external_cases && reportDataPayload.external_cases.length > 0) {
        let trs = reportDataPayload.external_cases.map(e => {
            let siteColor = e.site === 'Chile' ? '#dc2626' : '#2563eb';
            return `
            <tr style='height:20pt; background-color:#FFFFFF; color:#000000;'>
                <td colspan=3 style='font-weight:bold; color: ${siteColor};'>${e.site}</td>
                <td colspan=3>${e.ticket_number}</td><td colspan=4>${e.client}</td><td colspan=10>${e.reason}</td>
                <td colspan=2>${e.status}</td><td colspan=2 style='text-align:center;'>${e.contact_count}</td>
                <td colspan=10 style='text-align:left;'>${e.updates || '-'}</td>
            </tr>`;
        }).join('');
        externosHtml = `<tr style='height:15.75pt'><td colspan=34 bgcolor="#F59E0B" class="bg-ext-main" style='color:white; font-weight:bold; border-top:none;'>Casos Sitios Externos (Chile/Miami)</td></tr>
                        <tr style='height:15pt;'>
                            <td colspan=3 bgcolor="#FDE68A" class='header-sub bg-ext-sub'>Sitio</td><td colspan=3 bgcolor="#FDE68A" class='header-sub bg-ext-sub'>Ticket</td><td colspan=4 bgcolor="#FDE68A" class='header-sub bg-ext-sub'>Cliente</td><td colspan=10 bgcolor="#FDE68A" class='header-sub bg-ext-sub'>Motivo</td><td colspan=2 bgcolor="#FDE68A" class='header-sub bg-ext-sub'>Estado</td><td colspan=2 bgcolor="#FDE68A" class='header-sub bg-ext-sub'>Cant. Mails/Llamados</td><td colspan=10 bgcolor="#FDE68A" class='header-sub bg-ext-sub'>Actualizaciones</td>
                        </tr>${trs}`;
    }

    previewContainer.innerHTML = `
    <style>
        .tabla-bloqueada { display: table !important; width: 100% !important; min-width: 800px; border-collapse: collapse; table-layout: auto; }
        .email-preview-table td { border: 1px solid #cbd5e1; padding: 4px; text-align: center; font-size: 9pt; }
        .header-sub { font-weight: bold; font-size: 9pt; color: #000000 !important; }
        .bg-turno-main { background-color: #26849C !important; } .bg-turno-sub { background-color: #92CDDC !important; }
    </style>

    <div style="background-color: #ffffff; color: #000000; padding: 10px;">
        <p>Buenas equipo,<br>Les envío la planilla del <b>${turnoSeleccionado}</b>.</p>
        ${cartelRelevoHtml} ${notasHtml}

        <div style='overflow-x: auto; margin-bottom: 20px;'>
            <table border="1" class='tabla-bloqueada email-preview-table'>
                <tr><td colspan='34' style='background-color:#8ED973; color:black; font-weight:bold;'>ACTUALIZACION DE CASOS</td></tr>
                <tr><td colspan='3' style='background-color:#E2F0D9; font-weight:bold;'>CS/REQ/RITM</td><td style='background-color:#E2F0D9; font-weight:bold;'>Cliente</td><td colspan='13' style='background-color:#E2F0D9; font-weight:bold;'>Titulo</td><td colspan='2' style='background-color:#E2F0D9; font-weight:bold;'>Estado</td><td colspan='15' style='background-color:#E2F0D9; font-weight:bold;'>ACTUALIZACIONES</td></tr>
                ${casosHtml}
                ${proximosHtml}
                ${accesosHtml}
                ${extrasHtml}
                ${externosHtml}
            </table>
        </div>

        <div style='overflow-x: auto;'>
            <table border="1" class='tabla-bloqueada email-preview-table'>
            <tr style='height:15.75pt'><td colspan=22 bgcolor="#26849C" class="bg-turno-main" style='color:white; font-weight:bold;'>Métricas de Cantidades y Tiempos del Turno</td></tr>
            <tr style='height:25pt;'>
                <td bgcolor="#92CDDC" class='header-sub bg-turno-sub'>Fecha</td>
                <td bgcolor="#92CDDC" class='header-sub bg-turno-sub'>SH AWS</td>
                <td bgcolor="#92CDDC" class='header-sub bg-turno-sub'>SH</td>
                <td bgcolor="#92CDDC" class='header-sub bg-turno-sub'>RH</td>
                <td bgcolor="#92CDDC" class='header-sub bg-turno-sub'>IN/OUT</td>
                <td bgcolor="#92CDDC" class='header-sub bg-turno-sub'>INC</td>
                <td bgcolor="#92CDDC" class='header-sub bg-turno-sub'>Alarmas AWS</td>
                <td bgcolor="#92CDDC" class='header-sub bg-turno-sub'>Calls</td>
                <td bgcolor="#92CDDC" class='header-sub bg-turno-sub'>Mails</td>
                <td bgcolor="#92CDDC" class='header-sub bg-turno-sub'>Tareas D.</td>
                <td bgcolor="#92CDDC" class='header-sub bg-turno-sub'>Accesos</td>
                <td bgcolor="#92CDDC" class='header-sub bg-turno-sub'>Traducción</td>
                <td bgcolor="#92CDDC" class='header-sub bg-turno-sub'>Asistencia</td>
                <td bgcolor="#92CDDC" class='header-sub bg-turno-sub'>MOPs</td>
                <td bgcolor="#92CDDC" class='header-sub bg-turno-sub'>ABM CMDB</td>
                <td bgcolor="#92CDDC" class='header-sub bg-turno-sub'>Etiquetas</td>
                <td style='background-color:#F7C7AC;'>Llamadas Chi</td>
                <td style='background-color:#FFFF99;'>Llamadas Mia</td>
                <td style='background-color:#CFD8DC;'>Tareas Add</td>
                <td bgcolor="#92CDDC" class='header-sub bg-turno-sub'>Break</td>
            </tr>
            <tr style='height:20pt; background-color:#FFFFFF; color:#000000;'>
                <td bgcolor="#FFFFFF"><b>${fechaHoy} (Cant)</b></td>
                <td bgcolor="#FFFFFF">${m.sh_aws.c}</td><td bgcolor="#FFFFFF">${m.sh.c}</td>
                <td bgcolor="#FFFFFF">${m.rh.c}</td><td bgcolor="#FFFFFF">${m.inout.c}</td>
                <td bgcolor="#FFFFFF">${m.inc.c}</td><td bgcolor="#FFFFFF">${m.inc_aws.c}</td>
                <td bgcolor="#FFFFFF">${m.calls.c}</td><td bgcolor="#FFFFFF">${m.mails.c}</td>
                <td bgcolor="#FFFFFF">${m.td.c}</td><td bgcolor="#FFFFFF">${m.acc.c}</td>
                <td bgcolor="#FFFFFF">${m.trad.c}</td><td bgcolor="#FFFFFF">${m.pta.c}</td>
                <td bgcolor="#FFFFFF">${m.mop.c}</td><td bgcolor="#FFFFFF">${m.abm.c}</td>
                <td bgcolor="#FFFFFF">${m.eti.c}</td>
                <td style='background-color:#F7C7AC;'>${m.chi.c}</td><td style='background-color:#FFFF99;'>${m.mia.c}</td><td style='background-color:#CFD8DC;'>${m.te.c}</td>
                <td bgcolor="#FFFFFF">1</td>
            </tr>
            <tr style='height:20pt; background-color:#FFFFFF; color:#000000;'>
                <td bgcolor="#FFFFFF"><b>TD${fechaHoy} (Min)</b></td>
                <td bgcolor="#FFFFFF">${m.sh_aws.t}</td><td bgcolor="#FFFFFF">${m.sh.t}</td>
                <td bgcolor="#FFFFFF">${m.rh.t}</td><td bgcolor="#FFFFFF">${m.inout.t}</td>
                <td bgcolor="#FFFFFF">${m.inc.t}</td><td bgcolor="#FFFFFF">${m.inc_aws.t}</td>
                <td bgcolor="#FFFFFF">${m.calls.t}</td><td bgcolor="#FFFFFF">${m.mails.t}</td>
                <td bgcolor="#FFFFFF">${m.td.t}</td><td bgcolor="#FFFFFF">${m.acc.t}</td>
                <td bgcolor="#FFFFFF">${m.trad.t}</td><td bgcolor="#FFFFFF">${m.pta.t}</td>
                <td bgcolor="#FFFFFF">${m.mop.t}</td><td bgcolor="#FFFFFF">${m.abm.t}</td>
                <td bgcolor="#FFFFFF">${m.eti.t}</td>
                <td style='background-color:#F7C7AC;'>${m.chi.t}</td><td style='background-color:#FFFF99;'>${m.mia.t}</td><td style='background-color:#CFD8DC;'>${m.te.t}</td>
                <td bgcolor="#FFFFFF">60</td>
            </tr>
            </table>
        </div>
    </div>`;
}

// ==========================================================================
// 5. CONTROL DE FEEDBACK / MESA DE AYUDA (CORREGIDO)
// ==========================================================================

window.openFeedbackModal = function() { document.getElementById("feedback-modal").classList.remove("hidden"); };
window.closeFeedbackModal = function() { document.getElementById("feedback-modal").classList.add("hidden"); };

function getCurrentUserName() {
    // 1. Intentamos leer del HTML, pero mostramos por consola qué es lo que lee realmente
    const userEl = document.querySelector('.top-user span');
    const rawText = userEl ? userEl.innerText : "No encontró el span";
    console.log("🛠️ DEBUG - Texto puro en el menú:", rawText); 
    
    const cleanName = userEl ? userEl.innerText.replace("Operador:", "").replace("Administrador:", "").trim() : "Operador";
    console.log("🛠️ DEBUG - Nombre limpio procesado:", cleanName);
    
    return cleanName;
}

// 1. Detección ajustada para leer tu usuario exacto ("tgarbossa")
function isAdminUser() {
    const name = getCurrentUserName();
    // Validamos por nombre completo, nombre de usuario o flag local
    return name.includes("Tomas") || name.includes("tgarbossa") || name.includes("Admin") || localStorage.getItem("forceAdmin") === "true";
}

window.submitFeedback = async function(e) {
    e.preventDefault();

    const reporterName = getCurrentUserName();
    const formData = new FormData();
    formData.append("task_type", document.getElementById("fb-type").value);
    formData.append("title", document.getElementById("fb-title").value);
    formData.append("observations", document.getElementById("fb-obs").value);
    formData.append("reported_by", reporterName);

    const fileInput = document.getElementById("fb-file");
    if (fileInput && fileInput.files.length > 0) formData.append("file", fileInput.files[0]);

    const btn = e.target.querySelector('button[type="submit"]');
    btn.innerText = "Enviando...";
    btn.disabled = true;

    try {
        const res = await fetch("/shift/api/feedback", { method: "POST", body: formData });
        if (res.ok) {
            if (typeof showNotification === 'function') showNotification('success', "✅ Reporte enviado al administrador.");
            else alert("✅ Reporte enviado al equipo.");
            closeFeedbackModal();
            e.target.reset();
            checkNotifications();
        } else {
            if (typeof showNotification === 'function') showNotification('error', "❌ Ocurrió un error en el servidor.");
        }
    } catch (err) {
        console.error(err);
        if (typeof showNotification === 'function') showNotification('error', "❌ Error de comunicación.");
    } finally {
        btn.innerText = "Enviar Reporte";
        btn.disabled = false;
    }
};

let currentTickets = [];

window.checkNotifications = async function() {
    const isAdmin = isAdminUser();
    const userQuery = isAdmin ? "ADMIN" : getCurrentUserName();

    try {
        const res = await fetch(`/shift/api/feedback?user=${userQuery}`);
        if (!res.ok) return;
        const data = await res.json();

        let unreadCount = 0;
        data.forEach(t => {
            if (isAdmin && t.admin_unread) unreadCount++;
            if (!isAdmin && t.user_unread) unreadCount++;
        });

        const badge = document.getElementById("bell-badge");
        if(badge) {
            if (unreadCount > 0) {
                badge.innerText = unreadCount;
                badge.style.display = "inline-block";
            } else {
                badge.style.display = "none";
            }
        }
    } catch (err) { console.error("Error revisando notificaciones:", err); }
};

window.openSupportCenter = function() {
    document.getElementById("support-modal").classList.remove("hidden");
    loadTickets();
};

window.closeSupportCenter = function() {
    document.getElementById("support-modal").classList.add("hidden");
    checkNotifications();
};

// Cargar la lista de tickets en el modal de soporte
window.loadTickets = async function() {
    const isAdmin = isAdminUser();
    const userQuery = isAdmin ? "ADMIN" : getCurrentUserName();

    const res = await fetch(`/shift/api/feedback?user=${userQuery}`);
    currentTickets = await res.json();

    const list = document.getElementById("support-messages-container");
    if(!list) return;

    list.innerHTML = currentTickets.map(t => {
        const unread = (isAdmin && t.admin_unread) || (!isAdmin && t.user_unread);
        let statusColor = t.status === "Resuelto" ? "#10b981" : (t.status === "En Proceso" ? "#f59e0b" : "#ef4444");

        return `
        <div onclick="showTicketDetail('${t.id}')" style="padding: 15px; border-bottom: 1px solid #cbd5e1; cursor: pointer; background-color: ${unread ? '#e0f2fe' : '#ffffff'} !important; color: #0f172a !important; border-left: 4px solid ${unread ? '#3b82f6' : 'transparent'};">
            <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                <span style="font-weight: bold; color: ${statusColor} !important; font-size: 0.8rem; text-transform: uppercase;">${t.status}</span>
                <span style="font-size: 0.8rem; color: #475569 !important;">${new Date(t.created_at).toLocaleDateString()}</span>
            </div>
            <div style="font-weight: bold; color: #0f172a !important; margin-bottom: 5px;">${t.title}</div>
            <div style="font-size: 0.85rem; color: #475569 !important;">${t.task_type} ${isAdmin ? ` | De: ${t.reported_by}` : ''}</div>
        </div>`;
    }).join('') || `<div style="padding:20px; text-align:center; color:#64748b;">No hay reportes ni mensajes.</div>`;
};

// Mostrar el detalle de un ticket específico
window.showTicketDetail = async function(id) {
    const t = currentTickets.find(x => x.id === id);
    const isAdmin = isAdminUser();

    // Marcar silenciosamente como leído en el backend
    await fetch(`/shift/api/feedback/${id}/read?role=${isAdmin ? 'ADMIN' : 'USER'}`, {method: 'PUT'});

    // 1. INYECTAMOS CSS BLINDADO PARA EVITAR EL CONFLICTO CON EL MODO OSCURO
    let html = `
        <style>
            .ticket-modal-override * { font-family: sans-serif; box-sizing: border-box; }
            .ticket-box { background-color: #ffffff !important; border: 1px solid #cbd5e1 !important; border-radius: 6px; padding: 15px; margin-bottom: 20px; }
            .ticket-text-dark { color: #0f172a !important; }
            .ticket-input { background-color: #ffffff !important; color: #0f172a !important; border: 1px solid #94a3b8 !important; }
            .ticket-input:focus { outline: 2px solid #3b82f6 !important; }
            .ticket-btn { background-color: #e2e8f0 !important; color: #0f172a !important; border: none !important; }
        </style>

        <div class="ticket-modal-override">
            <button onclick="loadTickets()" class="ticket-btn" style="margin-bottom: 20px; font-size: 0.85rem; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-weight: bold;">⬅️ Volver a la lista</button>
            
            <h2 class="ticket-text-dark" style="margin-top: 0; margin-bottom: 15px; font-size: 1.4rem;">${t.title}</h2>
            
            <div style="display:flex; gap:10px; margin-bottom: 20px; flex-wrap: wrap;">
                <span style="background-color: #3b82f6 !important; color: #ffffff !important; padding: 4px 10px; border-radius: 12px; font-size: 0.8rem; font-weight: bold;">🏷️ ${t.task_type}</span>
                <span style="background-color: #64748b !important; color: #ffffff !important; padding: 4px 10px; border-radius: 12px; font-size: 0.8rem; font-weight: bold;">👤 ${t.reported_by}</span>
            </div>

            <div class="ticket-box">
                <div style="font-weight: bold; margin-bottom: 8px; color: #2563eb !important; font-size: 0.95rem;">📥 Descripción del Reporte:</div>
                <div class="ticket-text-dark" style="white-space: pre-wrap; font-size: 0.95rem; line-height: 1.5;">${t.observations}</div>
            </div>
    `;

    if (t.admin_comment) {
        html += `
            <div class="ticket-box" style="background-color: #f0fdf4 !important; border-color: #86efac !important;">
                <div style="font-weight: bold; margin-bottom: 8px; color: #16a34a !important; font-size: 0.95rem;">👨‍💻 Respuesta del Administrador:</div>
                <div style="white-space: pre-wrap; font-size: 0.95rem; line-height: 1.5; color: #14532d !important;">${t.admin_comment}</div>
            </div>`;
    }

    if (isAdmin) {
        html += `
            <div class="ticket-box" style="border: 2px solid #94a3b8 !important; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
                <h4 class="ticket-text-dark" style="margin-top:0; margin-bottom: 15px; font-size: 1.1rem; border-bottom: 1px solid #cbd5e1 !important; padding-bottom: 10px;">⚙️ Resolución y Cierre</h4>
                
                <div style="margin-bottom: 15px;">
                    <label class="ticket-text-dark" style="display: block; font-size: 0.85rem; font-weight: bold; margin-bottom: 5px;">Estado de la tarea:</label>
                    <select id="dev-status" class="ticket-input" style="padding: 10px; border-radius: 6px; width: 100%; font-size: 0.95rem; cursor: pointer;">
                        <option value="En Proceso" ${t.status === 'En Proceso' ? 'selected' : ''}>⏳ En Proceso (Investigando)</option>
                        <option value="Resuelto" ${t.status === 'Resuelto' ? 'selected' : ''}>✅ Resuelto (Finalizado)</option>
                    </select>
                </div>
                
                <div style="margin-bottom: 20px;">
                    <label class="ticket-text-dark" style="display: block; font-size: 0.85rem; font-weight: bold; margin-bottom: 5px;">Comentario / Actualización para el operador:</label>
                    <textarea id="dev-comment" class="ticket-input" rows="3" placeholder="Ej: Ya fue corregido en el servidor..." style="width: 100%; border-radius: 6px; padding: 10px; font-size: 0.95rem; resize: vertical;">${t.admin_comment || ''}</textarea>
                </div>
                
                <button onclick="submitAdminResponse('${t.id}')" style="background-color: #10b981 !important; color: #ffffff !important; padding: 12px 15px; width: 100%; font-weight: bold; font-size: 1rem; border: none !important; border-radius: 6px; cursor: pointer; transition: 0.2s;">💾 Guardar y Notificar al Operador</button>
            </div>`;
    }

    html += `</div>`; // Cierre de .ticket-modal-override

    document.getElementById("support-messages-container").innerHTML = html;
    checkNotifications(); 
};

window.submitAdminResponse = async function(id) {
    const payload = {
        status: document.getElementById("dev-status").value,
        admin_comment: document.getElementById("dev-comment").value
    };

    const res = await fetch(`/shift/api/feedback/${id}/resolve`, {
        method: "PUT", headers: {"Content-Type": "application/json"},
        body: JSON.stringify(payload)
    });

    if (res.ok) {
        if (typeof showNotification === 'function') showNotification('success', "✅ Respuesta guardada con éxito.");
        else alert("Respuesta guardada y notificada.");
        showTicketDetail(id);
    }
};