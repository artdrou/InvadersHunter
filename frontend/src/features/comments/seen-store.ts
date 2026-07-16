import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Per-invader count of comments the user has already seen (last time they
 * opened the wall). The map-popup badge turns red when the live count exceeds
 * the seen count — i.e. there are new comments since the last visit.
 */
type CommentSeenState = {
  seen: Record<number, number>;
  markSeen: (invaderId: number, count: number) => void;
};

export const useCommentSeenStore = create<CommentSeenState>()(
  persist(
    (set) => ({
      seen: {},
      markSeen: (invaderId, count) =>
        set((s) => ({ seen: { ...s.seen, [invaderId]: count } })),
    }),
    {
      name: 'comment-seen-storage',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);

/** True when there are comments the user hasn't seen yet for this invader. */
export function hasNewComments(seen: Record<number, number>, invaderId: number, count: number): boolean {
  return count > (seen[invaderId] ?? 0);
}
