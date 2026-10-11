import { useState } from "react";
import { useTheme } from "@/contexts/theme-context";
import { useRequireAccount } from "@/features/auth";
import type { InvaderWithState } from "@/features/invaders";
import { ISS_INVADER_NAME } from "@/features/iss/constants";
import type { ModifyRequestPayload } from "@/features/invaders/services/invaders.api";
import type { UserRequest } from "@/features/invaders/types";
import type { EditField } from "@/features/invaders/edit-fields";
import { usePendingModify } from "@/features/invaders/hooks/use-pending-modify";
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
  const requireAccount = useRequireAccount();
  const { theme, appFont, fontScale } = useTheme();
  const styles = makeStyles(theme, appFont, fontScale);

  const [mode, setMode] = useState<"view" | "edit">(pendingCoords ? "edit" : "view");
  const [editField, setEditField] = useState<EditField | null>(null);
  const [alreadySent] = usePendingModify(invader.id);

  // "+ Add" on a missing detail: location goes straight to the map picker,
  // anything else opens the edit form (photo also asks for the photo)
  function addMissing(field: EditField) {
    requireAccount(() => {
      if (field === "location") { onPickLocation?.(invader); return; }
      setEditField(field);
      setMode("edit");
    });
  }

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
          initialField={editField}
          styles={styles}
        />
      ) : (
        <PopupView
          invader={invader}
          isISS={isISS}
          alreadySent={alreadySent}
          onFlash={onFlash}
          onUnflash={onUnflash}
          onModify={() => requireAccount(() => { setEditField(null); setMode("edit"); })}
          onAddMissing={addMissing}
          onClose={onClose}
          theme={theme}
          styles={styles}
        />
      )}
    </PopupShell>
  );
}
