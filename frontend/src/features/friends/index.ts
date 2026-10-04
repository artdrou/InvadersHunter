// Barrel: only screens outside this feature import from here. Components inside
// the feature import siblings directly (see feedback on barrel require cycles).
export type { FriendEntry, FriendsOverview, FriendProfile, FriendMapView, FriendMapMode } from './types';
export {
  fetchFriendsOverview,
  sendFriendRequest,
  acceptFriendRequest,
  removeFriendship,
  fetchFriendProfile,
} from './services/friends.api';
export { useFriendsStore } from './store';
export { applyFriendView, friendRequestError } from './utils';
export type { FriendRequestError } from './utils';
export { FriendMapPicker } from './components/FriendMapPicker';
export { FriendMapBanner } from './components/FriendMapBanner';
