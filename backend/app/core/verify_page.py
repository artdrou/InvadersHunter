"""Small page shown when the email-check link (verification email) is opened in a browser."""
from html import escape

from .email import ACCENT, BG, BORDER, BRAND, CARD, HEADER_URL, TEXT, TEXT_SOFT

TEXTS = {
    "fr": {
        "ok": ("Email confirmé !", "Votre compte est activé. Retournez dans l'app et connectez-vous."),
        "already": ("Déjà confirmé", "Votre email est déjà confirmé. Connectez-vous dans l'app."),
        "invalid": ("Lien expiré", "Ce lien n'est plus valable. Dans l'app, connectez-vous puis demandez un nouveau code."),
        "too_many": ("Trop d'essais", "Réessayez dans quelques minutes."),
    },
    "en": {
        "ok": ("Email confirmed!", "Your account is active. Go back to the app and log in."),
        "already": ("Already confirmed", "Your email is already confirmed. Log in from the app."),
        "invalid": ("Link expired", "This link is no longer valid. In the app, log in and ask for a new code."),
        "too_many": ("Too many tries", "Try again in a few minutes."),
    },
}


def verify_page(outcome: str, language: str = "fr") -> str:
    title, body = TEXTS.get(language, TEXTS["fr"])[outcome]
    color = ACCENT if outcome in ("ok", "already") else TEXT
    return f"""<!doctype html>
<html lang="{escape(language)}"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark">
<title>{BRAND} · {escape(title)}</title></head>
<body style="margin:0;background:{BG};font-family:Arial,Helvetica,sans-serif;">
<div style="max-width:520px;margin:0 auto;padding:24px 16px;">
  <img src="{HEADER_URL}" alt="{BRAND}" style="display:block;width:100%;height:auto;margin-bottom:12px;">
  <div style="background:{CARD};border:1px solid {BORDER};border-radius:12px;padding:28px 24px;text-align:center;">
    <h1 style="margin:0 0 12px;font-size:22px;color:{color};">{escape(title)}</h1>
    <p style="margin:0;font-size:16px;line-height:1.5;color:{TEXT_SOFT};">{escape(body)}</p>
  </div>
</div>
</body></html>"""
