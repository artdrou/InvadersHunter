import os
import requests

BREVO_API_KEY = os.getenv("BREVO_API_KEY")
SENDER = {"name": "Invader Hunter", "email": "invaderhunter.app@gmail.com"}

def _send(to_email: str, subject: str, text: str):
    requests.post(
        "https://api.brevo.com/v3/smtp/email",
        headers={"api-key": BREVO_API_KEY, "Content-Type": "application/json"},
        json={"sender": SENDER, "to": [{"email": to_email}], "subject": subject, "textContent": text},
        timeout=10,
    )

async def send_reset_password_email(email: str, token: str):
    try:
        _send(email, "Réinitialisation de mot de passe - Invader Hunter",
              f"Votre code de réinitialisation est : {token}\n\nIl expire dans 15 minutes.")
    except Exception:
        pass

async def send_account_created_email(email: str):
    try:
        _send(email, "Compte Invader Hunter créé", "Votre compte Invader Hunter a bien été créé.")
    except Exception:
        pass
