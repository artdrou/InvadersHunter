# MapSI - Application de Carte Interactive

## 📱 Étape 1 : Carte de base avec géolocalisation

### Fonctionnalités actuelles
- ✅ Carte interactive (zoom/dézoom avec les doigts)
- ✅ Déplacement sur la carte
- ✅ Géolocalisation (centrage automatique au démarrage)
- ✅ Bouton pour recentrer sur votre position

---

## 🚀 Installation et lancement

### Prérequis
1. **Node.js** installé sur votre ordinateur
   - Téléchargez sur : https://nodejs.org/
   - Vérifiez l'installation : `node --version`

2. **Expo Go** sur votre téléphone
   - Android : https://play.google.com/store/apps/details?id=host.exp.exponent
   - iOS : https://apps.apple.com/app/expo-go/id982107779

### Installation

1. **Ouvrir un terminal** dans le dossier MapSI

2. **Installer les dépendances** :
   ```bash
   npm install
   ```

3. **Lancer l'application** :
   ```bash
   npm start
   ```
   ou
   ```bash
   npx expo start
   ```

4. **Scanner le QR code** qui apparaît avec :
   - **Android** : L'app Expo Go (bouton "Scan QR Code")
   - **iOS** : L'appareil photo normal (il détectera automatiquement le QR code Expo)

5. L'application se chargera sur votre téléphone !

---

## 📝 Notes importantes

### Permission de localisation
Au premier lancement, l'app demandera l'autorisation d'accéder à votre position. Acceptez pour profiter de la fonctionnalité de géolocalisation.

### Pour Android : Configuration Google Maps
Si vous êtes sur Android et que la carte ne s'affiche pas correctement :
1. Obtenez une clé API Google Maps : https://console.cloud.google.com/
2. Remplacez `VOTRE_CLE_API_GOOGLE_MAPS` dans `app.json`

Pour iOS, aucune clé n'est nécessaire (Apple Maps est utilisé).

---

## 🎯 Prochaines étapes

- [ ] Ajout de points d'intérêt (SI)
- [ ] Suppression de SI
- [ ] Informations détaillées sur chaque SI
- [ ] Statuts des SI
- [ ] Filtrage par statut
- [ ] Scanner de dossier photos
- [ ] Personnalisation visuelle

---

## 🐛 Problèmes courants

### "Metro Bundler" ne démarre pas
```bash
# Nettoyez le cache
npx expo start -c
```

### L'app ne se connecte pas sur le téléphone
- Assurez-vous que votre téléphone et votre PC sont sur le même réseau WiFi
- Désactivez temporairement les VPN

### Erreur de permissions
- Sur iOS : Allez dans Réglages > MapSI > Localisation > "Lorsque l'app est active"
- Sur Android : Réglages > Apps > MapSI > Autorisations > Localisation

---

## 📞 Besoin d'aide ?

Si vous rencontrez des problèmes, notez :
- Le message d'erreur exact
- Votre système d'exploitation (Android/iOS)
- La version de Node.js (`node --version`)
