import { View, Text, Pressable, TextInput, ActivityIndicator } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import type { ThemeTokens } from '@/constants/theme'
import { FontSize } from '@/constants/theme'
import type { RoutingStyles } from './styles'

type Props = {
  isFrom: boolean
  coords: [number, number] | null
  displayLabel: string | null
  placeholder: string
  isSearchOpen: boolean
  searchQuery: string
  searchLoading: boolean
  searchResults: { label: string; coords: [number, number] }[]
  onOpenSearch: () => void
  onPickOnMap: () => void
  onUseLocation?: () => void
  onSearchChange: (text: string) => void
  onSelectResult: (coords: [number, number], label: string) => void
  onClear: () => void
  onCloseSearch: () => void
  theme: ThemeTokens
  appFont: string
  fontScale: number
  s: RoutingStyles
}

/**
 * One routing endpoint row (from/to): shows the picked label, opens an inline
 * address search with a results dropdown, and offers GPS / pick-on-map / clear.
 */
export function CoordField({
  isFrom, coords, displayLabel, placeholder,
  isSearchOpen, searchQuery, searchLoading, searchResults,
  onOpenSearch, onPickOnMap, onUseLocation, onSearchChange, onSelectResult, onClear, onCloseSearch,
  theme, appFont, fontScale, s,
}: Props) {
  const { t } = useTranslation()
  const sz = (n: number) => Math.round(n * fontScale)

  const leadingColor = isSearchOpen
    ? theme.accent
    : coords ? (isFrom ? theme.accent : theme.success) : theme.textMuted

  return (
    <View style={s.coordBlock}>
      <Pressable
        style={({ pressed }) => [
          s.coordRow,
          { borderColor: isSearchOpen ? theme.accent : theme.border, backgroundColor: theme.bg },
          !isSearchOpen && pressed && s.btnPressed,
        ]}
        onPress={!isSearchOpen ? onOpenSearch : undefined}
      >
        {/* Leading icon — GPS button for from (tappable), flag for to */}
        <Pressable
          onPress={isFrom && onUseLocation ? onUseLocation : undefined}
          hitSlop={6}
          style={({ pressed }) => [s.leadingIcon, isFrom && onUseLocation && pressed && s.btnPressed]}
          disabled={!isFrom || !onUseLocation}
        >
          <Ionicons name={isFrom ? 'navigate' : 'flag'} size={16} color={leadingColor} />
        </Pressable>

        {/* Inline text input when searching, label when not */}
        {isSearchOpen ? (
          <TextInput
            style={[s.coordLabel, { color: theme.text, fontFamily: appFont, fontSize: sz(FontSize.sm) }]}
            placeholder={t('routing.searchPlaceholder')}
            placeholderTextColor={theme.textMuted}
            value={searchQuery}
            onChangeText={onSearchChange}
            autoFocus
          />
        ) : (
          <Text
            style={[s.coordLabel, { color: coords ? theme.text : theme.textMuted, fontFamily: appFont, fontSize: sz(FontSize.sm) }]}
            numberOfLines={1}
          >
            {displayLabel ?? (coords ? `${coords[1].toFixed(5)}, ${coords[0].toFixed(5)}` : placeholder)}
          </Text>
        )}

        <View style={s.coordActions}>
          {isSearchOpen ? (
            searchLoading
              ? <ActivityIndicator size="small" color={theme.accent} />
              : <Pressable onPress={onCloseSearch} hitSlop={6} style={({ pressed }) => pressed && s.btnPressed}>
                  <Ionicons name="close" size={16} color={theme.textMuted} />
                </Pressable>
          ) : (
            <>
              {coords && (
                <Pressable onPress={onClear} hitSlop={6} style={({ pressed }) => pressed && s.btnPressed}>
                  <Ionicons name="close" size={15} color={theme.textMuted} />
                </Pressable>
              )}
              <Pressable onPress={onPickOnMap} hitSlop={6} style={({ pressed }) => pressed && s.btnPressed}>
                <Ionicons name="locate-outline" size={16} color={theme.textMuted} />
              </Pressable>
            </>
          )}
        </View>
      </Pressable>

      {/* Results dropdown — no separate input row */}
      {isSearchOpen && searchResults.length > 0 && (
        <View style={[s.searchBox, { backgroundColor: theme.bg, borderColor: theme.border }]}>
          {searchResults.map((r, i) => (
            <Pressable
              key={i}
              style={({ pressed }) => [s.searchResult, { borderTopColor: theme.bgDivider }, i > 0 && { borderTopWidth: 1 }, pressed && s.btnPressed]}
              onPress={() => onSelectResult(r.coords, r.label)}
            >
              <Ionicons name="location-outline" size={13} color={theme.textMuted} />
              <Text style={[s.searchResultText, { color: theme.text, fontFamily: appFont, fontSize: sz(FontSize.sm) }]} numberOfLines={2}>
                {r.label}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  )
}
