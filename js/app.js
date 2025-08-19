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

// --- LÓGICA DE MANIPULACIÓN DE TAREAS (CORREGIDA CON IDs) ---
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

// --- RENDERIZADO EN EL DOM (SIN BOTÓN DE ELIMINAR) ---
function renderTasks() {
    const taskContainer = document.getElementById('task-container');
    taskContainer.innerHTML = '';
    const categoryNames = { "bandeja-de-entrada": "Bandeja de Entrada", "prioritaria": "Prioritaria", "proximas": "Próximas", "algun-dia": "Algún Día" };

    for (const [category, tasks] of Object.entries(categories)) {
        if (category === 'archivadas') continue;
        const categoryDiv = document.createElement('div');
        categoryDiv.className = 'category';
        
        // Se ha eliminado el botón de la papelera de esta plantilla
        let tasksHTML = tasks.map(task => `
            <div class="task ${task.completed ? 'completed' : ''}">
                <input type="checkbox" onchange="toggleTaskCompletion('${task.id}')" ${task.completed ? 'checked' : ''}>
                <span>${task.task}</span>
                <select onchange="moveTask('${task.id}', this.value)">
                    <option value="" disabled selected>Mover</option>
                    ${Object.keys(categoryNames).filter(c => c !== category).map(c => `<option value="${c}">${categoryNames[c]}</option>`).join('')}
                </select>
            </div>
        `).join('');

        categoryDiv.innerHTML = `<h3>${categoryNames[category]}</h3><div class="task-list">${tasksHTML}</div>`;
        taskContainer.appendChild(categoryDiv);
    }
}

// --- LÓGICA DE SINCRONIZACIÓN CON DROPBOX (CORREGIDA CON FUSIÓN) ---
function updateDropboxButtons() {
    const loginBtn = document.getElementById('dropbox-login');
    const syncBtn = document.getElementById('dropbox-sync');
    const logoutBtn = document.getElementById('dropbox-logout');

    if (!loginBtn || !syncBtn || !logoutBtn) return; // Comprobación de seguridad

    if (accessToken) {
        loginBtn.style.display = 'none';
        syncBtn.style.display = 'inline-block';
        logoutBtn.style.display = 'inline-block';
    } else {
        loginBtn.style.display = 'inline-block';
        syncBtn.style.display = 'none';
        logoutBtn.style.display = 'none';
    }
}

async function validateToken() {
    if (!accessToken) return false;
    
    try {
        const response = await fetch('https://api.dropboxapi.com/2/users/get_current_account', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                // 'Content-Type' no es necesario si el body es null
            },
            body: null // ¡ESTA ES LA CORRECCIÓN CLAVE! La API espera un cuerpo nulo.
        });
        
        console.log('🧪 Status de validación:', response.status);
        
        if (response.ok) {
            const userData = await response.json();
            console.log('✅ Token válido para usuario:', userData.name.display_name);
            return true;
        } else {
            const errorData = await response.text();
            console.log('❌ Token inválido:', response.status, errorData);
            return false;
        }
    } catch (error) {
        console.error('💥 Error de red al validar token:', error);
        return false;
    }
}

// FUNCIÓN DE FUSIÓN CORREGIDA Y MÁS ROBUSTA
function mergeTasks(localCategories, remoteCategories) {
    const tasksById = new Map();

    // 1. Poner TODAS las tareas (locales y remotas) en un solo mapa,
    //    quedándose siempre con la versión que tenga el timestamp más reciente.
    const processCategory = (categoriesObject) => {
        for (const categoryName in categoriesObject) {
            for (const task of categoriesObject[categoryName]) {
                const existing = tasksById.get(task.id);
                if (!existing || new Date(task.lastModified) > new Date(existing.lastModified)) {
                    // Guardamos la tarea Y la categoría a la que pertenece
                    tasksById.set(task.id, { ...task, category: categoryName });
                }
            }
        }
    };

    processCategory(localCategories);
    processCategory(remoteCategories);

    // 2. Ahora que tenemos la lista definitiva de tareas ganadoras,
    //    reconstruimos el objeto de categorías desde cero.
    const mergedCategories = {
        "bandeja-de-entrada": [], "prioritaria": [], "proximas": [], "algun-dia": [], "archivadas": []
    };

    for (const task of tasksById.values()) {
        // Si la categoría de la tarea ganadora existe, la colocamos allí.
        if (mergedCategories[task.category]) {
            // Quitamos la propiedad 'category' que era temporal
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
                    const merged = mergeTasks(categories, remoteData.categories);
                    Object.assign(categories, merged);
                    saveCategoriesToLocalStorage();
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
    // Verificar tanto en hash como en query params
    const hash = window.location.hash.substring(1);
    const search = window.location.search.substring(1);
    
    console.log('🔍 Hash:', hash);
    console.log('🔍 Search:', search);
    
    let newToken = null;
    
    // Intentar desde hash
    if (hash) {
        const hashParams = new URLSearchParams(hash);
        newToken = hashParams.get('access_token');
    }
    
    // Intentar desde query params si no hay en hash
    if (!newToken && search) {
        const searchParams = new URLSearchParams(search);
        newToken = searchParams.get('access_token');
    }
    
    console.log('🎫 Nuevo token encontrado:', newToken ? 'Sí' : 'No');
    
    if (newToken) {
        console.log('💾 Guardando token...');
        localStorage.setItem('dropbox_access_token', newToken);
        accessToken = newToken;
        
        // Limpiar URL
        window.history.replaceState({}, document.title, window.location.pathname);
        
        updateDropboxButtons();
        showToast('✅ Conectado con Dropbox correctamente');
        
        // Intentar sincronizar con más delay
        setTimeout(() => {
            console.log('🔄 Intentando primera sincronización...');
            syncFromDropbox();
        }, 2000); // Aumentado a 2 segundos
    } else {
        updateDropboxButtons();
        if (accessToken) {
            console.log('🔄 Token existente encontrado, validando...');
            // Validar con delay
            setTimeout(() => {
                validateToken().then(valid => {
                    if (valid) {
                        syncFromDropbox();
                    } else {
                        console.log('❌ Token existente no válido');
                    }
                });
            }, 1000);
        }
    }
}

// --- INICIALIZACIÓN DE LA APLICACIÓN (ÚNICA Y CONSOLIDADA) ---
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

    // Lógica de Backup/Restore y Limpieza
    // ... (Aquí irían los listeners para backup-btn, restore-btn, etc., que ya tenías)

    // Iniciar el flujo de autenticación de Dropbox
    handleAuthCallback();
});
// (Asegúrate de que las implementaciones de updateDropboxButtons, validateToken y handleAuthCallback estén completas aquí)



