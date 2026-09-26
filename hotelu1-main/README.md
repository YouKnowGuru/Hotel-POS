# Restaurant POS — Deployment Guide

Frontend on **Vercel**, backend + database on **Render**.

> Repo layout:
> ```
> hotelu1-main/
>   backend/    Node + Express + Sequelize + Socket.IO
>   frontend/   React (CRA) + Tailwind
> ```

---

## 1. Database on Render

Render's free tier offers **PostgreSQL** (free) — MySQL is paid only. The
backend supports both via `DATABASE_URL`.

### Option A (recommended) — Render PostgreSQL (free)

1. Render Dashboard → **New +** → **PostgreSQL**.
2. Name: `hotelu1-db`, Plan: **Free**, Region: pick nearest.
3. Create DB. Once provisioned, copy the **Internal Database URL** (looks like
   `postgres://hotelu1:****@dpg-xxxx-a/hotelu1`).

### Option B — External free MySQL (Aiven / Clever Cloud)

1. Create a free MySQL instance there.
2. You'll get a URL like `mysql://user:pass@host:port/db`.
3. Use that as `DATABASE_URL`. Also set `DB_DIALECT=mysql`.

---

## 2. Backend on Render

1. Render Dashboard → **New +** → **Web Service** → connect this GitHub repo.
2. Settings:
   - **Root Directory:** `hotelu1-main/backend`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Health Check Path:** `/healthz`
3. Environment Variables:

   | Key            | Value                                                       |
   | -------------- | ----------------------------------------------------------- |
   | `NODE_ENV`     | `production`                                                |
   | `PORT`         | `10000` (Render binds your service to this)                 |
   | `HOST`         | `0.0.0.0`                                                   |
   | `JWT_SECRET`   | long random string                                          |
   | `CORS_ORIGIN`  | `https://your-app.vercel.app` (comma-separate more if needed) |
   | `DATABASE_URL` | the Internal URL copied above                               |
   | `DB_DIALECT`   | `postgres` (or `mysql` for Option B)                        |
   | `DB_SSL`       | `true`                                                      |

4. Deploy. After it boots, verify:
   - `https://your-backend.onrender.com/healthz` → `{ status: "ok", db: true, ... }`

Default seeded users on first boot: `admin/admin`, `manager/pass2`,
`waiter/pass`.

> Tip: a `render.yaml` blueprint exists at the repo root if you prefer
> "Blueprints" (one-click create of DB + service).

---

## 3. Frontend on Vercel

1. Vercel Dashboard → **Add New** → **Project** → import this GitHub repo.
2. Settings:
   - **Root Directory:** `hotelu1-main/frontend`
   - Framework Preset: **Create React App** (auto-detected via `vercel.json`)
   - Build Command: `npm run build`
   - Output Directory: `build`
3. Environment Variables:

   | Key                  | Value                                  |
   | -------------------- | -------------------------------------- |
   | `REACT_APP_API_URL`  | `https://your-backend.onrender.com`    |

4. Deploy. Open `https://your-app.vercel.app` and log in.

> After the frontend domain is final, copy it into **Render → backend service →
> Environment → `CORS_ORIGIN`** and redeploy the backend so CORS allows it.

---

## 4. Local development

Backend (`hotelu1-main/backend`):

```bash
cp .env.example .env
# edit DB_* values for your local MySQL/Postgres
npm install
npm start
```

Frontend (`hotelu1-main/frontend`):

```bash
cp .env.example .env
# leave REACT_APP_API_URL unset to use http://localhost:3001
npm install
npm start
```

---

## 5. Notes

- All amounts and prices are strictly in **Bhutanese Ngultrum (Nu. / BTN)**.
  All other currency support and conversions have been removed.
- Socket.IO talks directly to the backend URL — Vercel does not proxy WS.
- Render free instances sleep after 15 min of inactivity; first request after
  sleep takes ~30s to wake (login retries handle this automatically).
