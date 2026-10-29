import { useMemo, useState } from "react";
import { Modal, View, Text, TextInput, Pressable, FlatList, StyleSheet, useWindowDimensions } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/contexts/theme-context";
import { type ThemeTokens, FontSize, BorderRadius, Spacing, ButtonFontBold } from "@/constants/theme";
import { arcadeCard } from "@/constants/arcade-button";
import { ShadowText } from "@/components/ShadowText";
import type { InvaderWithState } from "@/features/invaders/types";
import { InvaderGridCell } from "@/features/invaders/components/InvaderGridCell";
import { missingLocationGroups } from "../missing-location";

const COLUMNS = 4;
const CARD_MAX_WIDTH = 440;

type Props = {
  visible: boolean;
  invaders: InvaderWithState[];
  onSelect: (invader: InvaderWithState) => void;
  onClose: () => void;
};

/**
 * Long-press → "add a location to an existing invader": every invader without a
 * position, as a photo grid grouped by city (always expanded), with a name search.
 */
export function MissingLocationList({ visible, invaders, onSelect, onClose }: Props) {
  const { t } = useTranslation();
  const { theme, appFont, fontScale } = useTheme();
  const { width: windowWidth } = useWindowDimensions();
  const styles = makeStyles(theme, appFont, fontScale);
  const [query, setQuery] = useState("");

  const groups = useMemo(() => missingLocationGroups(invaders, query), [invaders, query]);
  const cardWidth = Math.min(CARD_MAX_WIDTH, windowWidth - 2 * Spacing.three);
  const cellSize = Math.floor((cardWidth - 2 * Spacing.three - (COLUMNS - 1) * Spacing.two) / COLUMNS);

  function close() {
    setQuery("");
    onClose();
  }

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={close}>
      <Pressable style={styles.overlay} onPress={close}>
        <Pressable style={[styles.card, { width: cardWidth }]} onPress={() => {}}>
          <View style={styles.header}>
            <View style={styles.titleWrap}>
              <ShadowText shadowColor={theme.titleShadow} style={styles.title}>{t("map.missingLocationTitle")}</ShadowText>
            </View>
            <Pressable onPress={close} hitSlop={8}>
              <Text style={styles.close}>✕</Text>
            </Pressable>
          </View>
          <Text style={styles.muted}>{t("map.missingLocationHint")}</Text>

          <TextInput
            style={styles.search}
            value={query}
            onChangeText={setQuery}
            placeholder={t("map.missingLocationSearch")}
            placeholderTextColor={theme.textMuted}
            autoCapitalize="characters"
            autoCorrect={false}
            clearButtonMode="while-editing"
          />

          <FlatList
            data={groups}
            keyExtractor={([city]) => city}
            keyboardShouldPersistTaps="handled"
            style={styles.list}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <Text style={[styles.muted, styles.empty]}>
                {t(query.trim() ? "map.missingLocationNoMatch" : "map.missingLocationEmpty")}
              </Text>
            }
            renderItem={({ item: [city, list] }) => (
              <View style={styles.section}>
                <View style={styles.cityRow}>
                  <Text style={styles.city}>{city}</Text>
                  <Text style={styles.count}>{list.length}</Text>
                </View>
                <View style={styles.grid}>
                  {list.map((inv) => (
                    <View key={inv.id} style={{ width: cellSize }}>
                      <InvaderGridCell invader={inv} size={cellSize} selected={false} onPress={() => { setQuery(""); onSelect(inv); }} />
                    </View>
                  ))}
                </View>
              </View>
            )}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function makeStyles(t: ThemeTokens, font: string, scale: number) {
  const sz = (n: number) => Math.round(n * scale);
  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.6)",
      justifyContent: "center",
      alignItems: "center",
    },
    card: {
      height: "80%",
      ...arcadeCard(t),
      padding: Spacing.three,
      gap: Spacing.two,
    },
    header: { flexDirection: "row", alignItems: "center", gap: Spacing.two },
    titleWrap: { flex: 1 },
    title: { color: t.accent, fontFamily: ButtonFontBold, fontSize: sz(FontSize.lg), letterSpacing: 1 },
    close: { color: t.textMuted, fontSize: sz(FontSize.lg) },
    search: {
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: BorderRadius.sm,
      paddingHorizontal: Spacing.two,
      paddingVertical: Spacing.two,
      color: t.text,
      fontFamily: font,
      fontSize: sz(FontSize.sm),
      backgroundColor: t.bg,
    },
    list: { flex: 1 },
    listContent: { gap: Spacing.three, paddingBottom: Spacing.two },
    section: { gap: Spacing.two },
    cityRow: {
      flexDirection: "row",
      alignItems: "center",
      borderBottomWidth: 1,
      borderBottomColor: t.border,
      paddingBottom: Spacing.one,
    },
    city: { flex: 1, color: t.accent, fontFamily: font, fontSize: sz(FontSize.md), letterSpacing: 1 },
    count: { color: t.textMuted, fontFamily: font, fontSize: sz(FontSize.xs) },
    grid: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.two },
    muted: { color: t.textMuted, fontFamily: font, fontSize: sz(FontSize.xs) },
    empty: { textAlign: "center", paddingVertical: Spacing.four },
  });
}
