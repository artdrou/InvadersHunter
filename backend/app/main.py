from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.routers import users, space_invader, user_progress, auth


app = FastAPI(title="Invaders Hunter Backend")

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

@app.get("/")
def root():
    return {"message": "Backend Invaders Hunter fonctionne"}