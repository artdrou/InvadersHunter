import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { TutorialPage } from '@/features/tutorial'
import { RoutingPanelPreview } from '../RoutingPanelPreview'
import { InvaderTapIllustration } from '../InvaderTapIllustration'

/** The four tutorial pages shown from the routing panel's info button. */
export function useRoutingTutorialPages(): TutorialPage[] {
  const { t } = useTranslation()
  return useMemo<TutorialPage[]>(() => [
    {
      key: 'overview',
      tab: t('tutorial.routing.tab1'),
      items: [
        { type: 'section', label: t('tutorial.routing.overviewOpenSection'), body: t('tutorial.routing.overviewOpenBody') },
        { type: 'node',    content: <RoutingPanelPreview /> },
        { type: 'section', label: t('tutorial.routing.overviewZone2Title'), body: t('tutorial.routing.overviewZone2Body') },
        { type: 'section', label: t('tutorial.routing.overviewZone3Title'), body: t('tutorial.routing.overviewZone3Body') },
        { type: 'section', label: t('tutorial.routing.overviewZone4Title'), body: t('tutorial.routing.overviewZone4Body') },
        { type: 'section', label: t('tutorial.routing.overviewZone5Title'), body: t('tutorial.routing.overviewZone5Body') },
      ],
    },
    {
      key: 'coords',
      tab: t('tutorial.routing.tab2'),
      items: [
        { type: 'section', label: t('tutorial.routing.coordsSection'), body: t('tutorial.routing.coordsBody') },
        { type: 'step',    title: t('tutorial.routing.coordStep1Title'), body: t('tutorial.routing.coordStep1Body') },
        { type: 'step',    title: t('tutorial.routing.coordStep2Title'), body: t('tutorial.routing.coordStep2Body') },
        { type: 'step',    title: t('tutorial.routing.coordStep3Title'), body: t('tutorial.routing.coordStep3Body') },
        { type: 'step',    title: t('tutorial.routing.coordStep4Title'), body: t('tutorial.routing.coordStep4Body') },
        { type: 'node',    content: <RoutingPanelPreview highlight={[2, 4]} /> },
      ],
    },
    {
      key: 'detour',
      tab: t('tutorial.routing.tab3'),
      items: [
        { type: 'section', label: t('tutorial.routing.detourSection'), body: t('tutorial.routing.detourBody') },
        { type: 'step',    title: t('tutorial.routing.detourStep1Title'), body: t('tutorial.routing.detourStep1Body') },
        { type: 'step',    title: t('tutorial.routing.detourStep2Title'), body: t('tutorial.routing.detourStep2Body') },
        { type: 'step',    title: t('tutorial.routing.detourStep3Title'), body: t('tutorial.routing.detourStep3Body') },
        { type: 'node',    content: <RoutingPanelPreview highlight={[5]} expanded /> },
      ],
    },
    {
      key: 'invaders',
      tab: t('tutorial.routing.tab4'),
      items: [
        { type: 'section', label: t('tutorial.routing.invadersSection'), body: t('tutorial.routing.invadersBody') },
        { type: 'step',    title: t('tutorial.routing.invadersStep1Title'), body: t('tutorial.routing.invadersStep1Body') },
        { type: 'step',    title: t('tutorial.routing.invadersStep2Title'), body: t('tutorial.routing.invadersStep2Body') },
        { type: 'tip',     body: t('tutorial.routing.invadersTip') },
        { type: 'node',    content: <InvaderTapIllustration /> },
      ],
    },
  ], [t])
}
