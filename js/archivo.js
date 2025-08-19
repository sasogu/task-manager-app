document.addEventListener('DOMContentLoaded', function() {
    const archiveContainer = document.getElementById('archive-container');

    function renderArchivedTasks() {
        const allCategories = JSON.parse(localStorage.getItem('categories') || '{}');
        const archivedTasks = allCategories['archivadas'] || [];
        
        archiveContainer.innerHTML = ''; // Limpiar vista

        if (archivedTasks.length === 0) {
            archiveContainer.innerHTML = '<p>No hay tareas archivadas.</p>';
            return;
        }

        archivedTasks.forEach((taskObj, index) => {
            const taskDiv = document.createElement('div');
            taskDiv.className = 'task';
            taskDiv.innerHTML = `
                <input type="checkbox" ${taskObj.completed ? 'checked' : ''} disabled>
                <span class="${taskObj.completed ? 'completed' : ''}">${taskObj.task}</span>
                <button onclick="deletePermanently(${index})">Eliminar Permanentemente</button>
            `;
            archiveContainer.appendChild(taskDiv);
        });
    }

    window.deletePermanently = function(taskIndex) {
        if (confirm('¿Estás seguro de que quieres eliminar esta tarea permanentemente? Esta acción no se puede deshacer.')) {
            const allCategories = JSON.parse(localStorage.getItem('categories') || '{}');
            if (allCategories['archivadas']) {
                allCategories['archivadas'].splice(taskIndex, 1);
                localStorage.setItem('categories', JSON.stringify(allCategories));
                renderArchivedTasks(); // Volver a renderizar la lista
            }
        }
    }

    // Cargar las tareas al iniciar
    renderArchivedTasks();
});