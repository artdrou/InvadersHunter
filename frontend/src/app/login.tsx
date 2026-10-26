import { useState } from 'react';
import { View, TextInput, Pressable, Text, Image, StyleSheet, ActivityIndicator, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useAuthStore, loginUser } from '@/features/auth';
import { useTheme } from '@/contexts/theme-context';
import { hapticTap } from '@/features/settings';
import { type ThemeTokens, FontSize, BorderRadius, Spacing, ButtonFont, LIGHT_THEMES } from '@/constants/theme';

const LOGO_DARK = require('../../assets/images/hintvaders-logo-stacked.png');
const LOGO_LIGHT = require('../../assets/images/hintvaders-logo-stacked-light.png');
const STREETS = require('../../assets/images/login-streets.png');
const LOGO_RATIO = 1050 / 1353;     // width / height of the stacked logo
const STREETS_RATIO = 780 / 1688;
const LOGO_MAX_W = 440;

export default function LoginScreen() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const login = useAuthStore((s) => s.login);
  const enterGuestMode = useAuthStore((s) => s.enterGuestMode);
  const router = useRouter();
  const { t } = useTranslation();
  const { theme, themeName, appFont, fontScale } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(theme, appFont, fontScale, insets.top, insets.bottom);
  const light = LIGHT_THEMES.has(themeName);
  // Explicit sizes: percentage sizes ignored the screen padding (streets cut short, logo overflowing).
  const window = useWindowDimensions();
  const [hero, setHero] = useState({ width: 0, height: 0 });
  const logoWidth = Math.min(hero.width * 0.92, LOGO_MAX_W, (hero.height - Spacing.four) * LOGO_RATIO);

  async function handleLogin() {
    if (!username || !password) return;
    hapticTap();
    setLoading(true);
    setError(null);
    try {
      const { accessToken, refreshToken } = await loginUser(username, password);
      login(accessToken, refreshToken);
    } catch {
      setError(t('auth.login.invalid'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      {/* Street grid behind the whole screen, fading out towards the bottom (baked into the image) */}
      <Image
        source={STREETS}
        style={[
          styles.streets,
          { width: window.width, height: window.width / STREETS_RATIO },
          light && styles.streetsLight,
        ]}
        resizeMode="stretch"
      />

      <View
        style={styles.hero}
        onLayout={(e) => setHero({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}
      >
        {logoWidth > 0 && (
          <Image
            source={light ? LOGO_LIGHT : LOGO_DARK}
            style={{ width: logoWidth, height: logoWidth / LOGO_RATIO }}
            resizeMode="contain"
            accessibilityLabel={t('auth.appTitle')}
          />
        )}
      </View>

      <View style={styles.form}>
        <TextInput
          style={styles.input}
          placeholder={t('auth.username')}
          placeholderTextColor={theme.textMuted}
          autoCapitalize="none"
          value={username}
          onChangeText={setUsername}
        />
        <TextInput
          style={styles.input}
          placeholder={t('auth.password')}
          placeholderTextColor={theme.textMuted}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        {error && <Text style={styles.error}>{error}</Text>}

        <Pressable
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
          onPress={handleLogin}
          disabled={loading}>
          {loading ? (
            <ActivityIndicator color={theme.bg} />
          ) : (
            <Text style={styles.buttonText}>{t('auth.login.button')}</Text>
          )}
        </Pressable>

        <Pressable onPress={() => router.push('/register')} style={styles.registerLink}>
          <Text style={styles.registerText}>{t('auth.login.noAccount')} <Text style={styles.registerHighlight}>{t('auth.login.createOne')}</Text></Text>
        </Pressable>

        <Pressable onPress={() => router.push('/forgot-password')} style={styles.registerLink}>
          <Text style={styles.registerText}><Text style={styles.registerHighlight}>{t('auth.login.forgotPassword')}</Text></Text>
        </Pressable>

        <Pressable
          onPress={() => { hapticTap(); enterGuestMode(); router.replace('/(tabs)/map'); }}
          style={styles.guestLink}
        >
          <Text style={styles.registerText}><Text style={styles.registerHighlight}>{t('auth.login.guestMode')}</Text></Text>
        </Pressable>
      </View>
    </View>
  );
}

function makeStyles(t: ThemeTokens, font: string, scale: number, topInset: number, bottomInset: number) {
  const sz = (n: number) => Math.round(n * scale);
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: t.bg,
      alignItems: 'center',
      paddingHorizontal: Spacing.five,
      paddingTop: topInset + Spacing.three,
      paddingBottom: bottomInset + Spacing.five,
    },
    streets: {
      position: 'absolute',
      top: 0,
      left: 0,
    },
    streetsLight: { opacity: 0.5 },
    // Takes all the room above the form; the logo is sized to fit it (see logoWidth).
    hero: {
      flex: 1,
      width: '100%',
      alignItems: 'center',
      justifyContent: 'center',
      paddingBottom: Spacing.four,
    },
    form: {
      width: '100%',
      maxWidth: 360,
      gap: Spacing.three,
    },
    input: {
      backgroundColor: t.bgElement,
      color: t.text,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: BorderRadius.sm,
      paddingVertical: 12,
      paddingHorizontal: Spacing.three,
      fontSize: sz(FontSize.md),
      fontFamily: font,
    },
    error: {
      color: t.danger,
      fontSize: sz(FontSize.sm),
      fontFamily: font,
      textAlign: 'center',
    },
    button: {
      backgroundColor: t.accent,
      borderRadius: BorderRadius.sm,
      paddingVertical: 14,
      alignItems: 'center',
      marginTop: Spacing.two,
    },
    buttonPressed: {
      opacity: 0.8,
    },
    buttonText: {
      color: t.bg,
      fontFamily: ButtonFont,
      fontSize: FontSize.xxl,
    },
    registerLink: {
      alignItems: 'center',
    },
    guestLink: {
      alignItems: 'center',
      marginTop: Spacing.three,
      alignSelf: 'center',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.border,
      borderRadius: BorderRadius.sm,
      paddingVertical: 10,
      paddingHorizontal: Spacing.four,
    },
    registerText: {
      color: t.textMuted,
      fontSize: sz(FontSize.sm),
      fontFamily: font,
    },
    registerHighlight: {
      color: t.accent,
      fontFamily: font,
    },
  });
}
