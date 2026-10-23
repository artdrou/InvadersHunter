# Maquettes InvadersHunter

Un fichier HTML par écran de l'app, pour tester des idées de design rapidement avant de les coder dans l'app.

## Ouvrir

- **Galerie** : double-cliquer sur `index.html` (tous les écrans en miniature, choix du thème).
- **Un écran** : double-cliquer sur `screens/<groupe>/<ecran>.html`. Les boutons en haut changent le thème (Sombre, Clair, Ambre, Matrix).
- Il faut Internet pour les icônes (Lucide, chargées depuis unpkg.com). Les polices sont intégrées.

## Modifier

- **Un seul écran** : ouvrir le `.html` dans VS Code. Le bloc `<style>` en haut contient les styles propres à cet écran, le HTML en dessous suit l'ordre de l'écran. Recharger le navigateur (F5) pour voir le résultat.
- **Tous les écrans d'un coup** (couleurs, tailles de texte, arrondis, boutons, onglets…) : `_shared/app.css`. Les couleurs des 4 thèmes sont en haut du fichier, avec les mêmes noms que `frontend/src/constants/theme.ts`.
- **Icônes** : `<i data-lucide="nom"></i>`, noms sur https://lucide.dev/icons
- **Sprite d'invader** : `<i class="spr" data-w="24" data-color="var(--success)"></i>`
- **Marqueur de la carte** : `<img class="mk" data-pts="30" data-state="captured" style="left:40%;top:50%">` (états : captured, uncaptured, mine, friend, grey)

## Ajouter un écran

1. Copier un écran proche dans le bon dossier de `screens/` et le renommer.
2. Changer son `<title>` et son contenu.
3. Relancer la galerie : `python build_index.py` (depuis ce dossier).

## Dossiers

| Dossier | Contenu |
|---|---|
| `screens/` | Les écrans, par groupe (démarrage, carte, invaders, social, réglages, admin, fenêtres) |
| `_shared/` | `app.css` (thèmes + composants communs), `app.js` (onglets, sprites, carte, thèmes), `fonts.css` (polices), `assets/` (marqueurs, splash) |
| `directions/` | Premier essai de directions (Néon, Arcade, Mosaïque), gardé comme référence |

## Idées retenues du premier essai (à appliquer)

- Popup d'un invader flashé : l'état « Flashé » reste affiché, avec un petit bouton « Déflasher » qui apparaît, plutôt qu'un gros bouton bascule
- Titre façon Arcade (Pixelmania jaune, ombre rose décalée)
- Liste dépliable par ville avec la progression (code, x/y, barre en blocs, lignes « PA_1038 ....... 20 »)
- Effet bicolore sur l'onglet actif (jaune avec ombre rose)
- Petit récap en haut des réglages (pseudo, rang, score, flashs, villes)
- Le look Arcade, mais en moins poussé
