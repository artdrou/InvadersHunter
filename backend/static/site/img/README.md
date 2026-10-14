# Site images

App screenshots were taken on a Pixel 10 (dev app, demo account `demo_hunter`
on the dev backend), then cropped and compressed:

- `hero-map.jpg`, `hero-list.jpg`, `admin-list.jpg`, `admin-detail.jpg`: full screen minus status bar and gesture bar, 720 wide
- `feature-*.jpg`: a 1080×1500 window of the screen, resized to 720×1000
- `feature-route.jpg`: GPS coordinates of start / end blurred
- `sync-tool.jpg`: the flash import page (`/flash-import/web`), headless Chrome 960×600 @1.5×
- `qr-download.png`: QR code to `https://invader-hunter-production.up.railway.app/apk/download`

A missing file shows a dashed placeholder with its name. Brand assets (logo, invaders, favicons) are in `brand/`, copied at web size from
`design/logo/out/` (regenerate with `python design/logo/build_assets.py`).
