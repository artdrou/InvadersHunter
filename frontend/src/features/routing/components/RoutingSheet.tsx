import { useState } from 'react'
import {
  View, Text, Pressable, TextInput,
  StyleSheet, ActivityIndicator,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '@/contexts/theme-context'
import type { ThemeTokens } from '@/constants/theme'
import { BorderRadius, Spacing, ButtonFont, ButtonFontSize, FontSize } from '@/constants/theme'
import type { InvaderWithState } from '@/features/invaders/types'
import { isNonFlashable } from '@/features/invaders/types'
import { useTranslation } from 'react-i18next'
import type { RoutingParams, RouteResult } from '../types'
import { useAddressSearch } from '../hooks/use-address-search'

export type RoutingPickerTarget = 'from' | 'to'

function fmtMin(min: number): string {
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, '0')}`
}

type Props = {
  onClose: () => void
  fromCoords: [number, number] | null
  fromLabel: string | null
  toCoords: [number, number] | null
  toLabel: string | null
  onSetCoords: (target: RoutingPickerTarget, coords: [number, number], label: string) => void
  onClearCoords: (target: RoutingPickerTarget) => void
  onPickOnMap: (target: RoutingPickerTarget) => void
  allInvaders: InvaderWithState[]
  multiInvaders: InvaderWithState[]
  loading: boolean
  error: string | null
  route: RouteResult | null
  onCompute: (params: RoutingParams) => void
  onClear: () => void
  onClearMulti: () => void
  userLocation: [number, number] | null
}

export function RoutingSheet({
  onClose,
  fromCoords, fromLabel, toCoords, toLabel,
  onSetCoords, onClearCoords, onPickOnMap,
  allInvaders, multiInvaders,
  loading, error, route,
  onCompute, onClear, onClearMulti,
  userLocation,
}: Props) {
  const { theme, appFont, fontScale } = useTheme()
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
  const s = makeStyles(theme, appFont, fontScale)

  const [boucle, setBoucle]           = useState(false)
  const [detourMin, setDetourMin]     = useState(15)
  const [durationMin, setDurationMin] = useState(30)
  const [includeCaptures, setIncludeCaptures] = useState(false)
  const [flashableOnly, setFlashableOnly]     = useState(true)
  const [optionsOpen, setOptionsOpen]         = useState(false)

  const [searchTarget, setSearchTarget] = useState<RoutingPickerTarget | null>(null)
  const [searchQuery, setSearchQuery]   = useState('')
  const { search, results, loading: searchLoading, clear: clearSearch } = useAddressSearch(userLocation)

  function openSearch(target: RoutingPickerTarget) {
    setSearchTarget(target)
    setSearchQuery('')
    clearSearch()
  }

  function closeSearch() {
    setSearchTarget(null)
    setSearchQuery('')
    clearSearch()
  }

  function handleSearchChange(text: string) {
    setSearchQuery(text)
    search(text)
  }

  function selectResult(coords: [number, number], label: string) {
    if (!searchTarget) return
    onSetCoords(searchTarget, coords, label)
    closeSearch()
  }

  function handleCompute() {
    const uncaptured = allInvaders.filter((inv) => {
      if (inv.latitude == null || inv.longitude == null) return false
      if (!includeCaptures && inv.isCaptured) return false
      if (flashableOnly && isNonFlashable(inv.state)) return false
      return true
    })

    if (!fromCoords) return
    if (boucle) {
      onCompute({ mode: 'walk', from: fromCoords, invaders: uncaptured, travelMode: 'foot-walking', durationMin, walkMode: 'circuit' })
    } else {
      if (!toCoords) return
      onCompute({ mode: 'ab', from: fromCoords, to: toCoords, invaders: uncaptured, mandatoryInvaders: multiInvaders, travelMode: 'foot-walking', detourMin })
    }
  }

  const canCompute = (() => {
    if (loading) return false
    return boucle ? !!fromCoords : !!(fromCoords && toCoords)
  })()

  const optionsSummary = boucle ? fmtMin(durationMin) : (detourMin === 0 ? t('routing.detourDirect') : `+${fmtMin(detourMin)}`)

  return (
    <>
      {/* ── Top overlay card ─────────────────────────────────── */}
      <View
        style={[s.overlay, { top: insets.top + 8, backgroundColor: theme.bgElement, borderColor: theme.border }]}
        pointerEvents="box-none"
      >
        <View pointerEvents="auto">
          {/* Panel title */}
          <View style={[s.titleRow, { borderBottomColor: theme.bgDivider }]}>
            <Text style={[s.titleText, { color: theme.text }]}>{t('routing.modeAB')}</Text>
          </View>

          <View style={s.fields}>
            {/* From field */}
            <CoordField
              isFrom
              coords={fromCoords}
              displayLabel={fromLabel}
              placeholder={t('routing.labelFrom')}
              isSearchOpen={searchTarget === 'from'}
              searchQuery={searchQuery}
              searchLoading={searchLoading}
              searchResults={results}
              onOpenSearch={() => openSearch('from')}
              onPickOnMap={() => onPickOnMap('from')}
              onUseLocation={userLocation ? () => onSetCoords('from', userLocation, t('routing.myLocation')) : undefined}
              onSearchChange={handleSearchChange}
              onSelectResult={selectResult}
              onClear={() => onClearCoords('from')}
              onCloseSearch={closeSearch}
              theme={theme}
              appFont={appFont}
              fontScale={fontScale}
              s={s}
            />

            {/* Mandatory stops row — visible when A→B (not boucle) */}
            {!boucle && (
              <View style={[s.mandatoryRow, { borderColor: multiInvaders.length > 0 ? theme.accent : theme.border, backgroundColor: theme.bg }]}>
                <Ionicons name="flag-outline" size={14} color={multiInvaders.length > 0 ? theme.accent : theme.textMuted} />
                <Text style={[s.mandatoryText, { color: multiInvaders.length > 0 ? theme.accent : theme.textMuted }]} numberOfLines={1}>
                  {multiInvaders.length === 0
                    ? t('routing.selectTapHint')
                    : multiInvaders.length === 1
                      ? t('routing.invaderSelectedOne')
                      : t('routing.invaderSelectedMany', { count: multiInvaders.length })}
                </Text>
                {multiInvaders.length > 0 && (
                  <Pressable onPress={onClearMulti} hitSlop={8} style={({ pressed }) => pressed && s.btnPressed}>
                    <Ionicons name="close-circle" size={16} color={theme.textMuted} />
                  </Pressable>
                )}
              </View>
            )}

            {/* To field — hidden when boucle */}
            {!boucle && (
              <CoordField
                isFrom={false}
                coords={toCoords}
                displayLabel={toLabel}
                placeholder={t('routing.labelTo')}
                isSearchOpen={searchTarget === 'to'}
                searchQuery={searchQuery}
                searchLoading={searchLoading}
                searchResults={results}
                onOpenSearch={() => openSearch('to')}
                onPickOnMap={() => onPickOnMap('to')}
                onSearchChange={handleSearchChange}
                onSelectResult={selectResult}
                onClear={() => onClearCoords('to')}
                onCloseSearch={closeSearch}
                theme={theme}
                appFont={appFont}
                fontScale={fontScale}
                s={s}
              />
            )}

            {/* Options toggle row — Start left / +15min right when collapsed; just ▲ when expanded */}
            <View style={[s.optionsRow, { borderTopColor: theme.bgDivider, justifyContent: optionsOpen ? 'flex-end' : 'space-between' }]}>
              {/* Action button — left side, hidden when expanded (appears inside panel instead) */}
              {!optionsOpen && (
                route ? (
                  <Pressable
                    style={({ pressed }) => [s.actionBtn, { backgroundColor: theme.danger }, pressed && s.btnPressed]}
                    onPress={() => { onClear(); onClearMulti(); }}
                  >
                    <Ionicons name="close" size={13} color="#fff" />
                    <Text style={[s.actionBtnText, { color: '#fff' }]}>{t('common.cancel')}</Text>
                  </Pressable>
                ) : (
                  <Pressable
                    style={({ pressed }) => [s.actionBtn, { backgroundColor: canCompute ? theme.accent : theme.bgElement }, canCompute && pressed && s.btnPressed]}
                    onPress={handleCompute}
                    disabled={!canCompute}
                  >
                    {loading
                      ? <ActivityIndicator size="small" color={canCompute ? theme.bg : theme.textMuted} />
                      : <Ionicons name="flag" size={13} color={canCompute ? theme.bg : theme.textMuted} />
                    }
                    <Text style={[s.actionBtnText, { color: canCompute ? theme.bg : theme.textMuted }]}>
                      {t('routing.start')}
                    </Text>
                  </Pressable>
                )
              )}

              {/* Toggle chevron — summary visible only when collapsed */}
              <Pressable
                style={({ pressed }) => [s.optionsToggleBtn, pressed && s.btnPressed]}
                onPress={() => setOptionsOpen((v) => !v)}
              >
                {!optionsOpen && (
                  <Text style={[s.optionsSummary, { color: theme.textMuted }]}>{optionsSummary}</Text>
                )}
                <Ionicons name={optionsOpen ? 'chevron-up' : 'chevron-down'} size={14} color={theme.textMuted} />
              </Pressable>
            </View>

            {/* Collapsible options */}
            {optionsOpen && (
              <View style={[s.optionsPanel, { borderTopColor: theme.bgDivider }]}>
                <View style={s.filterRow}>
                  <Pressable
                    style={({ pressed }) => [s.chip, { borderColor: theme.border }, boucle && s.chipActive, pressed && s.btnPressed]}
                    onPress={() => setBoucle((v) => !v)}
                  >
                    <Ionicons name={boucle ? 'refresh-circle' : 'refresh-circle-outline'} size={13} color={boucle ? theme.bg : theme.textMuted} />
                    <Text style={[s.chipText, { color: boucle ? theme.bg : theme.textMuted }]}>{t('routing.loop')}</Text>
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [s.chip, { borderColor: theme.border }, !includeCaptures && s.chipActive, pressed && s.btnPressed]}
                    onPress={() => setIncludeCaptures((v) => !v)}
                  >
                    <Text style={[s.chipText, { color: !includeCaptures ? theme.bg : theme.textMuted }]}>{t('routing.filterUncaptured')}</Text>
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [s.chip, { borderColor: theme.border }, flashableOnly && s.chipActive, pressed && s.btnPressed]}
                    onPress={() => setFlashableOnly((v) => !v)}
                  >
                    <Text style={[s.chipText, { color: flashableOnly ? theme.bg : theme.textMuted }]}>{t('routing.filterFlashable')}</Text>
                  </Pressable>
                </View>
                <View style={s.stepper}>
                  <Pressable
                    style={({ pressed }) => [s.stepBtn, { borderColor: theme.border }, pressed && s.btnPressed]}
                    onPress={() => boucle ? setDurationMin((v) => Math.max(10, v - 10)) : setDetourMin((v) => Math.max(0, v - 5))}
                  >
                    <Text style={[s.stepBtnText, { color: theme.text }]}>−</Text>
                  </Pressable>
                  <Text style={[s.stepValue, { color: boucle || detourMin > 0 ? theme.text : theme.accent }]}>
                    {boucle ? fmtMin(durationMin) : (detourMin === 0 ? t('routing.detourDirect') : fmtMin(detourMin))}
                  </Text>
                  <Pressable
                    style={({ pressed }) => [s.stepBtn, { borderColor: theme.border }, pressed && s.btnPressed]}
                    onPress={() => boucle ? setDurationMin((v) => Math.min(180, v + 10)) : setDetourMin((v) => Math.min(180, v + 5))}
                  >
                    <Text style={[s.stepBtnText, { color: theme.text }]}>+</Text>
                  </Pressable>
                </View>

                {/* Action button at bottom-left when options are expanded */}
                {route ? (
                  <Pressable
                    style={({ pressed }) => [s.actionBtn, { backgroundColor: theme.danger, alignSelf: 'flex-start' }, pressed && s.btnPressed]}
                    onPress={() => { onClear(); onClearMulti(); }}
                  >
                    <Ionicons name="close" size={13} color="#fff" />
                    <Text style={[s.actionBtnText, { color: '#fff' }]}>{t('common.cancel')}</Text>
                  </Pressable>
                ) : (
                  <Pressable
                    style={({ pressed }) => [s.actionBtn, { backgroundColor: canCompute ? theme.accent : theme.bgElement, alignSelf: 'flex-start' }, canCompute && pressed && s.btnPressed]}
                    onPress={handleCompute}
                    disabled={!canCompute}
                  >
                    {loading
                      ? <ActivityIndicator size="small" color={canCompute ? theme.bg : theme.textMuted} />
                      : <Ionicons name="flag" size={13} color={canCompute ? theme.bg : theme.textMuted} />
                    }
                    <Text style={[s.actionBtnText, { color: canCompute ? theme.bg : theme.textMuted }]}>
                      {t('routing.start')}
                    </Text>
                  </Pressable>
                )}
              </View>
            )}
          </View>

          {/* Result */}
          {route && (
            <View style={[s.result, { backgroundColor: theme.bg, borderTopColor: theme.bgDivider }]}>
              <Text style={[s.resultText, { color: theme.success }]}>
                {route.orderedInvaders.length === 1
                  ? t('routing.resultInvaderOne')
                  : t('routing.resultInvaderMany', { count: route.orderedInvaders.length })} · {t('routing.resultSuffix', { minutes: route.totalMinutes, km: route.totalKm })}
              </Text>
              {route.detourMinutes !== undefined && route.detourMinutes > 0 && (
                <Text style={[s.resultSub, { color: theme.textMuted }]}>
                  {t('routing.detourMinutes', { minutes: route.detourMinutes })}
                </Text>
              )}
            </View>
          )}

          {error && <Text style={[s.error, { color: theme.danger }]}>{error}</Text>}
        </View>
      </View>

    </>
  )
}

// ── CoordField ─────────────────────────────────────────────────────────────

type CoordFieldProps = {
  isFrom: boolean
  coords: [number, number] | null
  displayLabel: string | null
  placeholder: string
  isSearchOpen: boolean
  searchQuery: string
  searchLoading: boolean
  searchResults: Array<{ label: string; coords: [number, number] }>
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
  s: ReturnType<typeof makeStyles>
}

function CoordField({
  isFrom, coords, displayLabel, placeholder,
  isSearchOpen, searchQuery, searchLoading, searchResults,
  onOpenSearch, onPickOnMap, onUseLocation, onSearchChange, onSelectResult, onClear, onCloseSearch,
  theme, appFont, fontScale, s,
}: CoordFieldProps) {
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

// ── Styles ─────────────────────────────────────────────────────────────────

function makeStyles(t: ThemeTokens, font: string, scale: number) {
  const sz = (n: number) => Math.round(n * scale)
  return StyleSheet.create({
    // Overlay card
    overlay: {
      position: 'absolute',
      left: 8,
      right: 8,
      borderRadius: BorderRadius.md,
      borderWidth: 1,
      overflow: 'visible',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.22,
      shadowRadius: 6,
      elevation: 8,
    },

    // Panel title
    titleRow: {
      paddingHorizontal: Spacing.three,
      paddingTop: Spacing.two,
      paddingBottom: Spacing.two,
      borderBottomWidth: StyleSheet.hairlineWidth,
    },
    titleText: { fontFamily: ButtonFont, fontSize: ButtonFontSize.lg },

    // Fields container
    fields: {
      paddingHorizontal: Spacing.three,
      paddingTop: Spacing.two,
      gap: Spacing.one,
    },

    // Coord input row
    coordBlock: { gap: 2 },
    coordRow: {
      flexDirection: 'row', alignItems: 'center',
      borderWidth: 1, borderRadius: BorderRadius.sm,
      paddingHorizontal: Spacing.two, paddingVertical: 10,
      gap: 8,
    },
    leadingIcon: { width: 20, alignItems: 'center' },
    coordLabel:   { flex: 1 },
    coordActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },

    // Options toggle row (summary + inline action button)
    optionsRow: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      borderTopWidth: StyleSheet.hairlineWidth,
      paddingTop: Spacing.two, paddingBottom: Spacing.one,
    },
    optionsToggleBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
    },
    optionsSummary: { fontFamily: font, fontSize: sz(FontSize.xs) },

    // Inline / panel action button (compute / cancel)
    actionBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 5,
      paddingHorizontal: Spacing.two + 2, paddingVertical: 6,
      borderRadius: BorderRadius.sm,
    },
    actionBtnText: { fontFamily: ButtonFont, fontSize: ButtonFontSize.xs },

    // Collapsible options
    optionsPanel: {
      borderTopWidth: StyleSheet.hairlineWidth,
      paddingTop: Spacing.two,
      gap: Spacing.two,
      paddingBottom: Spacing.one,
    },

    // Chips
    filterRow: { flexDirection: 'row', gap: Spacing.one, flexWrap: 'wrap' },
    chip: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      paddingHorizontal: Spacing.two, paddingVertical: 5,
      borderRadius: BorderRadius.sm, borderWidth: 1,
    },
    chipActive: { backgroundColor: t.accent, borderColor: t.accent },
    chipText:   { fontFamily: ButtonFont, fontSize: ButtonFontSize.xs },

    // Stepper
    stepper:     { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
    stepBtn:     { width: 32, height: 32, borderRadius: BorderRadius.sm, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
    stepBtnText: { fontFamily: ButtonFont, fontSize: ButtonFontSize.xl },
    stepValue:   { fontFamily: font, fontSize: sz(FontSize.md), minWidth: 72, textAlign: 'center' },

    // Mandatory stops row
    mandatoryRow: {
      flexDirection: 'row', alignItems: 'center',
      borderWidth: 1, borderRadius: BorderRadius.sm,
      paddingHorizontal: Spacing.two, paddingVertical: 8,
      gap: 8,
    },
    mandatoryText: { flex: 1, fontFamily: font, fontSize: sz(FontSize.xs) },

    // Result
    result: {
      borderTopWidth: 1,
      paddingHorizontal: Spacing.three,
      paddingVertical: Spacing.two,
      gap: 2,
    },
    resultText: { fontFamily: font, fontSize: sz(FontSize.sm) },
    resultSub:  { fontFamily: font, fontSize: sz(FontSize.xs) },
    error:      { fontFamily: font, fontSize: sz(FontSize.xs), textAlign: 'center', paddingHorizontal: Spacing.three, paddingBottom: Spacing.two },

    // Search
    searchBox:        { borderWidth: 1, borderRadius: BorderRadius.sm, marginTop: 2, overflow: 'hidden' },
    searchResult:     { flexDirection: 'row', alignItems: 'flex-start', gap: 6, paddingHorizontal: Spacing.two, paddingVertical: 9 },
    searchResultText: { flex: 1, lineHeight: 17 },

    btnPressed: { opacity: 0.7 },
  })
}
