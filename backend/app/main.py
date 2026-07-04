from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.api.routers import users, invaders, user_progress, auth, user_requests, admin_requests, upload, flash_import, apk, news, notifications
from app.migrate import run as run_migrations


@asynccontextmanager
async def lifespan(app: FastAPI):
    run_migrations()
    yield


app = FastAPI(title="Invaders Hunter Backend", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(users.router)
app.include_router(auth.router)
app.include_router(invaders.router)
app.include_router(user_progress.router)
app.include_router(user_requests.router)
app.include_router(admin_requests.router)
app.include_router(upload.router)
app.include_router(flash_import.router)
app.include_router(apk.router)
app.include_router(news.router)
app.include_router(notifications.router)

# Serve the Flash Import PC script (and any future static assets) as downloads.
_STATIC_DIR = Path(__file__).resolve().parents[1] / "static"
if _STATIC_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(_STATIC_DIR)), name="static")

@app.get("/")
def root():
    return {"message": "Backend Invaders Hunter fonctionne"}