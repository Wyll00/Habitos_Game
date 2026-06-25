"""
Convierte los datos existentes (de la app de un solo usuario) en datos de un
usuario concreto: crea ese usuario y le asigna todas las filas sin dueño.

Uso (apuntando a tu .env de Supabase):
  python migrate_to_multiuser.py <usuario> <contraseña>

Es seguro ejecutarlo varias veces.
"""
import sys
from werkzeug.security import generate_password_hash
from app import (app, db, User, Habit, HabitLog, Objective, Challenge,
                 DailyGoal, ManualEntry, FoodItem, MealLog, UserProfile)


def main():
    if len(sys.argv) < 3:
        print('Uso: python migrate_to_multiuser.py <usuario> <contraseña>')
        return
    username, password = sys.argv[1], sys.argv[2]

    with app.app_context():
        db.create_all()
        u = User.query.filter_by(username=username).first()
        if not u:
            u = User(username=username, password_hash=generate_password_hash(password))
            db.session.add(u)
            db.session.commit()
            print(f'Usuario "{username}" creado (id={u.id}).')
        else:
            print(f'Usuario "{username}" ya existe (id={u.id}).')

        # Asignar a este usuario todas las filas sin dueño (user_id NULL)
        models = [Habit, HabitLog, Objective, Challenge, DailyGoal,
                  ManualEntry, FoodItem, MealLog, UserProfile]
        for M in models:
            n = M.query.filter_by(user_id=None).update({'user_id': u.id})
            if n:
                print(f'  {M.__table__.name}: {n} filas asignadas a "{username}".')
        db.session.commit()
        print('Migración completada.')


if __name__ == '__main__':
    main()
