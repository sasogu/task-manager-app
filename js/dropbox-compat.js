(function(global) {
    const STATE_PATH = '/task-manager/state.json';
    const LEGACY_PATH = '/tareas.json';

    const WEB_TO_STATE = {
        'bandeja-de-entrada': 'bandejaDeEntrada',
        'prioritaria': 'prioritaria',
        'proximas': 'proximas',
        'algun-dia': 'algunDia',
        'archivadas': 'archivadas'
    };

    const STATE_TO_WEB = {
        'bandejaDeEntrada': 'bandeja-de-entrada',
        'prioritaria': 'prioritaria',
        'proximas': 'proximas',
        'algunDia': 'algun-dia',
        'archivadas': 'archivadas'
    };

    function ensureCategoriesShape(source = {}) {
        return {
            'bandeja-de-entrada': Array.isArray(source['bandeja-de-entrada']) ? source['bandeja-de-entrada'].slice() : [],
            'prioritaria': Array.isArray(source['prioritaria']) ? source['prioritaria'].slice() : [],
            'proximas': Array.isArray(source['proximas']) ? source['proximas'].slice() : [],
            'algun-dia': Array.isArray(source['algun-dia']) ? source['algun-dia'].slice() : [],
            'archivadas': Array.isArray(source['archivadas']) ? source['archivadas'].slice() : []
        };
    }

    function webTaskToStateTask(task = {}, categoryKey = 'bandeja-de-entrada') {
        const recurrence = task.recurrence || {};
        const guessedCategory = WEB_TO_STATE[categoryKey] || WEB_TO_STATE[task.category] || 'bandejaDeEntrada';
        const lastModified = task.lastModified || new Date().toISOString();
        return {
            id: task.id || task.taskId || (global.crypto?.randomUUID?.() || String(Date.now())),
            title: task.task || task.title || '',
            category: guessedCategory,
            tags: Array.isArray(task.tags) ? task.tags : [],
            description: task.description || '',
            reminder: task.reminderAt || task.reminder || null,
            completed: !!task.completed,
            reminderDone: !!task.reminderDone,
            archivedOn: task.archivedOn || null,
            lastModified,
            deletedOn: task.deletedOn || null,
            recurrenceType: recurrence.type || task.recurrenceType || 'none',
            recurrenceInterval: recurrence.interval || task.recurrenceInterval || 1
        };
    }

    function stateTaskToWebTask(task = {}) {
        const lastModified = task.lastModified || task.archivedOn || task.reminder || new Date().toISOString();
        return {
            id: task.id || (global.crypto?.randomUUID?.() || String(Date.now())),
            task: task.title || '',
            completed: !!task.completed,
            tags: Array.isArray(task.tags) ? task.tags : [],
            reminderAt: task.reminder || null,
            reminderDone: !!task.reminderDone,
            archivedOn: task.archivedOn || null,
            lastModified,
            deletedOn: task.deletedOn || null,
            recurrence: {
                type: task.recurrenceType || 'none',
                interval: task.recurrenceInterval != null ? task.recurrenceInterval : 1
            }
        };
    }

    function toStateSnapshot(webSnapshot = {}) {
        const categories = ensureCategoriesShape(webSnapshot.categories || {});
        const tasks = [];
        Object.entries(categories).forEach(([cat, list]) => {
            list.forEach(t => tasks.push(webTaskToStateTask(t, cat)));
        });
        const deleted = Array.isArray(webSnapshot.deletedTasks)
            ? webSnapshot.deletedTasks.map(t => webTaskToStateTask(t, t.category))
            : [];
        return { tasks, deletedTasks: deleted, lastSync: webSnapshot.lastSync || null };
    }

    function fromStateSnapshot(stateSnapshot = {}) {
        const categories = ensureCategoriesShape();
        const tasks = Array.isArray(stateSnapshot.tasks) ? stateSnapshot.tasks : [];
        tasks.forEach(t => {
            const cat = STATE_TO_WEB[t.category] || 'bandeja-de-entrada';
            categories[cat].push(stateTaskToWebTask(t));
        });
        const deletedTasks = Array.isArray(stateSnapshot.deletedTasks)
            ? stateSnapshot.deletedTasks.map(stateTaskToWebTask)
            : [];
        return { categories, deletedTasks, lastSync: stateSnapshot.lastSync || null };
    }

    function parseAnyPayload(raw) {
        if (!raw || typeof raw !== 'object') return null;
        if (Array.isArray(raw.tasks)) return fromStateSnapshot(raw);
        if (raw.categories) {
            return {
                categories: ensureCategoriesShape(raw.categories),
                deletedTasks: Array.isArray(raw.deletedTasks) ? raw.deletedTasks : [],
                lastSync: raw.lastSync || null
            };
        }
        const inferred = ensureCategoriesShape(raw);
        const hasContent = Object.values(inferred).some(arr => arr.length > 0);
        if (hasContent) {
            return {
                categories: inferred,
                deletedTasks: Array.isArray(raw.deletedTasks) ? raw.deletedTasks : [],
                lastSync: raw.lastSync || null
            };
        }
        return null;
    }

    global.DropboxCompat = {
        STATE_PATH,
        LEGACY_PATH,
        ensureCategoriesShape,
        webTaskToStateTask,
        stateTaskToWebTask,
        toStateSnapshot,
        fromStateSnapshot,
        parseAnyPayload
    };
})(window);
