import { useCallback, useEffect, useMemo, useState } from "react";
import { View, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useTheme } from "@/contexts/theme-context";
import { Spacing } from "@/constants/theme";
import { useRequireAccount } from "@/features/auth";
import { hapticSuccess } from "@/features/settings";
import { useLocateStore, type PickReturnTarget } from "@/features/map/store";
import { PopupEdit } from "@/features/map/components/InvaderPopup/PopupEdit";
import { makeStyles as makePopupStyles } from "@/features/map/components/InvaderPopup/styles";
import type { ModifyRequestPayload } from "../services/invaders.api";
import type { InvaderWithState, UserRequest } from "../types";
import type { EditField } from "../edit-fields";
import { InvaderInfoPanel } from "../components/InvaderInfoPanel";

type Options = {
  /** Which screen this list is: the map's location picker comes back to it. */
  target: PickReturnTarget;
  /** The invader whose panel is open: switching / collapsing drops an open edit form. */
  expandedInvaderId: number | null;
  /** Re-open a panel (and its group) when coming back from the map picker. */
  expandInvader: (invaderId: number) => void;
  onSubmitModifyRequest: (payload: ModifyRequestPayload) => Promise<UserRequest | null>;
  onFlash: (inv: InvaderWithState) => void;
  onUnflash: (inv: InvaderWithState) => void;
  onLocate?: (inv: InvaderWithState) => void;
};

type Editing = {
  invaderId: number;
  field: EditField | null;
  coords: { lat: number; lon: number } | null;
};

/**
 * Info panel + in-place edit form for invader lists (Invaders tab, incomplete
 * invaders page): "Modifier" and the "+ Add" chips open the edit form in the list;
 * a location is picked on the map, which then comes back here with it.
 */
export function useListEditing({
  target, expandedInvaderId, expandInvader, onSubmitModifyRequest, onFlash, onUnflash, onLocate,
}: Options) {
  const router = useRouter();
  const requireAccount = useRequireAccount();
  const { theme, appFont, fontScale } = useTheme();
  const popupStyles = useMemo(() => makePopupStyles(theme, appFont, fontScale), [theme, appFont, fontScale]);
  const setPickForList = useLocateStore((s) => s.setPickForList);
  const pickedForList = useLocateStore((s) => s.pickedForList);
  const setPickedForList = useLocateStore((s) => s.setPickedForList);
  const [editing, setEditing] = useState<Editing | null>(null);

  const pickLocation = useCallback((invader: InvaderWithState) => {
    setPickForList({ invaderId: invader.id, target });
    router.navigate("/(tabs)/map");
  }, [setPickForList, target, router]);

  // "Modifier" (field null) or "+ Add": the form opens in the list; a missing
  // location goes straight to the map picker
  const handleModify = useCallback((invader: InvaderWithState, field: EditField | null) => {
    requireAccount(() => {
      if (field === "location") { pickLocation(invader); return; }
      setEditing({ invaderId: invader.id, field, coords: null });
    });
  }, [requireAccount, pickLocation]);

  // Back from the map picker (only the list that asked consumes it)
  useEffect(() => {
    if (!pickedForList || pickedForList.target !== target) return;
    const { invaderId, lat, lon } = pickedForList;
    setPickedForList(null);
    expandInvader(invaderId);
    setEditing((prev) => ({
      invaderId,
      field: prev?.invaderId === invaderId ? prev.field : null,
      coords: { lat, lon },
    }));
  }, [pickedForList, target, setPickedForList, expandInvader]);

  useEffect(() => {
    setEditing((prev) => (prev && prev.invaderId !== expandedInvaderId ? null : prev));
  }, [expandedInvaderId]);

  const renderPanel = useCallback((invader: InvaderWithState, containerStyle: object) => {
    if (editing?.invaderId === invader.id) {
      return (
        <View style={[styles.editPanel, { backgroundColor: theme.bgElement }, containerStyle]}>
          <PopupEdit
            invader={invader}
            pendingCoords={editing.coords}
            initialField={editing.field}
            onClose={() => setEditing(null)}
            onPickLocation={pickLocation}
            onRequestSent={() => hapticSuccess()}
            onSubmitModifyRequest={onSubmitModifyRequest}
            styles={popupStyles}
          />
        </View>
      );
    }
    return (
      <InvaderInfoPanel
        invader={invader}
        onFlash={onFlash}
        onUnflash={onUnflash}
        onLocate={onLocate}
        onModify={handleModify}
        containerStyle={containerStyle}
      />
    );
  }, [editing, theme, popupStyles, pickLocation, onSubmitModifyRequest, onFlash, onUnflash, onLocate, handleModify]);

  return { renderPanel };
}

const styles = StyleSheet.create({
  editPanel: { padding: Spacing.three, gap: Spacing.two },
});
