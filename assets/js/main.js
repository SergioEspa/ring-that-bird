
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    sidebar.classList.toggle('collapsed');
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
                    loadPage(page);
                });
            });
        });
    
    function loadPage(page) {
        fetch(`pages/${page}.html`)
            .then(response => response.text())
            .then(data => {
                document.getElementById("content").innerHTML = data;
            });
    }
});