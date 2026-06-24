"""
Activa Row Level Security (RLS) en todas las tablas del esquema public.

Por qué: Supabase expone una API REST pública (rol anon/authenticated) sobre las
tablas de public. Sin RLS, cualquiera con la "anon key" podría leer/escribir tus
datos. Activando RLS SIN políticas, esos roles quedan denegados por completo.

Por qué NO rompe la app: Flask se conecta como el rol 'postgres' (dueño de las
tablas), que salta RLS. Solo se bloquea la API REST pública, no tu app.

Re-ejecútalo si añades tablas nuevas (db.create_all las crea sin RLS).

Uso:
  python secure_supabase.py
"""
from sqlalchemy import inspect, text
from app import app, db


def main():
    with app.app_context():
        if db.engine.dialect.name != 'postgresql':
            print('DATABASE_URL no apunta a Postgres; nada que hacer.')
            return
        tables = inspect(db.engine).get_table_names(schema='public')
        with db.engine.begin() as conn:
            for t in tables:
                conn.execute(text(
                    f'ALTER TABLE public."{t}" ENABLE ROW LEVEL SECURITY;'))
                print(f'  RLS activado: public.{t}')
        print(f'Listo. RLS activado en {len(tables)} tablas.')


if __name__ == '__main__':
    main()
