// =================================================================================
// GESTOR DE TAREAS - VERSIÓN FINAL REFACTORIZADA
// =================================================================================

// --- ESTADO GLOBAL DE LA APLICACIÓN ---
const categories = {
    "bandeja-de-entrada": [],
    "prioritaria": [],
    "proximas": [],
    "algun-dia": [],
    "archivadas": []
};

const categoryNames = {
    "bandeja-de-entrada": "Bandeja de Entrada",
    "prioritaria": "Prioritaria",
    "proximas": "Próximas",
    "algun-dia": "Algún Día",
    "archivadas": "Archivadas"
};

const deletedTasks = JSON.parse(localStorage.getItem('deletedTasks') || '[]');
const DROPBOX_APP_KEY = 'f21fzdjtng58vcg';
let accessToken = localStorage.getItem('dropbox_access_token');
let localLastSync = localStorage.getItem('lastSync');
let syncInterval = null;
const DROPBOX_REDIRECT_URI = 'https://sasogu.github.io/task-manager-app/';

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

// Modal de confirmación personalizado (Promise-based)
function showConfirm(message, acceptLabel = 'Aceptar', cancelLabel = 'Cancelar') {
    const modal = document.getElementById('confirm-modal');
    const msgEl = document.getElementById('confirm-message');
    const acceptBtn = document.getElementById('confirm-accept');
    const cancelBtn = document.getElementById('confirm-cancel');
    if (!modal || !msgEl || !acceptBtn || !cancelBtn) {
        // Fallback de seguridad si el modal no existe
        return Promise.resolve(window.confirm(message));
    }

    msgEl.textContent = message;
    acceptBtn.textContent = acceptLabel;
    cancelBtn.textContent = cancelLabel;
    modal.style.display = 'flex';

    return new Promise((resolve) => {
        const cleanup = () => {
            modal.style.display = 'none';
            acceptBtn.removeEventListener('click', onAccept);
            cancelBtn.removeEventListener('click', onCancel);
            modal.removeEventListener('click', onBackdrop);
            document.removeEventListener('keydown', onKey);
        };
        const onAccept = () => { cleanup(); resolve(true); };
        const onCancel = () => { cleanup(); resolve(false); };
        const onBackdrop = (e) => { if (e.target === modal) { cleanup(); resolve(false); } };
        const onKey = (e) => {
            if (e.key === 'Escape') { cleanup(); resolve(false); }
            if (e.key === 'Enter') { cleanup(); resolve(true); }
        };

        acceptBtn.addEventListener('click', onAccept);
        cancelBtn.addEventListener('click', onCancel);
        modal.addEventListener('click', onBackdrop);
        document.addEventListener('keydown', onKey);

        // Intentar enfocar el botón de aceptar para rapidez
        setTimeout(() => acceptBtn.focus(), 0);
    });
}

function convertirEnlaces(texto) {
    // Escapar HTML y luego convertir URLs en enlaces seguros
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const escapeHTML = (s) => s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\"/g, '&quot;')
        .replace(/'/g, '&#39;');
    const escaped = typeof texto === 'string' ? escapeHTML(texto) : '';
    return escaped.replace(urlRegex, function(url) {
        const safeHref = encodeURI(url);
        return `<a href="${safeHref}" target="_blank" rel="noopener noreferrer">${escapeHTML(url)}</a>`;
    });
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

function addTask(category, taskName, tags = [], reminderAt = null) {
    const newTask = {
        id: generateUUID(),
        task: taskName,
        completed: false,
        lastModified: new Date().toISOString(),
        tags: tags,
        reminderAt: reminderAt, // ISO string o null
        reminderDone: false,
        triggerScheduledAt: null
    };
    categories[category].push(newTask);
    saveCategoriesToLocalStorage();
    renderTasks();
    if (accessToken) syncToDropbox(false);
}

async function removeTask(taskId) {
    const taskData = findTask(taskId);
    if (!taskData) return;

    const taskTitle = (taskData.task && taskData.task.task) ? taskData.task.task : '';
    const msg = taskTitle
        ? `¿Estás seguro de que quieres eliminar la tarea "${taskTitle}"?`
        : '¿Estás seguro de que quieres eliminar esta tarea?';
    const confirmed = await showConfirm(msg, 'Eliminar', 'Cancelar');
    if (!confirmed) return;

    const [removedTask] = categories[taskData.category].splice(taskData.taskIndex, 1);
    deletedTasks.push({ ...removedTask, deletedOn: new Date().toISOString() });
    localStorage.setItem('deletedTasks', JSON.stringify(deletedTasks));
    saveCategoriesToLocalStorage();
    renderTasks();
    if (accessToken) syncToDropbox(false);
}

function toggleTaskCompletion(taskId) {
    const taskData = findTask(taskId);
    if (taskData) {
        const { task } = taskData;
        task.completed = !task.completed;
        task.lastModified = new Date().toISOString();
        if (task.completed && taskData.category !== 'archivadas') {
            const [movedTask] = categories[taskData.category].splice(taskData.taskIndex, 1);
            movedTask.archivedOn = new Date().toISOString();
            movedTask.reminderDone = true;
            categories['archivadas'].push(movedTask);
        } else if (!task.completed && taskData.category === 'archivadas') {
            const [movedTask] = categories[taskData.category].splice(taskData.taskIndex, 1);
            delete movedTask.archivedOn;
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
        // Gestionar metadatos de archivado al mover entre categorías
        if (newCategory === 'archivadas') {
            task.completed = true;
            task.archivedOn = new Date().toISOString();
            task.reminderDone = true;
        } else if (taskData.category === 'archivadas' && newCategory !== 'archivadas') {
            task.completed = false;
            delete task.archivedOn;
        }
        categories[newCategory].push(task);
        saveCategoriesToLocalStorage();
        renderTasks();
        if (accessToken) syncToDropbox(false);
    }
}

// --- EDICIÓN DE TAREAS ---
function updateTask(taskId, newName, newCategory, newTags = [], newReminderAt = null) {
    const data = findTask(taskId);
    if (!data) return;
    const { task, category } = data;
    task.task = newName;
    task.tags = Array.isArray(newTags) ? newTags : [];
    // Actualizar recordatorio
    task.reminderAt = newReminderAt || null;
    // Si se cambia la fecha, reiniciar el estado de disparo y reprogramar
    task.reminderDone = false;
    task.triggerScheduledAt = null;
    task.lastModified = new Date().toISOString();
    if (newCategory && newCategory !== category && categories[newCategory]) {
        categories[category].splice(data.taskIndex, 1);
        // Gestionar metadatos de archivado si cambia la categoría desde el editor
        if (newCategory === 'archivadas') {
            task.completed = true;
            task.archivedOn = new Date().toISOString();
        } else if (category === 'archivadas' && newCategory !== 'archivadas') {
            task.completed = false;
            delete task.archivedOn;
        }
        categories[newCategory].push(task);
    }
    saveCategoriesToLocalStorage();
    renderTasks();
    if (accessToken) syncToDropbox(false);
}

function openEditTask(taskId) {
    const data = findTask(taskId);
    if (!data) return;
    const popup = document.getElementById('popup-tarea');
    const form = document.getElementById('popup-task-form');
    const taskNameInput = document.getElementById('popup-task-name');
    const categorySelect = document.getElementById('popup-task-category');
    const tagsInput = document.getElementById('popup-task-tags');
    const reminderInput = document.getElementById('popup-task-reminder');
    if (!popup || !form || !taskNameInput || !categorySelect || !tagsInput) return;

    // Prefill
    taskNameInput.value = data.task.task || '';
    categorySelect.value = data.category;
    tagsInput.value = (data.task.tags || []).join(', ');
    if (reminderInput) {
        // Convertir ISO a valor datetime-local (sin zona, formato YYYY-MM-DDTHH:mm)
        const iso = data.task.reminderAt || '';
        if (iso) {
            const d = new Date(iso);
            const pad = n => String(n).padStart(2, '0');
            const local = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
            reminderInput.value = local;
        } else {
            reminderInput.value = '';
        }
    }

    // Switch form to edit mode
    form.dataset.mode = 'edit';
    form.dataset.editingId = taskId;
    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.textContent = 'Guardar';

    popup.style.display = 'flex';
    taskNameInput.focus();
    updateTagDatalist();
    renderTagSuggestions();
}

function resetPopupFormMode() {
    const form = document.getElementById('popup-task-form');
    if (!form) return;
    form.dataset.mode = 'add';
    form.dataset.editingId = '';
    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.textContent = 'Añadir';
}

// --- RENDERIZADO EN EL DOM (SIN BOTÓN DE ELIMINAR) ---
function renderTasks() {
    const taskContainer = document.getElementById('task-container');
    const filterTagSelect = document.getElementById('filter-tag');
    // Mantener filtro activo: tomar el valor actual o el guardado en localStorage
    let filterTag = '';
    if (filterTagSelect) {
        filterTag = filterTagSelect.value || localStorage.getItem('selectedFilterTag') || '';
    } else {
        filterTag = localStorage.getItem('selectedFilterTag') || '';
    }
    taskContainer.innerHTML = '';

    for (const [category, tasks] of Object.entries(categories)) {
        if (category === 'archivadas') continue;
        const categoryDiv = document.createElement('div');
        categoryDiv.className = 'category';

        // Filtrar tareas por etiqueta seleccionada
        let filteredTasks = filterTag
            ? tasks.filter(task => task.tags && task.tags.includes(filterTag))
            : tasks;

        let tasksHTML = filteredTasks.map(task => `
            <div class="task ${task.completed ? 'completed' : ''}" draggable="true" data-id="${task.id}">
                <div class="task-main">
                    <input type="checkbox" onchange="toggleTaskCompletion('${task.id}')" ${task.completed ? 'checked' : ''}>
                    <span>
                        ${convertirEnlaces(task.task)}
                        ${task.tags && task.tags.length ? `<small class="tags">${task.tags.map(t => `<span class=\"tag-chip in-task\">#${t}</span>`).join(' ')}</small>` : ''}
                        ${task.reminderAt ? `<small class=\"reminder-meta\">⏰ ${new Date(task.reminderAt).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' })}</small>` : ''}
                    </span>
                </div>
                <div class="task-actions">
                    <select aria-label="Mover tarea" onchange="moveTask('${task.id}', this.value)">
                        <option value="" disabled selected>Mover</option>
                        ${Object.keys(categoryNames).filter(c => c !== category).map(c => `<option value="${c}">${categoryNames[c]}</option>`).join('')}
                    </select>
                    <button class="edit-btn" aria-label="Editar tarea" onclick="openEditTask('${task.id}')">✏️ <span class="btn-label">Editar</span></button>
                    <button class="delete-btn" aria-label="Eliminar tarea" onclick="removeTask('${task.id}')">🗑️ <span class="btn-label">Eliminar</span></button>
                </div>
            </div>
        `).join('');

        categoryDiv.innerHTML = `<h3>${categoryNames[category]}</h3><div class="task-list">${tasksHTML}</div>`;
        // Añadir manejadores de DnD a cada categoría renderizada
        categoryDiv.addEventListener('dragover', function(e) {
            e.preventDefault();
            categoryDiv.classList.add('drag-over');
        });
        categoryDiv.addEventListener('dragleave', function() {
            categoryDiv.classList.remove('drag-over');
        });
        categoryDiv.addEventListener('drop', function(e) {
            e.preventDefault();
            categoryDiv.classList.remove('drag-over');
            const taskId = e.dataTransfer.getData('text/plain');
            const newCategory = Object.keys(categoryNames).find(
                key => categoryDiv.querySelector('h3').textContent === categoryNames[key]
            );
            if (taskId && newCategory) moveTask(taskId, newCategory);
        });
        taskContainer.appendChild(categoryDiv);
    }

    // Actualiza filtros (conservando selección) y autocompletado en cada render
    updateTagFilterDropdown(filterTag);
    updateTagDatalist();
}

// Handler global para el arrastre
window.onDragStart = function(event, taskId) {
    event.dataTransfer.setData('text/plain', taskId);
};

// --- UTILIDADES DE ETIQUETAS (VISIBLES GLOBALMENTE) ---
function getAllTags() {
    const tagsSet = new Set();
    Object.values(categories).forEach(tasks => {
        tasks.forEach(task => {
            if (task.tags && Array.isArray(task.tags)) {
                task.tags.forEach(tag => tagsSet.add(tag));
            }
        });
    });
    return Array.from(tagsSet).sort();
}

function updateTagFilterDropdown(currentValue = '') {
    const filterTagSelect = document.getElementById('filter-tag');
    if (!filterTagSelect) return;
    const tags = getAllTags();

    // Construir opciones con "Mostrar todo" al principio
    let optionsHtml = '<option value="">Mostrar todo</option>';

    // Si hay un valor actual que ya no existe en las etiquetas, añadirlo para conservar selección
    const hasCurrent = currentValue && tags.includes(currentValue);
    const renderedTags = hasCurrent ? tags : [currentValue, ...tags].filter((v, i, a) => v && a.indexOf(v) === i);

    optionsHtml += renderedTags.map(tag => `<option value="${tag}">${tag}</option>`).join('');

    filterTagSelect.innerHTML = optionsHtml;
    // Restaurar selección previa
    filterTagSelect.value = currentValue || '';
}

// Autocompletado para input de etiquetas (datalist)
function updateTagDatalist() {
    const datalist = document.getElementById('all-tags-list');
    if (!datalist) return;
    const tags = getAllTags();
    datalist.innerHTML = tags.map(t => `<option value="${t}"></option>`).join('');
}

// Chips de sugerencias bajo el input de etiquetas
function renderTagSuggestions() {
    const container = document.getElementById('tag-suggestions');
    const tagsInput = document.getElementById('popup-task-tags');
    if (!container || !tagsInput) return;
    const all = getAllTags();
    const current = new Set(parseTagsInputValue(tagsInput.value));
    container.innerHTML = all.map(tag => {
        const sel = current.has(tag) ? 'selected' : '';
        return `<span class="tag-chip ${sel}" data-tag="${tag}">#${tag}</span>`;
    }).join('');
    container.querySelectorAll('.tag-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            const tag = chip.dataset.tag;
            toggleTagInInput(tag);
            renderTagSuggestions();
        });
    });
}

function parseTagsInputValue(value) {
    return value.split(',')
        .map(t => t.trim())
        .filter(t => t.length > 0)
        .filter((v, i, a) => a.indexOf(v) === i);
}

function setTagsInputFromArray(arr) {
    const tagsInput = document.getElementById('popup-task-tags');
    if (!tagsInput) return;
    const unique = Array.from(new Set(arr.map(t => t.trim()).filter(Boolean)));
    tagsInput.value = unique.join(', ');
}

function toggleTagInInput(tag) {
    const tagsInput = document.getElementById('popup-task-tags');
    if (!tagsInput) return;
    const list = parseTagsInputValue(tagsInput.value);
    const idx = list.indexOf(tag);
    if (idx === -1) list.push(tag); else list.splice(idx, 1);
    setTagsInputFromArray(list);
}

// --- LÓGICA DE SINCRONIZACIÓN CON DROPBOX (CORREGIDA CON FUSIÓN) ---
function updateDropboxButtons() {
    const loginBtn = document.getElementById('dropbox-login');
    const syncBtn = document.getElementById('dropbox-sync');
    if (!loginBtn || !syncBtn) return;
    if (accessToken) {
        loginBtn.style.display = 'none';
        syncBtn.style.display = 'inline-block';
    } else {
        loginBtn.style.display = 'inline-block';
        syncBtn.style.display = 'none';
    }
}

// Compatibilidad: en algunos flujos se invoca este helper; si no existe, dejar como no-op
function showReconnectDropboxBtn() { /* no-op: el botón de login ya queda visible al expirar */ }


// Muestra/Oculta todo el bloque de sincronización si no hay conexión
function updateSyncGroupVisibility() {
    const group = document.getElementById('sync-group');
    if (!group) return;
    if (navigator.onLine) {
        group.style.display = '';
        // Ajustar botones internos según sesión
        updateDropboxButtons();
    } else {
        group.style.display = 'none';
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
function mergeTasks(localCategories, remoteCategories, deletedIdsSet) {
    const tasksById = new Map();

    const processCategory = (categoriesObject) => {
        for (const categoryName in categoriesObject) {
            for (const task of categoriesObject[categoryName]) {
                // Ignorar tareas eliminadas
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
            mergedCategories[task.category].push(finalTask);
        }
    }
    // Orden determinista por lastModified (más recientes primero)
    Object.keys(mergedCategories).forEach(cat => {
        mergedCategories[cat].sort((a, b) => new Date(b.lastModified || 0) - new Date(a.lastModified || 0));
    });
    return mergedCategories;
}

function mergeDeletedTasks(localDeleted, remoteDeleted) {
    const deletedById = new Map();
    localDeleted.forEach(t => deletedById.set(t.id, t));
    remoteDeleted.forEach(t => deletedById.set(t.id, t));
    return Array.from(deletedById.values());
}

async function syncToDropbox(showAlert = true) {
    if (!accessToken) return false;
    const data = { categories, deletedTasks, lastSync: new Date().toISOString() };
    try {
        const response = await fetch('https://content.dropboxapi.com/2/files/upload', {
            method: 'POST', headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/octet-stream', 'Dropbox-API-Arg': JSON.stringify({ path: '/tareas.json', mode: 'overwrite' }) }, body: JSON.stringify(data, null, 2)
        });
        if (response.status === 401) {
            accessToken = null;
            localStorage.removeItem('dropbox_access_token');
            updateDropboxButtons();
            showToast('⚠️ Tu sesión de Dropbox ha caducado. Vuelve a conectar.');
            showReconnectDropboxBtn();
            return false;
        }
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
        if (meta.status === 401) {
            accessToken = null;
            localStorage.removeItem('dropbox_access_token');
            updateDropboxButtons();
            showToast('⚠️ Tu sesión de Dropbox ha caducado. Vuelve a conectar.');
            showReconnectDropboxBtn();
            return false;
        }
        if (!meta.ok) return meta.status === 409 ? await syncToDropbox(false) : false;
        const remoteMeta = await meta.json();
        if (force || !localLastSync || new Date(remoteMeta.server_modified) > new Date(localLastSync)) {
            const res = await fetch('https://content.dropboxapi.com/2/files/download', { method: 'POST', headers: { 'Authorization': `Bearer ${accessToken}`, 'Dropbox-API-Arg': JSON.stringify({ path: '/tareas.json' }) } });
            if (res.status === 401) {
                accessToken = null;
                localStorage.removeItem('dropbox_access_token');
                updateDropboxButtons();
                showToast('⚠️ Tu sesión de Dropbox ha caducado. Vuelve a conectar.');
                showReconnectDropboxBtn();
                return false;
            }
            if (res.ok) {
                const remoteData = await res.json();
                if (remoteData.categories) {
                    // 1. Fusionar eliminados
                    const remoteDeleted = remoteData.deletedTasks || [];
                    const mergedDeletedList = mergeDeletedTasks(deletedTasks, remoteDeleted);
                    const deletedIdsSet = new Set(mergedDeletedList.map(t => t.id));
                    // 2. Fusionar categorías ignorando eliminados
                    const mergedCategories = mergeTasks(categories, remoteData.categories, deletedIdsSet);
                    Object.assign(categories, mergedCategories);
                    deletedTasks.length = 0;
                    Array.prototype.push.apply(deletedTasks, mergedDeletedList);
                    saveCategoriesToLocalStorage();
                    localStorage.setItem('deletedTasks', JSON.stringify(deletedTasks));
                    renderTasks();
                    localLastSync = remoteMeta.server_modified;
                    localStorage.setItem('lastSync', localLastSync);
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
    // Verificar solo en hash (más seguro): access_token viene en el fragmento
    const hash = window.location.hash.substring(1);
    
    console.log('🔍 Hash:', hash);
    
    let newToken = null;
    if (hash) {
        const hashParams = new URLSearchParams(hash);
        newToken = hashParams.get('access_token');
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
    const taskNameInput = document.getElementById('popup-task-name');
    const categorySelect = document.getElementById('popup-task-category');
    const tagsInput = document.getElementById('popup-task-tags');
    const reminderInput = document.getElementById('popup-task-reminder');

    if (abrirPopupBtn) abrirPopupBtn.addEventListener('click', () => {
        resetPopupFormMode();
        popup.style.display = 'flex';
        document.getElementById('popup-task-name').focus();
        updateTagDatalist();
        renderTagSuggestions();
    });
    if (cancelarPopupBtn) cancelarPopupBtn.addEventListener('click', () => {
        resetPopupFormMode();
        popup.style.display = 'none';
    });
    window.addEventListener('click', (e) => { if (e.target == popup) popup.style.display = 'none'; });
    if (popupForm) {
        popupForm.addEventListener('submit', function(e) {
            e.preventDefault();
            let nombre = taskNameInput.value.trim();
            const categoria = categorySelect.value;
            let tags = tagsInput.value
                .split(',')
                .map(t => t.trim())
                .filter(t => t.length > 0);
            // Recordatorio
            let reminderAt = null;
            if (reminderInput && reminderInput.value) {
                // Interpretar como hora local -> ISO
                const localStr = reminderInput.value; // YYYY-MM-DDTHH:mm
                const localDate = new Date(localStr);
                if (!isNaN(localDate.getTime())) {
                    reminderAt = localDate.toISOString();
                }
            }

            // Capturar hashtags del nombre como etiquetas adicionales y limpiar el nombre
            const hashtagRegex = /#([\p{L}\d_-]+)/gu;
            const extra = Array.from(nombre.matchAll(hashtagRegex)).map(m => m[1]);
            if (extra.length) {
                nombre = nombre.replace(/#[\p{L}\d_-]+/gu, '').replace(/\s{2,}/g, ' ').trim();
                tags = Array.from(new Set([...tags, ...extra]));
            }

            if (!nombre) {
                showToast('Por favor, ingresa un nombre de tarea.', 'error');
                return;
            }

            // Modo edición vs. alta
            const isEdit = popupForm.dataset.mode === 'edit';
            if (isEdit) {
                const editingId = popupForm.dataset.editingId;
                updateTask(editingId, nombre, categoria, tags, reminderAt);
            } else {
                addTask(categoria, nombre, tags, reminderAt);
            }

            taskNameInput.value = '';
            tagsInput.value = '';
            if (reminderInput) reminderInput.value = '';
            resetPopupFormMode();
            popupForm.closest('.modal').style.display = 'none';
        });
        // Actualizar chips al teclear manualmente
        tagsInput.addEventListener('input', renderTagSuggestions);
    }

    // Lógica de Dropbox
    document.getElementById('dropbox-login')?.addEventListener('click', () => {
        // Usamos una URL fija y absoluta que coincida exactamente con lo registrado en Dropbox
        const baseUrl = window.location.origin;
        const cleanPath = window.location.pathname.split('?')[0].split('#')[0]; // Eliminar parámetros y hash
        let redirectUri;
        
        // Construir redirect de forma robusta para /, /dir/, y /dir/index.html
        if (cleanPath.endsWith('index.html')) {
            redirectUri = baseUrl + cleanPath.replace(/index\.html$/, '');
        } else if (cleanPath === '/' || cleanPath === '') {
            redirectUri = baseUrl + '/';
        } else {
            redirectUri = baseUrl + cleanPath;
        }
        
        console.log('🔍 URL de redirección:', redirectUri);
        
        const authUrl = `https://www.dropbox.com/oauth2/authorize?client_id=${DROPBOX_APP_KEY}&response_type=token&redirect_uri=${encodeURIComponent(redirectUri)}`;
        
        window.location.href = authUrl;
    });
    document.getElementById('dropbox-sync')?.addEventListener('click', performFullSync);

    // Lógica de Backup/Restore y Limpieza
    // ... (Aquí irían los listeners para backup-btn, restore-btn, etc., que ya tenías)

    const clearBtn = document.getElementById('clear-data-btn');
    if (clearBtn) {
        clearBtn.addEventListener('click', function() {
            if (confirm('¿Borrar todos los datos locales y cache?')) {
                localStorage.clear();
                if ('caches' in window) {
                    caches.keys().then(keys => keys.forEach(key => caches.delete(key)));
                }
                showToast('Datos borrados. La página se recargará.');
                setTimeout(() => location.reload(), 1000);
            }
        });
    }

    // Atajo de teclado para añadir nueva tarea (Ctrl+N o Cmd+N)
    document.addEventListener('keydown', function(e) {
        // Solo activar si NO estamos en un input, textarea o select
        const tag = document.activeElement.tagName.toLowerCase();
        if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

        // Atajo: Alt+N (menos conflictivo y funciona en ambos navegadores)
        if (e.altKey && e.key.toLowerCase() === 'n') {
            e.preventDefault();
            const popup = document.getElementById('popup-tarea');
            if (popup) {
                popup.style.display = 'flex';
                const input = document.getElementById('popup-task-name');
                if (input) input.focus();
            }
        }
    });

    // Iniciar el flujo de autenticación de Dropbox
    handleAuthCallback();

    document.getElementById('filter-tag')?.addEventListener('change', (e) => {
        try { localStorage.setItem('selectedFilterTag', e.target.value || ''); } catch (_) {}
        renderTasks();
    });

    // Botón para habilitar notificaciones
    document.getElementById('enable-notifications')?.addEventListener('click', async () => {
        try {
            if (!('Notification' in window)) {
                showToast('Notificaciones no soportadas en este navegador', 'error');
                return;
            }
            let perm = Notification.permission;
            if (perm !== 'granted') {
                perm = await Notification.requestPermission();
            }
            if (perm === 'granted') {
                localStorage.setItem('notificationsEnabled', 'true');
                showToast('Notificaciones habilitadas ✅');
            } else {
                localStorage.setItem('notificationsEnabled', 'false');
                showToast('Permiso de notificaciones denegado', 'error');
            }
        } catch (e) {
            console.error('Error solicitando notificaciones', e);
            showToast('No se pudo solicitar notificaciones', 'error');
        }
    });

    // Drag & Drop para tareas
    document.addEventListener('dragstart', function(e) {
        const taskEl = e.target.closest?.('.task');
        if (taskEl && taskEl.dataset.id) {
            e.dataTransfer.setData('text/plain', taskEl.dataset.id);
        }
    });

    // Acceso rápido: si llega con ?quick=1 abrir directamente el popup de nueva tarea
    try {
        const params = new URLSearchParams(window.location.search);
        if (params.has('quick')) {
            resetPopupFormMode();
            popup.style.display = 'flex';
            const input = document.getElementById('popup-task-name');
            if (input) input.focus();
            updateTagDatalist();
            renderTagSuggestions();
        }
    } catch (_) {}

    // getAllTags y updateTagFilterDropdown ahora son globales
    // Mostrar recordatorios vencidos al abrir la app
    checkDueRemindersAndAlertOnce();
    // Ajustar visibilidad de sincronización según conectividad
    updateSyncGroupVisibility();
    window.addEventListener('online', updateSyncGroupVisibility);
    window.addEventListener('offline', updateSyncGroupVisibility);
});

// Muestra un popup con recordatorios vencidos al abrir
function checkDueRemindersAndAlertOnce() {
    const now = Date.now();
    const due = [];
    let needsSave = false;
    for (const [cat, tasks] of Object.entries(categories)) {
        for (const task of tasks) {
            if (!task) continue;
            if (task.completed) continue;
            if (!task.reminderAt) continue;
            if (task.reminderDone) continue;
            const when = Date.parse(task.reminderAt);
            if (!isNaN(when) && when <= now) {
                due.push({ title: task.task, category: categoryNames[cat] || cat });
                task.reminderDone = true;
                task.lastModified = new Date().toISOString();
                needsSave = true;
            }
        }
    }
    if (needsSave) saveCategoriesToLocalStorage();
    if (due.length > 0) {
        const lines = due.map(d => `• ${d.title} (${d.category})`).join('\n');
        alert(`Tienes ${due.length} recordatorio(s) vencido(s):\n\n${lines}`);
    }
}

// --- RECORDATORIOS ---
async function showLocalNotification(title, options = {}) {
    try {
        const registration = await navigator.serviceWorker?.getRegistration();
        if (registration && Notification.permission === 'granted') {
            return registration.showNotification(title, options);
        }
    } catch (_) {}
    if (Notification.permission === 'granted') {
        return new Notification(title, options);
    }
}

function checkDueReminders() {
    const enabled = localStorage.getItem('notificationsEnabled') === 'true';
    // Si soporta triggers y hay permiso, delegamos en ellos y no hacemos polling
    if (enabled && supportsNotificationTriggers() && Notification.permission === 'granted') return;
    const now = Date.now();
    let needsSave = false;
    if (!enabled || !('Notification' in window)) return;

    for (const [cat, tasks] of Object.entries(categories)) {
        for (const task of tasks) {
            if (!task) continue;
            if (task.completed) continue;
            if (!task.reminderAt) continue;
            if (task.reminderDone) continue;
            const when = Date.parse(task.reminderAt);
            if (!isNaN(when) && when <= now) {
                const body = `Categoría: ${categoryNames[cat]}`;
                showLocalNotification('Recordatorio de tarea', {
                    body: `${task.task}\n${body}`,
                    icon: 'icons/icon-192.png',
                    tag: `reminder-${task.id}`,
                    data: { taskId: task.id }
                });
                task.reminderDone = true;
                task.lastModified = new Date().toISOString();
                needsSave = true;
            }
        }
    }
    if (needsSave) {
        saveCategoriesToLocalStorage();
    }
}

let reminderInterval = null;
function startReminderPolling() {
    if (reminderInterval) clearInterval(reminderInterval);
    // Comprobar inmediatamente y luego cada 30 segundos
    checkDueReminders();
function supportsNotificationTriggers() {
    try {
        // showTrigger es parte de las opciones; TimestampTrigger expone el constructor
        return (
            'Notification' in window &&
            'showTrigger' in Notification.prototype &&
            typeof TimestampTrigger !== 'undefined'
        );
    } catch (_) { return false; }
}

async function tryScheduleTaskTrigger(task, categoryKey) {
    try {
        if (!task || !task.reminderAt) return;
        if (!supportsNotificationTriggers()) return;
        if (Notification.permission !== 'granted') return;
        const when = Date.parse(task.reminderAt);
        if (isNaN(when)) return;
        if (when <= Date.now() + 1000) return; // No programar pasado o inmediato
        if (task.triggerScheduledAt === task.reminderAt) return; // Ya programado
        const reg = await navigator.serviceWorker?.getRegistration();
        if (!reg) return;
        await reg.showNotification('Recordatorio de tarea', {
            body: `${task.task}\nCategoría: ${categoryNames[categoryKey] || ''}`.trim(),
            tag: `reminder-${task.id}`,
            icon: 'icons/icon-192.png',
            showTrigger: new TimestampTrigger(when),
            data: { taskId: task.id, category: categoryKey }
        });
        task.triggerScheduledAt = task.reminderAt;
        saveCategoriesToLocalStorage();
    } catch (e) {
        console.warn('No se pudo programar trigger:', e);
    }
}

function schedulePendingTriggers() {
    if (!supportsNotificationTriggers()) return;
    if (Notification.permission !== 'granted') return;
    for (const [cat, tasks] of Object.entries(categories)) {
        for (const t of tasks) {
            if (!t || t.completed) continue;
            if (!t.reminderAt) continue;
            if (t.triggerScheduledAt === t.reminderAt) continue;
            tryScheduleTaskTrigger(t, cat);
        }
    }
}
    reminderInterval = setInterval(checkDueReminders, 30000);
}
