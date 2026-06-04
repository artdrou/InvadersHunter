import { useState } from 'react'
import {
  Modal, View, Text, Pressable, ScrollView, TextInput,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '@/contexts/theme-context'
import type { ThemeTokens } from '@/constants/theme'
import { BorderRadius, Spacing, ButtonFont, ButtonFontSize } from '@/constants/theme'
import type { InvaderWithState } from '@/features/invaders/types'
import { isNonFlashable } from '@/features/invaders/types'
import { useTranslation } from 'react-i18next'
import type { RoutingParams, RouteResult } from '../types'
import { useAddressSearch } from '../hooks/use-address-search'

type SheetMode = 'ab' | 'walk' | 'multi'

export type RoutingPickerTarget = 'from' | 'to'

type Props = {
  visible: boolean
  onClose: () => void
  // A→B coords (controlled from map.tsx)
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
  loading: boolean
  error: string | null
  route: RouteResult | null
  onCompute: (params: RoutingParams) => void
  onClear: () => void
}

export function RoutingSheet({
  visible, onClose,
  fromCoords, fromLabel, toCoords, toLabel,
  onSetCoords, onClearCoords, onPickOnMap,
  allInvaders, multiInvaders, onRemoveFromMulti,
  loading, error, route,
  onCompute, onClear,
}: Props) {
  const { theme, appFont } = useTheme()
  const { t } = useTranslation()
  const s = makeStyles(theme, appFont)

  const [mode, setMode]               = useState<SheetMode>('ab')
  const [detourPct, setDetourPct]     = useState(30)
  const [durationMin, setDurationMin] = useState(30)
  const [walkMode, setWalkMode]       = useState<'circuit' | 'libre'>('circuit')
  // Invader filter — defaults: uncaptured only + flashable only
  const [includeCaptures, setIncludeCaptures] = useState(false)
  const [flashableOnly, setFlashableOnly]     = useState(true)

  // Address search state — one active search field at a time
  const [searchTarget, setSearchTarget] = useState<RoutingPickerTarget | null>(null)
  const [searchQuery, setSearchQuery]   = useState('')
  const { search, results, loading: searchLoading, clear: clearSearch } = useAddressSearch()

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
      if (!fromCoords || !toCoords) return
      onCompute({
        mode: 'ab',
        from: fromCoords,
        to: toCoords,
        invaders: uncaptured,
        travelMode: 'foot-walking',
        detourPct,
      })
    } else if (mode === 'walk') {
      if (!fromCoords) return
      onCompute({
        mode: 'walk',
        from: fromCoords,
        invaders: uncaptured,
        travelMode: 'foot-walking',
        durationMin,
        walkMode,
        ...(walkMode === 'libre' && toCoords ? { to: toCoords } : {}),
      })
    } else {
      if (multiInvaders.length < 2) return
      onCompute({ mode: 'multi', invaders: multiInvaders, travelMode: 'foot-walking' })
    }
  }

  const canCompute = (() => {
    if (loading) return false
    if (mode === 'ab') return !!(fromCoords && toCoords)
    if (mode === 'walk') return !!(fromCoords) && (walkMode === 'circuit' || !!toCoords)
    return multiInvaders.length >= 2
  })()

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={s.kav}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
      <Pressable style={s.backdrop} onPress={onClose} />

      <View style={[s.sheet, { backgroundColor: theme.bgElement, borderColor: theme.border }]}>
        <View style={[s.handle, { backgroundColor: theme.bgDivider }]} />

        {/* Mode tabs */}
        <View style={[s.tabs, { borderBottomColor: theme.bgDivider }]}>
          {(['ab', 'walk', 'multi'] as SheetMode[]).map((m) => (
            <Pressable
              key={m}
              style={[s.tab, mode === m && { borderBottomColor: theme.accent, borderBottomWidth: 2 }]}
              onPress={() => { setMode(m); closeSearch() }}
            >
              <Text style={[s.tabText, { color: mode === m ? theme.accent : theme.textMuted, fontFamily: appFont }]}>
                {m === 'ab' ? t('routing.modeAB') : m === 'walk' ? t('routing.modeWalk') : t('routing.modeMulti')}
              </Text>
            </Pressable>
          ))}
        </View>

        <ScrollView
          style={s.body}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={s.bodyContent}
          keyboardShouldPersistTaps="handled"
        >

          {/* ── Invader filters ── */}
          <View style={s.filterRow}>
            <Pressable
              style={[s.filterChip, { borderColor: theme.border }, !includeCaptures && { backgroundColor: theme.accent, borderColor: theme.accent }]}
              onPress={() => setIncludeCaptures((v) => !v)}
            >
              <Text style={[s.filterChipText, { color: !includeCaptures ? theme.bg : theme.textMuted, fontFamily: appFont }]}>
                {t('routing.filterUncaptured')}
              </Text>
            </Pressable>
            <Pressable
              style={[s.filterChip, { borderColor: theme.border }, flashableOnly && { backgroundColor: theme.accent, borderColor: theme.accent }]}
              onPress={() => setFlashableOnly((v) => !v)}
            >
              <Text style={[s.filterChipText, { color: flashableOnly ? theme.bg : theme.textMuted, fontFamily: appFont }]}>
                {t('routing.filterFlashable')}
              </Text>
            </Pressable>
          </View>

          {/* ── A→B ── */}
          {mode === 'ab' && (
            <>
              <CoordField
                label={t('routing.labelFrom')}
                coords={fromCoords}
                displayLabel={fromLabel}
                isSearchOpen={searchTarget === 'from'}
                searchQuery={searchQuery}
                searchLoading={searchLoading}
                searchResults={results}
                onOpenSearch={() => openSearch('from')}
                onPickOnMap={() => { onPickOnMap('from') }}
                onSearchChange={handleSearchChange}
                onSelectResult={selectResult}
                onClear={() => onClearCoords('from')}
                onCloseSearch={closeSearch}
                theme={theme}
                appFont={appFont}
                s={s}
              />
              <CoordField
                label={t('routing.labelTo')}
                coords={toCoords}
                displayLabel={toLabel}
                isSearchOpen={searchTarget === 'to'}
                searchQuery={searchQuery}
                searchLoading={searchLoading}
                searchResults={results}
                onOpenSearch={() => openSearch('to')}
                onPickOnMap={() => { onPickOnMap('to') }}
                onSearchChange={handleSearchChange}
                onSelectResult={selectResult}
                onClear={() => onClearCoords('to')}
                onCloseSearch={closeSearch}
                theme={theme}
                appFont={appFont}
                s={s}
              />
              <Text style={[s.label, { color: theme.textMuted }]}>{t('routing.labelDetour')}</Text>
              <View style={s.stepper}>
                <Pressable style={[s.stepBtn, { borderColor: theme.border }]} onPress={() => setDetourPct(Math.max(10, detourPct - 10))}>
                  <Text style={[s.stepBtnText, { color: theme.text }]}>−</Text>
                </Pressable>
                <Text style={[s.stepValue, { color: theme.text, fontFamily: appFont }]}>{detourPct}%</Text>
                <Pressable style={[s.stepBtn, { borderColor: theme.border }]} onPress={() => setDetourPct(Math.min(100, detourPct + 10))}>
                  <Text style={[s.stepBtnText, { color: theme.text }]}>+</Text>
                </Pressable>
              </View>
            </>
          )}

          {/* ── Walk ── */}
          {mode === 'walk' && (
            <>
              <CoordField
                label={t('routing.labelFrom')}
                coords={fromCoords}
                displayLabel={fromLabel}
                isSearchOpen={searchTarget === 'from'}
                searchQuery={searchQuery}
                searchLoading={searchLoading}
                searchResults={results}
                onOpenSearch={() => openSearch('from')}
                onPickOnMap={() => { onPickOnMap('from') }}
                onSearchChange={handleSearchChange}
                onSelectResult={selectResult}
                onClear={() => onClearCoords('from')}
                onCloseSearch={closeSearch}
                theme={theme}
                appFont={appFont}
                s={s}
              />
              <Text style={[s.label, { color: theme.textMuted }]}>{t('routing.labelDuration')}</Text>
              <View style={s.stepper}>
                <Pressable style={[s.stepBtn, { borderColor: theme.border }]} onPress={() => setDurationMin(Math.max(10, durationMin - 10))}>
                  <Text style={[s.stepBtnText, { color: theme.text }]}>−</Text>
                </Pressable>
                <Text style={[s.stepValue, { color: theme.text, fontFamily: appFont }]}>{durationMin} min</Text>
                <Pressable style={[s.stepBtn, { borderColor: theme.border }]} onPress={() => setDurationMin(Math.min(180, durationMin + 10))}>
                  <Text style={[s.stepBtnText, { color: theme.text }]}>+</Text>
                </Pressable>
              </View>
              <Text style={[s.label, { color: theme.textMuted }]}>{t('routing.labelType')}</Text>
              <View style={s.pillRow}>
                {(['circuit', 'libre'] as const).map((wm) => (
                  <Pressable
                    key={wm}
                    style={[s.pillWide, { borderColor: theme.border }, walkMode === wm && { backgroundColor: theme.accent, borderColor: theme.accent }]}
                    onPress={() => setWalkMode(wm)}
                  >
                    <Text style={[s.pillText, { color: walkMode === wm ? theme.bg : theme.textMuted, fontFamily: appFont }]}>
                      {wm === 'circuit' ? t('routing.walkCircuit') : t('routing.walkFree')}
                    </Text>
                  </Pressable>
                ))}
              </View>
              {walkMode === 'libre' && (
                <CoordField
                  label={t('routing.labelTo')}
                  coords={toCoords}
                  displayLabel={toLabel}
                  isSearchOpen={searchTarget === 'to'}
                  searchQuery={searchQuery}
                  searchLoading={searchLoading}
                  searchResults={results}
                  onOpenSearch={() => openSearch('to')}
                  onPickOnMap={() => { onPickOnMap('to') }}
                  onSearchChange={handleSearchChange}
                  onSelectResult={selectResult}
                  onClear={() => onClearCoords('to')}
                  onCloseSearch={closeSearch}
                  theme={theme}
                  appFont={appFont}
                  s={s}
                />
              )}
            </>
          )}

          {/* ── Multi ── */}
          {mode === 'multi' && (
            <>
              <Text style={[s.label, { color: theme.textMuted }]}>
                {multiInvaders.length === 0
                  ? t('routing.noInvaderSelected')
                  : multiInvaders.length === 1
                    ? t('routing.invaderSelectedOne')
                    : t('routing.invaderSelectedMany', { count: multiInvaders.length })}
              </Text>
              {multiInvaders.length === 0 && (
                <Text style={[s.hint, { color: theme.textMuted }]}>
                  {t('routing.multiHint')}
                </Text>
              )}
              {multiInvaders.map((inv) => (
                <View key={inv.id} style={[s.multiRow, { borderColor: theme.bgDivider }]}>
                  <Text style={[s.multiName, { color: theme.text }]} numberOfLines={1}>{inv.name}</Text>
                  <Pressable onPress={() => onRemoveFromMulti(inv.id)} hitSlop={8}>
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
                <Text style={[s.resultSub, { color: theme.textMuted }]}>{t('routing.detourMinutes', { minutes: route.detourMinutes })}</Text>
              )}
            </View>
          )}

          {error && <Text style={[s.error, { color: theme.danger }]}>{error}</Text>}
        </ScrollView>

        {/* Footer */}
        <View style={s.footer}>
          {route && (
            <Pressable style={[s.clearBtn, { borderColor: theme.danger }]} onPress={() => { onClear(); onClose() }}>
              <Text style={[s.clearBtnText, { color: theme.danger, fontFamily: appFont }]}>{t('routing.clearRoute')}</Text>
            </Pressable>
          )}
          <Pressable
            style={[s.computeBtn, { backgroundColor: canCompute ? theme.accent : theme.bgDivider }]}
            onPress={handleCompute}
            disabled={!canCompute}
          >
            {loading
              ? <ActivityIndicator size="small" color={theme.bg} />
              : <Text style={[s.computeBtnText, { color: canCompute ? theme.bg : theme.textMuted, fontFamily: appFont }]}>
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
  s: ReturnType<typeof makeStyles>
}

function CoordField({
  label, coords, displayLabel,
  isSearchOpen, searchQuery, searchLoading, searchResults,
  onOpenSearch, onPickOnMap, onSearchChange, onSelectResult, onClear, onCloseSearch,
  theme, appFont, s,
}: CoordFieldProps) {
  const { t } = useTranslation()
  return (
    <View style={s.coordBlock}>
      <Text style={[s.label, { color: theme.textMuted }]}>{label}</Text>

      {/* Row: label/coords + action buttons */}
      <View style={[s.coordRow, { borderColor: theme.border, backgroundColor: theme.bg }]}>
        <Text style={[s.coordLabel, { color: coords ? theme.text : theme.textMuted }]} numberOfLines={1}>
          {displayLabel ?? (coords ? `${coords[1].toFixed(5)}, ${coords[0].toFixed(5)}` : t('routing.coordNotSet'))}
        </Text>
        <View style={s.coordActions}>
          {coords && (
            <Pressable onPress={onClear} hitSlop={6}>
              <Ionicons name="close" size={16} color={theme.textMuted} />
            </Pressable>
          )}
          <Pressable onPress={onOpenSearch} hitSlop={6}>
            <Ionicons name="search-outline" size={18} color={isSearchOpen ? theme.accent : theme.textMuted} />
          </Pressable>
          <Pressable onPress={onPickOnMap} hitSlop={6}>
            <Ionicons name="locate-outline" size={18} color={theme.textMuted} />
          </Pressable>
        </View>
      </View>

      {/* Inline search */}
      {isSearchOpen && (
        <View style={[s.searchBox, { backgroundColor: theme.bg, borderColor: theme.border }]}>
          <View style={s.searchInputRow}>
            <TextInput
              style={[s.searchInput, { color: theme.text, fontFamily: appFont }]}
              placeholder={t('routing.searchPlaceholder')}
              placeholderTextColor={theme.textMuted}
              value={searchQuery}
              onChangeText={onSearchChange}
              autoFocus
            />
            <Pressable onPress={onCloseSearch} hitSlop={6}>
              <Ionicons name="close" size={18} color={theme.textMuted} />
            </Pressable>
          </View>
          {searchLoading && <ActivityIndicator size="small" color={theme.accent} style={{ padding: 8 }} />}
          {searchResults.map((r, i) => (
            <Pressable
              key={i}
              style={[s.searchResult, { borderTopColor: theme.bgDivider }]}
              onPress={() => onSelectResult(r.coords, r.label)}
            >
              <Ionicons name="location-outline" size={14} color={theme.textMuted} />
              <Text style={[s.searchResultText, { color: theme.text }]} numberOfLines={2}>{r.label}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  )
}

// ── Styles ─────────────────────────────────────────────────────────────────

function makeStyles(t: ThemeTokens, _font: string) {
  return StyleSheet.create({
    kav:        { flex: 1, justifyContent: 'flex-end' },
    backdrop:   { flex: 1 },
    sheet: {
      borderTopLeftRadius:  BorderRadius.lg,
      borderTopRightRadius: BorderRadius.lg,
      borderWidth:    1,
      borderBottomWidth: 0,
      maxHeight: '80%',
      paddingBottom: 32,
    },
    handle: {
      width: 36, height: 4, borderRadius: 2,
      alignSelf: 'center', marginVertical: 10,
    },
    tabs: {
      flexDirection: 'row', borderBottomWidth: 1,
      marginHorizontal: Spacing.four,
    },
    tab: {
      flex: 1, alignItems: 'center', paddingVertical: 10,
      borderBottomWidth: 2, borderBottomColor: 'transparent',
    },
    tabText: { fontSize: 13, fontWeight: '600' },
    body:        { paddingHorizontal: Spacing.four },
    bodyContent: { paddingTop: Spacing.three, gap: Spacing.two, paddingBottom: Spacing.two },
    filterRow:   { flexDirection: 'row', gap: Spacing.two },
    filterChip:  { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
    filterChipText: { fontSize: 12, fontWeight: '600' },

    // coord field
    coordBlock: { gap: 4 },
    coordRow: {
      flexDirection: 'row', alignItems: 'center',
      borderWidth: 1, borderRadius: BorderRadius.sm,
      paddingHorizontal: Spacing.two, paddingVertical: 10, gap: 8,
    },
    coordLabel: { flex: 1, fontSize: 13 },
    coordActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },

    // search
    searchBox: {
      borderWidth: 1, borderRadius: BorderRadius.sm, marginTop: 4, overflow: 'hidden',
    },
    searchInputRow: {
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: Spacing.two, paddingVertical: 8, gap: 8,
    },
    searchInput: { flex: 1, fontSize: 14, paddingVertical: 0 },
    searchResult: {
      flexDirection: 'row', alignItems: 'flex-start', gap: 8,
      paddingHorizontal: Spacing.two, paddingVertical: 10,
      borderTopWidth: 1,
    },
    searchResultText: { flex: 1, fontSize: 13, lineHeight: 18 },

    label: {
      fontSize: 11, fontWeight: '600', letterSpacing: 0.5,
      textTransform: 'uppercase', marginTop: Spacing.two,
    },
    pillRow:  { flexDirection: 'row', gap: Spacing.two },
    pillWide: { flex: 1, paddingVertical: 10, borderRadius: BorderRadius.sm, borderWidth: 1, alignItems: 'center' },
    pillText: { fontSize: 13 },
    stepper:  { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
    stepBtn:  { width: 36, height: 36, borderRadius: BorderRadius.sm, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
    stepBtnText: { fontSize: 20, lineHeight: 24 },
    stepValue:   { fontSize: 16, minWidth: 70, textAlign: 'center' },

    multiRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1 },
    multiName: { fontSize: 14, flex: 1, marginRight: 8 },

    result:    { borderWidth: 1, borderRadius: BorderRadius.sm, padding: Spacing.three, gap: 4, marginTop: Spacing.two },
    resultText:{ fontSize: 14, fontWeight: '600' },
    resultSub: { fontSize: 12 },
    error:     { fontSize: 12, textAlign: 'center', marginTop: Spacing.two },
    hint:      { fontSize: 12, lineHeight: 18 },

    footer:       { paddingHorizontal: Spacing.four, paddingTop: Spacing.three, gap: Spacing.two },
    clearBtn:     { borderWidth: 1, borderRadius: BorderRadius.sm, paddingVertical: 12, alignItems: 'center' },
    clearBtnText: { fontSize: 13 },
    computeBtn:   { borderRadius: BorderRadius.sm, paddingVertical: 14, alignItems: 'center' },
    computeBtnText: { fontSize: 14, fontWeight: '700' },
  })
}
