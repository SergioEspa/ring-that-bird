import { loadSession } from "./auth.js";
import { getAnillaIdentidad, getRemitentes, getRingingsMadeByUser, insertAnillaIdentidad, insertRinging } from "./requests.js";

let map;
let markerGroup;
let tempMarker = null;
let aves = []
let remitentes = []

// GESTIÓN DEL MAPA
async function renderMarkers(currentUser) {
    if(currentUser){
        try{
            const ringings = await getRingingsMadeByUser(currentUser.email);
            if(markerGroup){
                markerGroup.clearLayers();
            }
            ringings.forEach((ringing) => {
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
                            console.log("Has clicado en el anillamiento:", ringing);
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

export function initializeMap(aves_main) {
    aves = [...aves_main]
    map = L.map('map').setView([51.505, -0.09], 13);
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

    // Configuración del Geocoder (Sin cambios)
    L.Control.geocoder({
        defaultMarkGeocode: false,
        position: 'topleft',
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
    renderMarkers(currentUser);
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
            
            addBirdModal.hide();
            
            let anilla_identidad = null;
            const existing_anilla_identidad = await getAnillaIdentidad(data.ringNumber, nombreRemitente);
            console.log(existing_anilla_identidad);
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
                await renderMarkers(currentUser);
                alert('Anillamiento guardado y mapa actualizado');
            });
        }
        else{
            alert('¡Debes iniciar sesión para registrar anillamientos!')
        }
    };

    populateRemitentes();

    // Lógica de autocompletado de especies
    document.getElementById('species').addEventListener('input', function() {
        const input = this;
        const query = input.value.toLowerCase();
        const suggestions = document.getElementById('suggestions');
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

export async function showFilterRingingsModal() {
    if(!document.getElementById('filterRingingsModal')) {
        const response = await fetch('dialogs/filterRingingsDialog.html');
        const modalHTML = await response.text();
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }
    
    const filterRingingsModal = new bootstrap.Modal(document.getElementById('filterRingingsModal'));
    filterRingingsModal.show();
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
