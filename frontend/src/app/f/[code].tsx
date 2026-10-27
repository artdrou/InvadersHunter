import { useEffect } from 'react';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { useFriendsStore } from '@/features/friends';

/**
 * Friend link (`https://<host>/f/<code>` or `hintvaders://f/<code>`): hands the code
 * to the Social tab, which fills the "Add a friend" field with it. Signed out, the
 * login screen comes first and the code waits in the store.
 */
export default function FriendLinkScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const setPendingCode = useFriendsStore((s) => s.setPendingCode);

  useEffect(() => { if (code) setPendingCode(code); }, [code, setPendingCode]);

  return <Redirect href="/(tabs)/social" />;
}
