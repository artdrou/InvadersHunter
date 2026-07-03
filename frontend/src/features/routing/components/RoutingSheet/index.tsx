import { useState } from 'react'
import { View, Text, Pressable } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import { useTheme } from '@/contexts/theme-context'
import type { InvaderWithState } from '@/features/invaders/types'
import { isNonFlashable } from '@/features/invaders/types'
import { InfoButton, TutorialModal } from '@/features/tutorial'
import type { RoutingParams, RouteResult } from '../../types'
import { useAddressSearch } from '../../hooks/use-address-search'
import { makeStyles } from './styles'
import { fmtMin } from './format'
import { useRoutingTutorialPages } from './tutorial'
import { CoordField } from './CoordField'
import { OptionsPanel } from './OptionsPanel'
import { ComputeButton } from './ComputeButton'

export type RoutingPickerTarget = 'from' | 'to'

type Props = {
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
  const [tutorialVisible, setTutorialVisible] = useState(false)

  const tutorialPages = useRoutingTutorialPages()

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

  const canCompute = loading ? false : boucle ? !!fromCoords : !!(fromCoords && toCoords)
  const cancelRoute = () => { onClear(); onClearMulti() }
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
            <Text style={[s.titleText, { color: theme.accent }]}>{t('routing.modeAB')}</Text>
            <InfoButton onPress={() => setTutorialVisible(true)} color={theme.accent} />
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

            {/* Options toggle row — action left / summary right when collapsed; just ▲ when expanded */}
            <View style={[s.optionsRow, { borderTopColor: theme.bgDivider, justifyContent: optionsOpen ? 'flex-end' : 'space-between' }]}>
              {!optionsOpen && (
                <ComputeButton
                  route={route} canCompute={canCompute} loading={loading}
                  onCompute={handleCompute} onCancel={cancelRoute}
                  theme={theme} s={s}
                />
              )}
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
              <OptionsPanel
                boucle={boucle} setBoucle={setBoucle}
                includeCaptures={includeCaptures} setIncludeCaptures={setIncludeCaptures}
                flashableOnly={flashableOnly} setFlashableOnly={setFlashableOnly}
                detourMin={detourMin} setDetourMin={setDetourMin}
                durationMin={durationMin} setDurationMin={setDurationMin}
                route={route} canCompute={canCompute} loading={loading}
                onCompute={handleCompute} onCancel={cancelRoute}
                theme={theme} s={s}
              />
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

      <TutorialModal
        visible={tutorialVisible}
        onClose={() => setTutorialVisible(false)}
        title={t('tutorial.routing.title')}
        pages={tutorialPages}
      />
    </>
  )
}
