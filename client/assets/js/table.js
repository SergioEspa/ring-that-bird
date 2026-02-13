import { getRingingsMadeByUser } from "./requests.js";
import { filterState, resetFilterState } from "./utils/status.js";
import { showBirdDetails } from "./details.js";

// Variables locales
let rawData = [];        // Datos originales del servidor
let filteredData = [];   // Datos tras pasar por los filtros
let currentSort = 'date_desc'; // Orden por defecto
let aves = [];

export async function initializeTable(currentUser, aves_json) {
    aves = aves_json;
    const tableBody = document.getElementById('tableBody');
    const refreshBtn = document.getElementById('refreshTableBtn');
    const exportBtn = document.getElementById('exportExcelBtn');

    if (!currentUser) {
        tableBody.innerHTML = `<tr><td colspan="6" class="text-center p-5 text-muted">Debes iniciar sesión.</td></tr>`;
        return;
    }

    // 1. INICIALIZAR COMPONENTES DE FILTRO (Sliders y Datepicker)
    initTableFiltersComponents();

    // 2. LISTENERS DE FILTRO
    document.getElementById('table-applyFiltersBtn').addEventListener('click', applyTableFilters);
    
    document.getElementById('table-clearFiltersBtn').addEventListener('click', () => {
        resetTableFilters();
        applyTableFilters();
    });
    
    // 3. LISTENERS DE ORDENACIÓN
    document.querySelectorAll('[data-sort]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            // Visual: Cambiar clase 'active'
            document.querySelectorAll('[data-sort]').forEach(b => b.classList.remove('active'));
            e.currentTarget.classList.add('active');
            
            // Lógica: Ordenar y repintar
            currentSort = e.currentTarget.dataset.sort;
            renderWithSort();
        });
    });

    // 4. AUTOCOMPLETADO
    document.getElementById('table-filterSpecies').addEventListener('input', function() {
        const input = this;
        const query = input.value.toLowerCase();
        const suggestions = document.getElementById('suggestions');
        suggestions.innerHTML = "";

        if (query.length < 2) return;

        suggestions.style.display = 'block';

        const filteredSpecies = aves.filter(ave => 
            ave.especie.toLowerCase().includes(query) || ave.sciName.toLowerCase().includes(query)
        ).slice(0, 10);

        
        filteredSpecies.forEach(bird => {
            const item = document.createElement("div");
            item.className = "list-group-item list-group-item-action";
            item.textContent = `${bird.especie} (${bird.sciName})`;
            item.addEventListener("click", () => {
                input.value = bird.especie;
                suggestions.innerHTML = "";
                document.getElementById('table-filterSpecies').textContent = bird.especie;
            });
            suggestions.appendChild(item);
        });

        const exactMatch = aves.find(ave => ave.especie.toLowerCase() === query);
        if(exactMatch){
            document.getElementById('table-filterSpecies').textContent = exactMatch.especie;
            suggestions.innerHTML = "";
        }
    });

    // 5. LISTENERS GLOBALES
    refreshBtn.onclick = loadData;
    exportBtn.onclick = () => exportToExcel(filteredData); // Exportamos lo que se ve (filtrado)

    // Función de carga inicial
    async function loadData() {
        tableBody.innerHTML = `<tr><td colspan="6" class="text-center p-5 text-muted"><div class="spinner-border text-primary mb-2"></div><p>Cargando...</p></td></tr>`;
        try {
            rawData = await getRingingsMadeByUser(currentUser.email);
            applyTableFilters(); // Esto filtra (si hubiera algo) y luego ordena y pinta
        } catch (error) {
            console.error(error);
            tableBody.innerHTML = `<tr><td colspan="6" class="text-center text-danger p-5">Error cargando datos</td></tr>`;
        }
    };

    // HYDRATION
    // 1. Textos
    document.getElementById('table-filterSpecies').value = filterState.species;
    document.getElementById('table-filterStations').value = filterState.station;

    // 2. Sliders
    const sliderFat = document.getElementById('table-slider-fat');
    if(sliderFat && sliderFat.noUiSlider) {
        sliderFat.noUiSlider.set(filterState.underskin_fat);
    }

    const sliderMuscle = document.getElementById('table-slider-muscle');
    if(sliderMuscle && sliderMuscle.noUiSlider) {
        sliderMuscle.noUiSlider.set(filterState.muscle);
    }

    // 3. Checkboxes (Asumiendo que tus IDs son 'table-macho', 'table-juvenil', etc.)
    ['macho', 'hembra', 'desconocido'].forEach(sex_val => {
        const checkbox = document.getElementById('table-' + sex_val);
        // Usamos .includes() porque filterState.sex es un array ['macho', ...]
        if (checkbox) checkbox.checked = filterState.sex.includes(sex_val);
    });

    ['juvenil', 'adulto'].forEach(age_val => {
        const checkbox = document.getElementById('table-' + age_val);
        if (checkbox) checkbox.checked = filterState.age.includes(age_val);
    });

    // 4. Fechas (Flatpickr)
    const dateInput = document.getElementById('table-filterDateRange');
    if (dateInput && dateInput._flatpickr) {
        if (filterState.dateRange && filterState.dateRange.length === 2) {
            // El 'false' es vital para no disparar eventos infinitos
            dateInput._flatpickr.setDate(filterState.dateRange, false);
        } else {
            dateInput._flatpickr.clear();
        }
    }

    await loadData();
}

function applyTableFilters() {
    // 1. Recogemos valores del DOM
    const species = document.getElementById('table-filterSpecies').value.trim().toLowerCase();
    const station = document.getElementById('table-filterStations').value.trim();
    
    const datePicker = document.querySelector("#table-filterDateRange")._flatpickr;
    const selectedDates = datePicker ? datePicker.selectedDates : [];

    const sexos = [];
    if (document.getElementById('table-macho').checked) sexos.push('macho');
    if (document.getElementById('table-hembra').checked) sexos.push('hembra');
    if (document.getElementById('table-desconocido').checked) sexos.push('desconocido');

    const edades = [];
    if (document.getElementById('table-juvenil').checked) edades.push('juvenil');
    if (document.getElementById('table-adulto').checked) edades.push('adulto');

    const fatValues = document.getElementById('table-slider-fat').noUiSlider.get();
    const muscleValues = document.getElementById('table-slider-muscle').noUiSlider.get();
    
    // ---------------------------------------------------------
    // ¡NUEVO! GUARDAMOS EL ESTADO GLOBAL (SINGLE SOURCE OF TRUTH)
    // ---------------------------------------------------------
    filterState.species = species;
    filterState.station = station;
    filterState.dateRange = selectedDates; // Guardamos los objetos Date reales
    filterState.sex = sexos;
    filterState.age = edades;
    // Convertimos a números para guardar limpio en el estado
    filterState.underskin_fat = [Number(fatValues[0]), Number(fatValues[1])];
    filterState.muscle = [Number(muscleValues[0]), Number(muscleValues[1])];
    // ---------------------------------------------------------

    

    // 2. Filtramos rawData usando los valores locales
    filteredData = rawData.filter(r => {
        // Especie
        if (species && !r.common_name.toLowerCase().includes(species) && !r.sci_name.toLowerCase().includes(species)) return false;
        
        // Estación
        if (station && r.station !== station) return false;

        // Fecha (CORREGIDO: Faltaba la comparación lógica)
        if (selectedDates.length === 2) {
            // Asumiendo que r.capture_date es "DD-MM-YYYY", lo pasamos a ISO "YYYY-MM-DD" para comparar strings
            const dateParts = r.capture_date.split('-');
            // Cuidado aquí: asegúrate si es DD-MM-YYYY o YYYY-MM-DD. 
            // Si es DD-MM-YYYY:
            const rDateISO = `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`; 
            
            const start = selectedDates[0].toISOString().split('T')[0];
            const end = selectedDates[1].toISOString().split('T')[0];

            if (rDateISO < start || rDateISO > end) return false; // <--- ESTA LÍNEA FALTABA
        }

        // Sexo y Edad
        if (sexos.length > 0 && !sexos.includes(r.sex)) return false;
        if (edades.length > 0 && !edades.includes(r.age)) return false;

        // Sliders (Convertir a número)
        if (r.underskin_fat < Number(fatValues[0]) || r.underskin_fat > Number(fatValues[1])) return false;
        if (r.muscle < Number(muscleValues[0]) || r.muscle > Number(muscleValues[1])) return false;

        return true;
    });

    // 3. Una vez filtrado, ordenamos y pintamos
    renderWithSort();
}

// --- FUNCIÓN DE ORDENACIÓN ---
function renderWithSort() {
    // Hacemos una copia para no mutar el orden original si no queremos
    const dataToSort = [...filteredData];

    dataToSort.sort((a, b) => {
        switch (currentSort) {
            case 'date_desc': // Fecha más reciente primero
                // Asumiendo formato DD-MM-YYYY
                return parseDate(b.capture_date) - parseDate(a.capture_date);
            case 'date_asc':
                return parseDate(a.capture_date) - parseDate(b.capture_date);
            case 'species_asc':
                return a.common_name.localeCompare(b.common_name);
            case 'ring_asc':
                return a.codigo_anilla.localeCompare(b.codigo_anilla, undefined, {numeric: true});
            default:
                return 0;
        }
    });

    renderTableRows(dataToSort);
}

// Helper para fecha DD-MM-YYYY a objeto Date
function parseDate(dateStr) {
    if(!dateStr) return 0;
    const [d, m, y] = dateStr.split('-');
    return new Date(`${y}-${m}-${d}`);
}

function renderTableRows(ringings) {
    const tbody = document.getElementById('tableBody');
    const countLabel = document.getElementById('recordCount');
    
    tbody.innerHTML = '';
    countLabel.innerText = `Mostrando ${ringings.length} registros`;

    if (ringings.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center p-5 text-muted">No se encontraron resultados con estos filtros.</td></tr>`;
        return;
    }

    ringings.forEach(r => {
        const row = document.createElement('tr');
        
        // Badges
        const ageBadge = `<span class="badge ${r.age === 'juvenil' ? 'bg-info' : 'bg-secondary'} bg-opacity-10 text-dark border me-1">${r.age || '?'}</span>`;
        let sexClass = r.sex === 'macho' ? 'bg-primary' : (r.sex === 'hembra' ? 'bg-danger' : 'bg-secondary');
        const sexBadge = `<span class="badge ${sexClass} bg-opacity-10 text-dark border">${r.sex || '?'}</span>`;
        
        const bioData = `
            <div class="d-flex gap-1">
                <span class="badge bg-light text-dark border" title="Grasa">G: ${r.underskin_fat}</span>
                <span class="badge bg-light text-dark border" title="Músculo">M: ${r.muscle}</span>
            </div>
        `;

        row.innerHTML = `
            <td class="ps-4 fw-bold text-muted small">${r.capture_date}</td>
            <td>
                <div class="fw-bold text-dark">${r.common_name || 'Desconocido'}</div>
                <div class="small text-muted fst-italic">${r.sci_name}</div>
            </td>
            <td><span class="badge bg-light text-dark border font-monospace">${r.codigo_anilla}</span></td>
            <td>
                <div class="mb-1">${ageBadge}${sexBadge}</div>
                ${bioData}
            </td>
            <td>${r.bird_weight} g</td>
            <td>${r.station || '-'}</td>
            <td>${r.is_recapture ? 'Sí' : 'No'}</td>
            <td class="text-center pe-4">
                <button class="btn btn-sm btn-link text-primary view-detail-btn">
                    <i class="bi bi-eye"></i>
                </button>
            </td>
        `;
        
        const btn = row.querySelector('.view-detail-btn');
        if (btn) {
            btn.addEventListener('click', () => {
                showBirdDetails(r, ringings);
            });
        }

        tbody.appendChild(row);
    });
}

// --- INICIALIZACIÓN DE COMPONENTES ---
function initTableFiltersComponents() {
    // Datepicker
    flatpickr("#table-filterDateRange", {
        mode: "range",
        locale: "es",
        dateFormat: "d-m-Y",
        maxDate: "today",
        conjunction: " a "
    });

    // Sliders
    createSlider('table-slider-fat', 0, 9, 'table-fat-val-min', 'table-fat-val-max');
    createSlider('table-slider-muscle', 0, 3, 'table-muscle-val-min', 'table-muscle-val-max');
}

function createSlider(id, min, max, labelMinId, labelMaxId) {
    const slider = document.getElementById(id);
    if(!slider) return; // Protección

    // Destruir si ya existe (por si recargas la página)
    if(slider.noUiSlider) slider.noUiSlider.destroy();

    noUiSlider.create(slider, {
        start: [min, max],
        connect: true,
        step: 1,
        range: { 'min': min, 'max': max },
        format: { to: v => Math.round(v), from: v => Number(v) }
    });

    slider.noUiSlider.on('update', (values) => {
        document.getElementById(labelMinId).innerText = values[0];
        document.getElementById(labelMaxId).innerText = values[1];
    });
}

function resetTableFilters() {
    document.getElementById('table-filterSpecies').value = '';
    document.getElementById('table-filterStations').value = '';
    document.querySelector("#table-filterDateRange")._flatpickr.clear();
    
    ['table-sexM', 'table-sexF', 'table-sexU', 'table-ageJuv', 'table-ageAd', 'table-otherUserRingings']
        .forEach(id => document.getElementById(id).checked = false);

    document.getElementById('table-slider-fat').noUiSlider.set([0, 9]);
    document.getElementById('table-slider-muscle').noUiSlider.set([0, 3]);

    resetFilterState();
}

// Exportar Excel (usando filteredData para exportar solo lo que ves)
function exportToExcel(data) {
    if(!data || data.length === 0) {
        alert("No hay datos visibles para exportar");
        return;
    }
    // ... tu lógica de mapeo y exportación ...
    const dataToExport = data.map(item => ({
        "Fecha": item.capture_date,
        "Especie": item.common_name,
        "Anilla": item.codigo_anilla,
        // ... resto de campos
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Cuaderno");
    XLSX.writeFile(workbook, `Cuaderno_${new Date().toISOString().split('T')[0]}.xlsx`);
}