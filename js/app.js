// Archivo de lógica de la aplicación para gestionar tareas
const categories = {
    "bandeja-de-entrada": [],
    "prioritaria": [],
    "proximas": [],
    "algun-dia": [],
    "archivadas": []
};
const deletedTasks = JSON.parse(localStorage.getItem('deletedTasks') || '[]');

function obtenerFechaActualParaNombreArchivo() {
    const ahora = new Date();
    const año = ahora.getFullYear();
    const mes = String(ahora.getMonth() + 1).padStart(2, '0');
    const dia = String(ahora.getDate()).padStart(2, '0');
    const hora = String(ahora.getHours()).padStart(2, '0');
    const minutos = String(ahora.getMinutes()).padStart(2, '0');
    return `${año}-${mes}-${dia}_${hora}-${minutos}`;
}


function addTask(category, task) {
    if (categories[category]) {
        categories[category].push({ task, completed: false });
        saveCategoriesToLocalStorage();
        renderTasks();
    } else {
        console.error('Categoría no válida');
    }
}

function removeTask(category, taskIndex) {
    if (categories[category]) {
        const removed = categories[category].splice(taskIndex, 1)[0];
        if (removed) {
            deletedTasks.push({
                ...removed,
                category,
                deletedAt: new Date().toISOString()
            });
            localStorage.setItem('deletedTasks', JSON.stringify(deletedTasks));
        }
        saveCategoriesToLocalStorage();
        renderTasks();
    } else {
        console.error('Categoría no válida');
    }
}

function toggleTaskCompletion(category, taskIndex) {
    if (categories[category] && categories[category][taskIndex]) {
        // Si la tarea no está en archivadas y se marca como completada, archívala
        if (category !== 'archivadas' && !categories[category][taskIndex].completed) {
            categories[category][taskIndex].completed = true;
            const task = categories[category].splice(taskIndex, 1)[0];
            categories['archivadas'].push(task);
        } else if (category === 'archivadas') {
            // Si está en archivadas, solo cambia el estado completado
            categories[category][taskIndex].completed = !categories[category][taskIndex].completed;
        }
        saveCategoriesToLocalStorage();
        renderTasks();
    } else {
        console.error('Categoría o tarea no válida');
    }
}

function moveTask(currentCategory, taskIndex, newCategory) {
    if (categories[currentCategory] && categories[newCategory]) {
        const task = categories[currentCategory].splice(taskIndex, 1)[0];
        categories[newCategory].push(task);
        saveCategoriesToLocalStorage();
        renderTasks();
    } else {
        console.error('Categoría no válida');
    }
}

function renderTasks() {
    const taskContainer = document.getElementById('task-container');
    taskContainer.innerHTML = '';

    const categoryNames = {
        "bandeja-de-entrada": "Bandeja de Entrada",
        "prioritaria": "Prioritaria",
        "proximas": "Próximas",
        "algun-dia": "Algún Día",
        "archivadas": "Archivadas"
    };

    for (const [category, tasks] of Object.entries(categories)) {
        const categoryDiv = document.createElement('div');
        categoryDiv.className = 'category';
        categoryDiv.innerHTML = `<h3>${categoryNames[category]}</h3>`;

        tasks.forEach((taskObj, index) => {
            const taskDiv = document.createElement('div');
            taskDiv.className = 'task';
            taskDiv.innerHTML = `
                <input type="checkbox" ${taskObj.completed ? 'checked' : ''} onclick="toggleTaskCompletion('${category}', ${index})">
                <span class="${taskObj.completed ? 'completed' : ''}">${taskObj.task}</span>
                ${category === 'archivadas' ? `<button onclick="removeTask('${category}', ${index})">Eliminar</button>` : ''}
                <select onchange="moveTask('${category}', ${index}, this.value)">
                    <option value="" disabled selected>Mover a...</option>
                    ${Object.keys(categories)
                        .filter(cat => cat !== category)
                        .map(cat => `<option value="${cat}">${categoryNames[cat]}</option>`)
                        .join('')}
                </select>
            `;
            categoryDiv.appendChild(taskDiv);
        });

        taskContainer.appendChild(categoryDiv);
    }
}

// Guardar categorías en localStorage
function saveCategoriesToLocalStorage() {
    localStorage.setItem('categories', JSON.stringify(categories));
}

// Cargar categorías desde localStorage
function loadCategoriesFromLocalStorage() {
    const storedCategories = localStorage.getItem('categories');
    if (storedCategories) {
        Object.assign(categories, JSON.parse(storedCategories));
    }
}

// Llamar a la función de carga al inicio
loadCategoriesFromLocalStorage();
renderTasks();

function handleAddTask() {
    const taskNameInput = document.getElementById('task-name');
    const taskCategorySelect = document.getElementById('task-category');

    const taskName = taskNameInput.value.trim();
    const taskCategory = taskCategorySelect.value || 'bandeja-de-entrada'; // Usar 'bandeja-de-entrada' como categoría predeterminada

    if (taskName) {
        addTask(taskCategory, taskName);
        taskNameInput.value = ''; // Limpiar el campo de texto
        taskCategorySelect.value = ''; // Reiniciar el menú desplegable
    } else {
        alert('Por favor, ingresa un nombre de tarea.');
    }
}

// Añadir soporte para enviar el formulario con Enter y enfocar el input principal
document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('task-form');
    const taskNameInput = document.getElementById('task-name');
    if (taskNameInput) {
        setTimeout(() => {
            taskNameInput.focus();
            taskNameInput.select();
        }, 300);
    }
    if (form) {
        form.addEventListener('submit', function(e) {
            e.preventDefault();
            handleAddTask();
        });
    }

    // --- POPUP ---
    const popup = document.getElementById('popup-tarea');
    const popupForm = document.getElementById('popup-task-form');
    const popupInput = document.getElementById('popup-task-name');
    const popupCategory = document.getElementById('popup-task-category');
    const cancelarBtn = document.getElementById('cancelar-popup');

    // Quita o comenta esta parte para NO mostrar el popup al iniciar
    // if (popup) {
    //     popup.style.display = 'flex';
    //     setTimeout(() => { popupInput && popupInput.focus(); }, 200);
    // }

    // Añadir tarea desde el popup
    if (popupForm) {
        popupForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const nombre = popupInput.value.trim();
            const categoria = popupCategory.value || 'bandeja-de-entrada';
            if (nombre) {
                addTask(categoria, nombre);
                popupInput.value = '';
                popup.style.display = 'none';
            } else {
                alert('Por favor, ingresa un nombre de tarea.');
            }
        });
    }

    // Cancelar y cerrar el popup
    if (cancelarBtn) {
        cancelarBtn.addEventListener('click', function() {
            popup.style.display = 'none';
        });
    }

    // Botón para abrir el popup de nueva tarea
    const abrirPopupBtn = document.getElementById('abrir-popup-tarea');
    if (abrirPopupBtn && popup) {
        abrirPopupBtn.addEventListener('click', function() {
            popup.style.display = 'flex';
            setTimeout(() => { popupInput && popupInput.focus(); }, 200);
        });
    }

    // === DROPBOX API DIRECTA ===

    const DROPBOX_APP_KEY = 'f21fzdjtng58vcg';
    let accessToken = localStorage.getItem('dropbox_access_token');

    // Debug del estado de conexión
    function logDropboxStatus() {
        console.log('=== ESTADO DROPBOX ===');
        console.log('Token existe:', !!accessToken);
        console.log('Botones existentes:', {
            login: !!document.getElementById('dropbox-login'),
            sync: !!document.getElementById('dropbox-sync'),
            logout: !!document.getElementById('dropbox-logout')
        });
        console.log('=====================');
    }

    // Actualizar botones según estado
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
        
        logDropboxStatus(); // Debug
    }

    // Login con Dropbox
    const dropboxLoginBtn = document.getElementById('dropbox-login');
    if (dropboxLoginBtn) {
        dropboxLoginBtn.addEventListener('click', function() {
            console.log('Conectando con Dropbox...');
            const authUrl = `https://www.dropbox.com/oauth2/authorize?client_id=${DROPBOX_APP_KEY}&response_type=token&redirect_uri=https://sasogu.github.io/task-manager-app/`;
            window.location.href = authUrl;
        });
    }

    // Verificar si el token es válido
    async function validateToken() {
        if (!accessToken) return false;
        
        try {
            const response = await fetch('https://api.dropboxapi.com/2/users/get_current_account', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (response.ok) {
                return true;
            } else {
                // Token inválido, limpiar
                localStorage.removeItem('dropbox_access_token');
                accessToken = null;
                updateDropboxButtons();
                return false;
            }
        } catch (error) {
            console.error('Error validando token:', error);
            return false;
        }
    }

    // Guardar tareas en Dropbox
    async function syncToDropbox() {
        if (!accessToken || !(await validateToken())) {
            console.log('Token no válido o no disponible');
            return;
        }
        
        const data = {
            categories: categories,
            deletedTasks: JSON.parse(localStorage.getItem('deletedTasks') || '[]'),
            lastSync: new Date().toISOString()
        };
        
        try {
            const response = await fetch('https://content.dropboxapi.com/2/files/upload', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/octet-stream',
                    'Dropbox-API-Arg': JSON.stringify({
                        path: '/tareas.json',
                        mode: 'overwrite',
                        autorename: false
                    })
                },
                body: JSON.stringify(data, null, 2)
            });
            
            if (response.ok) {
                console.log('✅ Tareas guardadas en Dropbox');
                return true;
            } else {
                const errorData = await response.json();
                console.error('❌ Error al guardar en Dropbox:', response.status, errorData);
                return false;
            }
        } catch (error) {
            console.error('❌ Error de red al sincronizar:', error);
            return false;
        }
    }

    // Cargar tareas desde Dropbox
    async function syncFromDropbox() {
        if (!accessToken || !(await validateToken())) {
            console.log('Token no válido para cargar');
            return;
        }
        
        try {
            const response = await fetch('https://content.dropboxapi.com/2/files/download', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Dropbox-API-Arg': JSON.stringify({path: '/tareas.json'})
                }
            });
            
            if (response.ok) {
                const text = await response.text();
                const data = JSON.parse(text);
                if (data.categories) {
                    Object.assign(categories, data.categories);
                    saveCategoriesToLocalStorage();
                    renderTasks();
                    console.log('✅ Tareas cargadas desde Dropbox');
                    return true;
                }
            } else if (response.status === 409) {
                console.log('📂 No hay archivo de backup en Dropbox');
            } else {
                const errorData = await response.json();
                console.error('❌ Error al cargar desde Dropbox:', response.status, errorData);
            }
        } catch (error) {
            console.log('⚠️ No se pudo cargar desde Dropbox:', error.message);
        }
        return false;
    }

    // Sincronizar manualmente
    const dropboxSyncBtn = document.getElementById('dropbox-sync');
    if (dropboxSyncBtn) {
        dropboxSyncBtn.addEventListener('click', async function() {
            console.log('🔄 Iniciando sincronización manual...');
            const uploaded = await syncToDropbox();
            if (uploaded) {
                alert('✅ Tareas sincronizadas correctamente');
            } else {
                alert('❌ Error al sincronizar. Revisa la consola.');
            }
        });
    }

    // Logout de Dropbox
    const dropboxLogoutBtn = document.getElementById('dropbox-logout');
    if (dropboxLogoutBtn) {
        dropboxLogoutBtn.addEventListener('click', function() {
            localStorage.removeItem('dropbox_access_token');
            accessToken = null;
            updateDropboxButtons();
            alert('Desconectado de Dropbox');
        });
    }

    // Verificar token al cargar
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    const newToken = params.get('access_token');

    if (newToken) {
        localStorage.setItem('dropbox_access_token', newToken);
        accessToken = newToken;
        window.location.hash = '';
        updateDropboxButtons();
        syncFromDropbox();
        alert('✅ Conectado con Dropbox correctamente');
    } else {
        updateDropboxButtons();
        if (accessToken) {
            validateToken().then(valid => {
                if (valid) {
                    syncFromDropbox();
                }
            });
        }
    }

    // Modificar la función addTask para sincronizar automáticamente
    const originalAddTask = addTask;
    addTask = function(category, task) {
        originalAddTask(category, task);
        if (accessToken) {
            setTimeout(() => syncToDropbox(), 500); // Pequeño delay para asegurar que se guarda localmente primero
        }
    };

    // Modificar removeTask también
    const originalRemoveTask = removeTask;
    removeTask = function(category, taskIndex) {
        originalRemoveTask(category, taskIndex);
        if (accessToken) {
            setTimeout(() => syncToDropbox(), 500);
        }
    };

    // Modificar toggleTaskCompletion también
    const originalToggleTask = toggleTaskCompletion;
    toggleTaskCompletion = function(category, taskIndex) {
        originalToggleTask(category, taskIndex);
        if (accessToken) {
            setTimeout(() => syncToDropbox(), 500);
        }
    };

    // Botón temporal para debug/limpieza
    const clearBtn = document.createElement('button');
    clearBtn.textContent = 'Limpiar datos';
    clearBtn.onclick = clearAllData;
    clearBtn.style.cssText = 'position:fixed; top:10px; right:10px; z-index:9999; background:red; color:white;';
    document.body.appendChild(clearBtn);

    // Botón para limpiar datos (temporal para debug)
    const clearDataBtn = document.getElementById('clear-data-btn');
    if (clearDataBtn) {
        clearDataBtn.addEventListener('click', function() {
            if (confirm('¿Borrar todos los datos locales y cache?')) {
                localStorage.clear();
                if ('caches' in window) {
                    caches.keys().then(cacheNames => {
                        cacheNames.forEach(cacheName => caches.delete(cacheName));
                    });
                }
                alert('Datos borrados. Recargando página...');
                location.reload();
            }
        });
    }

    // === DEBUG DROPBOX ===
    document.addEventListener('DOMContentLoaded', function() {
        
        // Función de debug completa
        function debugDropboxConfig() {
            console.log('=== DEBUG DROPBOX ===');
            console.log('App Key:', 'f21fzdjtng58vcg');
            console.log('Current URL:', window.location.href);
            console.log('Token in localStorage:', localStorage.getItem('dropbox_access_token') ? 'EXISTS' : 'NOT FOUND');
            console.log('URL Hash:', window.location.hash);
            console.log('URL Search:', window.location.search);
            console.log('====================');
        }
        
        // Ejecutar debug al cargar
        debugDropboxConfig();
        
        // Función para probar manualmente la conexión
        window.testDropboxConnection = async function() {
            const token = localStorage.getItem('dropbox_access_token');
            if (!token) {
                console.log('❌ No hay token');
                return;
            }
            
            console.log('🧪 Probando conexión con token...');
            
            try {
                const response = await fetch('https://api.dropboxapi.com/2/users/get_current_account', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                });
                
                console.log('📡 Respuesta:', response.status);
                
                if (response.ok) {
                    const data = await response.json();
                    console.log('✅ Token válido. Usuario:', data.name.display_name);
                } else {
                    const error = await response.json();
                    console.log('❌ Token inválido:', error);
                }
            } catch (err) {
                console.log('💥 Error de red:', err);
            }
        };
        
        console.log('💡 Ejecuta testDropboxConnection() en consola para probar el token');
    });
});

// Función para obtener las tareas desde localStorage
function obtenerTareas() {
    const data = localStorage.getItem('categories');
    return data ? JSON.parse(data) : {
        "bandeja-de-entrada": [],
        "prioritaria": [],
        "proximas": [],
        "algun-dia": [],
        "archivadas": []
    };
}

// Función para guardar las tareas en localStorage
function guardarTareas(tareasPorCategoria) {
    localStorage.setItem('categories', JSON.stringify(tareasPorCategoria));
}

// Exportar tareas
document.getElementById('backup-btn').addEventListener('click', function() {
    const tareas = obtenerTareas();
    const backupData = {
        fecha: new Date().toISOString(),
        tareas
    };
    const blob = new Blob([JSON.stringify(backupData, null, 2)], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tareas-backup_${obtenerFechaActualParaNombreArchivo()}.json`;

    a.click();
    URL.revokeObjectURL(url);
});


// Importar tareas
document.getElementById('restore-btn').addEventListener('click', function() {
    document.getElementById('restore-file').click();
});

document.getElementById('restore-file').addEventListener('change', function(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const json = JSON.parse(e.target.result);

            if (!json.tareas || typeof json.tareas !== 'object') {
                throw new Error('Formato de backup no válido');
            }

            // Reemplaza el contenido actual de `categories` sin recargar
            Object.keys(categories).forEach(cat => delete categories[cat]); // Limpia
            Object.assign(categories, json.tareas); // Carga

            saveCategoriesToLocalStorage(); // Guarda en localStorage
            renderTasks(); // Vuelve a renderizar en pantalla

            alert('Tareas restauradas correctamente.');
        } catch (err) {
            alert('Error al importar: ' + err.message);
        }
    };
    reader.readAsText(file);
});

// Exportar tareas eliminadas
document.getElementById('export-deleted-btn').addEventListener('click', function() {
    const deleted = JSON.parse(localStorage.getItem('deletedTasks') || '[]');
    if (deleted.length === 0) {
        alert('No hay tareas eliminadas para exportar.');
        return;
    }

    // Encabezados CSV
    const headers = ['Tarea', 'Completada', 'Categoría', 'Fecha de eliminación'];
    // Filas CSV
    const rows = deleted.map(t =>
        [
            `"${(t.task || '').replace(/"/g, '""')}"`,
            t.completed ? 'Sí' : 'No',
            t.category || '',
            t.deletedAt || ''
        ].join(',')
    );
    // Unir encabezados y filas
    const csvContent = [headers.join(','), ...rows].join('\r\n');

    // Descargar archivo
    const blob = new Blob([csvContent], {type: 'text/csv'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tareas-eliminadas_${obtenerFechaActualParaNombreArchivo()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
});

// Función para limpiar datos
function clearAllData() {
    if (confirm('¿Estás seguro de que quieres borrar todos los datos locales?')) {
        localStorage.clear();
        
        // También limpiar el cache del Service Worker
        if ('caches' in window) {
            caches.delete('task-manager-cache-v1.0.35');
        }
        
        alert('Datos borrados. La página se recargará.');
        location.reload();
    }
}



