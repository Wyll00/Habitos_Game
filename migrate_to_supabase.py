"""
Copia los datos de la base SQLite local (database.db) a la base de datos
configurada en DATABASE_URL (Supabase / Postgres).

Uso:
  1. Pon DATABASE_URL en tu archivo .env apuntando a Supabase.
  2. python migrate_to_supabase.py

Es seguro ejecutarlo varias veces: usa "merge", así que no duplica filas
(actualiza las que ya existan con el mismo id).
"""
import os
import sqlite3
from datetime import datetime, date

from app import (app, db, Habit, HabitLog, Objective, Challenge,
                 DailyGoal, ManualEntry, FoodItem, MealLog, UserProfile)

SQLITE_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'database.db')

# Orden que respeta dependencias (food_item antes que meal_log)
MODELS = [Habit, HabitLog, Objective, Challenge, DailyGoal,
          ManualEntry, FoodItem, MealLog, UserProfile]


def coerce(model, column_name, value):
    """Convierte los strings de SQLite a los tipos que espera Postgres."""
    if value is None:
        return None
    col_type = model.__table__.columns[column_name].type.__class__.__name__
    if col_type == 'DateTime' and isinstance(value, str):
        return datetime.fromisoformat(value)
    if col_type == 'Date' and isinstance(value, str):
        return date.fromisoformat(value)
    if col_type == 'Boolean':
        return bool(value)
    return value


def main():
    if not os.path.exists(SQLITE_PATH):
        print('No encuentro database.db; no hay nada que migrar.')
        return

    src = sqlite3.connect(SQLITE_PATH)
    src.row_factory = sqlite3.Row

    with app.app_context():
        if 'sqlite' in str(db.engine.url):
            print('AVISO: DATABASE_URL no apunta a Postgres. Pon el .env de Supabase.')
            return

        db.create_all()  # crea las tablas en Supabase si aún no existen
        total = 0
        for model in MODELS:
            table = model.__table__.name
            try:
                rows = src.execute(f'SELECT * FROM "{table}"').fetchall()
            except sqlite3.OperationalError:
                continue  # esa tabla no existe en el sqlite viejo
            for row in rows:
                data = {k: coerce(model, k, row[k]) for k in row.keys()
                        if k in model.__table__.columns}
                db.session.merge(model(**data))  # merge preserva el id
                total += 1
            if rows:
                print(f'  {table}: {len(rows)} filas')
        db.session.commit()

        # Re-sincroniza las secuencias de IDs de Postgres para que los
        # próximos inserts no choquen con los ids ya migrados.
        for model in MODELS:
            table = model.__table__.name
            seq = db.session.execute(
                db.text("SELECT pg_get_serial_sequence(:t, 'id')"),
                {'t': table}
            ).scalar()
            if seq:
                db.session.execute(db.text(
                    f"SELECT setval('{seq}', "
                    f"COALESCE((SELECT MAX(id) FROM \"{table}\"), 1))"
                ))
        db.session.commit()
        print(f'Listo. {total} filas migradas a Supabase.')

    src.close()


if __name__ == '__main__':
    main()
