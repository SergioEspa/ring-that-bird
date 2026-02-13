import { logoutUser } from "./requests.js";
import { isUserLoggedIn, loadSession, performLogout, setupLoginForms, updateUIAuthState } from "./auth.js";
import { loadBirdsPage, loadRingedBirdsPage } from "./library.js";
import { initializeMap, startAddingBird } from "./map.js";
import { initializeTable } from "./table.js";

let aves = [];
let descripciones = {};
let home_link = null;
let familyToShow = 'any';

// GESTIÓN DE LA SIDEBAR
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    sidebar.classList.toggle('collapsed');
}

function toggleActiveLink(selectedLink) {
    if(!selectedLink) return;
    document.querySelectorAll('#sidebar a').forEach(link => {
        link.classList.remove('active');
    });
    selectedLink.classList.add('active');
}

// GESTIÓN PÁGINAS
function loadPage(page) {
    const header_title = document.getElementById('footer-title');
    fetch(`pages/${page}`)
        .then(response => response.text())
        .then(data => {
            document.getElementById("content").innerHTML = data;

            if (page === 'map.html') {
                initializeMap(aves);
                header_title.textContent = "Ring & Release - Mapa Interactivo";
                document.getElementById('add-bird-btn').addEventListener('click', startAddingBird);
            }
            else if (page === 'table.html') { // <--- NUEVO BLOQUE
                header_title.textContent = "Ring & Release - Cuaderno de Campo";
                // Pasamos currentUser para que sepa qué datos cargar
                initializeTable(loadSession(), aves);
            }
            else if (page === 'birds.html') {
                loadBirdsPage('any', aves, descripciones);
                header_title.textContent = "Ring & Release - Biblioteca de Aves";
                document.getElementById('speciesFamilyFilter').addEventListener('change', function() {
                    familyToShow = this.value;
                    if (familyToShow === 'todas') familyToShow = 'any';
                    loadBirdsPage(familyToShow, aves, descripciones);
                });
                document.getElementById('registeredSpeciesOnly').addEventListener('change', function() {
                    if(this.checked){
                        loadRingedBirdsPage(aves, descripciones);
                    }
                    else{
                        loadBirdsPage(familyToShow, aves, descripciones);
                    }
                });
            }
            else if (page === 'login.html') {
                header_title.textContent = "Ring & Release - Iniciar Sesión";
                setupLoginForms(() => {
                    loadPage('home.html');
                    const homeLink = document.querySelector('#sidebar a[data-page="home.html"]');
                    toggleActiveLink(homeLink);
                    updateUIAuthState();
                });
            }
            else if (page === 'home.html') {
                header_title.textContent = "Ring & Release - Inicio";
                updateUIAuthState();
            }
        });
}

async function preLoadData() {
    const [avesRes, descRes] = await Promise.all([
        fetch('birds_spain.json'),
        fetch('descriptions.json')
    ]);
    aves = await avesRes.json();
    descripciones = await descRes.json();
}

// INICIALIZACIÓN
document.addEventListener('DOMContentLoaded', async function() {
    // Carga de datos estáticos
    await preLoadData();
    
    // Carga Sidebar
    fetch("components/sidebar.html")
        .then(response => response.text())
        .then(data => {
            document.getElementById("sidebar").innerHTML = data;
            
            // Listener del Toggle Sidebar
            document.getElementById('toggle-btn').addEventListener('click', toggleSidebar);

            // Listeners de enlaces del menú
            document.querySelectorAll('#sidebar a[data-page]').forEach(link => {
                if(link.dataset.page === 'home.html'){
                    home_link = link;
                }
                link.addEventListener('click', function(event) {
                    event.preventDefault();
                    const page = link.dataset.page;
                    
                    if (page === 'login.html') {
                        if(isUserLoggedIn()){
                            performLogout();
                            loadPage('home.html');
                            toggleActiveLink(home_link);
                        }
                        else {
                            toggleActiveLink(link);
                            loadPage(page);
                        }
                    } else {
                        toggleActiveLink(link);
                        loadPage(page);
                    }
                });
            });

            // Carga inicial (Home)
            const defaultLink = document.querySelector('#sidebar a[data-page="home.html"]');
            if (defaultLink) {
                toggleActiveLink(defaultLink);
                loadPage(defaultLink.dataset.page);
            }
            
            // Verificar estado inicial de auth
            updateUIAuthState();
        });
});