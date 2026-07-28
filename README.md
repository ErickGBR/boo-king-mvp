# Cooking – Reservas de citas

Backend en **Node (Express + Prisma)** y frontend en **React (Vite + Tailwind)**.

## Cómo correr el proyecto

### 1. Backend (API)

```bash
cd backend
cp .env.example .env
```

Edita `.env` y deja al menos:
- `DATABASE_URL="file:./prisma/dev.db"`
- `JWT_SECRET=una-clave-secreta-cualquiera`

Luego:

```bash
npm install
npx prisma db push
npm run db:seed
npm run dev
```

El API queda en **http://localhost:4000**.

### 2. Frontend (en otra terminal)

```bash
cd frontend
npm install
npm run dev
```

La app queda en **http://localhost:3000** (el proxy envía `/api` al backend).

---

### 3. Despliegue en Render (SQLite)

El proyecto incluye `render.yaml` para desplegar en [Render](https://render.com) con **SQLite** y disco persistente.

1. Crea una cuenta en Render y conecta el repo de GitHub.
2. Render detectará `render.yaml` (Blueprint). Crea el servicio desde el Blueprint o “New > Blueprint”.
3. El servicio usa el **Dockerfile** de la raíz: construye frontend + backend en un solo contenedor.
4. La base **SQLite** se guarda en un disco persistente montado en `/app/data` (variable `DATABASE_URL=file:/app/data/sqlite.db`).
5. `JWT_SECRET` se genera automáticamente; puedes fijarlo en el Dashboard si lo necesitas.

**Nota:** El disco persistente requiere un plan de pago (p. ej. **starter**). Sin disco, los datos se pierden en cada redeploy.

---

**Resumen:** dos terminales, en la primera `cd backend && npm run dev`, en la segunda `cd frontend && npm run dev`. Abre http://localhost:3000.
