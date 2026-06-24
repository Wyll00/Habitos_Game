import os
import secrets
from datetime import datetime, date, timedelta
import calendar
from flask import Flask, render_template, request, jsonify, redirect, url_for, session
from werkzeug.utils import secure_filename
from flask_sqlalchemy import SQLAlchemy
from dotenv import load_dotenv

# Carga el .env que está junto a este archivo (independiente del directorio actual)
load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), '.env'))

app = Flask(__name__)
basedir = os.path.abspath(os.path.dirname(__file__))

# Base de datos: si existe DATABASE_URL (Supabase/Postgres) la usa; si no, SQLite local.
database_url = os.environ.get('DATABASE_URL')
if database_url:
    # SQLAlchemy exige el prefijo 'postgresql://' (algunos paneles dan 'postgres://')
    if database_url.startswith('postgres://'):
        database_url = database_url.replace('postgres://', 'postgresql://', 1)
else:
    database_url = 'sqlite:///' + os.path.join(basedir, 'database.db')

app.config['SQLALCHEMY_DATABASE_URI'] = database_url
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Login: una sola contraseña para toda la app (variable de entorno APP_PASSWORD).
# SECRET_KEY firma la cookie de sesión; en producción ponla fija en el entorno.
app.secret_key = os.environ.get('SECRET_KEY', secrets.token_hex(32))
APP_PASSWORD = os.environ.get('APP_PASSWORD')
if not APP_PASSWORD:
    print('AVISO: APP_PASSWORD no está definida -> la app queda SIN login (abierta).')

UPLOAD_FOLDER = os.path.join(basedir, 'static', 'uploads')
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

db = SQLAlchemy(app)

# ================= MODELS =================
class Habit(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.String(200))
    streak = db.Column(db.Integer, default=0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class HabitLog(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    habit_id = db.Column(db.Integer, nullable=False)
    date = db.Column(db.Date, nullable=False)
    completed = db.Column(db.Boolean, default=False)

class Objective(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    timeframe = db.Column(db.String(50), nullable=False) # 'mensual', 'trimestral', 'semestral', 'anual'
    completed = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class Challenge(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    total_days = db.Column(db.Integer, nullable=False)
    current_streak = db.Column(db.Integer, default=0)
    is_active = db.Column(db.Boolean, default=True)
    last_checkin = db.Column(db.Date, nullable=True)

class DailyGoal(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    target_date = db.Column(db.Date, nullable=False, default=date.today)
    task = db.Column(db.String(200), nullable=False)
    completed = db.Column(db.Boolean, default=False)

class ManualEntry(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    category = db.Column(db.String(50), nullable=False)
    content = db.Column(db.Text, nullable=False)
    image_path = db.Column(db.String(200), nullable=True)
    date = db.Column(db.DateTime, default=datetime.utcnow)

class FoodItem(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(150), nullable=False)
    calories = db.Column(db.Float, nullable=False) # per 100g
    protein = db.Column(db.Float, nullable=False)
    carbs = db.Column(db.Float, nullable=False)
    fats = db.Column(db.Float, nullable=False)

class MealLog(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    food_id = db.Column(db.Integer, db.ForeignKey('food_item.id'), nullable=False)
    date = db.Column(db.Date, nullable=False, default=date.today)
    quantity = db.Column(db.Float, nullable=False) # in grams
    food = db.relationship('FoodItem', backref=db.backref('logs', lazy=True))

class UserProfile(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), default="Comandante")
    age = db.Column(db.Integer, default=25)
    weight = db.Column(db.Float, default=70.0)
    height = db.Column(db.Float, default=175.0)
    life_mission = db.Column(db.String(500), default="Conquistar la disciplina diaria.")
    profile_image = db.Column(db.String(200), nullable=True)
    xp = db.Column(db.Integer, default=0)
    
    # Nutrition Targets
    target_calories = db.Column(db.Integer, default=2500)
    target_protein = db.Column(db.Integer, default=160)
    target_carbs = db.Column(db.Integer, default=300)
    target_fats = db.Column(db.Integer, default=70)

def get_rank_info(xp):
    ranks = [
        (0, 100, "Recluta"),
        (101, 300, "Soldado"),
        (301, 600, "Cabo"),
        (601, 1000, "Sargento"),
        (1001, 2000, "Teniente"),
        (2001, 4000, "Capitán"),
        (4001, 7000, "Mayor"),
        (7001, 10000, "Coronel"),
        (10001, 999999, "General de 5 Estrellas")
    ]
    for min_xp, max_xp, name in ranks:
        if min_xp <= xp <= max_xp:
            progress = int(((xp - min_xp) / (max_xp - min_xp)) * 100) if max_xp != 999999 else 100
            return {"name": name, "progress": progress, "xp": xp, "max_xp": max_xp}
    return {"name": "General de 5 Estrellas", "progress": 100, "xp": xp, "max_xp": xp}

with app.app_context():
    db.create_all()

# ================= AUTENTICACIÓN =================
@app.context_processor
def inject_auth():
    # Disponible en todas las plantillas para mostrar/ocultar el botón de salir
    return {'login_enabled': bool(APP_PASSWORD)}

@app.before_request
def require_login():
    # Deja pasar siempre los estáticos y la propia página de login
    if request.endpoint in ('login', 'static'):
        return
    # Si no hay contraseña configurada, no se exige login (modo local)
    if not APP_PASSWORD:
        return
    if not session.get('authenticated'):
        return redirect(url_for('login'))

@app.route('/login', methods=['GET', 'POST'])
def login():
    if not APP_PASSWORD or session.get('authenticated'):
        return redirect(url_for('index'))
    error = None
    if request.method == 'POST':
        # compare_digest evita fugas de info por tiempo de comparación
        if secrets.compare_digest(request.form.get('password', ''), APP_PASSWORD):
            session['authenticated'] = True
            session.permanent = True
            return redirect(url_for('index'))
        error = 'Contraseña incorrecta.'
    return render_template('login.html', error=error)

@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('login'))

# ================= ROUTES =================
@app.route('/')
def index():
    today = date.today()
    
    # 3. PERFIL
    profile = UserProfile.query.first()
    if not profile:
        profile = UserProfile()
        db.session.add(profile)
        db.session.commit()
        
    rank_info = get_rank_info(profile.xp)

    # 4. BITÁCORA
    entries = ManualEntry.query.order_by(ManualEntry.date.desc()).limit(20).all()

    # 5. RETOS (Verificar penalizaciones Hardcore)
    challenges = Challenge.query.filter_by(is_active=True).all()
    for ch in challenges:
        if ch.last_checkin:
            days_passed = (today - ch.last_checkin).days
            if days_passed > 1:
                ch.current_streak = 0
                db.session.commit()

    return render_template('index.html', today=today, entries=entries, profile=profile, challenges=challenges, rank_info=rank_info)

# --- APIs Hábitos (Diarios) ---
@app.route('/api/habits/<date_str>', methods=['GET'])
def get_habits(date_str):
    target_date = datetime.strptime(date_str, '%Y-%m-%d').date()
    habits = Habit.query.all()
    res = []
    for h in habits:
        # Solo mostramos hábitos creados en o antes de esta fecha
        if h.created_at.date() <= target_date:
            log = HabitLog.query.filter_by(habit_id=h.id, date=target_date).first()
            is_completed = log.completed if log else False
            res.append({'id': h.id, 'name': h.name, 'description': h.description, 'streak': h.streak, 'completed': is_completed})
    return jsonify(res)

@app.route('/api/habit/new', methods=['POST'])
def new_habit():
    data = request.json
    h = Habit(name=data['name'], description=data.get('description', ''))
    db.session.add(h)
    db.session.commit()
    return jsonify({'success': True})

@app.route('/api/habit/toggle/<int:habit_id>/<date_str>', methods=['POST'])
def toggle_habit(habit_id, date_str):
    target_date = datetime.strptime(date_str, '%Y-%m-%d').date()
    h = Habit.query.get_or_404(habit_id)
    log = HabitLog.query.filter_by(habit_id=h.id, date=target_date).first()
    
    if not log:
        log = HabitLog(habit_id=h.id, date=target_date, completed=True)
        db.session.add(log)
    else:
        log.completed = not log.completed
        
    # Asignar XP y Racha
    profile = UserProfile.query.first()
    if target_date == date.today():
        if log.completed:
            h.streak += 1
            if profile: profile.xp += 10
        else:
            h.streak = max(0, h.streak - 1)
            if profile: profile.xp = max(0, profile.xp - 10)
    else:
        # Si marca días pasados también suma/resta
        if log.completed:
            if profile: profile.xp += 10
        else:
            if profile: profile.xp = max(0, profile.xp - 10)
            
    db.session.commit()
    
    rank_info = get_rank_info(profile.xp) if profile else None
    
    return jsonify({'success': True, 'completed': log.completed, 'streak': h.streak, 'new_xp': profile.xp if profile else 0, 'rank_info': rank_info})

# --- APIs Slider Semanal (Progreso Diario) ---
@app.route('/api/week_slider', methods=['GET'])
def get_week_slider():
    today = date.today()
    start_date = today - timedelta(days=3)
    
    days_data = []
    weekdays_es = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
    
    for i in range(7):
        current_date = start_date + timedelta(days=i)
        
        # Calcular progreso de Hábitos Diarios para esta fecha
        habits = [h for h in Habit.query.all() if h.created_at.date() <= current_date]
        total = len(habits)
        
        completed = 0
        if total > 0:
            logs = HabitLog.query.filter_by(date=current_date, completed=True).all()
            # Intersect logs with actual habits that existed
            valid_habit_ids = [h.id for h in habits]
            completed = sum(1 for log in logs if log.habit_id in valid_habit_ids)
            
        progress = int((completed / total) * 100) if total > 0 else 0
        
        days_data.append({
            'date': current_date.strftime('%Y-%m-%d'),
            'day_name': weekdays_es[current_date.weekday()],
            'day_number': current_date.day,
            'progress': progress,
            'has_goals': total > 0
        })
        
    return jsonify(days_data)

# --- APIs Objetivos a Largo Plazo ---
@app.route('/api/objectives', methods=['GET'])
def get_objectives():
    objs = Objective.query.all()
    res = {
        'mensual': [],
        'trimestral': [],
        'semestral': [],
        'anual': []
    }
    for o in objs:
        if o.timeframe in res:
            res[o.timeframe].append({'id': o.id, 'title': o.title, 'completed': o.completed})
    return jsonify(res)

@app.route('/api/objective/new', methods=['POST'])
def new_objective():
    data = request.json
    obj = Objective(title=data['title'], timeframe=data['timeframe'])
    db.session.add(obj)
    db.session.commit()
    return jsonify({'success': True})

@app.route('/api/objective/toggle/<int:obj_id>', methods=['POST'])
def toggle_objective(obj_id):
    obj = Objective.query.get_or_404(obj_id)
    obj.completed = not obj.completed
    
    profile = UserProfile.query.first()
    if obj.completed:
        if profile: profile.xp += 50
    else:
        if profile: profile.xp = max(0, profile.xp - 50)
        
    db.session.commit()
    
    rank_info = get_rank_info(profile.xp) if profile else None
    return jsonify({'success': True, 'completed': obj.completed, 'new_xp': profile.xp if profile else 0, 'rank_info': rank_info})

# --- APIs Bitácora ---
@app.route('/entry/new', methods=['POST'])
def new_entry():
    category = request.form.get('category')
    title = request.form.get('title')
    image_filename = None
    if 'image' in request.files:
        file = request.files['image']
        if file and file.filename != '':
            filename = f"{int(datetime.now().timestamp())}_{secure_filename(file.filename)}"
            file.save(os.path.join(app.config['UPLOAD_FOLDER'], filename))
            image_filename = filename
            
    if category:
        # Note: the model has no title, just content and category
        db.session.add(ManualEntry(category=category, content=request.form.get('content'), image_path=image_filename))
        db.session.commit()
        return jsonify({'success': True})
    return jsonify({'success': False}), 400

# --- APIs Perfil ---
@app.route('/api/profile/update', methods=['POST'])
def update_profile():
    profile = UserProfile.query.first()
    if not profile:
        profile = UserProfile()
        db.session.add(profile)
    profile.name = request.form.get('name', profile.name)
    try:
        profile.age = int(request.form.get('age', profile.age))
        profile.weight = float(request.form.get('weight', profile.weight))
        profile.height = float(request.form.get('height', profile.height))
    except (ValueError, TypeError): pass
    profile.life_mission = request.form.get('life_mission', profile.life_mission)
    
    if 'profile_image' in request.files:
        file = request.files['profile_image']
        if file and file.filename != '':
            filename = f"profile_{int(datetime.now().timestamp())}_{secure_filename(file.filename)}"
            file.save(os.path.join(app.config['UPLOAD_FOLDER'], filename))
            profile.profile_image = filename
    db.session.commit()
    return jsonify({'success': True})

# --- APIs Retos ---
@app.route('/api/challenge/new', methods=['POST'])
def new_challenge():
    data = request.get_json()
    title = data.get('title')
    total_days = data.get('total_days')
    if title and total_days:
        try:
            total_days = int(total_days)
            db.session.add(Challenge(name=title, total_days=total_days))
            db.session.commit()
            return jsonify({'success': True})
        except ValueError:
            pass
    return jsonify({'success': False}), 400

@app.route('/api/challenge/checkin/<int:challenge_id>', methods=['POST'])
def checkin_challenge(challenge_id):
    today = date.today()
    ch = Challenge.query.get_or_404(challenge_id)
    
    if ch.last_checkin == today:
        return jsonify({'success': False, 'message': 'Ya hiciste check-in hoy'})
        
    ch.last_checkin = today
    ch.current_streak += 1
    
    if ch.current_streak >= ch.total_days:
        ch.is_active = False # Completado exitosamente
        
    profile = UserProfile.query.first()
    if profile: profile.xp += 20
        
    db.session.commit()
    
    rank_info = get_rank_info(profile.xp) if profile else None
    
    return jsonify({'success': True, 'streak': ch.current_streak, 'completed': not ch.is_active, 'new_xp': profile.xp if profile else 0, 'rank_info': rank_info})

# --- APIs Estadísticas ---
@app.route('/api/stats', methods=['GET'])
def get_stats():
    # 1. Bitácora (Categorías)
    categories_data = db.session.query(ManualEntry.category, db.func.count(ManualEntry.id)).group_by(ManualEntry.category).all()
    journal_labels = [c[0] for c in categories_data]
    journal_counts = [c[1] for c in categories_data]

    # 2. Almanaque -> Ahora es Objetivos
    total_goals = Objective.query.count()
    completed_goals = Objective.query.filter_by(completed=True).count()

    # 3. Hábitos (Mejor racha)
    best_habit = Habit.query.order_by(Habit.streak.desc()).first()
    best_streak = best_habit.streak if best_habit else 0

    # 4. Retos (Progreso general)
    active_challenges = Challenge.query.filter_by(is_active=True).count()
    completed_challenges = Challenge.query.filter_by(is_active=False).count()

    return jsonify({
        'journal': {'labels': journal_labels, 'data': journal_counts},
        'almanac': {'total': total_goals, 'completed': completed_goals},
        'habits': {'best_streak': best_streak},
        'challenges': {'active': active_challenges, 'completed': completed_challenges}
    })

# --- APIs Almanaque (Calendario Mensual) ---
@app.route('/api/almanac/month/<int:year>/<int:month>', methods=['GET'])
def get_almanac_month(year, month):
    # Obtener el número de días del mes
    _, num_days = calendar.monthrange(year, month)
    
    days_data = []
    
    for day in range(1, num_days + 1):
        current_date = date(year, month, day)
        
        # Calcular progreso de Hábitos Diarios para esta fecha
        habits = [h for h in Habit.query.all() if h.created_at.date() <= current_date]
        total = len(habits)
        
        completed = 0
        if total > 0:
            logs = HabitLog.query.filter_by(date=current_date, completed=True).all()
            valid_habit_ids = [h.id for h in habits]
            completed = sum(1 for log in logs if log.habit_id in valid_habit_ids)
            
        progress = int((completed / total) * 100) if total > 0 else 0
        
        days_data.append({
            'date': current_date.strftime('%Y-%m-%d'),
            'day': day,
            'progress': progress,
            'has_habits': total > 0
        })
        
    return jsonify(days_data)

# --- APIs Nutrición (Suministros) ---
@app.route('/api/food', methods=['GET'])
def get_foods():
    foods = FoodItem.query.all()
    return jsonify([{'id': f.id, 'name': f.name, 'calories': f.calories, 'protein': f.protein, 'carbs': f.carbs, 'fats': f.fats} for f in foods])

@app.route('/api/food/new', methods=['POST'])
def add_food():
    data = request.json
    try:
        f = FoodItem(name=data['name'], calories=float(data['calories']), protein=float(data['protein']), carbs=float(data['carbs']), fats=float(data['fats']))
        db.session.add(f)
        db.session.commit()
        return jsonify({'success': True, 'id': f.id})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 400

@app.route('/api/meals/<date_str>', methods=['GET'])
def get_meals(date_str):
    target_date = datetime.strptime(date_str, '%Y-%m-%d').date()
    logs = MealLog.query.filter_by(date=target_date).all()
    
    meals_data = []
    total_cal, total_pro, total_carb, total_fat = 0, 0, 0, 0
    
    for log in logs:
        # Calculate macros based on quantity (food macros are per 100g)
        factor = log.quantity / 100.0
        cal = log.food.calories * factor
        pro = log.food.protein * factor
        carb = log.food.carbs * factor
        fat = log.food.fats * factor
        
        total_cal += cal
        total_pro += pro
        total_carb += carb
        total_fat += fat
        
        meals_data.append({
            'id': log.id,
            'food_name': log.food.name,
            'quantity': log.quantity,
            'calories': round(cal, 1),
            'protein': round(pro, 1),
            'carbs': round(carb, 1),
            'fats': round(fat, 1)
        })
        
    profile = UserProfile.query.first()
    targets = {
        'calories': profile.target_calories if profile else 2500,
        'protein': profile.target_protein if profile else 160,
        'carbs': profile.target_carbs if profile else 300,
        'fats': profile.target_fats if profile else 70
    }
        
    return jsonify({
        'meals': meals_data,
        'totals': {
            'calories': round(total_cal, 1),
            'protein': round(total_pro, 1),
            'carbs': round(total_carb, 1),
            'fats': round(total_fat, 1)
        },
        'targets': targets
    })

@app.route('/api/meal/new', methods=['POST'])
def add_meal():
    data = request.json
    try:
        target_date = datetime.strptime(data['date'], '%Y-%m-%d').date()
        m = MealLog(food_id=int(data['food_id']), quantity=float(data['quantity']), date=target_date)
        db.session.add(m)
        db.session.commit()
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 400

@app.route('/api/meal/<int:meal_id>', methods=['DELETE'])
def delete_meal(meal_id):
    m = MealLog.query.get_or_404(meal_id)
    db.session.delete(m)
    db.session.commit()
    return jsonify({'success': True})

@app.route('/api/meal/<int:meal_id>', methods=['PUT'])
def edit_meal(meal_id):
    m = MealLog.query.get_or_404(meal_id)
    data = request.json
    try:
        m.quantity = float(data['quantity'])
        db.session.commit()
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 400

if __name__ == '__main__':
    debug = os.environ.get('FLASK_DEBUG', 'true').lower() == 'true'
    port = int(os.environ.get('PORT', 5000))
    app.run(debug=debug, host='0.0.0.0', port=port)
