# Restaurant Owner Verification & Dashboard

Django REST Framework backend and React (Vite) frontend for restaurant owner verification and dashboard access after admin approval.

## Features

- **Roles**: USER (default), OWNER, AUDITOR, ADMIN
- **Owner application**: Users submit business details and proof documents; at least one proof required
- **Admin review**: Approve or reject with notes; approval creates Restaurant and sets user role to OWNER
- **Audit trail**: Applications are never deleted; `reviewed_by` and `reviewed_at` stored
- **JWT auth**: Login/register; protected routes by role

## Quick start

### Backend (Django)

```bash
cd backend
python -m venv venv
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

- API: `http://127.0.0.1:8000/api/`
- Admin user already created: **admin@example.com** / **admin123** (change in production)

### Frontend (React + Vite)

```bash
cd frontend
npm install
npm run dev
```

- App: `http://localhost:5173`
- Set `VITE_API_URL=http://127.0.0.1:8000/api` in `.env` if the API is on another host.

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register/` | Register (no auth) |
| POST | `/api/auth/login/` | Login → JWT |
| GET | `/api/auth/me/` | Current user |
| POST | `/api/owner/apply/` | Submit owner application |
| GET | `/api/owner/application-status/` | My application(s) |
| POST | `/api/owner/upload/` | Upload file → URL for proof/photos |
| GET | `/api/admin/owner-applications/` | List applications (ADMIN) |
| GET | `/api/admin/owner-applications/{id}/` | Application detail (ADMIN) |
| PATCH | `/api/admin/owner-applications/{id}/approve/` | Approve (ADMIN) |
| PATCH | `/api/admin/owner-applications/{id}/reject/` | Reject (ADMIN) |
| GET | `/api/restaurants/me/` | My restaurant (OWNER) |

## Flow

1. User registers and signs in.
2. User goes to **Apply as Owner**, fills form, uploads at least one proof (license/GST, business card, owner photo, or utility bill), accepts declaration, submits.
3. Admin signs in (e.g. admin@example.com), opens **Review Applications**, opens an application, then **Approve** or **Reject** (optional review notes).
4. On approve: Restaurant record is created, user role set to OWNER; user can access **Owner Dashboard**.

## Project structure

```
AB/
├── backend/           # Django + DRF
│   ├── config/        # settings, urls
│   └── core/         # User, OwnerApplication, Restaurant, API
├── frontend/         # React + Vite
│   └── src/
│       ├── api.js    # axios + auth
│       ├── context/  # AuthContext
│       ├── components/
│       └── pages/    # Login, Register, Apply, Application Status, Admin, Owner Dashboard
└── README.md
```

## Security notes

- Change `SECRET_KEY` and disable `DEBUG` in production.
- Use HTTPS and secure cookie/session in production.
- File uploads are stored under `backend/media/`; restrict allowed types and size (backend limits: 10MB, pdf/jpg/png/gif/webp).
