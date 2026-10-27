// Barrel: only screens outside this feature import from here. Components inside
// the feature import siblings directly (see feedback on barrel require cycles).
export type {
  FriendEntry, FriendsOverview, FriendProfile, FriendMapView, FriendMapMode, FriendLookup, FriendRelation,
} from './types';
export {
  fetchFriendsOverview,
  fetchFriendCode,
  lookupUsername,
  sendFriendRequest,
  acceptFriendRequest,
  removeFriendship,
  fetchFriendProfile,
} from './services/friends.api';
export { useFriendsStore } from './store';
export { useUsernameLookup } from './hooks/use-username-lookup';
export { applyFriendView, friendRequestError, friendLink } from './utils';
export type { FriendRequestError } from './utils';
export { FriendMapPicker } from './components/FriendMapPicker';
export { FriendMapBanner } from './components/FriendMapBanner';
export { MyFriendCodeCard } from './components/MyFriendCodeCard';
