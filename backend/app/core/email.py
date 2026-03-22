import os
from dotenv import load_dotenv
from fastapi_mail import FastMail, MessageSchema, ConnectionConfig

load_dotenv()

conf = ConnectionConfig(
    MAIL_USERNAME=os.getenv("MAIL_USERNAME"),
    MAIL_PASSWORD=os.getenv("MAIL_PASSWORD"),
    MAIL_FROM=os.getenv("MAIL_FROM"),
    MAIL_PORT=int(os.getenv("MAIL_PORT")),
    MAIL_SERVER=os.getenv("MAIL_SERVER"),
    MAIL_STARTTLS=os.getenv("MAIL_STARTTLS") == "True",
    MAIL_SSL_TLS=os.getenv("MAIL_SSL_TLS") == "True",
    USE_CREDENTIALS=True,
)

async def send_reset_password_email(email: str, token: str):
    message = MessageSchema(
        subject="Réinitialisation de mot de passe - Invader Hunter",
        recipients=[email],
        body=f"Votre code de réinitialisation est : {token}\n\nIl expire dans 15 minutes.",
        subtype="plain",
    )
    fm = FastMail(conf)
    await fm.send_message(message)

async def send_account_created_email(email: str):
    message = MessageSchema(
        subject="Compte Invader Hunter créé",
        recipients=[email],
        body="Votre compte Invader Hunter a bien été créé.",
        subtype="plain",
    )

    fm = FastMail(conf)
    await fm.send_message(message)