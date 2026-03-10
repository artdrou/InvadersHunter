# app/create_tables.py
from app.database import Base, engine
from app.models.user import User
from app.models.space_invader import Invader
from app.models.user_progress import UserProgress

# Crée toutes les tables
Base.metadata.create_all(bind=engine)
print("Tables créées !")