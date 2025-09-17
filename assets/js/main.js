
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
            });
    }
});