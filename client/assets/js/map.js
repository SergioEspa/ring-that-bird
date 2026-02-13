import { loadSession } from "./auth.js";
import { getAnillaIdentidad, getRemitentes, getRingingsMadeByUser, insertAnillaIdentidad, insertRinging } from "./requests.js";
import { filterState } from "./utils/status.js";
import { showBirdDetails } from "./details.js";

let map;
let markerGroup;
let tempMarker = null;
let aves = []
let remitentes = []
let allRingings = []

// APLICAR FILTROS Y GUARDAR ESTADO
function triggerApplyFilters(ringingsToShow){
    const species = document.getElementById('filterSpecies').value;
    filterState.species = species;

    const datePicker = document.querySelector("#filterDateRange")._flatpickr;
    const selectedDates = datePicker ? datePicker.selectedDates : [];
    filterState.dateRange = selectedDates;
    const station = document.getElementById('filterStations').value

    const sexos = [];
    if (document.getElementById('macho').checked) sexos.push('macho');
    if (document.getElementById('hembra').checked) sexos.push('hembra');
    if (document.getElementById('desconocido').checked) sexos.push('desconocido');
    filterState.sex = sexos;

    const edades = [];
    if (document.getElementById('juvenil').checked) edades.push('juvenil');
    if (document.getElementById('adulto').checked) edades.push('adulto');
    filterState.age = edades;

    const fatValues = document.getElementById('slider-fat').noUiSlider.get();
    const muscleValues = document.getElementById('slider-muscle').noUiSlider.get();
    filterState.underskin_fat = [Number(fatValues[0]), Number(fatValues[1])];
    filterState.muscle = [Number(muscleValues[0]), Number(muscleValues[1])];

    const showOtherUserRingings = document.getElementById('otherUserRingings').checked;

    // Aplicamos filtros activos
    if(species){
        ringingsToShow = ringingsToShow.filter(ringing => ringing.common_name.toLowerCase() === species.toLowerCase());
    }
    if(selectedDates.length === 2){
        const inicio = selectedDates[0].toISOString().split('T')[0];
        const fin = selectedDates[1].toISOString().split('T')[0];
        
        ringingsToShow = ringingsToShow.filter(ringing => {
            return ringing.capture_date >= inicio && ringing.capture_date <= fin;
        });
    }
    if(station){
        ringingsToShow = ringingsToShow.filter(ringing => ringing.station === station);
    }
    if(sexos.length > 0){
        ringingsToShow = ringingsToShow.filter(ringing => sexos.includes(ringing.sex));
    }
    if(edades.length > 0){
        ringingsToShow = ringingsToShow.filter(ringing => edades.includes(ringing.age));
    }
    ringingsToShow = ringingsToShow.filter(ringing => {
        return ringing.underskin_fat >= fatValues[0] && ringing.underskin_fat <= fatValues[1];
    });
    ringingsToShow = ringingsToShow.filter(ringing => {
        return ringing.muscle >= muscleValues[0] && ringing.muscle <= muscleValues[1];
    });
    return ringingsToShow;
}

// VISUALIZACIÓN DE MARCADORES
async function renderMarkers(currentUser) {
    if(currentUser){
        try{
            allRingings = await getRingingsMadeByUser(currentUser.email);
            let ringingsToShow = triggerApplyFilters([...allRingings]);
            if(markerGroup){
                markerGroup.clearLayers();
            }
            ringingsToShow.forEach((ringing) => {
                const ringing_location = ringing.capture_location;
                const [lat, lng] = ringing_location.split(',').map(coord => parseFloat(coord.trim()));
                if (!ringing_location || !ringing_location.includes(',')) return;

                const ringing_marker = L.marker([lat, lng]);

                const uniqueId = `btn_ringing_${ringing.id}`;

                const popupContent = `
                    <div style="text-align: center;">
                        <h6 class="mb-1"><b>${ringing.common_name || ringing.sci_name}</b></h6>
                        <small class="text-muted">${ringing.nombre_remitente}: ${ringing.codigo_anilla}</small><br>
                        <span class="badge bg-light text-dark border mt-1">${ringing.capture_date}</span>
                        <br>
                        <button id="${uniqueId}" class="btn btn-sm view-details-btn mt-2">
                            <i class="bi bi-eye"></i> Ver ficha
                        </button>
                    </div>
                `;

                ringing_marker.bindPopup(popupContent);

                ringing_marker.on('popupopen', () => {
                    const btn = document.getElementById(uniqueId);
                    if (btn) {
                        btn.addEventListener('click', () => {
                            showBirdDetails(ringing, allRingings);
                        });
                    }
                });

                ringing_marker.addTo(markerGroup);
            });
        } catch(error){
            console.error("Error mostrando marcadores: ", error);
        }
    }
}

// POBLAMOS LOS FILTROS CON LOS VALORES DEL ESTADO
function hydrateMapFilters() {
    // 1. Textos
    document.getElementById('filterSpecies').value = filterState.species;
    document.getElementById('filterStations').value = filterState.station;
    document.getElementById('otherUserRingings').checked = filterState.showOtherUser;
    
    // 2. Checkboxes (En el mapa los IDs son directos: 'macho', 'hembra'...)
    ['macho', 'hembra', 'desconocido'].forEach(id => {
        const cb = document.getElementById(id);
        if(cb) cb.checked = filterState.sex.includes(id);
    });
    
    ['juvenil', 'adulto'].forEach(id => {
        const cb = document.getElementById(id);
        if(cb) cb.checked = filterState.age.includes(id);
    });
    
    // 3. Sliders
    const sliderFat = document.getElementById('slider-fat');
    if(sliderFat && sliderFat.noUiSlider) sliderFat.noUiSlider.set(filterState.underskin_fat);
    
    const sliderMuscle = document.getElementById('slider-muscle');
    if(sliderMuscle && sliderMuscle.noUiSlider) sliderMuscle.noUiSlider.set(filterState.muscle);
    
    // 4. Fechas
    const dateInput = document.getElementById('filterDateRange');
    if (dateInput && dateInput._flatpickr && filterState.dateRange.length === 2) {
        dateInput._flatpickr.setDate(filterState.dateRange, false);
    }
}

// LISTENERS Y TERRENO DE FILTRADO PREPARADO PARA INTERACCIÓN
function initSliders(){
    // --- CONFIGURACIÓN SLIDER GRASA (0-9) ---
    const sliderFat = document.getElementById('slider-fat');

    noUiSlider.create(sliderFat, {
        start: [0, 9],       // Posiciones iniciales
        connect: true,       // Relleno azul entre los puntos
        step: 1,             // ¡IMPORTANTE! Movimiento discreto
        range: {
            'min': 0,
            'max': 9
        },
        format: {            // Para que no salgan decimales (9.00)
            to: value => Math.round(value),
            from: value => Number(value)
        }
    });

    // Listener visual para actualizar los numeritos de abajo
    sliderFat.noUiSlider.on('update', function (values) {
        document.getElementById('fat-val-min').innerHTML = values[0];
        document.getElementById('fat-val-max').innerHTML = values[1];
    });


    // --- CONFIGURACIÓN SLIDER MÚSCULO (0-3) ---
    const sliderMuscle = document.getElementById('slider-muscle');

    noUiSlider.create(sliderMuscle, {
        start: [0, 3],
        connect: true,
        step: 1,             // Movimiento discreto
        range: {
            'min': 0,
            'max': 3
        },
        format: {
            to: value => Math.round(value),
            from: value => Number(value)
        }
    });

    sliderMuscle.noUiSlider.on('update', function (values) {
        document.getElementById('muscle-val-min').innerHTML = values[0];
        document.getElementById('muscle-val-max').innerHTML = values[1];
    });
}

function initFilters(){
    // Inicializar el calendario de rango
    flatpickr("#filterDateRange", {
        mode: "range",          // Modo rango (Ida y Vuelta)
        locale: "es",           // Idioma español
        dateFormat: "d-m-Y",    // Formato europeo
        maxDate: "today",       // No dejar seleccionar fechas futuras
        conjunction: "  a  ",   // Separador visual
        theme: "light",         // Tema claro
        
        // Opcional: Hacer algo automáticamente al cerrar el calendario
        onClose: function(selectedDates, dateStr, instance) {
            console.log("Fechas seleccionadas:", dateStr);
            // Si quisieras filtrar al instante, llamarías a tu función aquí
        }
    });

    // Listener para el botón LIMPIAR (Resetear filtros)
    document.getElementById('clearFiltersBtn').addEventListener('click', async () => {
        document.getElementById('filterSpecies').value = '';
        document.getElementById('filterStations').value = '';

        const datePicker = document.querySelector("#filterDateRange")._flatpickr;
        if (datePicker) datePicker.clear();

        const checkboxes = [
            'macho', 'hembra', 'desconocido', 
            'juvenil', 'adulto', 
            'otherUserRingings'
        ];
        checkboxes.forEach(id => {
            const cb = document.getElementById(id);
            if (cb) cb.checked = false;
        });

        const fatSlider = document.getElementById('slider-fat').noUiSlider;
        if (fatSlider) fatSlider.set([0, 9]);

        const muscleSlider = document.getElementById('slider-muscle').noUiSlider;
        if (muscleSlider) muscleSlider.set([0, 3]);

        const currentUser = loadSession();
        await renderMarkers(currentUser); 
    });

    // Predicción
    document.getElementById('filterSpecies').addEventListener('input', function() {
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
                document.getElementById('filterSpecies').textContent = bird.especie;
            });
            suggestions.appendChild(item);
        });

        const exactMatch = aves.find(ave => ave.especie.toLowerCase() === query);
        if(exactMatch){
            document.getElementById('filterSpecies').textContent = exactMatch.especie;
            suggestions.innerHTML = "";
        }
    });

    // Listener para el botón APLICAR
    document.getElementById('applyFiltersBtn').addEventListener('click', () => {
        renderMarkers(loadSession());
    });
}


// LÓGICA DE VISUALIZACIÓN DE ANILLAMIENTOS Y FILTRADO ARRIBA

// LÓGICA DE GUARDADO DE ANILLAMIENTOS DEBAJO

export async function initializeMap(aves_main) {
    initSliders();
    initFilters();
    hydrateMapFilters();

    aves = [...aves_main]
    map = L.map('map', {zoomControl: false}).setView([51.505, -0.09], 13);
    markerGroup = L.layerGroup().addTo(map);

    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(function(position) {
            var lat = position.coords.latitude;
            var lon = position.coords.longitude;
            map.setView([lat, lon], 13);
        });
    }

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(map);

    L.control.zoom({
        position: 'topright' // Opciones: 'topright', 'topleft', 'bottomleft', 'bottomright'
    }).addTo(map);

    // Configuración del Geocoder (Sin cambios)
    L.Control.geocoder({
        defaultMarkGeocode: false,
        position: 'topright',
        collapsed: true,
        placeholder: "Buscar ubicación...",
        errorMessage: "No se encontró la ubicación",
        queryMinLength: 3,
        suggestMinLength: 3,
        suggestTimeout: 100,
        geocoder: L.Control.Geocoder.nominatim({
            geocodingQueryParams: { limit: 5, addressdetails: 1 }
        })
    }).on('markgeocode', function(e) {
        var latlng = e.geocode.center;
        map.flyTo(latlng, 14, { duration: 1.5, easeLinearity: 0.25 });
    }).addTo(map);

    const currentUser = loadSession();
    await renderMarkers(currentUser);
}

function exitAddingBirdMode(){
    map.off('click', placeMarker);
    document.getElementById('map').style.cursor = '';

    const cancelBtns = document.querySelectorAll('#cancel-add-bird');
    cancelBtns.forEach(btn => btn.remove());

    document.getElementById('add-bird-btn').style.display = 'block';
}

export async function startAddingBird() {
    if(!document.getElementById('locationModal')) {
        const response = await fetch('dialogs/mapDialog.html');
        const modalHTML = await response.text();
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }
    
    const locationModal = new bootstrap.Modal(document.getElementById('locationModal'));
    locationModal.show();

    document.getElementById("cancelLocation").addEventListener('click', () => locationModal.hide());

    document.getElementById("acceptLocation").addEventListener('click', () => {
        locationModal.hide();
        document.getElementById('map').style.cursor = 'crosshair';

        // Create cancel button
        const cancelBtn = document.createElement('button');
        cancelBtn.id = 'cancel-add-bird';
        cancelBtn.className = 'btn btn-danger position-absolute bottom-0 end-0 m-4';
        cancelBtn.innerHTML = '<i class="bi bi-x-lg"></i> Cancelar';
        cancelBtn.style.zIndex = 1000;
        document.getElementById('map').appendChild(cancelBtn);

        cancelBtn.addEventListener('click', function() { exitAddingBirdMode(); });

        document.getElementById('add-bird-btn').style.display = 'none';
        map.on('click', placeMarker);
    });
}

function placeMarker(e) {
    const latlng = e.latlng;
    if(tempMarker) markerGroup.removeLayer(tempMarker);
    tempMarker = L.marker(latlng).addTo(markerGroup);

    exitAddingBirdMode();
    showAddBirdDialog(latlng);
}

async function showAddBirdDialog(latlng) {
    let i = 1;

    if(!document.getElementById('addBirdModal')) {
        const response = await fetch('dialogs/addBirdDialog.html');
        const modalHTML = await response.text();
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }
    
    const addBirdModal = new bootstrap.Modal(document.getElementById('addBirdModal'));
    document.getElementById('sciName').textContent = '';
    addBirdModal.show();
    
    // Limpieza de eventos duplicados (opcional, buena práctica)
    const closeDialog = () => {
        addBirdModal.hide();
        if(tempMarker) {
            markerGroup.removeLayer(tempMarker);
            tempMarker = null;
        }
    };

    const form = document.getElementById('addBirdForm');
    form.reset();
    
    document.getElementById('cancelAddBird').onclick = closeDialog;
    document.getElementById('cross-close-bird-dialog').onclick = closeDialog;
    
    document.getElementById('acceptAddBird').onclick = async function(e) {
        const currentUser = loadSession();
        if(currentUser){
            e.preventDefault();
            const form = document.getElementById('addBirdForm');
            
            if (!form.checkValidity()) {
                form.reportValidity();
                return;
            }
            
            const data = Object.fromEntries(new FormData(form));
            data.location = latlng.lat + "," + latlng.lng;
            const today = new Date();
            data.ringingDate = `${today.getDate()}-${today.getMonth() + 1}-${today.getFullYear()}`;
            data.sciName = document.getElementById('sciName').innerText;
            const sel = document.getElementById('remitente');
            const nombreRemitente = sel.options[sel.selectedIndex].text;
            data.station = document.getElementById('station').value;
            addBirdModal.hide();
            
            let anilla_identidad = null;
            const existing_anilla_identidad = await getAnillaIdentidad(data.ringNumber, nombreRemitente);
            
            if(existing_anilla_identidad){
                anilla_identidad = existing_anilla_identidad
                data.anilla_id = anilla_identidad.id;
                data.ringed = true;
            }
            else{
                const anillaData = {'ringNumber':data.ringNumber, 'sciName':data.sciName, 'remitente': data.remitente}
                const anilla_identidad_id = await insertAnillaIdentidad(anillaData)
                if(anilla_identidad_id && anilla_identidad_id.id){
                    data.anilla_id = anilla_identidad_id.id
                }
                data.ringed = false;
            }

            // Llamada a la función que ahora contactará con el backend
            let ringing = insertRinging(data, currentUser).then(async () => {
                btnPrev.disabled = true;
                btnNext.disabled = false;
                document.getElementById(`step3`).classList.add('d-none');
                document.getElementById(`step1`).classList.remove('d-none');
                updateHeader(1);
                btnNext.classList.remove('d-none');
                btnSubmit.classList.add('d-none');
                await renderMarkers(currentUser);
                alert('Anillamiento guardado y mapa actualizado');
            });

        }
        else{
            alert('¡Debes iniciar sesión para registrar anillamientos!')
        }
    };

    function updateHeader(i){
        let textFrame = document.getElementById('stepIndicator')
        switch(i){
            case 1:
                textFrame.innerText = 'Paso 1 de 3: Identidad';
                break;
            case 2:
                textFrame.innerText = 'Paso 2 de 3: Biometría';
                break;
            case 3:
                textFrame.innerText = 'Paso 3 de 3: Detalles';
                break
        }
    }

    const btnPrev = document.getElementById('btnPrevStep');
    const btnNext = document.getElementById('btnNextStep');
    const btnSubmit = document.getElementById('acceptAddBird')

    btnNext.addEventListener('click', function() {
        if(i < 3) i++;
        btnPrev.disabled = (i === 1);
        document.getElementById(`step${i-1}`).classList.add('d-none');
        document.getElementById(`step${i}`).classList.remove('d-none');
        updateHeader(i);
        if (i === 3) {
            btnNext.classList.add('d-none');      // Ocultar "Siguiente"
            btnSubmit.classList.remove('d-none'); // Mostrar "Guardar"
        }
    });

    btnPrev.addEventListener('click', function() {
        if(i > 1) i--;
        btnPrev.disabled = (i === 1);
        document.getElementById(`step${i+1}`).classList.add('d-none');
        document.getElementById(`step${i}`).classList.remove('d-none');
        updateHeader(i);
        if(i == 2) {
            btnNext.classList.remove('d-none');   // Mostrar "Siguiente"
            btnSubmit.classList.add('d-none');    // Ocultar "Guardar"
        }
    });


    populateRemitentes();

    // Lógica de autocompletado de especies
    document.getElementById('species').addEventListener('input', function() {
        const input = this;
        const query = input.value.toLowerCase();
        const suggestions = document.getElementById('suggestionsDialog');
        suggestions.innerHTML = "";

        document.getElementById('sciName').textContent = '';

        if (query.length < 2) return;

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
                document.getElementById('sciName').textContent = bird.sciName;
            });
            suggestions.appendChild(item);
        });

        const exactMatch = aves.find(ave => ave.especie.toLowerCase() === query);
        if(exactMatch){
            document.getElementById('sciName').textContent = exactMatch.sciName;
            suggestions.innerHTML = "";
        }
    });

    document.getElementById('btnExtraInfoBirds').onclick = function(event){
        event.preventDefault();
        const container = document.getElementById('divExtraInfoBirds');
        if(container.classList.contains("d-none")){
            container.classList.remove("d-none");
            this.innerText = "Esconder métricas adicionales"
        } else {
            container.classList.add("d-none");
            this.innerText = "Mostrar métricas adicionales"
        }
    };
}

async function populateRemitentes() {
    const selectElement = document.getElementById('remitente');
    remitentes = await getRemitentes();
    selectElement.innerHTML = '<option value="" selected disabled>Selecciona</option>';
    remitentes.forEach(rem => {
        const option = document.createElement('option');
        option.value = rem.id;
        option.textContent = rem.nombre;
        selectElement.appendChild(option);
    });
}
