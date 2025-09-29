const supabase = window.supabase.createClient(
  'https://fugemxixociisuobrvgm.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ1Z2VteGl4b2NpaXN1b2JydmdtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg2NjAzMjksImV4cCI6MjA3NDIzNjMyOX0.C0tuW6HC8gOqt55xlvEu6P3KGySevMrjlPonNdAGe3Y'
);

let map;
let markerGroup;
let tempMarker = null;
let aves = [];
let isAddingBird = false;
let descripciones = {};

async function registerUser(email, password) {
    const { data, error } = await supabase.auth.signUp({
        email: email,
        password: password,
    });
    if (error) {
        alert("Error during registration: " + error.message);
        throw error;
    }

    if(!document.getElementById('confirmEmailModal')) {
        const response = await fetch('dialogs/confirmEmailDialog.html');
        const modalHTML = await response.text();
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }

    const confirmEmailModal = new bootstrap.Modal(document.getElementById('confirmEmailModal'));
    confirmEmailModal.show();

    document.getElementById('accept-confirm-email-btn').addEventListener('click', () => {
        confirmEmailModal.hide();
    });
    document.getElementById('cross-close-confirm-email').addEventListener('click', () => {
        confirmEmailModal.hide();
    });

    return data;
}

async function loginUser(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
        email: email,
        password: password
    });
    if (error) {
        alert("Error during login: " + error.message);
        throw error;
    }
    return data;
}

async function insertRinging(
    birdSciName,
    email,
    ringNumber,
    date,
    location,
    weight,
    maxWingspan,
    thirdPrimary,
    tail,
    tarsus,
    beak,
    underskinFat,
    broodPatch,
    sex,
    age,
    notes,
    ringed,
    origin
) {
    // Obtener user_id desde email
    const { data: userData, error: userError } = await supabase
        .from('usuario')
        .select('user_id')
        .eq('email', email);

    if (userError) throw userError;
    if (!userData || userData.length === 0)
        throw new Error("User with the provided email does not exist");

    const user_id = userData[0].user_id;

    // Obtener siguiente ringing_id
    const { data: ringings, error: ringingsError } = await supabase
        .from('anillamiento')
        .select('ringing_id');

    if (ringingsError) throw ringingsError;

    const ringing_id = `R${ringings.length + 1}`;

    // Obtener bird_id desde birdSciName
    const { data: birdData, error: birdError } = await supabase
        .from('ave')
        .select('bird_id')
        .eq('sci_name', birdSciName);

    if (birdError) throw birdError;
    if (!birdData || birdData.length === 0)
        throw new Error("Bird with the provided scientific name does not exist");

    const bird_id = birdData[0].bird_id;

    const { data, error } = await supabase
        .from('anillamiento')
        .insert({
        ringing_id,
        ring_number: ringNumber,
        date,
        location,
        weight,
        max_wingspan: maxWingspan,
        third_primary: thirdPrimary,
        tail,
        tarsus,
        beak,
        underskin_fat: underskinFat,
        brood_patch: broodPatch,
        sex,
        age,
        notes,
        ringed,
        origin,
        bird_id,
        user_id
        });

    if (error) throw error;
    return data;
}

async function getRingingsMadeByUser(email) {
    const { data, error } = await supabase
        .from('usuario')
        .select('*, anillamiento(*)')
        .eq('email', email);

    if (error) throw error;
    return data;
}

async function getRingingsByUserOfBird(email, birdSciName) {
    const { data, error } = await supabase
        .from('usuario')
        .select('*, anillamiento(*, ave(*))')
        .eq('email', email);

    if (error) throw error;
    if (!data || data.length === 0) return [];

    const ringings = data[0].anillamiento || [];
    const filteredRingings = ringings.filter(
        r => r.ave && r.ave.sci_name === birdSciName
    );

    return filteredRingings;
}

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

async function loadBirdsPage(family) {
    const birdGrid = document.getElementById('birdGrid');
    birdGrid.innerHTML = '';
    
    for (const bird of aves) {
        if (family == 'any' || bird.familia == family) {
            const sciFileName = bird.sciName.replace(/ /g, '_');
            const imageUrlThumb = `bird_images/${sciFileName}_thumb.jpg`;
            const imageUrlThumbJPEG = `bird_images/${sciFileName}_thumb.jpeg`;
            const fallbackImage = 'bird_images/generic_bird.png';

            // Check if JPG exists, otherwise use JPEG
            let imageExists = await fetch(imageUrlThumb)
                .then(res => res.ok)
                .catch(() => false);
            let imageUrlThumbFinal = imageExists ? imageUrlThumb : imageUrlThumbJPEG;

            // Check if JPEG exists, otherwise use fallback
            imageExists = await fetch(imageUrlThumbFinal)
                .then(res => res.ok)
                .catch(() => false);
            imageUrlThumbFinal = imageExists ? imageUrlThumbFinal : fallbackImage;
            
            
            const col = document.createElement('div');
            col.className = 'col-sm-6 col-md-4 col-lg-3';
            col.innerHTML = `
                <div class="card h-100 shadow-sm rounded-3">
                <img src="${imageUrlThumbFinal}" class="card-img-top" alt="${bird.especie}">
                <div class="card-body text-center">
                    <h5 class="card-title">${bird.especie}</h5>
                    <p class="card-text"><em>${bird.sciName}</em></p>
                </div>
                </div>
            `;

            birdGrid.appendChild(col);

            col.addEventListener('click', function() {
                showBirdDetails(bird, imageUrlThumbFinal);
            });
        }
    }
}

async function showBirdDetails(bird, imageUrl) {
    if(!document.getElementById('birdDetailsModal')) {
        const response = await fetch('dialogs/birdDetailsDialog.html');
        const modalHTML = await response.text();
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }
        
    const birdDetailsModal = new bootstrap.Modal(document.getElementById('birdDetailsModal'));
    document.getElementById('birdDetailsModalLabel').textContent = bird.especie;
    document.getElementById('birdDetailsSciName').textContent = bird.sciName;
    document.getElementById('birdDetailsFamily').textContent = bird.familia;
    document.getElementById('birdDetailsDescription').textContent = descripciones[bird.sciName] || 'Descripción no disponible.';
    habitat = '';
    if (bird.PB) habitat += 'Península Ibérica';
    if (bird.CA) habitat += (habitat ? ', ' : '') + 'Canarias';
    if (bird.NA) habitat += (habitat ? ', ' : '') + 'Norte de África';
    document.getElementById('birdDetailsHabitat').textContent = habitat || 'No disponible';
    document.getElementById('birdDetailsImage').src = imageUrl;
    document.getElementById('birdDetailsImage').alt = bird.especie;
    birdDetailsModal.show();
}

document.addEventListener('DOMContentLoaded', function() {
    fetch('birds_spain.json')
        .then(response => response.json())
        .then(data => aves = data);

    fetch('descriptions.json')
        .then(response => response.json())
        .then(data => descripciones = data);
    
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
        const footer_title = document.getElementById('footer-title');
        fetch(`pages/${page}`)
            .then(response => response.text())
            .then(data => {
                document.getElementById("content").innerHTML = data;

                if (page === 'map.html') {
                    initializeMap();
                    footer_title.textContent = "Ring & Release - Mapa Interactivo";
                    const addBirdBtn = document.getElementById('add-bird-btn');
                    addBirdBtn.addEventListener('click', function() {
                        startAddingBird();
                    });
                }
                else if (page === 'birds.html') {
                    loadBirdsPage('any');
                    footer_title.textContent = "Ring & Release - Biblioteca de Aves";
                    const filterSelector = document.getElementById('speciesFamilyFilter');
                    filterSelector.addEventListener('change', function() {
                        selectedFamily = this.value;
                        console.log("Selected family:", selectedFamily);
                        if (selectedFamily === 'todas') {
                            selectedFamily = 'any';
                        }
                        loadBirdsPage(selectedFamily);
                    });
                }
                else if (page === 'login.html') {
                    footer_title.textContent = "Ring & Release - Iniciar Sesión";

                    const registerForm = document.querySelector('#registerForm');
                    const loginForm = document.querySelector('#loginForm');
                    const emailInputRegister = document.getElementById('emailRegister');
                    const passwordInputRegister = document.getElementById('passwordRegister');
                    const confirmPasswordInput = document.getElementById('confirmPassword');
                    const emailInputLogin = document.getElementById('emailLogin');
                    const passwordInputLogin = document.getElementById('passwordLogin');
                    const loginBtn = document.getElementById('loginBtn');
                    const registerBtn = document.getElementById('registerBtn');
                    
                    const passwordWarning = document.getElementById('passwordWarning');
                    const confirmPasswordWarning = document.getElementById('confirmPasswordWarning');
                    const emailWarning = document.getElementById('emailWarning');

                    function isValidEmail(email) {
                        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                        return emailPattern.test(email);
                    }

                    function isStrongPassword(password) {
                        // At least 8 characters, one uppercase, one lowercase, one number, one special character
                        const passwordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
                        return passwordPattern.test(password);
                    }

                    emailInputRegister.addEventListener('input', () => {
                        // Email validation
                        if (!isValidEmail(emailInputRegister.value)) {
                            emailWarningRegister.textContent = "Introduce un correo electrónico válido.";
                        } else {
                            emailWarningRegister.textContent = "";
                        }
                    });

                    passwordInputRegister.addEventListener('input', () => {
                        // Password strength validation
                        if (!isStrongPassword(passwordInputRegister.value)) {
                            passwordWarning.textContent = "La contraseña debe tener al menos 8 caracteres, una mayúscula y un número.";
                        } else {
                            passwordWarning.textContent = "";
                        }
                    });

                    confirmPasswordInput.addEventListener('input', () => {
                        // Confirm password match
                        if (passwordInputRegister.value !== confirmPasswordInput.value) {
                            confirmPasswordWarning.textContent = "Las contraseñas no coinciden.";
                        } else {
                            confirmPasswordWarning.textContent = "";
                        }
                    });

                    emailInputLogin.addEventListener('input', () => {
                        // Email validation
                        if (!isValidEmail(emailInputLogin.value)) {
                            emailWarningLogin.textContent = "Introduce un correo electrónico válido.";
                        } else {
                            emailWarningLogin.textContent = "";
                        }
                    });

                    registerForm.addEventListener('input', () => {
                        const password = document.getElementById('passwordRegister').value;
                        const confirmPassword = document.getElementById('confirmPassword').value;
                        const name = document.getElementById('name').value;
                        const email = document.getElementById('emailRegister').value;

                        // Enable button only if all fields are filled
                        registerBtn.disabled = !(name && email && password && confirmPassword);
                    });

                    loginForm.addEventListener('input', () => {
                        const email = document.getElementById('emailLogin').value;
                        const password = document.getElementById('passwordLogin').value;
                        loginBtn.disabled = !(email && password);
                    });

                    loginBtn.addEventListener('click', function(event) {
                        if (loginForm.checkValidity()) {
                            event.preventDefault();
                            loginUser(emailInputLogin.value, passwordInputLogin.value);
                        }
                    });
                    registerBtn.addEventListener('click', function(event) {
                        // Alert only when the formats are valid
                        if (registerForm.checkValidity()) {
                            event.preventDefault();
                            registerUser(emailInputRegister.value, passwordInputRegister.value);
                        }
                    });
                }
                else if (page === 'home.html') {
                    footer_title.textContent = "Ring & Release - Inicio";
                }
                
            });
    }
});