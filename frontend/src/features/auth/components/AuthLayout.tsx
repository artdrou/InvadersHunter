/**
 * Shell of the signed-out screens (login, register, forgot password): the street grid
 * behind the whole screen, then the stacked HintVaders logo and the screen's form right
 * below it. The logo takes almost the whole width but shrinks so the form stays on
 * screen (same size on screens whose form is not taller than login's); the column
 * scrolls when the keyboard opens.
 * Artwork: design/logo/wordmark.py.
 */
import { ReactNode, useState } from 'react';
import { View, Image, ScrollView, StyleSheet, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/contexts/theme-context';
import { Spacing } from '@/constants/theme';
import { StreetsBackground } from '@/components/StreetsBackground';

const LOGO_DARK = require('../../../../assets/images/hintvaders-logo-stacked.png');
const LOGO_LIGHT = require('../../../../assets/images/hintvaders-logo-stacked-light.png');
const { width: LW, height: LH } = Image.resolveAssetSource(LOGO_DARK);
const LOGO_MAX_W = 560;            // tablets
const LOGO_SCREEN_W = 0.94;        // share of the screen width
// Forms shorter than this still leave the logo the size it has on login (the tallest
// usual form), so it stays the same size from one screen to the next.
const MIN_FORM_H = 320;
const PAD_TOP = Spacing.four, PAD_BOTTOM = Spacing.five, LOGO_GAP = Spacing.five;

export function AuthLayout({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const window = useWindowDimensions();
  // Almost the whole width, but the form must stay on screen: the logo gets the height left above it.
  const [formHeight, setFormHeight] = useState(0);
  const roomAbove = window.height - insets.top - insets.bottom - PAD_TOP - PAD_BOTTOM - LOGO_GAP
    - Math.max(formHeight, MIN_FORM_H);
  const logoWidth = Math.max(0, Math.min(window.width * LOGO_SCREEN_W, LOGO_MAX_W, (roomAbove * LW) / LH));

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <StreetsBackground />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + PAD_TOP, paddingBottom: insets.bottom + PAD_BOTTOM },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Image
          source={theme.isLight ? LOGO_LIGHT : LOGO_DARK}
          style={[styles.logo, { width: logoWidth, height: (logoWidth * LH) / LW }]}
          resizeMode="contain"
          accessibilityLabel={t('auth.appTitle')}
        />
        <View style={styles.form} onLayout={(e) => setFormHeight(e.nativeEvent.layout.height)}>
          {children}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    flexGrow: 1,
    alignItems: 'center',
    paddingHorizontal: Spacing.five,
  },
  // Wider than the padded column on purpose: centred, it spills over the side padding only
  logo: { marginBottom: LOGO_GAP },
  form: { width: '100%', alignItems: 'center' },
});
