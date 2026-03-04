# Deployment Guide: Vercel (frontend) + Railway (backend)

This project uses **Vercel** for the React frontend and **Railway** for the Django API. The Dockerfile is for the **backend only** (Railway). Vercel deploys the frontend from the repo without Docker.

---

## 1. Backend on Railway (Django + Docker)

### Prerequisites
- [Railway](https://railway.app) account
- [Supabase](https://supabase.com) project (for Postgres `DATABASE_URL` and optional Storage)
- Git repo (GitHub/GitLab) connected to Railway

### Steps

1. **Create a new project on Railway** and choose **Deploy from GitHub repo**. Select this repository.

2. **Set root directory and Dockerfile**
   - In the service → **Settings** → **Build**:
     - **Root Directory**: `backend`
     - **Dockerfile Path**: `Dockerfile` (relative to `backend`)
   - Or leave Root Directory empty and set **Dockerfile Path**: `backend/Dockerfile` (if Railway supports building from subfolder).

3. **Add environment variables** in Railway → **Variables**:

   | Variable | Required | Example / notes |
   |----------|----------|------------------|
   | `DATABASE_URL` | Yes | Supabase Postgres URL, e.g. `postgresql://postgres.xxx:password@aws-0-region.pooler.supabase.com:6543/postgres` |
   | `DJANGO_SECRET_KEY` | Yes | Long random string for production |
   | `DEBUG` | No | `False` in production |
   | `ALLOWED_HOSTS` | Yes | Your Railway host, e.g. `yourapp.up.railway.app`, or `*` (not recommended for production) |
   | `CORS_ALLOWED_ORIGINS` | Yes | Comma-separated frontend URLs, e.g. `https://yourapp.vercel.app` |
   | `SUPABASE_URL` | If using uploads | `https://your-ref.supabase.co` |
   | `SUPABASE_SERVICE_KEY` | If using uploads | Supabase service role key |
   | `SUPABASE_MEDIA_BUCKET` | No | `media` (default) |

4. **Deploy**
   - Railway will build the image from `backend/Dockerfile` and run `gunicorn`.
   - After first deploy, run migrations: Railway → your service → **Settings** → add a **Deploy** or use **Run Command** / **One-off command**:  
     `python manage.py migrate`

   If Railway offers a **Release Command**, set it to:
   ```bash
   python manage.py migrate --noinput
   ```
   so migrations run on each deploy.

5. **Note the backend URL**  
   You’ll get a URL like `https://your-service.up.railway.app`. Use this as the API base for the frontend.

---

## 2. Frontend on Vercel (React + Vite)

### Prerequisites
- [Vercel](https://vercel.com) account
- Same Git repo

### Steps

1. **Import the repo** in Vercel: **Add New** → **Project** → import your Git repository.

2. **Configure the project**
   - **Root Directory**: `frontend`
   - **Framework Preset**: Vite
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`

3. **Environment variables**
   - Add variable: **Name**: `VITE_API_URL`  
     **Value**: your Railway backend URL, e.g. `https://your-service.up.railway.app/api`  
     (Use `/api` only if your API is under `/api`; if Django serves at root, use `https://your-service.up.railway.app`.)

4. **Deploy**  
   Vercel will build and deploy. Your frontend will use `VITE_API_URL` to talk to the Railway backend.

5. **Update backend CORS**  
   In Railway, set `CORS_ALLOWED_ORIGINS` to your Vercel URL, e.g. `https://your-project.vercel.app`, so the browser allows API requests.

---

## 3. Summary checklist

| Step | Where | What |
|------|--------|------|
| 1 | Railway | Deploy from repo, root = `backend`, use `Dockerfile` |
| 2 | Railway | Set `DATABASE_URL`, `DJANGO_SECRET_KEY`, `ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS` (and Supabase vars if needed) |
| 3 | Railway | Run migrations (release command or one-off) |
| 4 | Vercel | Deploy `frontend` with `VITE_API_URL` = Railway API URL |
| 5 | Railway | Set `CORS_ALLOWED_ORIGINS` to your Vercel URL |

---

## 4. Local Docker (optional)

To run the backend with Docker locally:

```bash
cd backend
docker build -t foodas-api .
docker run --env-file ../.env -p 8000:8000 foodas-api
```

Ensure `../.env` (or the env file you pass) contains at least `DATABASE_URL` and `DJANGO_SECRET_KEY`.
