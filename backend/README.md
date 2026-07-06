# InvadersHunter — Backend

FastAPI REST API backed by a PostgreSQL database hosted on Neon. Deployed automatically to Railway on every push to main.

---

## Stack

- Python 3.11
- FastAPI
- SQLAlchemy 2
- Neon (PostgreSQL)
- Uvicorn
- JWT authentication (access token + refresh token)
- fastapi-mail for transactional emails

---

## Local setup

### 1. Create a virtual environment

```bash
cd backend
python -m venv venv
venv/Scripts/activate        # Windows
# or
source venv/bin/activate     # macOS / Linux
```

### 2. Install dependencies

```bash
pip install -r requirements.txt
```

### 3. Set environment variables

Create a `.env` file in the `backend/` folder:

```ini
DATABASE_URL=postgresql://<user>:<password>@<host>:<port>/<dbname>?sslmode=require
SECRET_KEY=your-secret-key
```

Get your `DATABASE_URL` from [neon.tech](https://neon.tech) after creating a project.

### 4. Start the server

```bash
venv/Scripts/python.exe -m uvicorn app.main:app --reload
```

The API will be available at `http://localhost:8000`.
Interactive docs: `http://localhost:8000/docs`

Database migrations run automatically at startup.

---

## Run tests

```bash
venv/Scripts/python.exe -m pytest tests/ -v
```

Tests use an in-memory SQLite database — no external database needed.

---

## API overview

| Method | Path | Description |
|---|---|---|
| GET | /invaders/ | List all invaders (delta sync supported) |
| GET | /invaders/{id} | Single invader detail |
| POST | /user-requests/ | Submit a location or state update |
| GET | /user-requests/ | List the current user's requests |
| GET | /admin-requests/ | List pending admin requests (admin only) |
| POST | /admin-requests/{id}/approve | Approve a request (admin only) |
| POST | /admin-requests/{id}/reject | Reject a request (admin only) |
| POST | /auth/login | Get access + refresh tokens |
| POST | /auth/refresh | Refresh access token |
| POST | /users/register | Create an account |
| POST | /user-progress/flash | Flash an invader |
| POST | /user-progress/unflash | Unflash an invader |

---

## Deployment

The backend is deployed on Railway. Every push to the main branch triggers an automatic redeploy.

Environment variables (`DATABASE_URL`, `SECRET_KEY`) are configured in the Railway project settings.
