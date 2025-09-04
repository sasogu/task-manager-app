document.addEventListener('DOMContentLoaded', function() {
    const archiveContainer = document.getElementById('archive-container');
    const filterSelect = document.getElementById('archive-filter-tag');

    function convertirEnlaces(texto) {
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        return texto.replace(urlRegex, function(url) {
            return `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`;
        });
    }

    function formatArchivedDate(task) {
        const iso = task.archivedOn || task.lastModified;
        if (!iso) return '';
        try {
            return new Date(iso).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' });
        } catch (_) {
            return iso;
        }
    }

    function getArchiveTags(tasks) {
        const s = new Set();
        tasks.forEach(t => Array.isArray(t.tags) && t.tags.forEach(tag => s.add(tag)));
        return Array.from(s).sort();
    }

    function updateArchiveFilterDropdown(currentValue, tasks) {
        if (!filterSelect) return;
        const tags = getArchiveTags(tasks);
        let html = '<option value="">Mostrar todo</option>';
        const hasCurrent = currentValue && tags.includes(currentValue);
        const rendered = hasCurrent ? tags : [currentValue, ...tags].filter((v, i, a) => v && a.indexOf(v) === i);
        html += rendered.map(t => `<option value="${t}">${t}</option>`).join('');
        filterSelect.innerHTML = html;
        filterSelect.value = currentValue || '';
    }

    function renderArchivedTasks() {
        const allCategories = JSON.parse(localStorage.getItem('categories') || '{}');
        const archivedTasks = allCategories['archivadas'] || [];
        const currentFilter = (filterSelect?.value || localStorage.getItem('selectedArchiveFilterTag') || '');
        // Orden estable: más recientes primero por archivedOn (si existe) o lastModified
        let view = archivedTasks.slice().sort((a, b) => {
            const aTime = new Date(a.archivedOn || a.lastModified || 0).getTime();
            const bTime = new Date(b.archivedOn || b.lastModified || 0).getTime();
            return bTime - aTime;
        });

        // Filtrado por etiqueta si aplica
        if (currentFilter) {
            view = view.filter(t => Array.isArray(t.tags) && t.tags.includes(currentFilter));
        }

        archiveContainer.innerHTML = '';

        if (view.length === 0) {
            archiveContainer.innerHTML = '<p>No hay tareas archivadas.</p>';
            // Aún actualizar el dropdown según las tareas originales
            updateArchiveFilterDropdown(currentFilter, archivedTasks);
            return;
        }

        view.forEach(taskObj => {
            const taskDiv = document.createElement('div');
            taskDiv.className = 'task';
            taskDiv.innerHTML = `
                <input type="checkbox" ${taskObj.completed ? 'checked' : ''} disabled>
                <span class="${taskObj.completed ? 'completed' : ''}">${convertirEnlaces(taskObj.task)}
                    ${taskObj.tags && taskObj.tags.length ? `<small class="tags">${taskObj.tags.map(t => `<span class=\"tag-chip in-task\">#${t}</span>`).join(' ')}</small>` : ''}
                </span>
                <small class="archived-meta">Archivada: ${formatArchivedDate(taskObj)}</small>
                <button onclick="unarchiveTask('${taskObj.id}')">Desarchivar</button>
                <button onclick="deletePermanently('${taskObj.id}')">Eliminar Permanentemente</button>
            `;
            archiveContainer.appendChild(taskDiv);
        });

        // Actualizar dropdown tras render
        updateArchiveFilterDropdown(currentFilter, archivedTasks);
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
        // Limpiar metadato de archivado al desarchivar
        if (task.archivedOn) delete task.archivedOn;
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

    // Gestionar cambios en el filtro
    filterSelect?.addEventListener('change', (e) => {
        try { localStorage.setItem('selectedArchiveFilterTag', e.target.value || ''); } catch (_) {}
        renderArchivedTasks();
    });

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
