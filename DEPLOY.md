# Desplegar Habitos_Game (Supabase + online)

La app de Flask se ejecuta en un hosting (Render) y guarda los datos en la base
de datos Postgres de **Supabase**. Supabase NO ejecuta el código Python; solo es
la base de datos.

---

## Parte 1 — Base de datos en Supabase

1. Crea una cuenta en https://supabase.com y un proyecto nuevo.
   - Apunta la **Database Password** que eliges al crear el proyecto.
2. Ve a **Project Settings → Database → Connection string → URI**.
   - Elige la pestaña **Connection pooler** (modo *Session*).
   - Copia la cadena. Tiene esta forma:
     ```
     postgresql://postgres.xxxx:CONTRASEÑA@aws-0-eu-central-1.pooler.supabase.com:5432/postgres
     ```
   - Añádele al final: `?sslmode=require`

---

## Parte 2 — Probar en tu PC apuntando a Supabase

1. Crea el archivo `.env` (copia de `.env.example`) y pega ahí tu `DATABASE_URL`.
2. Activa el venv e instala dependencias:
   ```powershell
   .\venv\Scripts\Activate.ps1
   pip install -r requirements.txt
   ```
3. Migra tus datos actuales (los 14 alimentos + tu perfil) a Supabase:
   ```powershell
   python migrate_to_supabase.py
   ```
   (Crea las tablas en Supabase y copia los datos. Es seguro repetirlo.)
4. Arranca la app:
   ```powershell
   python app.py
   ```
   Abre http://localhost:5000 — ya estás leyendo/escribiendo en Supabase.

---

## Parte 3 — Subir el código a GitHub

Render despliega desde un repositorio de GitHub.

```powershell
git init
git add .
git commit -m "Habitos_Game listo para Supabase + Render"
```
Crea un repo vacío en GitHub y luego:
```powershell
git remote add origin https://github.com/TU_USUARIO/Habitos_Game.git
git push -u origin main
```
> El `.gitignore` ya evita subir `.env`, `database.db`, `venv/` y `__pycache__/`.
> Comprueba que tu contraseña NO aparece en GitHub.

---

## Parte 4 — Desplegar en Render

1. Entra en https://render.com → **New → Web Service** → conecta tu repo.
2. Render detecta `render.yaml`. Si te pide los datos a mano:
   - **Build command:** `pip install -r requirements.txt`
   - **Start command:** `gunicorn app:app`
3. En **Environment** añade las variables:
   - `DATABASE_URL` = tu cadena de Supabase (con `?sslmode=require`)
   - `FLASK_DEBUG` = `false`
   - `SECRET_KEY` = una cadena larga aleatoria (Render puede generarla solo)
   - `APP_PASSWORD` = la contraseña con la que entrarás a la app
   > ⚠️ Sin `APP_PASSWORD` la app queda **abierta a cualquiera**. Es obligatoria
   > para el despliegue público.
4. **Create Web Service**. En 2-3 minutos tendrás una URL pública.

---

## ⚠️ Importante antes de dejarlo público

- **No tiene login.** Cualquiera con la URL puede ver y editar tus datos.
  Para uso personal, considera al menos protegerla (login básico o no compartir
  la URL). Si quieres, te añado autenticación.

- **Las imágenes subidas se borran.** Las fotos van a `static/uploads`, que en
  Render es un disco temporal: desaparecen en cada nuevo deploy. La solución es
  guardarlas en **Supabase Storage** (puedo hacerlo como siguiente paso).

- **El plan gratis de Render "duerme"** tras 15 min sin uso; el primer acceso
  tras dormir tarda ~30 s en despertar. Normal en el plan free.
