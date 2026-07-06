import { View, Text } from 'react-native';
import { useTheme } from '@/contexts/theme-context';
import { FontSize } from '@/constants/theme';

export function Diff({ label, current, proposed }: { label: string; current?: string | number | null; proposed?: string | number | null }) {
  const { theme, appFont } = useTheme();
  if (proposed === undefined || proposed === null) return null;
  const changed = String(proposed) !== String(current ?? '');
  return (
    <View style={{ marginBottom: 6 }}>
      <Text style={{ color: theme.textMuted, fontSize: FontSize.xxs, fontFamily: appFont }}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 }}>
        {current !== undefined && current !== null && (
          <>
            <Text style={{ color: theme.textMuted, fontSize: FontSize.sm, fontFamily: appFont }}>{String(current)}</Text>
            <Text style={{ color: theme.textMuted }}>→</Text>
          </>
        )}
        <Text style={{ color: changed ? theme.accent : theme.text, fontSize: FontSize.sm, fontFamily: appFont, fontWeight: changed ? '600' : '400' }}>
          {String(proposed)}
        </Text>
      </View>
    </View>
  );
}
