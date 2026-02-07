# 🚀 GUIDE DE DÉMARRAGE RAPIDE - MapSI

## Ce que vous avez maintenant

Une application React Native de base avec :
- ✅ Une carte interactive (Google Maps sur Android, Apple Maps sur iOS)
- ✅ Zoom/dézoom avec les doigts
- ✅ Géolocalisation automatique au démarrage
- ✅ Bouton pour recentrer sur votre position

---

## COMMENCER EN 3 ÉTAPES

### 1️⃣ Installez Node.js (si pas déjà fait)
Téléchargez et installez depuis : https://nodejs.org/
Choisissez la version LTS (recommandée)

### 2️⃣ Installez Expo Go sur votre téléphone
- **Android** : Play Store → "Expo Go"
- **iOS** : App Store → "Expo Go"

### 3️⃣ Lancez l'application

Ouvrez un terminal/invite de commande dans le dossier MapSI et tapez :

```bash
npm install
```

Puis :

```bash
npm start
```

Un QR code apparaîtra dans le terminal. Scannez-le avec :
- **Android** : L'app Expo Go → bouton "Scan QR Code"
- **iOS** : Votre appareil photo (qui ouvrira automatiquement Expo Go)

---

## 🎯 TESTER L'APPLICATION

Une fois lancée sur votre téléphone :

1. **Autorisez la localisation** quand l'app le demande
2. La carte devrait se centrer sur votre position actuelle
3. **Testez le zoom** : pincez avec 2 doigts
4. **Déplacez la carte** : glissez avec votre doigt
5. **Cliquez sur "📍 Ma position"** : la carte se recentre sur vous

---

## ✅ SI ÇA MARCHE

**Parfait ! Dites-moi et on passera à l'étape 2 :**
- Ajout de points d'intérêt (SI) en cliquant sur la carte

---

## ❌ SI ÇA NE MARCHE PAS

### Problème : "npm n'est pas reconnu"
→ Node.js n'est pas installé. Retournez à l'étape 1

### Problème : La carte est grise/vide sur Android
→ Il faut une clé Google Maps API :
1. Allez sur https://console.cloud.google.com/
2. Créez un projet
3. Activez "Maps SDK for Android"
4. Créez une clé API
5. Remplacez `VOTRE_CLE_API_GOOGLE_MAPS` dans le fichier `app.json`

### Problème : Le téléphone ne se connecte pas
→ Vérifiez que PC et téléphone sont sur le même WiFi
→ Essayez : `npm start` puis scannez le QR en mode "Tunnel"

### Problème : "Permission denied" pour la localisation
→ Allez dans les paramètres de votre téléphone
→ Apps → MapSI → Autorisations → Localisation → "Lorsque l'app est active"

---

## 📱 COMMANDES UTILES

```bash
# Lancer l'app
npm start

# Lancer avec cache vidé (si problème)
npx expo start -c

# Arrêter l'app
Ctrl + C dans le terminal
```

---

## 🎓 COMPRENDRE LA STRUCTURE

```
MapSI/
├── App.js          ← Le code principal de l'app
├── package.json    ← Liste des dépendances
├── app.json        ← Configuration de l'app
└── README.md       ← Documentation complète
```

Pour l'instant, tout le code est dans `App.js` - c'est simple et facile à comprendre !

---

## 📞 PRÊT POUR LA SUITE ?

Une fois que ça fonctionne, dites-moi et on ajoutera :

**Étape 2** : Ajouter des SI (points d'intérêt) en appuyant sur la carte
**Étape 3** : Afficher les infos des SI en cliquant dessus
**Étape 4** : Système de statuts
**Étape 5** : Filtrage par statut
**Étape 6** : Scanner de photos
**Étape 7** : Personnalisation visuelle

Une étape à la fois, tranquillement ! 🚀
