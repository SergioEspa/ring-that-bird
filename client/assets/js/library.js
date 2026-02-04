import { loadSession } from "./auth.js";
import { CONFIG } from "./config.js";
import { getRingingsMadeByUser } from "./requests.js";

async function renderBird(bird, descripciones) {
    const sciFileName = bird.sciName.replace(/ /g, '_');
    const image_url = `${CONFIG.API_URL}/api/images?name=${sciFileName}`;
    const col = document.createElement('div');
    col.className = 'col-sm-6 col-md-4 col-lg-3';
    col.innerHTML = `
        <div class="card h-100 shadow-sm rounded-3">
        <img src="${image_url}" class="card-img-top" alt="${bird.especie}">
        <div class="card-body text-center">
            <h5 class="card-title">${bird.especie}</h5>
            <p class="card-text"><em>${bird.sciName}</em></p>
        </div>
        </div>
    `;
    
    try{
        birdGrid.appendChild(col);
    }
    catch(error){
        const image_url = `${CONFIG.API_URL}/api/images?name=generic_bird`;
        col.innerHTML = `
            <div class="card h-100 shadow-sm rounded-3">
            <img src="${image_url}" class="card-img-top" alt="${bird.especie}">
            <div class="card-body text-center">
                <h5 class="card-title">${bird.especie}</h5>
                <p class="card-text"><em>${bird.sciName}</em></p>
            </div>
            </div>
        `;
        birdGrid.appendChild(col);
    }
    col.addEventListener('click', () => showBirdDetails(bird, image_url, descripciones));
}

// GESTIÓN BIBLIOTECA DE AVES
export async function loadBirdsPage(family, aves, descripciones) {
    const birdGrid = document.getElementById('birdGrid');
    birdGrid.innerHTML = '';
    
    for (const bird of aves) {
        if (family == 'any' || bird.familia == family) {
            renderBird(bird, descripciones);
        }
    }
}

export async function loadRingedBirdsPage(aves, descripciones) {
    const birdGrid = document.getElementById('birdGrid');
    birdGrid.innerHTML = '';
    const currentUser = loadSession();
    if(!currentUser){
        return;
    }
    const ringings = await getRingingsMadeByUser(currentUser.email)
    
    const ringings_sci_names = ringings.map(ringing => ringing.sci_name);
    for (const bird of aves) {
        if (ringings_sci_names.includes(bird.sciName)) {
            renderBird(bird, descripciones);
        }
    }
}

async function showBirdDetails(bird, imageUrl, descripciones) {
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
    
    let habitat = '';
    if (bird.PB) habitat += 'Península Ibérica';
    if (bird.CA) habitat += (habitat ? ', ' : '') + 'Canarias';
    if (bird.NA) habitat += (habitat ? ', ' : '') + 'Norte de África';
    document.getElementById('birdDetailsHabitat').textContent = habitat || 'No disponible';
    
    document.getElementById('birdDetailsImage').src = imageUrl;
    document.getElementById('birdDetailsImage').alt = bird.especie;
    birdDetailsModal.show();
}
