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
        syncToDropbox(); // Sincronizar automáticamente
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

    // Login con Dropbox
    const dropboxLoginBtn = document.getElementById('dropbox-login');
    if (dropboxLoginBtn) {
        dropboxLoginBtn.addEventListener('click', function() {
            console.log('Botón de Dropbox clickeado'); // Para debug
            const authUrl = dbx.getAuthenticationUrl('https://sasogu.github.io/task-manager-app/');
            console.log('URL de autorización:', authUrl); // Para debug
            window.location.href = authUrl;
        });
    }
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

// Configuración de Dropbox
const dbx = new Dropbox.Dropbox({ 
    clientId: 'f21fzdjtng58vcg',
    fetch: fetch
});

let isLoggedIn = false;

// Verificar si ya está autenticado
function checkDropboxAuth() {
    const accessToken = localStorage.getItem('dropbox_access_token');
    if (accessToken) {
        dbx.setAccessToken(accessToken);
        isLoggedIn = true;
        syncFromDropbox();
    }
}

// Login con Dropbox
document.getElementById('dropbox-login').addEventListener('click', function() {
    const authUrl = dbx.getAuthenticationUrl('https://sasogu.github.io/task-manager-app/'); // <-- Cambiada por tu URL real
    window.location.href = authUrl;
});

// Guardar tareas en Dropbox
async function syncToDropbox() {
    if (!isLoggedIn) return;
    
    const data = {
        categories: categories,
        deletedTasks: deletedTasks,
        lastSync: new Date().toISOString()
    };
    
    try {
        await dbx.filesUpload({
            path: '/tareas.json',
            contents: JSON.stringify(data, null, 2),
            mode: 'overwrite',
            autorename: true
        });
        console.log('Tareas sincronizadas con Dropbox');
    } catch (error) {
        console.error('Error al sincronizar:', error);
    }
}

// Cargar tareas desde Dropbox
async function syncFromDropbox() {
    if (!isLoggedIn) return;
    
    try {
        const response = await dbx.filesDownload({path: '/tareas.json'});
        const data = JSON.parse(response.result.fileBinary);
        
        if (data.categories) {
            Object.assign(categories, data.categories);
            saveCategoriesToLocalStorage();
            renderTasks();
        }
    } catch (error) {
        console.log('No hay backup previo en Dropbox o error:', error);
    }
}

// Al cargar la página, verificar si viene el token de Dropbox
window.addEventListener('load', function() {
    const urlParams = new URLSearchParams(window.location.search);
    const accessToken = urlParams.get('access_token');
    
    if (accessToken) {
        localStorage.setItem('dropbox_access_token', accessToken);
        dbx.setAccessToken(accessToken);
        isLoggedIn = true;
        // Limpiar URL
        window.history.replaceState({}, document.title, window.location.pathname);
        syncFromDropbox();
    } else {
        checkDropboxAuth();
    }
});



