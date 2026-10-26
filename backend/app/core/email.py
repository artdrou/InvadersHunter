"""Transactional emails, sent through Brevo's HTTP API: reset code, welcome,
account deleted, admin role granted / revoked, username / password changed,
personal data.

Railway's Hobby plan blocks outbound SMTP, hence the API. The sender domain
(hintvaders.app) is authenticated in Brevo. The header image is served by the
backend that sends the email (static/email/header.jpg).
"""
import base64
import logging
import os
from datetime import datetime
from html import escape
from zoneinfo import ZoneInfo

import requests

log = logging.getLogger(__name__)

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
        "deleted_subject": f"Votre compte {BRAND} a été supprimé",
        "deleted_title": "Compte supprimé",
        "deleted_body": "Votre compte <b>{username}</b> et toutes ses données (flashes, propositions, commentaires, amis) ont été définitivement supprimés.",
        "deleted_bye": "Merci d'avoir chassé avec nous. Vous pouvez recréer un compte à tout moment depuis l'app.",
        "admin_on_subject": f"Vous êtes administrateur {BRAND}",
        "admin_on_title": "Droits d'administrateur accordés",
        "admin_on_body": "Vous êtes maintenant administrateur. Un onglet <b>Admin</b> est apparu dans l'app : vous pouvez y valider ou refuser les propositions de la communauté.",
        "admin_on_note": "Vos décisions modifient la carte de tous les joueurs : merci de vérifier chaque proposition avec soin.",
        "admin_off_subject": f"Vos droits d'administrateur {BRAND} ont été retirés",
        "admin_off_title": "Droits d'administrateur retirés",
        "admin_off_body": "Vos droits d'administrateur ont été retirés. L'onglet Admin n'apparaît plus dans l'app ; le reste de votre compte ne change pas.",
        "admin_off_note": "Merci pour votre aide à la modération !",
        "username_subject": f"Votre pseudo {BRAND} a été modifié",
        "username_title": "Pseudo modifié",
        "username_body": "Votre pseudo a été modifié :",
        "username_login": "Utilisez désormais <b>{new}</b> pour vous connecter.",
        "not_you": "Ce n'est pas vous ? Réinitialisez votre mot de passe depuis l'app (« Mot de passe oublié »).",
        "password_subject": f"Votre mot de passe {BRAND} a été modifié",
        "password_title": "Mot de passe modifié",
        "password_body": "Le mot de passe de votre compte <b>{username}</b> a bien été modifié le {when} (heure de Paris).",
        "password_sessions": "Vous pouvez maintenant vous connecter avec votre nouveau mot de passe.",
        "password_not_you": "Ce n'est pas vous ? Changez votre mot de passe tout de suite depuis l'app (« Mot de passe oublié ») : quelqu'un a peut-être accès à votre adresse email.",
        "data_subject": f"Vos données personnelles {BRAND}",
        "data_title": "Vos données personnelles",
        "data_body": "Comme demandé, voici une copie de toutes les données liées à votre compte (droit d'accès, article 15 du RGPD). Le détail complet est dans le fichier joint <b>{filename}</b>.",
        "data_summary": "En résumé :",
        "data_rows": {
            "account": "Compte créé le", "flashes": "Invaders flashés", "requests": "Propositions envoyées",
            "comments": "Commentaires", "friends": "Amis", "devices": "Appareils (notifications)",
        },
        "data_rights": "Vous pouvez corriger vos données depuis l'app à tout moment. Pour supprimer votre compte et toutes ses données, faites-en la demande à un administrateur.",
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
        "deleted_subject": f"Your {BRAND} account was deleted",
        "deleted_title": "Account deleted",
        "deleted_body": "Your account <b>{username}</b> and all its data (flashes, proposals, comments, friends) have been permanently deleted.",
        "deleted_bye": "Thanks for hunting with us. You can create a new account from the app at any time.",
        "admin_on_subject": f"You are now a {BRAND} admin",
        "admin_on_title": "Admin rights granted",
        "admin_on_body": "You are now an admin. An <b>Admin</b> tab has appeared in the app: you can approve or reject the community's proposals there.",
        "admin_on_note": "Your decisions change the map for every player, so please check each proposal carefully.",
        "admin_off_subject": f"Your {BRAND} admin rights were removed",
        "admin_off_title": "Admin rights removed",
        "admin_off_body": "Your admin rights have been removed. The Admin tab no longer shows in the app; the rest of your account stays the same.",
        "admin_off_note": "Thanks for helping with moderation!",
        "username_subject": f"Your {BRAND} username was changed",
        "username_title": "Username changed",
        "username_body": "Your username was changed:",
        "username_login": "From now on, log in with <b>{new}</b>.",
        "not_you": "Wasn't you? Reset your password from the app (\"Forgot password\").",
        "password_subject": f"Your {BRAND} password was changed",
        "password_title": "Password changed",
        "password_body": "The password of your account <b>{username}</b> was changed on {when} (Paris time).",
        "password_sessions": "You can now log in with your new password.",
        "password_not_you": "Wasn't you? Change your password right away from the app (\"Forgot password\"): someone may have access to your email.",
        "data_subject": f"Your {BRAND} personal data",
        "data_title": "Your personal data",
        "data_body": "As requested, here is a copy of all the data linked to your account (right of access, GDPR article 15). The full details are in the attached file <b>{filename}</b>.",
        "data_summary": "In short:",
        "data_rows": {
            "account": "Account created on", "flashes": "Invaders flashed", "requests": "Proposals sent",
            "comments": "Comments", "friends": "Friends", "devices": "Devices (notifications)",
        },
        "data_rights": "You can correct your data from the app at any time. To delete your account and all its data, ask an admin.",
        "footer": "Automated email, please do not reply.",
    },
}


def _texts(language: str) -> dict:
    return TEXTS.get(language, TEXTS["fr"])


def _paris_now() -> str:
    return datetime.now(ZoneInfo("Europe/Paris")).strftime("%d/%m/%Y %H:%M")


def _p(text: str, color: str = TEXT, size: int = 16) -> str:
    return f'<p style="margin:0 0 16px;font-size:{size}px;line-height:1.5;color:{color};">{text}</p>'


def _box(inner: str, style: str = "") -> str:
    """Inset panel (darker than the card), used for the reset code, the username change, the data summary."""
    return (f'<div style="margin:8px 0 20px;padding:18px;background:{BG};border:1px solid {BORDER};'
            f'border-radius:10px;{style}">{inner}</div>')


def _text(html: str) -> str:
    """Plain-text version of a snippet of our own HTML (only <b> tags in the texts)."""
    return html.replace("<b>", "").replace("</b>", "")


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
    <tr><td style="padding-bottom:8px;"><img src="{HEADER_URL}" width="600" alt="{BRAND}" style="display:block;width:100%;height:auto;border:0;"></td></tr>
    <tr><td style="background:{CARD};border:1px solid {BORDER};border-radius:12px;padding:32px 28px;">
      <h1 style="margin:0 0 20px;font-size:22px;color:{TEXT};">{title}</h1>
      {body}
    </td></tr>
    <tr><td align="center" style="padding:20px 8px;font-size:12px;line-height:1.5;color:{TEXT_MUTED};">
      {BRAND}<br>{t["footer"]}
    </td></tr>
  </table>
</td></tr></table>
</body></html>"""


def _send(to_email: str, subject: str, text: str, html: str, attachments: list | None = None):
    """attachments: [(filename, bytes)]. No key (local dev, tests) → nothing is sent."""
    api_key = os.getenv("BREVO_API_KEY")
    if not api_key:
        log.warning("BREVO_API_KEY not set, email '%s' to %s not sent", subject, to_email)
        return
    payload = {"sender": SENDER, "to": [{"email": to_email}], "subject": subject,
               "textContent": text, "htmlContent": html}
    if attachments:
        payload["attachment"] = [{"name": name, "content": base64.b64encode(data).decode()}
                                 for name, data in attachments]
    resp = requests.post(
        "https://api.brevo.com/v3/smtp/email",
        headers={"api-key": api_key.strip(), "Content-Type": "application/json"},
        json=payload,
        timeout=10,
    )
    if not resp.ok:
        log.error("Brevo send failed (%s): %s", resp.status_code, resp.text[:300])


# ── Templates: each returns (subject, text, html) ───────────────────────────────

def reset_password_email(token: str, username: str, language: str = "fr") -> tuple[str, str, str]:
    t = _texts(language)
    hello = t["hello"].format(username=escape(username))
    code = _box(escape(token), "text-align:center;font-family:Consolas,Menlo,monospace;font-size:34px;"
                               f"font-weight:bold;letter-spacing:10px;color:{ACCENT};")
    body = (_p(hello) + _p(t["reset_intro"]) + code + _p(t["reset_expiry"], TEXT_SOFT, 14)
            + _p(t["reset_ignore"], TEXT_MUTED, 13))
    text = (f'{t["hello"].format(username=username)}\n\n{t["reset_intro"]} {token}\n\n'
            f'{t["reset_expiry"]}\n{t["reset_ignore"]}')
    return t["reset_subject"], text, _layout(t["reset_title"], body, f'{t["reset_intro"]} {token}', t)


def welcome_email(username: str, language: str = "fr") -> tuple[str, str, str]:
    t = _texts(language)
    hello = t["hello"].format(username=escape(username))
    body = _p(hello) + _p(t["welcome_body"]) + _p(t["welcome_sync"], TEXT_SOFT, 14)
    text = f'{t["hello"].format(username=username)}\n\n{t["welcome_body"]}\n{t["welcome_sync"]}'
    return t["welcome_subject"], text, _layout(t["welcome_title"], body, t["welcome_body"], t)


def account_deleted_email(username: str, language: str = "fr") -> tuple[str, str, str]:
    t = _texts(language)
    hello = t["hello"].format(username=escape(username))
    deleted = t["deleted_body"].format(username=escape(username))
    body = _p(hello) + _p(deleted) + _p(t["deleted_bye"], TEXT_SOFT, 14)
    text = (f'{t["hello"].format(username=username)}\n\n'
            f'{_text(t["deleted_body"].format(username=username))}\n{t["deleted_bye"]}')
    return t["deleted_subject"], text, _layout(t["deleted_title"], body, _text(deleted), t)


def admin_role_email(username: str, granted: bool, language: str = "fr") -> tuple[str, str, str]:
    t = _texts(language)
    k = "admin_on" if granted else "admin_off"
    hello = t["hello"].format(username=escape(username))
    body = _p(hello) + _p(t[f"{k}_body"]) + _p(t[f"{k}_note"], TEXT_SOFT, 14)
    text = f'{t["hello"].format(username=username)}\n\n{_text(t[f"{k}_body"])}\n{t[f"{k}_note"]}'
    return t[f"{k}_subject"], text, _layout(t[f"{k}_title"], body, _text(t[f"{k}_body"]), t)


def username_changed_email(old: str, new: str, language: str = "fr") -> tuple[str, str, str]:
    t = _texts(language)
    hello = t["hello"].format(username=escape(new))
    change = _box(f'<span style="color:{TEXT_MUTED};text-decoration:line-through;">{escape(old)}</span>'
                  f'&nbsp;&nbsp;<span style="color:{TEXT_SOFT};">→</span>&nbsp;&nbsp;'
                  f'<b style="color:{ACCENT};">{escape(new)}</b>',
                  "text-align:center;font-size:20px;")
    login = t["username_login"].format(new=escape(new))
    body = _p(hello) + _p(t["username_body"]) + change + _p(login, TEXT_SOFT, 14) + _p(t["not_you"], TEXT_MUTED, 13)
    text = (f'{t["hello"].format(username=new)}\n\n{t["username_body"]} {old} -> {new}\n'
            f'{_text(t["username_login"].format(new=new))}\n\n{t["not_you"]}')
    return t["username_subject"], text, _layout(t["username_title"], body, f"{old} → {new}", t)


def password_changed_email(username: str, when: str, language: str = "fr") -> tuple[str, str, str]:
    """`when`: already formatted date + time of the change."""
    t = _texts(language)
    hello = t["hello"].format(username=escape(username))
    changed = t["password_body"].format(username=escape(username), when=escape(when))
    body = (_p(hello) + _p(changed) + _p(t["password_sessions"], TEXT_SOFT, 14)
            + _p(t["password_not_you"], TEXT_MUTED, 13))
    text = (f'{t["hello"].format(username=username)}\n\n'
            f'{_text(t["password_body"].format(username=username, when=when))}\n'
            f'{t["password_sessions"]}\n\n{t["password_not_you"]}')
    return t["password_subject"], text, _layout(t["password_title"], body, _text(changed), t)


def personal_data_email(username: str, summary: dict, filename: str,
                        language: str = "fr") -> tuple[str, str, str]:
    """summary: {account, flashes, requests, comments, friends, devices} (values already formatted)."""
    t = _texts(language)
    hello = t["hello"].format(username=escape(username))
    intro = t["data_body"].format(filename=escape(filename))
    rows = "".join(
        f'<tr><td style="padding:6px 0;color:{TEXT_SOFT};font-size:14px;">{label}</td>'
        f'<td align="right" style="padding:6px 0;color:{TEXT};font-size:14px;font-weight:bold;">{escape(str(summary[key]))}</td></tr>'
        for key, label in t["data_rows"].items()
    )
    table = _box(f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0">{rows}</table>')
    body = _p(hello) + _p(intro) + _p(t["data_summary"], TEXT_SOFT, 14) + table + _p(t["data_rights"], TEXT_MUTED, 13)
    lines = "\n".join(f"- {label}: {summary[key]}" for key, label in t["data_rows"].items())
    text = (f'{t["hello"].format(username=username)}\n\n{_text(t["data_body"].format(filename=filename))}\n\n'
            f'{t["data_summary"]}\n{lines}\n\n{t["data_rights"]}')
    return t["data_subject"], text, _layout(t["data_title"], body, t["data_title"], t)


# ── Senders (run as background tasks; never raise) ──────────────────────────────

def _safe_send(to_email: str, built: tuple[str, str, str], attachments: list | None = None):
    try:
        _send(to_email, *built, attachments=attachments)
    except Exception:
        log.exception("Email '%s' to %s failed", built[0], to_email)


async def send_reset_password_email(email: str, token: str, username: str = "", language: str = "fr"):
    _safe_send(email, reset_password_email(token, username, language))


async def send_account_created_email(email: str, username: str = "", language: str = "fr"):
    _safe_send(email, welcome_email(username, language))


async def send_account_deleted_email(email: str, username: str, language: str = "fr"):
    _safe_send(email, account_deleted_email(username, language))


async def send_admin_role_email(email: str, username: str, granted: bool, language: str = "fr"):
    _safe_send(email, admin_role_email(username, granted, language))


async def send_username_changed_email(email: str, old: str, new: str, language: str = "fr"):
    _safe_send(email, username_changed_email(old, new, language))


async def send_password_changed_email(email: str, username: str, language: str = "fr"):
    _safe_send(email, password_changed_email(username, _paris_now(), language))


async def send_personal_data_email(email: str, username: str, summary: dict, filename: str,
                                   data: bytes, language: str = "fr"):
    _safe_send(email, personal_data_email(username, summary, filename, language), [(filename, data)])
