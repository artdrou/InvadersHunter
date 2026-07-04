import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { BorderRadius, Brand, ButtonFont, Spacing, FontSize } from '@/constants/theme';

export type AdminRequestType = 'create' | 'modify' | 'delete';

const TYPE_COLOR: Record<AdminRequestType, string> = {
  create: '#0060f0',
  modify: Brand.yellow,
  delete: Brand.uncapturedOutline,
};

const TYPE_ICON: Record<AdminRequestType, keyof typeof Ionicons.glyphMap> = {
  create: 'add-circle-outline',
  modify: 'create-outline',
  delete: 'trash-outline',
};

export function TypeBadge({ type }: { type: AdminRequestType }) {
  const { t } = useTranslation();
  const color = TYPE_COLOR[type] ?? TYPE_COLOR.modify;
  const icon = TYPE_ICON[type] ?? TYPE_ICON.modify;
  const styles = makeStyles(color);
  return (
    <View style={styles.badge}>
      <Ionicons name={icon} size={12} color={color} />
      <Text style={styles.text}>
        {t(`admin.type${type.charAt(0).toUpperCase()}${type.slice(1)}`)}
      </Text>
    </View>
  );
}

function makeStyles(color: string) {
  return StyleSheet.create({
    badge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      borderRadius: BorderRadius.sm,
      paddingHorizontal: Spacing.two,
      paddingVertical: 3,
      backgroundColor: color + '22',
      borderWidth: 1,
      borderColor: color,
    },
    text: {
      color,
      fontSize: FontSize.xs,
      fontFamily: ButtonFont,
      letterSpacing: 0.5,
    },
  });
}
