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
    var map = L.map('map').setView([51.505, -0.09], 13);

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

document.addEventListener('DOMContentLoaded', function() {
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
                }
            });
    }
});