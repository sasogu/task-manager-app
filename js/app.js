// =================================================================================
// GESTOR DE TAREAS - VERSIÓN FINAL REFACTORIZADA
// =================================================================================

// --- ESTADO GLOBAL DE LA APLICACIÓN ---
const categories = {
    "bandeja-de-entrada": [], "prioritaria": [], "proximas": [], "algun-dia": [], "archivadas": []
};
const deletedTasks = JSON.parse(localStorage.getItem('deletedTasks') || '[]');
const DROPBOX_APP_KEY = 'f21fzdjtng58vcg';
let accessToken = localStorage.getItem('dropbox_access_token');
let localLastSync = localStorage.getItem('lastSync');
let syncInterval = null;

// --- FUNCIONES DE UTILIDAD ---
function generateUUID() { return crypto.randomUUID(); }

function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => { toast.classList.add('show'); }, 100);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => { if (document.body.contains(toast)) document.body.removeChild(toast); }, 500);
    }, 3000);
}

function obtenerFechaActualParaNombreArchivo() {
    const now = new Date();
    const year = now.getFullYear();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// --- GESTIÓN DE DATOS LOCALES ---
function saveCategoriesToLocalStorage() { localStorage.setItem('categories', JSON.stringify(categories)); }
function loadCategoriesFromLocalStorage() {
    const stored = localStorage.getItem('categories');
    if (stored) Object.assign(categories, JSON.parse(stored));
}
function migrateOldTasks() {
    let needsSave = false;
    for (const category in categories) {
        categories[category].forEach(task => {
            if (!task.id) { task.id = generateUUID(); needsSave = true; }
            if (!task.lastModified) { task.lastModified = new Date().toISOString(); needsSave = true; }
        });
    }
    if (needsSave) { console.log('🔧 Migrando tareas antiguas.'); saveCategoriesToLocalStorage(); }
}

// --- LÓGICA DE MANIPULACIÓN DE TAREAS ---
function findTask(taskId) {
    for (const category in categories) {
        const taskIndex = categories[category].findIndex(t => t.id === taskId);
        if (taskIndex > -1) return { task: categories[category][taskIndex], category, taskIndex };
    }
    return null;
}

function addTask(category, taskName) {
    const newTask = { id: generateUUID(), task: taskName, completed: false, lastModified: new Date().toISOString() };
    categories[category].push(newTask);
    saveCategoriesToLocalStorage();
    renderTasks();
    if (accessToken) syncToDropbox(false);
}

function removeTask(taskId) {
    // AÑADIDO: Diálogo de confirmación
    if (!confirm('¿Estás seguro de que quieres eliminar esta tarea?')) {
        return; // Si el usuario cancela, no hacer nada
    }

    const taskData = findTask(taskId);
    if (taskData) {
        const [removedTask] = categories[taskData.category].splice(taskData.taskIndex, 1);
        deletedTasks.push({ ...removedTask, deletedOn: new Date().toISOString() });
        localStorage.setItem('deletedTasks', JSON.stringify(deletedTasks));
        saveCategoriesToLocalStorage();
        renderTasks();
        if (accessToken) syncToDropbox(false);
    }
}

function toggleTaskCompletion(taskId) {
    const taskData = findTask(taskId);
    if (taskData) {
        const { task } = taskData;
        task.completed = !task.completed;
        task.lastModified = new Date().toISOString();
        if (task.completed && taskData.category !== 'archivadas') {
            const [movedTask] = categories[taskData.category].splice(taskData.taskIndex, 1);
            categories['archivadas'].push(movedTask);
        } else if (!task.completed && taskData.category === 'archivadas') {
            const [movedTask] = categories[taskData.category].splice(taskData.taskIndex, 1);
            categories['bandeja-de-entrada'].push(movedTask);
        }
        saveCategoriesToLocalStorage();
        renderTasks();
        if (accessToken) syncToDropbox(false);
    }
}

function moveTask(taskId, newCategory) {
    const taskData = findTask(taskId);
    if (taskData && categories[newCategory]) {
        const [task] = categories[taskData.category].splice(taskData.taskIndex, 1);
        task.lastModified = new Date().toISOString();
        categories[newCategory].push(task);
        saveCategoriesToLocalStorage();
        renderTasks();
        if (accessToken) syncToDropbox(false);
    }
}

// --- RENDERIZADO EN EL DOM ---
function renderTasks() {
    const taskContainer = document.getElementById('task-container');
    taskContainer.innerHTML = '';
    const categoryNames = { "bandeja-de-entrada": "Bandeja de Entrada", "prioritaria": "Prioritaria", "proximas": "Próximas", "algun-dia": "Algún Día" };
    for (const [category, tasks] of Object.entries(categories)) {
        if (category === 'archivadas') continue;
        const categoryDiv = document.createElement('div');
        categoryDiv.className = 'category';
        let tasksHTML = tasks.map(task => `
            <div class="task ${task.completed ? 'completed' : ''}">
                <input type="checkbox" onchange="toggleTaskCompletion('${task.id}')" ${task.completed ? 'checked' : ''}>
                <span>${task.task}</span>
                <select onchange="moveTask('${task.id}', this.value)">
                    <option value="" disabled selected>Mover</option>
                    ${Object.keys(categoryNames).filter(c => c !== category).map(c => `<option value="${c}">${categoryNames[c]}</option>`).join('')}
                </select>
                <button class="delete-btn" onclick="removeTask('${task.id}')">🗑️</button>
            </div>`).join('');
        categoryDiv.innerHTML = `<h3>${categoryNames[category]}</h3><div class="task-list">${tasksHTML}</div>`;
        taskContainer.appendChild(categoryDiv);
    }
}

// --- LÓGICA DE SINCRONIZACIÓN CON DROPBOX ---
function updateDropboxButtons() {
    const loginBtn = document.getElementById('dropbox-login');
    const syncBtn = document.getElementById('dropbox-sync');
    const logoutBtn = document.getElementById('dropbox-logout');
    if (accessToken) {
        if (loginBtn) loginBtn.style.display = 'none';
        if (syncBtn) syncBtn.style.display = 'inline-block';
        if (logoutBtn) logoutBtn.style.display = 'inline-block';
    } else {
        if (loginBtn) loginBtn.style.display = 'inline-block';
        if (syncBtn) syncBtn.style.display = 'none';
        if (logoutBtn) logoutBtn.style.display = 'none';
    }
}

async function validateToken() {
    if (!accessToken) return false;
    try {
        const response = await fetch('https://api.dropboxapi.com/2/users/get_current_account', {
            method: 'POST', headers: { 'Authorization': `Bearer ${accessToken}` }, body: null
        });
        if (response.ok) {
            const userData = await response.json();
            console.log('✅ Token válido para usuario:', userData.name.display_name);
            return true;
        }
        return false;
    } catch (error) { return false; }
}

function mergeDeletedTasks(localDeleted, remoteDeleted) {
    const deletedById = new Map();
    localDeleted.forEach(t => deletedById.set(t.id, t));
    remoteDeleted.forEach(t => deletedById.set(t.id, t));
    return Array.from(deletedById.values());
}

function mergeTasks(localCategories, remoteCategories, deletedIdsSet) {
    const tasksById = new Map();
    const processCategory = (categoriesObject) => {
        for (const categoryName in categoriesObject) {
            for (const task of categoriesObject[categoryName]) {
                if (deletedIdsSet.has(task.id)) continue;
                const existing = tasksById.get(task.id);
                if (!existing || new Date(task.lastModified) > new Date(existing.lastModified)) {
                    tasksById.set(task.id, { ...task, category: categoryName });
                }
            }
        }
    };
    processCategory(localCategories);
    processCategory(remoteCategories);
    const mergedCategories = { "bandeja-de-entrada": [], "prioritaria": [], "proximas": [], "algun-dia": [], "archivadas": [] };
    for (const task of tasksById.values()) {
        if (mergedCategories[task.category]) {
            const { category, ...finalTask } = task;
            mergedCategories[category].push(finalTask);
        }
    }
    return mergedCategories;
}

async function syncToDropbox(showAlert = true) {
    if (!accessToken) return false;
    const data = { categories, deletedTasks, lastSync: new Date().toISOString() };
    try {
        const response = await fetch('https://content.dropboxapi.com/2/files/upload', {
            method: 'POST', headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/octet-stream', 'Dropbox-API-Arg': JSON.stringify({ path: '/tareas.json', mode: 'overwrite' }) }, body: JSON.stringify(data, null, 2)
        });
        if (response.ok) {
            const metadata = await response.json();
            localLastSync = metadata.server_modified;
            localStorage.setItem('lastSync', localLastSync);
            if (showAlert) showToast('✅ Tareas subidas a Dropbox');
            return true;
        }
    } catch (e) { console.error('Error en syncToDropbox', e); }
    return false;
}

async function syncFromDropbox(force = false) {
    if (!accessToken) return false;
    try {
        const meta = await fetch('https://api.dropboxapi.com/2/files/get_metadata', { method: 'POST', headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ path: '/tareas.json' }) });
        if (!meta.ok) return meta.status === 409 ? await syncToDropbox(false) : false;
        const remoteMeta = await meta.json();
        if (force || !localLastSync || new Date(remoteMeta.server_modified) > new Date(localLastSync)) {
            console.log(force ? '⬇️ Forzando descarga...' : '⬇️ Nueva versión remota detectada...');
            const res = await fetch('https://content.dropboxapi.com/2/files/download', { method: 'POST', headers: { 'Authorization': `Bearer ${accessToken}`, 'Dropbox-API-Arg': JSON.stringify({ path: '/tareas.json' }) } });
            if (res.ok) {
                const remoteData = await res.json();
                if (remoteData.categories) {
                    const remoteDeleted = remoteData.deletedTasks || [];
                    const mergedDeletedList = mergeDeletedTasks(deletedTasks, remoteDeleted);
                    const deletedIdsSet = new Set(mergedDeletedList.map(t => t.id));
                    const mergedCategories = mergeTasks(categories, remoteData.categories, deletedIdsSet);
                    Object.assign(categories, mergedCategories);
                    deletedTasks.length = 0;
                    Array.prototype.push.apply(deletedTasks, mergedDeletedList);
                    saveCategoriesToLocalStorage();
                    localStorage.setItem('deletedTasks', JSON.stringify(deletedTasks));
                    renderTasks();
                    localLastSync = remoteMeta.server_modified;
                    localStorage.setItem('lastSync', localLastSync);
                    console.log('✅ Tareas fusionadas desde Dropbox.');
                    return true;
                }
            }
        }
    } catch (e) { console.error('Error en syncFromDropbox', e); }
    return false;
}

async function performFullSync() {
    console.log('🔄 Iniciando sincronización completa...');
    showToast('Sincronizando...');
    const downloaded = await syncFromDropbox(true);
    if (downloaded) {
        const uploaded = await syncToDropbox(false);
        if (uploaded) showToast('✅ Sincronización completada.');
        else showToast('❌ Error al subir datos.', 'error');
    } else {
        showToast('❌ Error al descargar datos.', 'error');
    }
}

function startAutoSyncPolling() {
    if (syncInterval) clearInterval(syncInterval);
    syncInterval = setInterval(() => syncFromDropbox(), 30000);
    console.log('🔄 Sondeo de sincronización automática iniciado.');
}
function stopAutoSyncPolling() {
    if (syncInterval) { clearInterval(syncInterval); syncInterval = null; console.log('🛑 Sondeo detenido.'); }
}

function handleAuthCallback() {
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    const newToken = params.get('access_token');
    if (newToken) {
        localStorage.setItem('dropbox_access_token', newToken);
        accessToken = newToken;
        window.history.replaceState({}, document.title, window.location.pathname);
        updateDropboxButtons();
        showToast('✅ Conectado con Dropbox correctamente');
        setTimeout(() => syncFromDropbox(), 1500);
    } else {
        if (accessToken) {
            validateToken().then(valid => {
                if (valid) {
                    updateDropboxButtons();
                    syncFromDropbox();
                    startAutoSyncPolling();
                }
            });
        } else {
            updateDropboxButtons();
        }
    }
}

// --- INICIALIZACIÓN DE LA APLICACIÓN ---
document.addEventListener('DOMContentLoaded', function() {
    loadCategoriesFromLocalStorage();
    migrateOldTasks();
    renderTasks();

    // Lógica del Popup
    const popup = document.getElementById('popup-tarea');
    const abrirPopupBtn = document.getElementById('abrir-popup-tarea');
    const cancelarPopupBtn = document.getElementById('cancelar-popup');
    const popupForm = document.getElementById('popup-task-form');
    if (abrirPopupBtn) abrirPopupBtn.addEventListener('click', () => { popup.style.display = 'flex'; document.getElementById('popup-task-name').focus(); });
    if (cancelarPopupBtn) cancelarPopupBtn.addEventListener('click', () => { popup.style.display = 'none'; });
    window.addEventListener('click', (e) => { if (e.target == popup) popup.style.display = 'none'; });
    if (popupForm) popupForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const input = document.getElementById('popup-task-name');
        const select = document.getElementById('popup-task-category');
        if (input.value.trim()) {
            addTask(select.value, input.value.trim());
            input.value = '';
            popup.style.display = 'none';
        } else {
            showToast('Por favor, ingresa un nombre de tarea.', 'error');
        }
    });

    // Lógica de Dropbox
    document.getElementById('dropbox-login')?.addEventListener('click', () => {
        const authUrl = `https://www.dropbox.com/oauth2/authorize?client_id=${DROPBOX_APP_KEY}&response_type=token&redirect_uri=${window.location.origin + window.location.pathname}&scope=account_info.read files.content.read files.content.write`;
        window.location.href = authUrl;
    });
    document.getElementById('dropbox-sync')?.addEventListener('click', performFullSync);
    document.getElementById('dropbox-logout')?.addEventListener('click', () => {
        stopAutoSyncPolling();
        localStorage.removeItem('dropbox_access_token');
        localStorage.removeItem('lastSync');
        accessToken = null;
        localLastSync = null;
        updateDropboxButtons();
        showToast('Desconectado de Dropbox');
    });

    // Lógica de Backup/Restore y Limpieza (RESTAURADA Y CORREGIDA)
    document.getElementById('backup-btn')?.addEventListener('click', function() {
        const backupData = { fecha: new Date().toISOString(), categories: categories, deletedTasks: deletedTasks };
        const blob = new Blob([JSON.stringify(backupData, null, 2)], {type: 'application/json'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `tareas-backup_${obtenerFechaActualParaNombreArchivo()}.json`;
        a.click();
        URL.revokeObjectURL(url);
    });

    document.getElementById('restore-btn')?.addEventListener('click', function() {
        document.getElementById('restore-file').click();
    });

    document.getElementById('restore-file')?.addEventListener('change', function(event) {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const json = JSON.parse(e.target.result);
                if (!json.categories || typeof json.categories !== 'object') {
                    throw new Error('Formato de backup no válido. Falta la propiedad "categories".');
                }

                // 1. Restaurar las categorías
                Object.keys(categories).forEach(cat => categories[cat] = []); // Limpia el objeto actual
                Object.assign(categories, json.categories);
                saveCategoriesToLocalStorage();

                // 2. RESTAURAR TAMBIÉN LAS TAREAS ELIMINADAS (¡LA CLAVE!)
                const backupDeletedTasks = json.deletedTasks || [];
                deletedTasks.length = 0; // Limpiar la lista global actual
                Array.prototype.push.apply(deletedTasks, backupDeletedTasks); // Cargar las del backup
                localStorage.setItem('deletedTasks', JSON.stringify(deletedTasks));

                // 3. Actualizar la interfaz
                renderTasks();
                showToast('Tareas restauradas correctamente.');

            } catch (err) {
                showToast('Error al importar: ' + err.message, 'error');
            }
        };
        reader.readAsText(file);
    });

    document.getElementById('export-deleted-btn')?.addEventListener('click', function() {
        if (deletedTasks.length === 0) {
            showToast('No hay tareas eliminadas para exportar.', 'error');
            return;
        }
        const headers = ['ID', 'Tarea', 'Completada', 'Fecha de Modificación', 'Fecha de Eliminación'];
        const rows = deletedTasks.map(t => [t.id, `"${(t.task || '').replace(/"/g, '""')}"`, t.completed ? 'Sí' : 'No', t.lastModified, t.deletedOn].join(','));
        const csvContent = [headers.join(','), ...rows].join('\r\n');
        const blob = new Blob([csvContent], {type: 'text/csv;charset=utf-8;'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `tareas-eliminadas_${obtenerFechaActualParaNombreArchivo()}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    });

    document.getElementById('clear-data-btn')?.addEventListener('click', function() {
        if (confirm('¿Borrar todos los datos locales y cache?')) {
            localStorage.clear();
            caches.keys().then(keys => keys.forEach(key => caches.delete(key)));
            showToast('Datos borrados. La página se recargará.');
            setTimeout(() => location.reload(), 1000);
        }
    });

    // Iniciar el sondeo de sincronización automática si hay token
    if (accessToken) {
        validateToken().then(valid => {
            if (valid) {
                updateDropboxButtons();
                syncFromDropbox();
                startAutoSyncPolling();
            }
        });
    } else {
        updateDropboxButtons();
    }
});