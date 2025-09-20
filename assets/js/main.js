let map;
let markerGroup;
let tempMarker = null;
let aves = [];
let isAddingBird = false;

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    sidebar.classList.toggle('collapsed');
}

function toggleActiveLink(selectedLink) {
    document.querySelectorAll('#sidebar a').forEach(link => {
        link.classList.remove('active');
    });
    selectedLink.classList.add('active');
}

function initializeMap() {
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

    L.Control.geocoder({
        defaultMarkGeocode: false,
        position: 'topleft',
        collapsed: true,
        placeholder: "Buscar ubicación...",
        errorMessage: "No se encontró la ubicación",
        queryMinLength: 3, // Start suggesting after 3 characters
        suggestMinLength: 3,
        suggestTimeout: 100, // Faster suggestions (100ms)
        geocoder: L.Control.Geocoder.nominatim({
            geocodingQueryParams: {
                limit: 5,
                addressdetails: 1
            }
        })
    }).on('markgeocode', function(e) {
        var latlng = e.geocode.center;
        
        // Smooth transition to the location
        map.flyTo(latlng, 14, {
            duration: 1.5, // Animation duration in seconds
            easeLinearity: 0.25
        });
    }).addTo(map);
}

function exitAddingBirdMode(){
    map.off('click', placeMarker);
    isAddingBird = false;
    document.getElementById('map').style.cursor = '';

    const cancelBtns = document.querySelectorAll('#cancel-add-bird');
    cancelBtns.forEach(btn => btn.remove());

    document.getElementById('add-bird-btn').style.display = 'block';
}

async function startAddingBird() {
    if(!document.getElementById('locationModal')) {
        const response = await fetch('dialogs/mapDialog.html');
        const modalHTML = await response.text();
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }
    
    const locationModal = new bootstrap.Modal(document.getElementById('locationModal'));
    locationModal.show();

    document.getElementById("cancelLocation").addEventListener('click', () => {
        locationModal.hide();
    });

    document.getElementById("acceptLocation").addEventListener('click', () => {
        locationModal.hide();
        isAddingBird = true;
        document.getElementById('map').style.cursor = 'crosshair';

        // Create cancel button
        const cancelBtn = document.createElement('button');
        cancelBtn.id = 'cancel-add-bird';
        cancelBtn.className = 'btn btn-danger position-absolute top-0 end-0 m-4';
        cancelBtn.innerHTML = '<i class="bi bi-x-lg"></i> Cancelar';
        cancelBtn.style.zIndex = 1000; // Ensure it's above the map
        document.getElementById('map').appendChild(cancelBtn);

        // Add event listener to cancel button
        cancelBtn.addEventListener('click', function() {
            exitAddingBirdMode();
        });

        document.getElementById('add-bird-btn').style.display = 'none';

        map.on('click', placeMarker);
    });
}

function placeMarker(e) {
    const latlng = e.latlng;

    if(tempMarker) {
        markerGroup.removeLayer(tempMarker);
    }

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

    document.getElementById('cancelAddBird').addEventListener('click', () => {
        addBirdModal.hide();
        // Remove temporary marker if dialog is cancelled
        if(tempMarker) {
            markerGroup.removeLayer(tempMarker);
            tempMarker = null;
        }
    });

    document.getElementById('cross-close-bird-dialog').addEventListener('click', () => {
        addBirdModal.hide();
        // Remove temporary marker if dialog is cancelled
        if(tempMarker) {
            markerGroup.removeLayer(tempMarker);
            tempMarker = null;
        }
    });

    document.getElementById('acceptAddBird').addEventListener('click', function() {
        // Show alert for now
        alert('La funcionalidad de guardado se implementará próximamente');
        addBirdModal.hide();
    });    

    document.getElementById('species').addEventListener('input', function() {
        const input = this;
        const query = input.value.toLowerCase();
        const suggestions = document.getElementById('suggestions'); // asegúrate de tener este div en tu HTML
        suggestions.innerHTML = "";

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
    });
}

async function loadBirdsPage() {
    const birdGrid = document.getElementById('birdGrid');
    
    for (const bird of aves) {
        const sciFileName = bird.sciName.replace(/ /g, '_');
        const imageUrlThumb = `../../bird_images/${sciFileName}_thumb.jpg`;
        const imageUrl = `../../bird_images/${sciFileName}.jpg`;

        const col = document.createElement('div');
        col.className = 'col-sm-6 col-md-4 col-lg-3';
        col.innerHTML = `
            <div class="card h-100 shadow-sm rounded-3">
            <img src="${imageUrlThumb}" class="card-img-top" alt="${bird.especie}">
            <div class="card-body text-center">
                <h5 class="card-title">${bird.especie}</h5>
                <p class="card-text"><em>${bird.sciName}</em></p>
            </div>
            </div>
        `;

        birdGrid.appendChild(col);
    }
}

document.addEventListener('DOMContentLoaded', function() {
    fetch('birds_spain.json')
        .then(response => response.json())
        .then(data => aves = data);
    
    fetch("components/sidebar.html")
        .then(response => response.text())
        .then(data => {
            document.getElementById("sidebar").innerHTML = data;

            const toggleButton = document.getElementById('toggle-btn');

            toggleButton.addEventListener('click', function() {
                toggleSidebar();
            });
        
            document.querySelectorAll('#sidebar a[data-page]').forEach(link => {
                link.addEventListener('click', function(event) {
                    event.preventDefault();
                    const page = link.dataset.page;
                    toggleActiveLink(link);
                    loadPage(page);
                });
            });
            const defaultLink = document.querySelector('#sidebar a[data-page="home.html"]');
            if (defaultLink) {
                toggleActiveLink(defaultLink);
                loadPage(defaultLink.dataset.page);
            }
        });
    
    function loadPage(page) {
        fetch(`pages/${page}`)
            .then(response => response.text())
            .then(data => {
                document.getElementById("content").innerHTML = data;

                if (page === 'map.html') {
                    initializeMap();

                    const addBirdBtn = document.getElementById('add-bird-btn');
                    addBirdBtn.addEventListener('click', function() {
                        startAddingBird();
                    });
                }
                else if (page === 'birds.html') {
                    loadBirdsPage();
                }
            });
    }
});