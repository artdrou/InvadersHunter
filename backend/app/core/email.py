"""Transactional emails (reset code, welcome), sent through Brevo's HTTP API.

Railway's Hobby plan blocks outbound SMTP, hence the API. The sender domain
(hintvaders.app) is authenticated in Brevo. The header image is served by the
backend that sends the email (static/email/header.jpg).
"""
import logging
import os
from html import escape

import requests

log = logging.getLogger(__name__)

BREVO_API_KEY = os.getenv("BREVO_API_KEY")
BRAND = "HintVaders"
SENDER = {"name": BRAND, "email": "noreply@hintvaders.app"}

# Railway sets RAILWAY_PUBLIC_DOMAIN on each service; locally, fall back to prod.
_HOST = os.getenv("RAILWAY_PUBLIC_DOMAIN") or "invader-hunter-production.up.railway.app"
HEADER_URL = f"https://{_HOST}/static/email/header.jpg"

# Website colours (dark theme)
BG, CARD, BORDER = "#0a0f1e", "#111827", "#1e3a5f"
TEXT, TEXT_SOFT, TEXT_MUTED, ACCENT = "#e8f0fe", "#9fb3cc", "#5b7a9d", "#ccff00"

TEXTS = {
    "fr": {
        "reset_subject": f"Votre code de réinitialisation - {BRAND}",
        "reset_title": "Réinitialisation du mot de passe",
        "hello": "Bonjour {username},",
        "reset_intro": "Voici votre code pour choisir un nouveau mot de passe :",
        "reset_expiry": "Il expire dans 15 minutes.",
        "reset_ignore": "Vous n'avez rien demandé ? Ignorez cet email, votre mot de passe reste inchangé.",
        "welcome_subject": f"Bienvenue sur {BRAND} !",
        "welcome_title": "Bienvenue, chasseur !",
        "welcome_body": "Votre compte est prêt. Ouvrez la carte, partez à la chasse et flashez votre premier invader.",
        "welcome_sync": "Vos flashes sont sauvegardés sur votre compte : vous les retrouvez sur tous vos appareils.",
        "footer": "Email automatique, merci de ne pas y répondre.",
    },
    "en": {
        "reset_subject": f"Your reset code - {BRAND}",
        "reset_title": "Password reset",
        "hello": "Hi {username},",
        "reset_intro": "Here is your code to choose a new password:",
        "reset_expiry": "It expires in 15 minutes.",
        "reset_ignore": "Didn't ask for this? Ignore this email, your password stays the same.",
        "welcome_subject": f"Welcome to {BRAND}!",
        "welcome_title": "Welcome, hunter!",
        "welcome_body": "Your account is ready. Open the map, go hunting and flash your first invader.",
        "welcome_sync": "Your flashes are saved to your account, so you'll find them on all your devices.",
        "footer": "Automated email, please do not reply.",
    },
}


def _texts(language: str) -> dict:
    return TEXTS.get(language, TEXTS["fr"])


def _p(text: str, color: str = TEXT, size: int = 16) -> str:
    return f'<p style="margin:0 0 16px;font-size:{size}px;line-height:1.5;color:{color};">{text}</p>'


def _layout(title: str, body: str, preheader: str, t: dict) -> str:
    """Dark card under the HintVaders banner. Tables + inline styles: what email clients support."""
    return f"""<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark"><meta name="supported-color-schemes" content="dark"></head>
<body style="margin:0;padding:0;background:{BG};">
<div style="display:none;max-height:0;overflow:hidden;">{preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:{BG};">
<tr><td align="center" style="padding:24px 12px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;font-family:Arial,Helvetica,sans-serif;">
    <tr><td><img src="{HEADER_URL}" width="600" alt="{BRAND}" style="display:block;width:100%;height:auto;border:0;border-radius:12px 12px 0 0;"></td></tr>
    <tr><td style="background:{CARD};border:1px solid {BORDER};border-top:0;border-radius:0 0 12px 12px;padding:32px 28px;">
      <h1 style="margin:0 0 20px;font-size:22px;color:{TEXT};">{title}</h1>
      {body}
    </td></tr>
    <tr><td align="center" style="padding:20px 8px;font-size:12px;line-height:1.5;color:{TEXT_MUTED};">
      {BRAND}<br>{t["footer"]}
    </td></tr>
  </table>
</td></tr></table>
</body></html>"""


def _send(to_email: str, subject: str, text: str, html: str):
    resp = requests.post(
        "https://api.brevo.com/v3/smtp/email",
        headers={"api-key": BREVO_API_KEY, "Content-Type": "application/json"},
        json={"sender": SENDER, "to": [{"email": to_email}], "subject": subject,
              "textContent": text, "htmlContent": html},
        timeout=10,
    )
    if not resp.ok:
        log.error("Brevo send failed (%s): %s", resp.status_code, resp.text[:300])


def reset_password_email(token: str, username: str, language: str = "fr") -> tuple[str, str, str]:
    """(subject, text, html) of the reset-code email."""
    t = _texts(language)
    hello = t["hello"].format(username=escape(username))
    code = (f'<div style="margin:8px 0 20px;padding:18px;background:{BG};border:1px solid {BORDER};'
            f'border-radius:10px;text-align:center;font-family:Consolas,Menlo,monospace;font-size:34px;'
            f'font-weight:bold;letter-spacing:10px;color:{ACCENT};">{escape(token)}</div>')
    body = (_p(hello) + _p(t["reset_intro"]) + code + _p(t["reset_expiry"], TEXT_SOFT, 14)
            + _p(t["reset_ignore"], TEXT_MUTED, 13))
    text = (f'{t["hello"].format(username=username)}\n\n{t["reset_intro"]} {token}\n\n'
            f'{t["reset_expiry"]}\n{t["reset_ignore"]}')
    return t["reset_subject"], text, _layout(t["reset_title"], body, f'{t["reset_intro"]} {token}', t)


def welcome_email(username: str, language: str = "fr") -> tuple[str, str, str]:
    """(subject, text, html) of the account-created email."""
    t = _texts(language)
    hello = t["hello"].format(username=escape(username))
    body = _p(hello) + _p(t["welcome_body"]) + _p(t["welcome_sync"], TEXT_SOFT, 14)
    text = f'{t["hello"].format(username=username)}\n\n{t["welcome_body"]}\n{t["welcome_sync"]}'
    return t["welcome_subject"], text, _layout(t["welcome_title"], body, t["welcome_body"], t)


async def send_reset_password_email(email: str, token: str, username: str = "", language: str = "fr"):
    try:
        _send(email, *reset_password_email(token, username, language))
    except Exception:
        log.exception("Reset email to %s failed", email)


async def send_account_created_email(email: str, username: str = "", language: str = "fr"):
    try:
        _send(email, *welcome_email(username, language))
    except Exception:
        log.exception("Welcome email to %s failed", email)
