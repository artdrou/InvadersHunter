import { useState } from 'react'
import {
  Modal, View, Text, Pressable, ScrollView, TextInput,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '@/contexts/theme-context'
import type { ThemeTokens } from '@/constants/theme'
import { BorderRadius, Spacing, ButtonFont, ButtonFontSize, FontSize } from '@/constants/theme'
import type { InvaderWithState } from '@/features/invaders/types'
import { isNonFlashable } from '@/features/invaders/types'
import { useTranslation } from 'react-i18next'
import type { RoutingParams, RouteResult } from '../types'
import { useAddressSearch } from '../hooks/use-address-search'

function fmtMin(min: number): string {
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, '0')}`
}

type SheetMode = 'ab' | 'multi'

export type RoutingPickerTarget = 'from' | 'to'

type Props = {
  visible: boolean
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
  onRemoveFromMulti: (id: number) => void
  onPickInvadersOnMap: () => void
  loading: boolean
  error: string | null
  route: RouteResult | null
  onCompute: (params: RoutingParams) => void
  onClear: () => void
  userLocation: [number, number] | null
}

export function RoutingSheet({
  visible, onClose,
  fromCoords, fromLabel, toCoords, toLabel,
  onSetCoords, onClearCoords, onPickOnMap,
  allInvaders, multiInvaders, onRemoveFromMulti, onPickInvadersOnMap,
  loading, error, route,
  onCompute, onClear,
  userLocation,
}: Props) {
  const { theme, appFont, fontScale } = useTheme()
  const { t } = useTranslation()
  const s = makeStyles(theme, appFont, fontScale)

  const [mode, setMode]               = useState<SheetMode>('ab')
  const [boucle, setBoucle]           = useState(false)
  const [detourMin, setDetourMin]     = useState(15)
  const [durationMin, setDurationMin] = useState(30)
  const [includeCaptures, setIncludeCaptures] = useState(false)
  const [flashableOnly, setFlashableOnly]     = useState(true)

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

    if (mode === 'ab') {
      if (!fromCoords) return
      if (boucle) {
        onCompute({ mode: 'walk', from: fromCoords, invaders: uncaptured, travelMode: 'foot-walking', durationMin, walkMode: 'circuit' })
      } else {
        if (!toCoords) return
        onCompute({ mode: 'ab', from: fromCoords, to: toCoords, invaders: uncaptured, travelMode: 'foot-walking', detourMin })
      }
    } else {
      if (multiInvaders.length < 2) return
      onCompute({ mode: 'multi', from: userLocation ?? undefined, invaders: multiInvaders, travelMode: 'foot-walking' })
    }
  }

  const canCompute = (() => {
    if (loading) return false
    if (mode === 'ab') return boucle ? !!fromCoords : !!(fromCoords && toCoords)
    return multiInvaders.length >= 2
  })()

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView style={s.kav} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Pressable style={s.backdrop} onPress={onClose} />

        <View style={[s.sheet, { backgroundColor: theme.bgElement, borderColor: theme.border }]}>
          <View style={[s.handle, { backgroundColor: theme.bgDivider }]} />

          {/* Mode tabs */}
          <View style={[s.tabs, { borderBottomColor: theme.bgDivider }]}>
            {(['ab', 'multi'] as SheetMode[]).map((m) => (
              <Pressable
                key={m}
                style={({ pressed }) => [s.tab, mode === m && { borderBottomColor: theme.accent, borderBottomWidth: 2 }, pressed && s.btnPressed]}
                onPress={() => { setMode(m); closeSearch() }}
              >
                <Text style={[s.tabText, { color: mode === m ? theme.accent : theme.textMuted }]}>
                  {m === 'ab' ? t('routing.modeAB') : t('routing.modeMulti')}
                </Text>
              </Pressable>
            ))}
          </View>

          <ScrollView style={s.body} showsVerticalScrollIndicator={false} contentContainerStyle={s.bodyContent} keyboardShouldPersistTaps="handled">

            {/* ── Invader filters ── */}
            <View style={s.filterRow}>
              <Pressable
                style={({ pressed }) => [s.chip, { borderColor: theme.border }, !includeCaptures && s.chipActive, pressed && s.btnPressed]}
                onPress={() => setIncludeCaptures((v) => !v)}
              >
                <Text style={[s.chipText, { color: !includeCaptures ? theme.bg : theme.textMuted }]}>
                  {t('routing.filterUncaptured')}
                </Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [s.chip, { borderColor: theme.border }, flashableOnly && s.chipActive, pressed && s.btnPressed]}
                onPress={() => setFlashableOnly((v) => !v)}
              >
                <Text style={[s.chipText, { color: flashableOnly ? theme.bg : theme.textMuted }]}>
                  {t('routing.filterFlashable')}
                </Text>
              </Pressable>
            </View>

            {/* ── Chasse mode ── */}
            {mode === 'ab' && (
              <>
                {/* Boucle toggle */}
                <Pressable
                  style={({ pressed }) => [s.chip, { borderColor: theme.border }, boucle && s.chipActive, pressed && s.btnPressed]}
                  onPress={() => setBoucle((v) => !v)}
                >
                  <Ionicons name={boucle ? 'refresh-circle' : 'refresh-circle-outline'} size={16} color={boucle ? theme.bg : theme.textMuted} />
                  <Text style={[s.chipText, { color: boucle ? theme.bg : theme.textMuted }]}>
                    {t('routing.loop')}
                  </Text>
                </Pressable>

                {/* From */}
                <CoordField
                  label={t('routing.labelFrom')}
                  coords={fromCoords}
                  displayLabel={fromLabel}
                  isSearchOpen={searchTarget === 'from'}
                  searchQuery={searchQuery}
                  searchLoading={searchLoading}
                  searchResults={results}
                  onOpenSearch={() => openSearch('from')}
                  onPickOnMap={() => onPickOnMap('from')}
                  onSearchChange={handleSearchChange}
                  onSelectResult={selectResult}
                  onClear={() => onClearCoords('from')}
                  onCloseSearch={closeSearch}
                  theme={theme}
                  appFont={appFont}
                  fontScale={fontScale}
                  s={s}
                />

                {/* To — only when not boucle */}
                {!boucle && (
                  <CoordField
                    label={t('routing.labelTo')}
                    coords={toCoords}
                    displayLabel={toLabel}
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

                {/* Détour % or Walk time depending on boucle */}
                <Text style={[s.fieldLabel, { color: theme.textMuted }]}>
                  {boucle ? t('routing.labelDuration') : t('routing.labelDetour')}
                </Text>
                <View style={s.stepper}>
                  <Pressable
                    style={({ pressed }) => [s.stepBtn, { borderColor: theme.border }, pressed && s.btnPressed]}
                    onPress={() => boucle
                      ? setDurationMin((v) => Math.max(10, v - 10))
                      : setDetourMin((v) => Math.max(0, v - 5))}
                  >
                    <Text style={[s.stepBtnText, { color: theme.text }]}>−</Text>
                  </Pressable>
                  <Text style={[s.stepValue, { color: boucle || detourMin > 0 ? theme.text : theme.accent }]}>
                    {boucle
                      ? fmtMin(durationMin)
                      : detourMin === 0 ? t('routing.detourDirect') : fmtMin(detourMin)}
                  </Text>
                  <Pressable
                    style={({ pressed }) => [s.stepBtn, { borderColor: theme.border }, pressed && s.btnPressed]}
                    onPress={() => boucle
                      ? setDurationMin((v) => Math.min(180, v + 10))
                      : setDetourMin((v) => Math.min(180, v + 5))}
                  >
                    <Text style={[s.stepBtnText, { color: theme.text }]}>+</Text>
                  </Pressable>
                </View>
              </>
            )}

            {/* ── Multi ── */}
            {mode === 'multi' && (
              <>
                <Pressable
                  style={({ pressed }) => [s.selectBtn, { backgroundColor: theme.accent }, pressed && s.btnPressed]}
                  onPress={onPickInvadersOnMap}
                >
                  <Ionicons name="location-outline" size={16} color={theme.bg} />
                  <Text style={[s.selectBtnText, { color: theme.bg }]}>
                    {t('routing.selectOnMap')}
                  </Text>
                </Pressable>
                <Text style={[s.fieldLabel, { color: theme.textMuted }]}>
                  {multiInvaders.length === 0
                    ? t('routing.noInvaderSelected')
                    : multiInvaders.length === 1
                      ? t('routing.invaderSelectedOne')
                      : t('routing.invaderSelectedMany', { count: multiInvaders.length })}
                </Text>
                {multiInvaders.length === 0 && (
                  <Text style={[s.hint, { color: theme.textMuted }]}>{t('routing.multiHint')}</Text>
                )}
                {multiInvaders.map((inv) => (
                  <View key={inv.id} style={[s.multiRow, { borderColor: theme.bgDivider }]}>
                    <Text style={[s.multiName, { color: theme.text }]} numberOfLines={1}>{inv.name}</Text>
                    <Pressable
                      onPress={() => onRemoveFromMulti(inv.id)}
                      hitSlop={8}
                      style={({ pressed }) => pressed && s.btnPressed}
                    >
                      <Ionicons name="close-circle" size={18} color={theme.textMuted} />
                    </Pressable>
                  </View>
                ))}
              </>
            )}

            {/* Result */}
            {route && (
              <View style={[s.result, { backgroundColor: theme.bg, borderColor: theme.border }]}>
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
          </ScrollView>

          {/* Footer */}
          <View style={[s.footer, { borderTopColor: theme.bgDivider }]}>
            {route && (
              <Pressable
                style={({ pressed }) => [s.clearBtn, { borderColor: theme.danger }, pressed && s.btnPressed]}
                onPress={() => { onClear(); onClose() }}
              >
                <Text style={[s.clearBtnText, { color: theme.danger }]}>{t('routing.clearRoute')}</Text>
              </Pressable>
            )}
            <Pressable
              style={({ pressed }) => [s.computeBtn, { backgroundColor: canCompute ? theme.accent : theme.bgDivider }, pressed && canCompute && s.btnPressed]}
              onPress={handleCompute}
              disabled={!canCompute}
            >
              {loading
                ? <ActivityIndicator size="small" color={theme.bg} />
                : <Text style={[s.computeBtnText, { color: canCompute ? theme.bg : theme.textMuted }]}>
                    {t('routing.computeRoute')}
                  </Text>
              }
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

// ── CoordField ─────────────────────────────────────────────────────────────

type CoordFieldProps = {
  label: string
  coords: [number, number] | null
  displayLabel: string | null
  isSearchOpen: boolean
  searchQuery: string
  searchLoading: boolean
  searchResults: Array<{ label: string; coords: [number, number] }>
  onOpenSearch: () => void
  onPickOnMap: () => void
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
  label, coords, displayLabel,
  isSearchOpen, searchQuery, searchLoading, searchResults,
  onOpenSearch, onPickOnMap, onSearchChange, onSelectResult, onClear, onCloseSearch,
  theme, appFont, fontScale, s,
}: CoordFieldProps) {
  const { t } = useTranslation()
  const sz = (n: number) => Math.round(n * fontScale)

  return (
    <View style={s.coordBlock}>
      <Text style={[s.fieldLabel, { color: theme.textMuted }]}>{label}</Text>
      <View style={[s.coordRow, { borderColor: theme.border, backgroundColor: theme.bg }]}>
        <Text
          style={[s.coordLabel, { color: coords ? theme.text : theme.textMuted, fontFamily: appFont, fontSize: sz(FontSize.sm) }]}
          numberOfLines={1}
        >
          {displayLabel ?? (coords ? `${coords[1].toFixed(5)}, ${coords[0].toFixed(5)}` : t('routing.coordNotSet'))}
        </Text>
        <View style={s.coordActions}>
          {coords && (
            <Pressable onPress={onClear} hitSlop={6} style={({ pressed }) => pressed && s.btnPressed}>
              <Ionicons name="close" size={16} color={theme.textMuted} />
            </Pressable>
          )}
          <Pressable onPress={onOpenSearch} hitSlop={6} style={({ pressed }) => pressed && s.btnPressed}>
            <Ionicons name="search-outline" size={18} color={isSearchOpen ? theme.accent : theme.textMuted} />
          </Pressable>
          <Pressable onPress={onPickOnMap} hitSlop={6} style={({ pressed }) => pressed && s.btnPressed}>
            <Ionicons name="locate-outline" size={18} color={theme.textMuted} />
          </Pressable>
        </View>
      </View>

      {isSearchOpen && (
        <View style={[s.searchBox, { backgroundColor: theme.bg, borderColor: theme.border }]}>
          <View style={s.searchInputRow}>
            <TextInput
              style={[s.searchInput, { color: theme.text, fontFamily: appFont, fontSize: sz(FontSize.sm) }]}
              placeholder={t('routing.searchPlaceholder')}
              placeholderTextColor={theme.textMuted}
              value={searchQuery}
              onChangeText={onSearchChange}
              autoFocus
            />
            <Pressable onPress={onCloseSearch} hitSlop={6} style={({ pressed }) => pressed && s.btnPressed}>
              <Ionicons name="close" size={18} color={theme.textMuted} />
            </Pressable>
          </View>
          {searchLoading && <ActivityIndicator size="small" color={theme.accent} style={{ padding: 8 }} />}
          {searchResults.map((r, i) => (
            <Pressable
              key={i}
              style={({ pressed }) => [s.searchResult, { borderTopColor: theme.bgDivider }, pressed && s.btnPressed]}
              onPress={() => onSelectResult(r.coords, r.label)}
            >
              <Ionicons name="location-outline" size={14} color={theme.textMuted} />
              <Text
                style={[s.searchResultText, { color: theme.text, fontFamily: appFont, fontSize: sz(FontSize.sm) }]}
                numberOfLines={2}
              >
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
    kav:      { flex: 1, justifyContent: 'flex-end' },
    backdrop: { flex: 1 },
    sheet: {
      borderTopLeftRadius:  BorderRadius.lg,
      borderTopRightRadius: BorderRadius.lg,
      borderWidth: 1, borderBottomWidth: 0,
      maxHeight: '80%', paddingBottom: 32,
    },
    handle: {
      width: 36, height: 4, borderRadius: 2,
      alignSelf: 'center', marginVertical: 10,
    },

    // Tabs
    tabs: {
      flexDirection: 'row', borderBottomWidth: 1,
      marginHorizontal: Spacing.four,
    },
    tab: {
      flex: 1, alignItems: 'center', paddingVertical: Spacing.two,
      borderBottomWidth: 2, borderBottomColor: 'transparent',
    },
    tabText: {
      fontFamily: ButtonFont,
      fontSize: ButtonFontSize.lg,
    },

    body:        { paddingHorizontal: Spacing.four },
    bodyContent: { paddingTop: Spacing.three, gap: Spacing.two, paddingBottom: Spacing.two },

    // Chips — filters, boucle toggle (unified style)
    filterRow: { flexDirection: 'row', gap: Spacing.two, flexWrap: 'wrap' },
    chip: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      paddingHorizontal: Spacing.two, paddingVertical: 6,
      borderRadius: BorderRadius.sm, borderWidth: 1,
    },
    chipActive:   { backgroundColor: t.accent, borderColor: t.accent },
    chipText: {
      fontFamily: ButtonFont,
      fontSize: ButtonFontSize.lg,
    },

    // Field labels (above inputs)
    fieldLabel: {
      fontFamily: font,
      fontSize: sz(FontSize.xs),
      marginTop: Spacing.two,
      marginBottom: 2,
    },

    // Coord input row
    coordBlock: { gap: 2 },
    coordRow: {
      flexDirection: 'row', alignItems: 'center',
      borderWidth: 1, borderRadius: BorderRadius.sm,
      paddingHorizontal: Spacing.two, paddingVertical: 10, gap: 8,
    },
    coordLabel:   { flex: 1 },
    coordActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },

    // Search
    searchBox:        { borderWidth: 1, borderRadius: BorderRadius.sm, marginTop: 4, overflow: 'hidden' },
    searchInputRow:   { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.two, paddingVertical: 8, gap: 8 },
    searchInput:      { flex: 1, paddingVertical: 0 },
    searchResult:     { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingHorizontal: Spacing.two, paddingVertical: 10, borderTopWidth: 1 },
    searchResultText: { flex: 1, lineHeight: 18 },

    // Stepper
    stepper:     { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
    stepBtn:     { width: 36, height: 36, borderRadius: BorderRadius.sm, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
    stepBtnText: { fontFamily: ButtonFont, fontSize: ButtonFontSize.xl },
    stepValue:   { fontFamily: font, fontSize: sz(FontSize.md), minWidth: 80, textAlign: 'center' },

    // Multi mode
    selectBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
      paddingVertical: 13, borderRadius: BorderRadius.sm, marginTop: Spacing.two,
    },
    selectBtnText: { fontFamily: ButtonFont, fontSize: ButtonFontSize.xxl },

    multiRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1 },
    multiName: { fontFamily: font, fontSize: sz(FontSize.sm), flex: 1, marginRight: 8 },
    hint:      { fontFamily: font, fontSize: sz(FontSize.xs), lineHeight: sz(FontSize.xs) * 1.5 },

    // Result card
    result:     { borderWidth: 1, borderRadius: BorderRadius.sm, padding: Spacing.three, gap: 4, marginTop: Spacing.two },
    resultText: { fontFamily: font, fontSize: sz(FontSize.sm) },
    resultSub:  { fontFamily: font, fontSize: sz(FontSize.xs) },
    error:      { fontFamily: font, fontSize: sz(FontSize.xs), textAlign: 'center', marginTop: Spacing.two },

    // Footer
    footer:       { paddingHorizontal: Spacing.four, paddingTop: Spacing.three, gap: Spacing.two, borderTopWidth: 1 },
    clearBtn:     { borderWidth: 1, borderRadius: BorderRadius.sm, paddingVertical: 12, alignItems: 'center' },
    clearBtnText: { fontFamily: ButtonFont, fontSize: ButtonFontSize.xl },
    computeBtn:   { borderRadius: BorderRadius.sm, paddingVertical: 13, alignItems: 'center' },
    computeBtnText: { fontFamily: ButtonFont, fontSize: ButtonFontSize.xxl },

    btnPressed: { opacity: 0.7 },
  })
}
