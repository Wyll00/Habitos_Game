"""
Crea una cuenta de usuario nueva (no hay registro público en la app).

Uso (apuntando a tu .env de Supabase):
  python create_user.py <usuario> <contraseña>
"""
import sys
from werkzeug.security import generate_password_hash
from app import app, db, User


def main():
    if len(sys.argv) < 3:
        print('Uso: python create_user.py <usuario> <contraseña>')
        return
    username, password = sys.argv[1], sys.argv[2]

    with app.app_context():
        db.create_all()
        if User.query.filter_by(username=username).first():
            print(f'El usuario "{username}" ya existe.')
            return
        u = User(username=username, password_hash=generate_password_hash(password))
        db.session.add(u)
        db.session.commit()
        print(f'Usuario "{username}" creado (id={u.id}).')


if __name__ == '__main__':
    main()
