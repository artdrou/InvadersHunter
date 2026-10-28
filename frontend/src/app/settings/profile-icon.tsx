import { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/contexts/theme-context';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import { type ThemeTokens, ButtonFont, BorderRadius, Spacing, FontSize } from '@/constants/theme';
import { SettingsShell, hapticTap, hapticSuccess, ColorPickerModal } from '@/features/settings';
import { useAuthStore } from '@/features/auth';
import {
  useMyAvatar, useAvatarStore, PlayerAvatar, DEFAULT_AVATAR, AVATAR_SHAPES, sameAvatar, renderAvatarBase64,
  type Avatar, type AvatarShape,
} from '@/features/avatar';
import { decodeBloom, BLOOM_LEVEL_COUNT } from '@/features/marker-customization/generate-markers';
import { arcadeButton, arcadeButtonLabel, arcadeCard, arcadeLabelColor } from '@/constants/arcade-button';
import { ArcadeSectionLabel } from '@/components/ArcadeSectionLabel';
import { ShadowText } from '@/components/ShadowText';
import { ShapePicker } from '@/features/settings/components/ShapePicker';

const PREVIEW = 160;
const THUMB_RENDER = 128;
// Compact bloom read-out, same as the marker customization: size letter + intensity (1..3)
const BLOOM_SIZE_LABELS = ['S', 'M', 'L'];

/** Profile icon editor: same idea as the marker customization (shape, body color, glow). */
export default function ProfileIconScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { theme } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const userId = useAuthStore((s) => s.user?.id);
  const saved = useMyAvatar() ?? DEFAULT_AVATAR;
  const save = useAvatarStore((s) => s.save);

  const [draft, setDraft] = useState<Avatar>(saved);
  const [touched, setTouched] = useState(false);
  const [colorPicker, setColorPicker] = useState<'icon' | 'glow' | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);

  // The saved icon may arrive after the screen opens: follow it until the user edits
  useEffect(() => {
    if (!touched) setDraft(saved);
  }, [saved.shape, saved.icon, saved.glow, saved.bloom]);

  function edit(patch: Partial<Avatar>) {
    setDraft((d) => ({ ...d, ...patch }));
    setTouched(true);
    setError(false);
  }

  // Shape thumbnails in the chosen body color, without glow
  const thumbnails = useMemo(() => {
    const map = new Map<AvatarShape, string>();
    for (const shape of AVATAR_SHAPES) {
      try {
        const base64 = renderAvatarBase64(shape, draft.icon, null, THUMB_RENDER);
        if (base64) map.set(shape, `data:image/png;base64,${base64}`);
      } catch {}
    }
    return map;
  }, [draft.icon]);

  const isDirty = !sameAvatar(draft, saved);
  const bloomDesc = decodeBloom(draft.bloom);

  async function handleSave() {
    if (userId == null || saving) return;
    hapticTap();
    setSaving(true);
    setError(false);
    try {
      await save(userId, sameAvatar(draft, DEFAULT_AVATAR) ? null : draft);
      hapticSuccess();
      router.back();
    } catch {
      setError(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <SettingsShell title={t('avatar.title')}>
      <ShapePicker
        selected={draft.shape}
        onSelect={(shape) => edit({ shape })}
        thumbnail={(shape) => thumbnails.get(shape)}
        preview={<PlayerAvatar avatar={draft} size={PREVIEW} />}
        between={<ArcadeSectionLabel title={t('avatar.sectionShape')} />}
      />

      {/* ── Couleurs ── */}
      <ArcadeSectionLabel title={t('avatar.sectionColors')} />
      <View style={styles.encart}>
        <Pressable
          onPress={() => { hapticTap(); setColorPicker('icon'); }}
          style={({ pressed }) => [styles.param, pressed && styles.pressed]}
        >
          <View style={[styles.swatch, { backgroundColor: draft.icon, borderColor: theme.border }]} />
          <Text style={styles.paramLabel}>{t('markerCustomization.body')}</Text>
        </Pressable>

        <Pressable
          onPress={() => { hapticTap(); setColorPicker('glow'); }}
          style={({ pressed }) => [styles.param, pressed && styles.pressed]}
        >
          <View style={[styles.swatch, { backgroundColor: draft.glow, borderColor: theme.border }]} />
          <Text style={styles.paramLabel}>{t('markerCustomization.gloom')}</Text>
        </Pressable>

        <View style={styles.param}>
          <Text style={styles.stepperValue}>{BLOOM_SIZE_LABELS[bloomDesc.size]}·{bloomDesc.intensity + 1}</Text>
          <View style={styles.stepper}>
            <Pressable
              style={({ pressed }) => [styles.stepperBtn, draft.bloom <= 0 && styles.disabled, pressed && styles.pressed]}
              disabled={draft.bloom <= 0}
              onPress={() => { hapticTap(); edit({ bloom: draft.bloom - 1 }); }}
            >
              <Text style={styles.stepperBtnText}>−</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.stepperBtn, draft.bloom >= BLOOM_LEVEL_COUNT - 1 && styles.disabled, pressed && styles.pressed]}
              disabled={draft.bloom >= BLOOM_LEVEL_COUNT - 1}
              onPress={() => { hapticTap(); edit({ bloom: draft.bloom + 1 }); }}
            >
              <Text style={styles.stepperBtnText}>+</Text>
            </Pressable>
          </View>
          <Text style={styles.paramLabel}>{t('markerCustomization.bloom')}</Text>
        </View>
      </View>

      {error && <Text style={styles.error}>{t('avatar.saveFailed')}</Text>}

      {/* ── Actions ── */}
      <View style={styles.actionsRow}>
        <Pressable
          style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}
          onPress={() => { hapticTap(); edit(DEFAULT_AVATAR); }}
        >
          <ShadowText shadowColor={theme.titleShadow} style={styles.secondaryBtnText} numberOfLines={1}>{t('markerCustomization.reset')}</ShadowText>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.primaryBtn, arcadeButton(theme), (pressed || saving || !isDirty) && styles.pressed]}
          disabled={saving || !isDirty}
          onPress={handleSave}
        >
          {saving
            ? <ActivityIndicator color={arcadeLabelColor(theme)} />
            : <Text style={styles.primaryBtnText}>{t('markerCustomization.validate')}</Text>}
        </Pressable>
      </View>

      {colorPicker && (
        <ColorPickerModal
          visible
          title={t(`markerCustomization.${colorPicker}Color`)}
          currentColor={draft[colorPicker]}
          onClose={() => setColorPicker(null)}
          onValidate={(hex) => edit({ [colorPicker]: hex })}
        />
      )}
    </SettingsShell>
  );
}

function makeStyles(t: ThemeTokens) {
  return StyleSheet.create({
    pressed: { opacity: 0.6 },
    disabled: { opacity: 0.25 },

    encart: {
      flexDirection: 'row', justifyContent: 'space-between',
      ...arcadeCard(t), padding: Spacing.three,
    },
    param: { flex: 1, alignItems: 'center', gap: Spacing.two },
    paramLabel: { color: t.textMuted, fontFamily: ButtonFont, fontSize: FontSize.xs, textAlign: 'center' },
    swatch: { width: 44, height: 44, borderRadius: BorderRadius.sm, borderWidth: 2 },
    stepper: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
    stepperBtn: {
      width: 32, height: 32, alignItems: 'center', justifyContent: 'center',
      borderRadius: BorderRadius.sm, borderWidth: 2, borderColor: t.border, backgroundColor: t.bg,
    },
    stepperBtnText: { color: t.text, fontFamily: ButtonFont, fontSize: FontSize.lg, lineHeight: 22 },
    stepperValue: { minWidth: 42, textAlign: 'center', color: t.text, fontFamily: ButtonFont, fontSize: FontSize.sm },

    error: { color: t.danger, fontFamily: ButtonFont, fontSize: FontSize.sm, textAlign: 'center' },

    actionsRow: { flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.two },
    // Sized to its label (never wraps), Validate takes the rest of the row
    secondaryBtn: {
      paddingVertical: 14, paddingHorizontal: Spacing.three, alignItems: 'center',
      borderRadius: BorderRadius.sm, ...arcadeButton(t, 'outline'),
    },
    secondaryBtnText: { ...arcadeButtonLabel(t, 'outline'), fontSize: FontSize.md },
    primaryBtn: { flex: 1, paddingVertical: 14, alignItems: 'center', borderRadius: BorderRadius.sm },
    primaryBtnText: { ...arcadeButtonLabel(t), fontSize: FontSize.md },
  });
}
