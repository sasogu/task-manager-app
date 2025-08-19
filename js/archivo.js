document.addEventListener('DOMContentLoaded', function() {
    const archiveContainer = document.getElementById('archive-container');

    function renderArchivedTasks() {
        const allCategories = JSON.parse(localStorage.getItem('categories') || '{}');
        const archivedTasks = allCategories['archivadas'] || [];
        
        // INVERTIR EL ARRAY PARA MOSTRAR LAS ÚLTIMAS PRIMERO
        archivedTasks.reverse();

        archiveContainer.innerHTML = ''; // Limpiar vista

        if (archivedTasks.length === 0) {
            archiveContainer.innerHTML = '<p>No hay tareas archivadas.</p>';
            return;
        }

        archivedTasks.forEach((taskObj, index) => {
            // Nota: el 'index' original se pierde, pero no es problema si solo se usa para la key.
            // Para la eliminación, necesitaremos el ID de la tarea.
            const taskDiv = document.createElement('div');
            taskDiv.className = 'task';
            taskDiv.innerHTML = `
                <input type="checkbox" ${taskObj.completed ? 'checked' : ''} disabled>
                <span class="${taskObj.completed ? 'completed' : ''}">${taskObj.task}</span>
                <button onclick="deletePermanently('${taskObj.id}')">Eliminar Permanentemente</button>
            `;
            archiveContainer.appendChild(taskDiv);
        });
    }

    window.deletePermanently = function(taskId) {
        if (confirm('¿Estás seguro de que quieres eliminar esta tarea permanentemente? Esta acción no se puede deshacer.')) {
            const allCategories = JSON.parse(localStorage.getItem('categories') || '{}');
            if (allCategories['archivadas']) {
                // Buscar y eliminar por ID en lugar de por índice
                const taskIndex = allCategories['archivadas'].findIndex(t => t.id === taskId);
                if (taskIndex > -1) {
                    allCategories['archivadas'].splice(taskIndex, 1);
                    localStorage.setItem('categories', JSON.stringify(allCategories));
                    renderArchivedTasks(); // Volver a renderizar la lista
                }
            }
        }
    }

    // Cargar las tareas al iniciar
    renderArchivedTasks();
});