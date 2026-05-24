export { UpdateAvailableModal } from './components/UpdateAvailableModal';
export { useAppUpdateStore } from './store';
export {
  fetchVersionManifest,
  getCurrentVersion,
  resolveApkUrl,
  isNewer,
} from './services/app-update.api';
export type { VersionManifest } from './types';
