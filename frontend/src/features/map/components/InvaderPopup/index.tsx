import { useState, useEffect } from "react";
import { useSQLiteContext } from "expo-sqlite";
import { useTheme } from "@/contexts/theme-context";
import type { InvaderWithState } from "@/features/invaders";
import { ISS_INVADER_NAME } from "@/features/iss/constants";
import type { ModifyRequestPayload } from "@/features/invaders/services/invaders.api";
import type { UserRequest } from "@/features/invaders/types";
import { makeStyles } from "./styles";
import { PopupShell } from "./PopupShell";
import { PopupView } from "./PopupView";
import { PopupEdit } from "./PopupEdit";

type Props = {
  invader: InvaderWithState;
  pendingCoords?: { lat: number; lon: number } | null;
  onClose: () => void;
  onFlash: (invader: InvaderWithState) => void;
  onUnflash: (invader: InvaderWithState) => void;
  onPickLocation?: (invader: InvaderWithState) => void;
  onHeightChange?: (height: number) => void;
  onRequestSent?: () => void;
  onSubmitModifyRequest: (payload: ModifyRequestPayload) => Promise<UserRequest | null>;
};

/**
 * Invader detail popup. Starts in read-only {@link PopupView}; the modify link
 * (or an incoming pending coordinate) switches to the {@link PopupEdit} form.
 * Both render inside the shared {@link PopupShell}.
 */
export function InvaderPopup({
  invader, pendingCoords, onClose, onFlash, onUnflash,
  onPickLocation, onHeightChange, onRequestSent, onSubmitModifyRequest,
}: Props) {
  const db = useSQLiteContext();
  const { theme, appFont, fontScale } = useTheme();
  const styles = makeStyles(theme, appFont, fontScale);

  const [mode, setMode] = useState<"view" | "edit">(pendingCoords ? "edit" : "view");
  const [alreadySent, setAlreadySent] = useState(false);

  // Read from local SQLite — works offline, no network call.
  useEffect(() => {
    db.getFirstAsync<{ id: number }>(
      'SELECT id FROM user_requests WHERE invader_id = ? AND request_type = ? AND status = ?',
      [invader.id, 'modify', 'pending'],
    ).then((row) => setAlreadySent(!!row)).catch(() => {});
  }, [invader.id, db]);

  const isISS = invader.name === ISS_INVADER_NAME;

  return (
    <PopupShell styles={styles} onHeightChange={onHeightChange}>
      {mode === "edit" ? (
        <PopupEdit
          invader={invader}
          pendingCoords={pendingCoords}
          onClose={onClose}
          onPickLocation={onPickLocation}
          onRequestSent={onRequestSent}
          onSubmitModifyRequest={onSubmitModifyRequest}
          styles={styles}
        />
      ) : (
        <PopupView
          invader={invader}
          isISS={isISS}
          alreadySent={alreadySent}
          onFlash={onFlash}
          onUnflash={onUnflash}
          onModify={() => setMode("edit")}
          onClose={onClose}
          theme={theme}
          styles={styles}
        />
      )}
    </PopupShell>
  );
}
