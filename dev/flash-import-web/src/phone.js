// Phone access for the Flash Import web page, over WebUSB (Tango ADB).
//
// Mirrors what backend/static/flash_import/import_flashes.ps1 does with adb.exe:
// list the FlashInvaders app folder and return the file names. Bundled by
// build.mjs into backend/static/flash_import/web/phone.js.
import { Adb, AdbDaemonTransport } from '@yume-chan/adb';
import { AdbDaemonWebUsbDevice, AdbDaemonWebUsbDeviceManager } from '@yume-chan/adb-daemon-webusb';
import AdbWebCredentialStore from '@yume-chan/adb-credential-web';

const FLASH_INVADERS_PKG = 'com.ltu.flashInvader';
export const CANDIDATE_PATHS = [
  `/sdcard/Android/data/${FLASH_INVADERS_PKG}/files/Pictures`,
  `/sdcard/Android/data/${FLASH_INVADERS_PKG}/files/Flashes`,
  `/sdcard/Android/data/${FLASH_INVADERS_PKG}/files`,
  `/sdcard/Android/data/${FLASH_INVADERS_PKG}/cache`,
];

/** Errors the page turns into a troubleshooting hint (see `code`). */
export class PhoneError extends Error {
  constructor(code, cause) {
    super(code);
    this.code = code;
    this.cause = cause;
  }
}

const manager = AdbDaemonWebUsbDeviceManager.BROWSER;
// The adb key lives in this browser (IndexedDB): "Always allow" on the phone sticks.
const credentialStore = new AdbWebCredentialStore('InvadersHunter Flash Import');

let adb = null;

export function isSupported() {
  return !!manager && window.isSecureContext;
}

/**
 * Ask the user to pick their phone in the browser's USB dialog, then open an
 * adb session. `onWaitingForApproval` fires if the phone hasn't approved this
 * browser yet (the "Allow USB debugging?" prompt is up on the phone).
 */
export async function connect({ onWaitingForApproval } = {}) {
  if (!isSupported()) throw new PhoneError('unsupported');
  await disconnect();

  let device;
  try {
    device = await manager.requestDevice();
  } catch (e) {
    throw new PhoneError('picker', e);
  }
  if (!device) throw new PhoneError('no-device');

  let connection;
  try {
    connection = await device.connect();
  } catch (e) {
    if (e instanceof AdbDaemonWebUsbDevice.DeviceBusyError) throw new PhoneError('busy', e);
    throw new PhoneError('usb', e);
  }

  // Authentication blocks until the user taps "Allow" on the phone.
  const approvalTimer = setTimeout(() => onWaitingForApproval?.(), 1200);
  try {
    const transport = await AdbDaemonTransport.authenticate({
      serial: device.serial,
      connection,
      credentialStore,
    });
    adb = new Adb(transport);
  } catch (e) {
    throw new PhoneError('auth', e);
  } finally {
    clearTimeout(approvalTimer);
  }

  const [model, manufacturer, android] = await Promise.all([
    adb.getProp('ro.product.model'),
    adb.getProp('ro.product.manufacturer'),
    adb.getProp('ro.build.version.release'),
  ]);
  return { serial: device.serial, model: model.trim(), manufacturer: manufacturer.trim(), android: android.trim() };
}

/**
 * List the FlashInvaders flash files: the first candidate folder that has any.
 * `onPath(path, count)` reports each folder tried, for the page's log.
 */
export async function listFlashFiles({ onPath } = {}) {
  if (!adb) throw new PhoneError('not-connected');
  for (const path of CANDIDATE_PATHS) {
    const out = await adb.subprocess.noneProtocol.spawnWaitText(['ls', '-1', path]);
    const files = out.split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('ls:') && !l.includes('No such file') && !l.includes('Permission denied'));
    onPath?.(path, files.length);
    if (files.length > 0) return { path, files };
  }
  throw new PhoneError('no-folder');
}

/** Release the USB interface so adb / another tab can use the phone. */
export async function disconnect() {
  if (!adb) return;
  const current = adb;
  adb = null;
  try { await current.close(); } catch { /* already gone (cable unplugged) */ }
}
