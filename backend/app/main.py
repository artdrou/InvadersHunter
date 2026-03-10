from fastapi import FastAPI


app = FastAPI(title="Invaders Hunter Backend")

@app.get("/")
def root():
    return {"message": "Backend Invaders Hunter fonctionne"}