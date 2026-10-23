"""Regénère index.html : la galerie de toutes les maquettes de screens/.

Usage (depuis design/mockups) :  python build_index.py

Chaque page de screens/<groupe>/<ecran>.html apparaît automatiquement, avec son <title>.
Pour ajouter un écran : copier une page existante dans le bon dossier, la modifier, relancer ce script.
"""
import html
import re
from pathlib import Path

HERE = Path(__file__).parent
GROUPS = {
    "01-demarrage": "Démarrage et connexion",
    "02-carte": "Carte",
    "03-invaders": "Invaders et actualités",
    "04-social": "Social",
    "05-reglages": "Réglages",
    "06-admin": "Admin",
    "07-fenetres": "Fenêtres et messages",
}
SUFFIX = " — maquette InvadersHunter"


def page_info(path: Path):
    text = path.read_text(encoding="utf-8")
    title = re.search(r"<title>(.*?)</title>", text, re.S)
    title = title.group(1).replace(SUFFIX, "").strip() if title else path.stem
    source = re.search(r"<!--\s*Source\s*:\s*(.*?)-->", text, re.S)
    return title, (source.group(1).strip() if source else "")


def build():
    sections = []
    count = 0
    for folder in sorted((HERE / "screens").iterdir()):
        if not folder.is_dir():
            continue
        cards = []
        for page in sorted(folder.glob("*.html")):
            title, source = page_info(page)
            rel = page.relative_to(HERE).as_posix()
            count += 1
            cards.append(f"""        <a class="card" href="{rel}" data-src="{rel}">
          <div class="frame"><iframe loading="lazy" tabindex="-1" title="{html.escape(title)}" src="{rel}?embed"></iframe></div>
          <b>{html.escape(title)}</b>
          <span>{html.escape(page.name)}{' · ' + html.escape(source) if source else ''}</span>
        </a>""")
        name = GROUPS.get(folder.name, folder.name)
        sections.append(f"""    <section id="{folder.name}">
      <h2>{html.escape(name)} <small>{len(cards)}</small></h2>
      <div class="grid">
{chr(10).join(cards)}
      </div>
    </section>""")

    out = TEMPLATE.replace("{{SECTIONS}}", "\n".join(sections)).replace("{{COUNT}}", str(count))
    (HERE / "index.html").write_text(out, encoding="utf-8")
    print(f"index.html : {count} écrans")


TEMPLATE = """<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Maquettes InvadersHunter</title>
<!-- Fichier généré par build_index.py : ne pas modifier à la main, relancer le script. -->
<style>
  :root { --bg:#070b16; --surface:#0f1626; --fg:#e8f0fe; --soft:#9fb3cc; --muted:#5b7a9d; --line:#1e2a3a; --accent:#ccff00; --on-accent:#0a0f1e; }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--fg); font: 15px/1.5 system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; }
  .wrap { max-width: 1400px; margin: 0 auto; padding-block: 28px 64px; padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); }
  header { display: flex; flex-wrap: wrap; gap: 12px 24px; align-items: end; justify-content: space-between; }
  h1 { margin: 0; font-size: clamp(24px, 4vw, 34px); letter-spacing: -0.02em; }
  header p { margin: 4px 0 0; color: var(--soft); max-width: 70ch; }
  nav.groups { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 18px; }
  nav.groups a { color: var(--soft); text-decoration: none; font-size: 13px; padding: 5px 11px; border: 1px solid var(--line); border-radius: 999px; }
  nav.groups a:hover { color: var(--accent); border-color: var(--accent); }
  .themes { display: inline-flex; gap: 2px; background: var(--surface); border: 1px solid var(--line); border-radius: 999px; padding: 3px; }
  .themes button { font: 600 12px/1 system-ui, sans-serif; color: var(--soft); background: none; border: 0; padding: 8px 12px; border-radius: 999px; cursor: pointer; }
  .themes button[aria-pressed="true"] { background: var(--accent); color: var(--on-accent); }
  .themes button:focus-visible, .card:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
  section { margin-top: 40px; }
  h2 { margin: 0 0 14px; font-size: 19px; }
  h2 small { color: var(--muted); font-weight: 400; font-size: 14px; margin-left: 6px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 22px 16px; }
  .card { display: flex; flex-direction: column; gap: 3px; color: inherit; text-decoration: none; min-width: 0; }
  .frame { width: 180px; height: 400px; overflow: hidden; border-radius: 18px; background: #000; box-shadow: 0 0 0 4px #1b2130; margin-bottom: 8px; }
  .frame iframe { width: 360px; height: 800px; border: 0; transform: scale(.5); transform-origin: 0 0; pointer-events: none; display: block; }
  .card:hover .frame { box-shadow: 0 0 0 4px var(--accent); }
  .card b { font-size: 14px; }
  .card span { font-size: 12px; color: var(--muted); overflow-wrap: anywhere; }
</style>
</head>
<body>
<div class="wrap">
  <header>
    <div>
      <h1>Maquettes InvadersHunter</h1>
      <p>{{COUNT}} écrans de l'app telle qu'elle est aujourd'hui, un fichier HTML par écran dans <code>screens/</code>. Clique sur un écran pour l'ouvrir en grand.</p>
    </div>
    <div class="themes" role="group" aria-label="Thème">
      <button type="button" data-theme="dark" aria-pressed="true">Sombre</button>
      <button type="button" data-theme="light" aria-pressed="false">Clair</button>
      <button type="button" data-theme="amber" aria-pressed="false">Ambre</button>
      <button type="button" data-theme="matrix" aria-pressed="false">Matrix</button>
    </div>
  </header>
  <nav class="groups">""" + "".join(f'<a href="#{k}">{v}</a>' for k, v in GROUPS.items()) + """</nav>
{{SECTIONS}}
</div>
<script>
  document.querySelector('.themes').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    const t = b.dataset.theme;
    document.querySelectorAll('.themes button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    document.querySelectorAll('.card').forEach((c) => {
      c.querySelector('iframe').src = c.dataset.src + '?embed&theme=' + t;
      c.href = c.dataset.src + '?theme=' + t;
    });
  });
</script>
</body>
</html>
"""

if __name__ == "__main__":
    build()
