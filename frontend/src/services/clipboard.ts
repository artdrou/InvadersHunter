/** expo-clipboard is a native module: loaded on first copy, so an APK built without
 *  it only loses the Copy button instead of crashing on start. Returns false when
 *  the clipboard isn't available (callers fall back to the share sheet). */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    const Clipboard = require('expo-clipboard') as typeof import('expo-clipboard');
    await Clipboard.setStringAsync(text);
    return true;
  } catch {
    return false;
  }
}
