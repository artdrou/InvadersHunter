import { useEffect, useState } from "react";
import { useSQLiteContext } from "expo-sqlite";
import { EDIT_FIELDS, type EditField } from "../edit-fields";

/**
 * Details of the invader this user already proposed and that are still pending
 * (local SQLite — works offline). One pending proposal per user, invader and
 * detail: those details can't be proposed again until reviewed; the others can.
 */
export function usePendingFields(invaderId: number): Set<EditField> {
  const db = useSQLiteContext();
  const [pending, setPending] = useState<Set<EditField>>(new Set());
  useEffect(() => {
    db.getAllAsync<{ pending_fields: string | null }>(
      'SELECT pending_fields FROM user_requests WHERE invader_id = ? AND request_type = ? AND status = ?',
      [invaderId, 'modify', 'pending'],
    ).then((rows) => {
      const fields = new Set<EditField>();
      for (const row of rows) {
        // Stored before the column existed: unknown, assume it covers everything
        const list = row.pending_fields == null ? EDIT_FIELDS : row.pending_fields.split(',').filter(Boolean);
        list.forEach((f) => fields.add(f as EditField));
      }
      setPending(fields);
    }).catch(() => {});
  }, [invaderId, db]);
  return pending;
}
