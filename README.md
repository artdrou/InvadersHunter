# InvadersHunter

A mobile app for hunting Space Invaders street art. Browse a map of known invaders, flash the ones you find in real life, and contribute sightings to a shared database.

The app works offline — your flashes are saved locally and synced when you reconnect.

---

## Download the Android APK

Scan the QR code below or use the direct link to install the latest preview build on Android. The link always points to the latest GitHub release, so you don't need to refresh it between versions.

![APK QR Code](docs/apk-qr.png)

[Direct download link](https://github.com/artdrou/InvadersHunter/releases/latest/download/InvadersHunter-latest.apk)

Once installed, the app prompts you in-app when a new APK is available (no need to scan again).

> Android only for now. iOS support is not planned at this stage.

---

## What it does

- Map view showing all known Space Invaders with their location and status
- Tap an invader to see its details (name, photo, points)
- Flash an invader to mark it as found — or unflash if it has been destroyed
- Filter the map by flash status or invader state
- Submit location corrections or state updates that admins can review and approve
- Admin panel for reviewing and approving user submissions
- GPS localization with an accuracy indicator
- Offline-first: everything works without a connection, changes sync when back online

---

## Project structure

```
InvadersHunter/
  backend/     FastAPI API + PostgreSQL (Neon)
  frontend/    Expo app (React Native)
```

See each subfolder for its own setup instructions:

- [backend/README.md](backend/README.md)
- [frontend/README.md](frontend/README.md)

---

## Credits

Space Invaders street art is the original work of the artist **Invader**.
Invader location data and photos are sourced from [invader-spotter.art](https://www.invader-spotter.art/).

This project is an unofficial fan tool and is not affiliated with or endorsed by the artist.

---

## License

MIT License — see [LICENSE](LICENSE) for details.
