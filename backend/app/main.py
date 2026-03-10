from fastapi import FastAPI
from app.routers import users, space_invader, user_progress


app = FastAPI(title="Invaders Hunter Backend")

app.include_router(users.router)
app.include_router(space_invader.router)
app.include_router(user_progress.router)

@app.get("/")
def root():
    return {"message": "Backend Invaders Hunter fonctionne"}