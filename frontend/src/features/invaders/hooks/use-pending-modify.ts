import { useEffect, useState } from "react";
import { useSQLiteContext } from "expo-sqlite";

/** Whether this user already has a pending modify request for the invader (local
 *  SQLite — works offline). `refresh` re-reads it, e.g. after sending one. */
export function usePendingModify(invaderId: number): [boolean, () => void] {
  const db = useSQLiteContext();
  const [sent, setSent] = useState(false);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    db.getFirstAsync<{ id: number }>(
      'SELECT id FROM user_requests WHERE invader_id = ? AND request_type = ? AND status = ?',
      [invaderId, 'modify', 'pending'],
    ).then((row) => setSent(!!row)).catch(() => {});
  }, [invaderId, db, tick]);
  return [sent, () => setTick((n) => n + 1)];
}
