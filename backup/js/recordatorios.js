document.addEventListener('DOMContentLoaded', function() {
    const container = document.getElementById('reminder-container');

    function convertirEnlaces(texto) {
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        return texto.replace(urlRegex, function(url) {
            return `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`;
        });
    }

    function formatDate(iso) {
        try {
            return new Date(iso).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' });
        } catch (_) { return iso || ''; }
    }

    function render() {
        const all = JSON.parse(localStorage.getItem('categories') || '{}');
        const categoryNames = {
            'bandeja-de-entrada': 'Bandeja de Entrada',
            'prioritaria': 'Prioritaria',
            'proximas': 'Próximas',
            'algun-dia': 'Algún Día',
            'archivadas': 'Archivadas'
        };
        const items = [];
        for (const [cat, list] of Object.entries(all)) {
            if (!Array.isArray(list)) continue;
            if (cat === 'archivadas') continue; // ignorar archivo
            for (const t of list) {
                if (!t || !t.reminderAt) continue;
                // opcional: ignorar completadas
                if (t.completed) continue;
                items.push({
                    id: t.id,
                    task: t.task,
                    tags: t.tags || [],
                    reminderAt: t.reminderAt,
                    category: cat,
                    categoryName: categoryNames[cat] || cat
                });
            }
        }
        // Separar vencidos y próximos
        const now = Date.now();
        const overdue = [];
        const upcoming = [];
        for (const it of items) {
            const ts = Date.parse(it.reminderAt);
            if (!isNaN(ts) && ts <= now) overdue.push(it); else upcoming.push(it);
        }
        overdue.sort((a, b) => new Date(a.reminderAt) - new Date(b.reminderAt));
        upcoming.sort((a, b) => new Date(a.reminderAt) - new Date(b.reminderAt));

        container.innerHTML = '';
        if (overdue.length === 0 && upcoming.length === 0) {
            container.innerHTML = '<p>No hay tareas con recordatorio programado.</p>';
            return;
        }

        const renderList = (list, title, extraClass = '') => {
            if (list.length === 0) return;
            const section = document.createElement('section');
            section.className = `category ${extraClass}`.trim();
            section.innerHTML = `<h3>${title}</h3>`;
            list.forEach(it => {
                const el = document.createElement('div');
                el.className = 'task';
                el.innerHTML = `
                    <div class="task-main">
                        <input type="checkbox" aria-label="Completar y archivar" onclick="completeAndArchive('${it.id}')">
                        <span>
                            ${convertirEnlaces(it.task)}
                            ${it.tags.length ? `<small class=\"tags\">${it.tags.map(t => `<span class=\"tag-chip in-task\">#${t}</span>`).join(' ')}</small>` : ''}
                            <small class="reminder-meta">⏰ ${formatDate(it.reminderAt)} — ${it.categoryName}</small>
                        </span>
                    </div>
                `;
                section.appendChild(el);
            });
            container.appendChild(section);
        };

        renderList(overdue, 'Vencidos', 'overdue');
        renderList(upcoming, 'Próximos');
    }

    render();

    // Completar y archivar tarea desde esta vista
    window.completeAndArchive = function(taskId) {
        const all = JSON.parse(localStorage.getItem('categories') || '{}');
        const cats = ['bandeja-de-entrada', 'prioritaria', 'proximas', 'algun-dia', 'archivadas'];
        cats.forEach(c => { if (!Array.isArray(all[c])) all[c] = []; });

        // Buscar en no-archivadas
        let foundCat = null, idx = -1;
        for (const c of cats) {
            if (c === 'archivadas') continue;
            const i = all[c].findIndex(t => t && t.id === taskId);
            if (i > -1) { foundCat = c; idx = i; break; }
        }
        if (foundCat == null) return;

        const [task] = all[foundCat].splice(idx, 1);
        task.completed = true;
        task.archivedOn = new Date().toISOString();
        task.lastModified = new Date().toISOString();
        if (!Array.isArray(all['archivadas'])) all['archivadas'] = [];
        all['archivadas'].push(task);

        localStorage.setItem('categories', JSON.stringify(all));
        render();
        // Intentar sincronizar con Dropbox si hay sesión
        syncToDropboxFromReminders();
    }

    async function syncToDropboxFromReminders() {
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
            if (!res.ok) {
                if (res.status === 401) localStorage.removeItem('dropbox_access_token');
                try { console.warn('Dropbox: error subida desde recordatorios:', res.status, await res.text()); } catch {}
            }
        } catch (err) {
            console.warn('Dropbox: fallo de red en sync desde recordatorios:', err);
        }
    }
});
