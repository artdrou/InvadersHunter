from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.routers import users, space_invader, user_progress, auth, user_requests, admin_requests
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
app.include_router(space_invader.router)
app.include_router(user_progress.router)
app.include_router(user_requests.router)
app.include_router(admin_requests.router)

@app.get("/")
def root():
    return {"message": "Backend Invaders Hunter fonctionne"}