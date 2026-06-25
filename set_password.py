"""
Cambia la contraseña de un usuario existente.

Uso (apuntando a tu .env de Supabase):
  python set_password.py <usuario> <nueva_contraseña>
"""
import sys
from werkzeug.security import generate_password_hash
from app import app, db, User


def main():
    if len(sys.argv) < 3:
        print('Uso: python set_password.py <usuario> <nueva_contraseña>')
        return
    username, password = sys.argv[1], sys.argv[2]
    with app.app_context():
        u = User.query.filter_by(username=username).first()
        if not u:
            print(f'No existe el usuario "{username}".')
            return
        u.password_hash = generate_password_hash(password)
        db.session.commit()
        print(f'Contraseña de "{username}" actualizada.')


if __name__ == '__main__':
    main()
