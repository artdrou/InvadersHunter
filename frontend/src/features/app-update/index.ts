export { UpdateAvailableModal } from './components/UpdateAvailableModal';
export { useAppUpdateStore } from './store';
export { OtaReadyModal } from './components/OtaReadyModal';
export { useOtaUpdateCheck } from './hooks/use-ota-update-check';
export {
  fetchVersionManifest,
  getCurrentVersion,
  resolveApkUrl,
  isNewer,
} from './services/app-update.api';
export type { VersionManifest } from './types';
