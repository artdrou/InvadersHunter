"""
Friend links: `https://<host>/f/<code>` shares a friend code as a tappable link.

- With the app installed (APK with the intent filter), Android opens the link in
  the app directly once the host is verified through `/.well-known/assetlinks.json`
  (needs the signing certificate fingerprints in `ANDROID_CERT_SHA256`).
- Otherwise the browser shows `landing_page`: who invites you, the code, an
  "Open in HintVaders" button (custom scheme, falls back to the APK download) and
  the download link.

The landing page names the inviter: a friend code is meant to be shared, and the
app shows the same name as soon as the code is typed.
"""
import html
import os
from typing import Optional

from sqlalchemy.orm import Session

from ..core.environment import environment_for_host
from ..models.user import User
from .friend_service import format_code, normalize_code

APP_SCHEME = "hintvaders"

# Android package per backend: each environment's app opens its own links
PACKAGES = {
    "development": "com.invaderhunter.app.dev",
    "staging": "com.invaderhunter.app.stag",
    "production": "com.invaderhunter.app",
}
DEFAULT_PACKAGE = PACKAGES["production"]

# Same artwork as the app's login screen (frontend/assets/images/hintvaders-logo-stacked.png, resized)
LOGO_PATH = "/static/friend_link/logo.png"

TEXTS = {
    "fr": {
        "title": "Invitation HintVaders",
        "invite": "<b>{name}</b> t'invite à devenir amis sur HintVaders",
        "invite_anon": "On t'invite à devenir amis sur HintVaders",
        "unknown": "Ce code ami n'existe pas (ou plus). Vérifie le lien avec la personne qui te l'a envoyé.",
        "code": "Code ami",
        "open": "Ouvrir dans HintVaders",
        "how": "Dans l'app : onglet Social → Ajouter un ami → colle ce code.",
        "download": "Pas encore l'app ? Télécharger HintVaders",
    },
    "en": {
        "title": "HintVaders invite",
        "invite": "<b>{name}</b> invites you to be friends on HintVaders",
        "invite_anon": "You're invited to be friends on HintVaders",
        "unknown": "This friend code doesn't exist (anymore). Check the link with whoever sent it.",
        "code": "Friend code",
        "open": "Open in HintVaders",
        "how": "In the app: Social tab → Add a friend → paste this code.",
        "download": "Don't have the app yet? Download HintVaders",
    },
}


def _language(accept_language: Optional[str]) -> str:
    first = (accept_language or "").split(",")[0].strip().lower()
    return "fr" if first.startswith("fr") or not first else "en"


def package_for_host(host: Optional[str]) -> str:
    return PACKAGES.get(environment_for_host(host) or "", DEFAULT_PACKAGE)


def landing_page(db: Session, raw_code: str, host: Optional[str], accept_language: Optional[str]) -> str:
    texts = TEXTS[_language(accept_language)]
    code = normalize_code(raw_code)
    inviter = db.query(User).filter(User.friend_code == code).first() if code else None

    base = f"https://{host}" if host else ""
    download_url = f"{base}/apk/download"
    if inviter is None:
        body = f'<p class="lead">{texts["unknown"]}</p>'
    else:
        shown = format_code(code)
        intent = (
            f"intent://f/{shown}#Intent;scheme={APP_SCHEME};package={package_for_host(host)};"
            f"S.browser_fallback_url={download_url};end"
        )
        body = f"""
    <p class="lead">{texts["invite"].format(name=html.escape(inviter.username))}</p>
    <div class="code-box">
      <span class="label">{texts["code"]}</span>
      <span class="code">{shown}</span>
    </div>
    <a class="btn" href="{html.escape(intent)}">{texts["open"]}</a>
    <p class="hint">{texts["how"]}</p>"""

    return f"""<!doctype html>
<html lang="{_language(accept_language)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{texts["title"]}</title>
<style>
  :root {{ --bg:#0a0f1e; --el:#111827; --border:#1e3a5f; --text:#e8f0fe; --muted:#5b7a9d; --accent:#1cf0ff; --shadow:#ff0062; }}
  * {{ box-sizing: border-box; }}
  body {{ margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center;
         background:var(--bg); color:var(--text); font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace; padding:16px; }}
  main {{ width:100%; max-width:420px; text-align:center; display:flex; flex-direction:column; gap:20px; }}
  .logo {{ display:block; width:min(78%, 300px); height:auto; margin:0 auto; }}
  .lead {{ margin:0; font-size:16px; line-height:1.5; }}
  .code-box {{ background:var(--el); border:2px solid var(--border); border-radius:6px; box-shadow:3px 3px 0 rgba(0,0,0,.6);
              padding:16px; display:flex; flex-direction:column; gap:6px; }}
  .label {{ color:var(--muted); font-size:13px; }}
  .code {{ color:var(--accent); font-size:32px; font-weight:700; letter-spacing:4px; user-select:all; }}
  .btn {{ display:block; background:var(--accent); color:var(--shadow); font-weight:700; font-size:18px; text-decoration:none;
         padding:14px; border-radius:8px; box-shadow:3px 3px 0 var(--shadow); }}
  .hint {{ margin:0; color:var(--muted); font-size:13px; line-height:1.5; }}
  .download {{ color:var(--accent); font-size:14px; }}
</style>
</head>
<body>
  <main>
    <img class="logo" src="{LOGO_PATH}" alt="HintVaders">
{body}
    <a class="download" href="{html.escape(download_url)}">{texts["download"]}</a>
  </main>
</body>
</html>"""


def asset_links() -> list:
    """Digital Asset Links for Android App Links verification: every app package may
    open this host's links. Empty (links then open the landing page) until the
    signing certificate SHA-256 fingerprints are set in ANDROID_CERT_SHA256
    (comma-separated, from `eas credentials` / Play Console)."""
    fingerprints = [f.strip().upper() for f in os.getenv("ANDROID_CERT_SHA256", "").split(",") if f.strip()]
    if not fingerprints:
        return []
    return [
        {
            "relation": ["delegate_permission/common.handle_all_urls"],
            "target": {"namespace": "android_app", "package_name": package, "sha256_cert_fingerprints": fingerprints},
        }
        for package in PACKAGES.values()
    ]
