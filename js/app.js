// Archivo de lógica de la aplicación para gestionar tareas
const categories = {
    "bandeja-de-entrada": [],
    "prioritaria": [],
    "proximas": [],
    "algun-dia": [],
    "archivadas": []
};

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
        categories[category].splice(taskIndex, 1);
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

    // Mostrar el popup al iniciar
    if (popup) {
        popup.style.display = 'flex';
        setTimeout(() => { popupInput && popupInput.focus(); }, 200);
    }

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
});


