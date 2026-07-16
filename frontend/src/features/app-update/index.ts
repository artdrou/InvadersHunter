export { UpdateAvailableModal } from './components/UpdateAvailableModal';
export { useAppUpdateStore } from './store';
export { useOtaReload } from './hooks/use-ota-reload';
export {
  fetchVersionManifest,
  getCurrentVersion,
  resolveApkUrl,
  isNewer,
} from './services/app-update.api';
export type { VersionManifest } from './types';
