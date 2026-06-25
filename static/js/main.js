// Notificaciones con SweetAlert2 (estilo Códice)
const Toast = Swal.mixin({
    toast: true,
    position: 'bottom-end',
    showConfirmButton: false,
    timer: 2800,
    timerProgressBar: true,
    background: '#1e1e1e',
    color: '#e0e0e0',
    iconColor: '#d4af37',
});
// Mantiene la API notyf.success() / notyf.error() usada en todo el código
const notyf = {
    success: (msg) => Toast.fire({ icon: 'success', title: msg }),
    error: (msg) => Toast.fire({ icon: 'error', title: msg }),
};

// Ventanita de confirmación centrada (para borrar). Devuelve true/false.
async function confirmDialog(title, text) {
    const r = await Swal.fire({
        title: title,
        text: text,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#722f37',
        cancelButtonColor: '#555',
        background: '#1e1e1e',
        color: '#e0e0e0',
        reverseButtons: true,
    });
    return r.isConfirmed;
}

// Tabs navigation
function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    document.getElementById(`${tabId}-section`).classList.add('active');
    if (event && event.currentTarget) {
        event.currentTarget.classList.add('active');
    } else {
        const btn = document.querySelector(`.nav-btn[onclick="switchTab('${tabId}')"]`);
        if(btn) btn.classList.add('active');
    }
    
    // Si se abre la pestaña de estadísticas, cargar los datos
    if (tabId === 'stats') {
        loadStatistics();
    }
    if (tabId === 'objectives') {
        loadObjectives();
    }
    if (tabId === 'almanac') {
        renderAlmanacMonth();
    }
    if (tabId === 'nutrition') {
        const todayStr = new Date().toISOString().split('T')[0];
        document.getElementById('nutrition-date-picker').value = todayStr;
        loadFoodList();
        loadNutritionForDate();
    }
}

function switchObjTab(period) {
    const tabs = ['mensual', 'trimestral', 'semestral', 'anual'];
    tabs.forEach(t => {
        document.getElementById(`obj-${t}-tab`).style.display = 'none';
        const btn = document.getElementById(`btn-obj-${t}`);
        if(btn) {
            btn.style.background = 'transparent';
            btn.style.borderColor = 'var(--border-color)';
            btn.style.color = 'var(--text-main)';
        }
    });
    document.getElementById(`obj-${period}-tab`).style.display = 'block';
    const activeBtn = document.getElementById(`btn-obj-${period}`);
    if(activeBtn) {
        activeBtn.style.background = 'var(--accent-burgundy)';
        activeBtn.style.borderColor = 'var(--accent-burgundy)';
        activeBtn.style.color = '#fff';
    }
}

// Modals management
function openModal(modalId) {
    const modal = document.getElementById(modalId);
    modal.style.display = 'flex';
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    modal.style.display = 'none';
}

window.onclick = function(event) {
    if (event.target.classList.contains('modal')) {
        event.target.style.display = 'none';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // Load Night Mode setting
    const isNight = localStorage.getItem('nightMode') === 'true';
    if(isNight) {
        document.body.classList.add('night-mode');
        const btn = document.getElementById('night-mode-toggle');
        if(btn) {
            btn.innerHTML = '<i data-lucide="sun"></i> Visión Diurna';
            btn.style.color = 'var(--text-main)';
            btn.style.borderColor = 'var(--text-main)';
        }
    }
});

// Night Mode Toggle
function toggleNightMode() {
    document.body.classList.toggle('night-mode');
    const isNight = document.body.classList.contains('night-mode');
    localStorage.setItem('nightMode', isNight);
    
    const btn = document.getElementById('night-mode-toggle');
    if(btn) {
        if(isNight) {
            btn.innerHTML = '<i data-lucide="sun"></i> Visión Diurna';
            btn.style.color = 'var(--text-main)';
            btn.style.borderColor = 'var(--text-main)';
        } else {
            btn.innerHTML = '<i data-lucide="moon"></i> Visión Nocturna';
            btn.style.color = 'var(--text-muted)';
            btn.style.borderColor = 'var(--border-color)';
        }
        lucide.createIcons();
    }
}

// Actualizar el nombre del archivo seleccionado (Bitácora)
document.getElementById('entry-image')?.addEventListener('change', function(e) {
    const fileName = e.target.files[0]?.name;
    if (fileName) {
        document.querySelector('.file-label').innerHTML = `<i data-lucide="check" class="icon"></i> Archivo: ${fileName}`;
        lucide.createIcons();
    }
});

// Actualizar el nombre del archivo seleccionado (Perfil)
document.getElementById('profile_image')?.addEventListener('change', function(e) {
    const fileName = e.target.files[0]?.name;
    if (fileName) {
        document.getElementById('profile-img-label').innerHTML = `<i data-lucide="check" class="icon"></i> Archivo: ${fileName}`;
        lucide.createIcons();
    }
});

// Old toggleHabit removed. It is replaced by the date-specific one below.

// Submit new habit dynamically
async function submitHabit(event) {
    event.preventDefault();
    const nameInput = document.getElementById('habit-name');
    const descInput = document.getElementById('habit-desc');
    const days = Array.from(document.querySelectorAll('.habit-day-cb:checked')).map(cb => cb.value).join(',');

    try {
        const response = await fetch('/api/habit/new', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: nameInput.value,
                description: descInput.value,
                days: days
            })
        });

        if (response.ok) {
            notyf.success('Hábito creado.');
            closeModal('habit-modal');
            nameInput.value = '';
            descInput.value = '';
            document.querySelectorAll('.habit-day-cb').forEach(cb => cb.checked = true);
            const currentDate = document.getElementById('calendar-date').value;
            loadHabitsForDate(currentDate);
            loadWeekSlider();
        } else {
            notyf.error('Error al crear hábito');
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

// Submit new entry dynamically
async function submitEntry(event) {
    event.preventDefault();
    const form = document.getElementById('new-entry-form');
    const formData = new FormData(form);
    
    try {
        const response = await fetch('/entry/new', {
            method: 'POST',
            body: formData
        });

        if (response.ok) {
            notyf.success('Entrada guardada en la bitácora.');
            setTimeout(() => window.location.reload(), 1000);
        } else {
            notyf.error('Error al guardar la entrada.');
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

// Submit user profile update
async function updateProfile(event) {
    event.preventDefault();
    
    const form = document.getElementById('profile-form');
    const formData = new FormData();
    
    formData.append('name', document.getElementById('prof-name').value);
    formData.append('age', document.getElementById('prof-age').value);
    formData.append('weight', document.getElementById('prof-weight').value);
    formData.append('height', document.getElementById('prof-height').value);
    formData.append('goal', document.getElementById('prof-goal').value);
    
    const fileInput = document.getElementById('profile_image');
    if (fileInput.files.length > 0) {
        formData.append('profile_image', fileInput.files[0]);
    }
    
    try {
        const response = await fetch('/api/profile/update', {
            method: 'POST',
            body: formData
        });

        if (response.ok) {
            notyf.success("Perfil actualizado con éxito.");
            setTimeout(() => window.location.reload(), 1000);
        } else {
            notyf.error('Error al actualizar perfil');
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

// ================= HÁBITOS DIARIOS (Slider) =================
document.addEventListener('DOMContentLoaded', () => {
    // Si estamos en la app, cargamos el slider de la semana en la vista de hábitos
    const sliderContainer = document.getElementById('week-slider-container');
    if (sliderContainer) {
        loadWeekSlider();
        loadHabitsForDate(document.getElementById('calendar-date').value);
    }
});

async function loadWeekSlider() {
    const container = document.getElementById('week-slider-container');
    if (!container) return;
    
    try {
        const res = await fetch('/api/almanac/week');
        const days = await res.json();
        
        const currentDate = document.getElementById('calendar-date').value;
        
        let html = '<div class="week-slider">';
        days.forEach(day => {
            const isSelected = day.date === currentDate ? 'selected' : '';
            // Crear mini grafico circular usando conic-gradient
            const conicBg = `conic-gradient(var(--accent-gold) ${day.progress}%, transparent 0)`;
            
            html += `
            <div class="day-card ${isSelected}" onclick="selectDate('${day.date}')">
                <span class="day-name">${day.day_name}</span>
                <span class="day-number">${day.day_number}</span>
                <div class="mini-progress" style="background: ${conicBg}; border-radius: 50%;">
                    <div style="background: var(--card-bg); width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.8rem;">
                        ${day.progress}%
                    </div>
                </div>
            </div>`;
        });
        html += '</div>';
        
        container.innerHTML = html;
    } catch (e) {
        console.error("Error al cargar slider semanal", e);
    }
}

function selectDate(dateStr) {
    document.getElementById('calendar-date').value = dateStr;
    loadWeekSlider(); // Recargar para aplicar clase 'selected'
    loadHabitsForDate(dateStr);
}

const DAY_LETTERS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
function daysLabel(daysStr) {
    if (!daysStr) return '';
    const arr = daysStr.split(',').filter(x => x !== '');
    if (arr.length === 7) return ''; // todos los días -> no mostrar etiqueta
    return arr.map(d => DAY_LETTERS[parseInt(d)]).join('·');
}

async function deleteHabit(id, dateStr) {
    if (!(await confirmDialog('¿Eliminar esta tarea?', 'Se borrará para todos los días, junto con su historial.'))) return;
    try {
        const res = await fetch(`/api/habit/${id}`, { method: 'DELETE' });
        if (res.ok) {
            notyf.success('Tarea eliminada');
            loadHabitsForDate(dateStr);
            loadWeekSlider();
        } else {
            notyf.error('No se pudo eliminar');
        }
    } catch (e) {
        notyf.error('Error al eliminar');
    }
}

async function loadHabitsForDate(dateStr) {
    const list = document.getElementById('habits-list');
    if (!list) return;

    list.innerHTML = '<div style="text-align: center; opacity: 0.5;">Cargando...</div>';

    try {
        const res = await fetch(`/api/habits/${dateStr}`);
        const habits = await res.json();
        
        list.innerHTML = '';
        if (habits.length === 0) {
            list.innerHTML = `
            <div class="empty-state">
                <i data-lucide="target" style="width: 40px; height: 40px; margin-bottom: 1rem; opacity: 0.5;"></i>
                <p>No hay tareas o hábitos asignados para esta fecha.</p>
            </div>`;
        } else {
            habits.forEach(h => {
                const checkedIcon = h.completed ? 'check-circle-2' : '';
                const completedClass = h.completed ? 'completed' : '';
                const emptyCircle = h.completed ? '' : '<span class="empty-circle"></span>';
                const checkHTML = h.completed ? `<i data-lucide="${checkedIcon}" class="icon-check" style="color: var(--accent-gold);"></i>` : emptyCircle;
                const dl = daysLabel(h.days);
                const daysHTML = dl ? `<span class="habit-days">${dl}</span>` : '';

                list.innerHTML += `
                <div class="habit-card ${completedClass}" data-habit-id="${h.id}">
                    <div class="habit-content">
                        <h3 class="habit-name">${h.name} ${daysHTML}</h3>
                        <p class="habit-desc">${h.description}</p>
                    </div>
                    <div class="habit-actions">
                        <div class="streak-counter">
                            <i data-lucide="flame"></i> ${h.streak}
                        </div>
                        <button class="toggle-btn" onclick="toggleHabit(${h.id}, '${dateStr}')">
                            ${checkHTML}
                        </button>
                        <button class="delete-btn" title="Eliminar tarea" onclick="deleteHabit(${h.id}, '${dateStr}')">
                            <i data-lucide="trash-2"></i>
                        </button>
                    </div>
                </div>`;
            });
        }
        lucide.createIcons();
    } catch (e) {
        notyf.error("Error al cargar tareas");
    }
}

async function toggleHabit(id, dateStr) {
    try {
        const res = await fetch(`/api/habit/toggle/${id}/${dateStr}`, { method: 'POST' });
        if (res.ok) {
            const data = await res.json();
            if (data.completed) notyf.success('Hábito completado');
            if (data.rank_info) updateRankUI(data.rank_info);
            loadHabitsForDate(dateStr);
            loadWeekSlider();
        }
    } catch (e) {
        notyf.error('Error de conexión');
    }
}

// ================= OBJETIVOS =================
function openObjModal(timeframe) {
    document.getElementById('obj-timeframe').value = timeframe;
    openModal('obj-modal');
}

async function loadObjectives() {
    try {
        const res = await fetch('/api/objectives');
        const data = await res.json();
        
        ['mensual', 'trimestral', 'semestral', 'anual'].forEach(tf => {
            const list = document.getElementById(`obj-${tf}-list`);
            if (!list) return;
            
            if (data[tf].length === 0) {
                list.innerHTML = `<p style="color: var(--text-muted); font-size: 0.85rem; font-style: italic;">Sin objetivos definidos.</p>`;
            } else {
                list.innerHTML = data[tf].map(obj => `
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.5rem 0; border-bottom: 1px dashed rgba(255,255,255,0.05);">
                        <span style="${obj.completed ? 'text-decoration: line-through; color: var(--text-muted);' : ''}">${obj.title}</span>
                        <input type="checkbox" ${obj.completed ? 'checked' : ''} onchange="toggleObjective(${obj.id})">
                    </div>
                `).join('');
            }
        });
    } catch (e) { console.error(e); }
}

async function toggleObjective(id) {
    try {
        const res = await fetch(`/api/objective/toggle/${id}`, { method: 'POST' });
        if (res.ok) {
            const data = await res.json();
            if (data.rank_info) updateRankUI(data.rank_info);
            loadObjectives();
        }
    } catch (e) {}
}

async function submitObjective(event) {
    event.preventDefault();
    const title = document.getElementById('obj-title').value;
    const timeframe = document.getElementById('obj-timeframe').value;
    try {
        const res = await fetch('/api/objective/new', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, timeframe })
        });
        if (res.ok) {
            notyf.success('Objetivo añadido');
            closeModal('obj-modal');
            document.getElementById('obj-title').value = '';
            loadObjectives();
        }
    } catch (e) {}
}

// ================= RETOS =================
async function submitChallenge(event) {
    event.preventDefault();
    const title = document.getElementById('challenge-title').value;
    const total_days = document.getElementById('challenge-days').value;
    
    try {
        const response = await fetch('/api/challenge/new', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, total_days })
        });
        if (response.ok) {
            notyf.success('Reto iniciado. ¡No falles!');
            setTimeout(() => window.location.reload(), 1000);
        } else {
            notyf.error('Error al iniciar el reto');
        }
    } catch (e) {
        notyf.error('Error de red');
    }
}

async function checkinChallenge(challengeId) {
    try {
        const response = await fetch(`/api/challenge/checkin/${challengeId}`, { method: 'POST' });
        const data = await response.json();
        
        if (response.ok && data.success) {
            if (data.rank_info) updateRankUI(data.rank_info);
            if (data.completed) {
                notyf.success('¡RETO COMPLETADO! Eres un comandante legendario.');
            } else {
                notyf.success('Check-in registrado. Racha protegida.');
            }
            setTimeout(() => window.location.reload(), 1500);
        } else {
            notyf.error(data.message || 'Error al hacer check-in');
        }
    } catch (e) {
        notyf.error('Error al conectar');
    }
}

// ================= ESTADÍSTICAS =================
let journalChartInstance = null;

async function loadStatistics() {
    try {
        const res = await fetch('/api/stats');
        const data = await res.json();
        
        // Actualizar KPIs
        document.getElementById('stat-best-streak').textContent = data.habits.best_streak;
        document.getElementById('stat-almanac').textContent = `${data.almanac.completed} / ${data.almanac.total}`;
        document.getElementById('stat-challenges').textContent = `${data.challenges.active} / ${data.challenges.completed}`;
        
        // Renderizar Gráfico de Bitácora (Chart.js)
        const ctx = document.getElementById('journalChart').getContext('2d');
        
        if (journalChartInstance) {
            journalChartInstance.destroy();
        }
        
        // Colores Dark Academia
        const bgColors = [
            'rgba(212, 175, 55, 0.7)', // Dorado
            'rgba(114, 47, 55, 0.7)',  // Burdeos
            'rgba(63, 89, 65, 0.7)',   // Verde Oscuro
            'rgba(100, 100, 100, 0.7)',// Gris
            'rgba(255, 255, 255, 0.2)' // Blanco translúcido
        ];
        
        const borderColors = [
            'rgba(212, 175, 55, 1)',
            'rgba(114, 47, 55, 1)',
            'rgba(63, 89, 65, 1)',
            'rgba(100, 100, 100, 1)',
            'rgba(255, 255, 255, 0.5)'
        ];

        journalChartInstance = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: data.journal.labels.length > 0 ? data.journal.labels : ['Sin Entradas'],
                datasets: [{
                    data: data.journal.data.length > 0 ? data.journal.data : [1],
                    backgroundColor: data.journal.labels.length > 0 ? bgColors : ['rgba(255,255,255,0.05)'],
                    borderColor: data.journal.labels.length > 0 ? borderColors : ['rgba(255,255,255,0.1)'],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { color: '#e0e0e0', font: { family: 'Inter' } }
                    }
                }
            }
        });
        
    } catch (e) {
        console.error("Error cargando estadísticas", e);
        notyf.error("No se pudieron cargar las estadísticas");
    }
}

// ================= ALMANAQUE MENSUAL =================
let currentAlmanacDate = new Date();

function prevAlmanacMonth() {
    currentAlmanacDate.setMonth(currentAlmanacDate.getMonth() - 1);
    renderAlmanacMonth();
}

function nextAlmanacMonth() {
    currentAlmanacDate.setMonth(currentAlmanacDate.getMonth() + 1);
    renderAlmanacMonth();
}

async function renderAlmanacMonth() {
    const year = currentAlmanacDate.getFullYear();
    const month = currentAlmanacDate.getMonth() + 1; // 1-12
    const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
    
    document.getElementById('almanac-month-title').textContent = `${monthNames[month - 1]} ${year}`;
    
    const grid = document.getElementById('almanac-grid');
    grid.innerHTML = '<div style="grid-column: span 7; text-align: center; padding: 2rem;">Cargando...</div>';
    
    try {
        const res = await fetch(`/api/almanac/month/${year}/${month}`);
        const daysData = await res.json();
        
        grid.innerHTML = '';
        
        // Render headers
        const daysOfWeek = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
        daysOfWeek.forEach(d => {
            grid.innerHTML += `<div class="calendar-day-header">${d}</div>`;
        });
        
        // Get first day of month
        const firstDay = new Date(year, month - 1, 1).getDay();
        const emptyCells = firstDay === 0 ? 6 : firstDay - 1; // Adjust for Monday start
        
        for (let i = 0; i < emptyCells; i++) {
            grid.innerHTML += `<div class="calendar-day empty"></div>`;
        }
        
        const today = new Date();
        const isCurrentMonth = (today.getFullYear() === year && today.getMonth() + 1 === month);
        
        daysData.forEach(d => {
            let color = 'var(--text-muted)';
            let progText = '-';
            let goldClass = '';
            
            if (d.has_habits) {
                progText = `${d.progress}%`;
                if (d.progress === 100) {
                    color = 'var(--accent-gold)';
                    goldClass = 'gold';
                } else if (d.progress > 0) {
                    color = '#fff';
                }
            }
            
            let todayBadge = '';
            let todayClass = '';
            if (isCurrentMonth && d.day === today.getDate()) {
                todayClass = 'is-today';
                todayBadge = '<div class="today-badge">HOY</div>';
                // Si no tiene 100%, quitar el oro para que no choque con el azul de HOY
                if(d.progress !== 100) goldClass = '';
            }
            
            grid.innerHTML += `
            <div class="calendar-day ${goldClass} ${todayClass}">
                ${todayBadge}
                <div class="calendar-day-num">${d.day}</div>
                <div class="calendar-day-prog" style="color: ${color}">${progText}</div>
            </div>`;
        });
        
    } catch (e) {
        grid.innerHTML = '<div style="grid-column: span 7; text-align: center;">Error al cargar</div>';
    }
}

function updateRankUI(rankInfo) {
    const nameEl = document.getElementById('sidebar-rank-name');
    const xpEl = document.getElementById('sidebar-xp-current');
    const maxEl = document.getElementById('sidebar-xp-max');
    const fillEl = document.getElementById('sidebar-xp-fill');
    
    if (nameEl) nameEl.innerHTML = `<i data-lucide="star"></i> ${rankInfo.name}`;
    if (xpEl) xpEl.textContent = rankInfo.xp;
    if (maxEl) maxEl.textContent = rankInfo.max_xp;
    if (fillEl) fillEl.style.width = `${rankInfo.progress}%`;
    
    lucide.createIcons();
}


// ================= NUTRICIÓN =================
async function loadFoodList() {
    try {
        const res = await fetch('/api/food');
        const foods = await res.json();
        const select = document.getElementById('food-select');
        select.innerHTML = '<option value="">Selecciona un alimento...</option>';
        foods.forEach(f => {
            const isUnit = f.name.toLowerCase().includes('unidad');
            const unitText = isUnit ? 'kcal/unidad' : 'kcal/100g';
            select.innerHTML += `<option value="${f.id}" data-is-unit="${isUnit}">${f.name} (${f.calories} ${unitText})</option>`;
        });
        
        select.addEventListener('change', (e) => {
            const option = select.options[select.selectedIndex];
            const qtyInput = document.getElementById('meal-quantity');
            if (option && option.getAttribute('data-is-unit') === 'true') {
                qtyInput.placeholder = 'Unidades';
            } else {
                qtyInput.placeholder = 'Gramos (g)';
            }
        });
    } catch(e) { console.error(e); }
}

async function submitNewFood(event) {
    event.preventDefault();
    const data = {
        name: document.getElementById('new-food-name').value,
        calories: document.getElementById('new-food-cal').value,
        protein: document.getElementById('new-food-pro').value,
        carbs: document.getElementById('new-food-carb').value,
        fats: document.getElementById('new-food-fat').value
    };
    try {
        const res = await fetch('/api/food/new', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(data)
        });
        if (res.ok) {
            notyf.success("Alimento guardado");
            closeModal('new-food-modal');
            loadFoodList();
        }
    } catch(e) { notyf.error("Error al guardar alimento"); }
}

async function submitMeal() {
    const foodId = document.getElementById('food-select').value;
    const quantity = document.getElementById('meal-quantity').value;
    const date = document.getElementById('nutrition-date-picker').value;
    
    if(!foodId || !quantity || !date) {
        notyf.error("Rellena todos los campos");
        return;
    }
    
    try {
        const res = await fetch('/api/meal/new', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({food_id: foodId, quantity: quantity, date: date})
        });
        if(res.ok) {
            notyf.success("Ración añadida");
            document.getElementById('meal-quantity').value = '';
            loadNutritionForDate();
        }
    } catch(e) { notyf.error("Error al añadir ración"); }
}

async function deleteMeal(mealId) {
    if(!(await confirmDialog('¿Eliminar esta ración?', 'Se quitará de tu registro del día.'))) return;
    try {
        const res = await fetch(`/api/meal/${mealId}`, { method: 'DELETE' });
        if(res.ok) {
            notyf.success("Ración eliminada");
            loadNutritionForDate();
        }
    } catch(e) { notyf.error("Error al eliminar ración"); }
}

async function loadNutritionForDate() {
    const dateStr = document.getElementById('nutrition-date-picker').value;
    if(!dateStr) return;
    
    try {
        const res = await fetch(`/api/meals/${dateStr}`);
        const data = await res.json();
        
        // Update HUD
        const t = data.totals;
        const tgt = data.targets;
        
        document.getElementById('nut-cal-current').textContent = t.calories;
        document.getElementById('nut-pro-current').textContent = t.protein;
        document.getElementById('nut-carb-current').textContent = t.carbs;
        document.getElementById('nut-fat-current').textContent = t.fats;
        
        document.getElementById('nut-cal-max').textContent = tgt.calories;
        document.getElementById('nut-pro-max').textContent = tgt.protein;
        document.getElementById('nut-carb-max').textContent = tgt.carbs;
        document.getElementById('nut-fat-max').textContent = tgt.fats;
        
        document.getElementById('nut-cal-fill').style.width = `${Math.min(100, (t.calories/tgt.calories)*100)}%`;
        document.getElementById('nut-pro-fill').style.width = `${Math.min(100, (t.protein/tgt.protein)*100)}%`;
        document.getElementById('nut-carb-fill').style.width = `${Math.min(100, (t.carbs/tgt.carbs)*100)}%`;
        document.getElementById('nut-fat-fill').style.width = `${Math.min(100, (t.fats/tgt.fats)*100)}%`;
        
        // Update List
        const list = document.getElementById('meals-list');
        list.innerHTML = '';
        if(data.meals.length === 0) {
            list.innerHTML = '<div class="empty-state">No hay raciones registradas hoy.</div>';
        } else {
            data.meals.forEach(m => {
                list.innerHTML += `
                <div class="meal-log-item">
                    <div class="meal-log-info">
                        <h4>${m.food_name} <span style="color:var(--accent-gold); font-size:0.9rem;">(${m.quantity}g)</span></h4>
                        <div class="meal-log-macros">
                            ${m.calories} kcal | Pro: ${m.protein}g | Car: ${m.carbs}g | Gra: ${m.fats}g
                        </div>
                    </div>
                    <div style="display:flex; gap:0.5rem;">
                        <button class="btn-primary" style="background:transparent; color:#3498db; border-color:#3498db; padding:0.5rem;" onclick="editMeal(${m.id}, ${m.quantity})">
                            <i data-lucide="edit-2"></i>
                        </button>
                        <button class="btn-primary" style="background:transparent; color:#e74c3c; border-color:#e74c3c; padding:0.5rem;" onclick="deleteMeal(${m.id})">
                            <i data-lucide="trash-2"></i>
                        </button>
                    </div>
                </div>`;
            });
            lucide.createIcons();
        }
    } catch(e) { console.error(e); }
}

async function editMeal(mealId, currentQuantity) {
    document.getElementById('edit-meal-id').value = mealId;
    document.getElementById('edit-meal-quantity').value = currentQuantity;
    openModal('edit-meal-modal');
}

async function submitEditMeal(event) {
    event.preventDefault();
    const mealId = document.getElementById('edit-meal-id').value;
    const newVal = document.getElementById('edit-meal-quantity').value;
    
    try {
        const res = await fetch(`/api/meal/${mealId}`, {
            method: 'PUT',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({quantity: newVal})
        });
        if(res.ok) {
            notyf.success("Ración actualizada");
            closeModal('edit-meal-modal');
            loadNutritionForDate();
        }
    } catch(e) { notyf.error("Error al actualizar ración"); }
}
