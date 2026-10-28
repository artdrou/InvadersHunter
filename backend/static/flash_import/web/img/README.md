# Tutorial screenshots

Drop these PNGs here (same names). Until a file exists, the page shows a dashed
placeholder with its name. Portrait phone screenshots work best (~9:16); the
two marked *wide* are shown landscape.

| File | Shows | Step |
|---|---|---|
| `usb-file-transfer.png` | the phone's USB mode prompt / notification, "File transfer" selected (*wide*) | 1. Connect |
| `build-number.png` | Settings → About phone → Build number (tap 7×) | 2. Troubleshooting |
| `developer-options.png` | Settings → System → Developer options | 2. Troubleshooting |
| `usb-debugging.png` | the "USB debugging" toggle, ON | 2. Troubleshooting |
| `allow-usb-debugging.png` | the "Allow USB debugging?" prompt with "Always allow" ticked | 2. Troubleshooting |
| `browser-picker.png` | Chrome's "wants to connect" device picker listing the phone (*wide*) | 2. Troubleshooting |

`logo.svg` is generated from `dev/markers/src/shape-50.svg` (cyan) and
`shape-40.svg` (red, mirrored); it's also inlined in `index.html`.

## Sources

| File | Source |
|---|---|
| `developer-options.png`, `usb-debugging.png` | [Android Developers](https://developer.android.com/studio/debug/dev-options), CC BY 2.5 (credited in the page footer) |
| `allow-usb-debugging.png` | [FIRST Tech Challenge wiki](https://github.com/FIRST-Tech-Challenge/FtcRobotController/wiki/Enabling-Developer-Options) (credited in the page footer) |
| `build-number.png`, `usb-file-transfer.png` | our own mockups: `src/*.html`, rendered with headless Chrome at 2× (`--window-size=360,640` and `720,405`) |
