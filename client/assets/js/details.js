import { getRingingsMadeByUser } from "./requests.js"; 

let miniMap = null;

export async function showBirdDetails(ringing, allRingings) {
    
    // 1. Cargar el HTML del modal si no existe
    if(!document.getElementById('birdDetailModal')) {
        const response = await fetch('dialogs/detailDialog.html');
        const html = await response.text();
        document.body.insertAdjacentHTML('beforeend', html);
    }

    const history = allRingings
        .filter(r => {
            // Filtro por anilla y remitente (asumiendo que es lo único que define al individuo)
            const show = (r.codigo_anilla === ringing.codigo_anilla && r.nombre_remitente === ringing.nombre_remitente);
            return show;
        })
        .sort((a,b) => new Date(a.capture_date.split('-').reverse().join('-')) - new Date(b.capture_date.split('-').reverse().join('-')));

    // 4. Rellenar Datos Básicos (DOM)
    document.getElementById('detail-species').textContent = ringing.common_name;
    document.getElementById('detail-ring').textContent = ringing.codigo_anilla;
    document.getElementById('detail-date').textContent = ringing.capture_date;
    document.getElementById('detail-code').textContent = ringing.codigo_anilla;
    
    // Rellenar Biometría
    document.getElementById('detail-sex').textContent = ringing.sex;
    document.getElementById('detail-age').textContent = ringing.age;
    document.getElementById('detail-fat').textContent = ringing.underskin_fat;
    document.getElementById('detail-muscle').textContent = ringing.muscle;
    document.getElementById('detail-weight').textContent = ringing.bird_weight || '-';
    document.getElementById('detail-notes').textContent = ringing.notes || 'Sin observaciones adicionales.';
    document.getElementById('detail-ringer').textContent = ringing.nombre_remitente || 'Desconocido';

    // Badge de Recaptura en cabecera
    const badge = document.getElementById('detail-recapture-badge');
    if(history.length > 1) badge.classList.remove('d-none');
    else badge.classList.add('d-none');

    // 5. RENDERIZAR HISTORIAL (MODO GRID HORIZONTAL)
    const timelineContainer = document.getElementById('timeline-list');
    timelineContainer.innerHTML = '';
    
    // Convertimos el contenedor en una Fila de Bootstrap (Grid)
    timelineContainer.className = 'row g-3'; 
    
    history.forEach(h => {
        const isCurrent = h.id == ringing.id;
        
        // Estilos para diferenciar el actual del resto
        const cardClass = 'card h-100 border shadow-sm bg-light';
        const headerClass = isCurrent ? 'card-header bg-success text-white small fw-bold' : 'card-header bg-white small fw-bold text-muted';
        const badgeType = h.is_recapture 
            ? '<span class="badge bg-warning text-dark float-end" style="font-size: 0.7em;">Recaptura</span>' 
            : '<span class="badge bg-secondary float-end" style="font-size: 0.7em;">Anillamiento</span>';

        // Creamos la columna (3 por fila en pantallas grandes = col-lg-4)
        const col = document.createElement('div');
        col.className = 'col-12 col-md-6 col-lg-4';

        col.innerHTML = `
            <div class="${cardClass}">
                <div class="${headerClass} d-flex justify-content-between align-items-center">
                    <span><i class="bi bi-calendar-event me-1"></i>${h.capture_date}</span>
                    ${badgeType}
                </div>
                <div class="card-body p-2">
                    <h6 class="card-title text-primary small mb-1 text-truncate" title="${h.station}">
                        <i class="bi bi-house me-1"></i>${h.station || "Estación desconocida"}
                    </h6>
                    <p class="card-text small text-muted text-truncate mb-2" title="${h.capture_location}">
                        <i class="bi bi-geo-alt me-1"></i>${h.capture_location}
                    </p>
                    
                    <div class="bg-white rounded p-1 border d-flex justify-content-between text-muted" style="font-size: 0.75rem;">
                        <span><b>Edad:</b> ${h.age.substring(0,3)}</span>
                        <span><b>Sexo:</b> ${h.sex.substring(0,1).toUpperCase()}</span>
                        <span><b>Grasa:</b> ${h.underskin_fat}</span>
                    </div>

                    ${isCurrent ? '<div class="text-center mt-2"><span class="badge bg-success bg-opacity-10 text-success border border-success">Registro Actual</span></div>' : ''}
                </div>
            </div>
        `;
        timelineContainer.appendChild(col);
    });

    // 6. Mostrar Modal
    const modalEl = document.getElementById('birdDetailModal');
    const modal = new bootstrap.Modal(modalEl);
    modal.show();
}