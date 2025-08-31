document.addEventListener('DOMContentLoaded', function() {
    const archiveContainer = document.getElementById('archive-container');

    function convertirEnlaces(texto) {
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        return texto.replace(urlRegex, function(url) {
            return `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`;
        });
    }

    function renderArchivedTasks() {
        const allCategories = JSON.parse(localStorage.getItem('categories') || '{}');
        const archivedTasks = allCategories['archivadas'] || [];
        
        archivedTasks.reverse(); // Mostrar las últimas primero

        archiveContainer.innerHTML = '';

        if (archivedTasks.length === 0) {
            archiveContainer.innerHTML = '<p>No hay tareas archivadas.</p>';
            return;
        }

        archivedTasks.forEach(taskObj => {
            const taskDiv = document.createElement('div');
            taskDiv.className = 'task';
            taskDiv.innerHTML = `
                <input type="checkbox" ${taskObj.completed ? 'checked' : ''} disabled>
                <span class="${taskObj.completed ? 'completed' : ''}">${convertirEnlaces(taskObj.task)}</span>
                <button onclick="unarchiveTask('${taskObj.id}')">Desarchivar</button>
                <button onclick="deletePermanently('${taskObj.id}')">Eliminar Permanentemente</button>
            `;
            archiveContainer.appendChild(taskDiv);
        });
    }

    // FUNCIÓN DE ELIMINACIÓN CORREGIDA
    window.deletePermanently = function(taskId) {
        if (confirm('¿Estás seguro de que quieres eliminar esta tarea permanentemente? Esta acción no se puede deshacer.')) {
            // Cargar ambos, categorías y tareas eliminadas
            const allCategories = JSON.parse(localStorage.getItem('categories') || '{}');
            const deletedTasks = JSON.parse(localStorage.getItem('deletedTasks') || '[]');

            if (allCategories['archivadas']) {
                const taskIndex = allCategories['archivadas'].findIndex(t => t.id === taskId);
                
                if (taskIndex > -1) {
                    // 1. Eliminar la tarea de la lista de archivadas
                    const [removedTask] = allCategories['archivadas'].splice(taskIndex, 1);
                    
                    // 2. AÑADIR LA TAREA A LA LISTA DE ELIMINADAS (¡LA CLAVE!)
                    deletedTasks.push({ ...removedTask, deletedOn: new Date().toISOString() });

                    // 3. Guardar ambos cambios en localStorage
                    localStorage.setItem('categories', JSON.stringify(allCategories));
                    localStorage.setItem('deletedTasks', JSON.stringify(deletedTasks));
                    
                    // 4. Volver a renderizar la vista
                    renderArchivedTasks();
                    // 5. Intentar sincronizar con Dropbox si hay sesión
                    syncToDropboxFromArchive();
                }
            }
        }
    }

    // Desarchivar: mover a Bandeja de Entrada y marcar como no completada
    window.unarchiveTask = function(taskId) {
        const allCategories = JSON.parse(localStorage.getItem('categories') || '{}');
        const archived = allCategories['archivadas'];
        if (!Array.isArray(archived)) return;
        const idx = archived.findIndex(t => t.id === taskId);
        if (idx === -1) return;
        const [task] = archived.splice(idx, 1);
        task.completed = false;
        task.lastModified = new Date().toISOString();
        if (!Array.isArray(allCategories['bandeja-de-entrada'])) {
            allCategories['bandeja-de-entrada'] = [];
        }
        allCategories['bandeja-de-entrada'].push(task);
        localStorage.setItem('categories', JSON.stringify(allCategories));
        renderArchivedTasks();
        // Intentar sincronizar con Dropbox si hay sesión
        syncToDropboxFromArchive();
    }

    // Cargar las tareas al iniciar
    renderArchivedTasks();

    // Sincronización básica a Dropbox desde la vista de archivo
    async function syncToDropboxFromArchive() {
        const token = localStorage.getItem('dropbox_access_token');
        if (!token) return;
        try {
            const categories = JSON.parse(localStorage.getItem('categories') || '{}');
            const deletedTasks = JSON.parse(localStorage.getItem('deletedTasks') || '[]');
            const payload = { categories, deletedTasks, lastSync: new Date().toISOString() };
            const res = await fetch('https://content.dropboxapi.com/2/files/upload', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/octet-stream',
                    'Dropbox-API-Arg': JSON.stringify({ path: '/tareas.json', mode: 'overwrite' })
                },
                body: JSON.stringify(payload, null, 2)
            });
            if (res.status === 401) {
                // Token inválido; limpiar para que index gestione reconexión
                localStorage.removeItem('dropbox_access_token');
                console.warn('Dropbox: token inválido al sincronizar desde archivo.');
            } else if (!res.ok) {
                const t = await res.text();
                console.warn('Dropbox: error de subida desde archivo:', res.status, t);
            }
        } catch (err) {
            console.warn('Dropbox: fallo de red en sync desde archivo:', err);
        }
    }
});
