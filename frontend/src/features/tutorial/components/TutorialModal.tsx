import { useRef, useState } from 'react';
import {
  View, Text, Pressable, ScrollView, Modal,
  StyleSheet, Dimensions,
} from 'react-native';
import { useTheme } from '@/contexts/theme-context';
import { useTranslation } from 'react-i18next';
import {
  type ThemeTokens,
  ButtonFont, ButtonFontSize, BorderRadius, Spacing, FontSize, Fonts,
} from '@/constants/theme';

// ─── Types ────────────────────────────────────────────────────────────────────

import type { ReactNode } from 'react';

export type StepItem    = { type: 'step';    title: string; body?: string };
export type SectionItem = { type: 'section'; label: string; body: string };
export type TipItem     = { type: 'tip';     body: string };
export type ImageItem   = { type: 'image';   placeholder: string };
export type NodeItem    = { type: 'node';    content: ReactNode };
export type TutorialItem = StepItem | SectionItem | TipItem | ImageItem | NodeItem;

export type TutorialPage = {
  key: string;
  tab: string;
  items: TutorialItem[];
};

type Props = {
  visible: boolean;
  onClose: () => void;
  title: string;
  pages: TutorialPage[];
};

// ─── Component ────────────────────────────────────────────────────────────────

export function TutorialModal({ visible, onClose, title, pages }: Props) {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const s = makeStyles(theme);

  const [activePage, setActivePage] = useState(0);
  const [pageWidth, setPageWidth]   = useState(INITIAL_PAGE_WIDTH);
  const scrollRef = useRef<ScrollView>(null);

  // Title adapts to the current page
  const currentTitle = pages[activePage]?.tab ?? title;

  function goToPage(idx: number) {
    setActivePage(idx);
    if (pageWidth > 0) {
      scrollRef.current?.scrollTo({ x: idx * pageWidth, animated: true });
    }
  }

  function handleMomentumEnd(e: any) {
    if (pageWidth <= 0) return;
    const page = Math.round(e.nativeEvent.contentOffset.x / pageWidth);
    if (page !== activePage) setActivePage(page);
  }

  function handleClose() {
    setActivePage(0);
    onClose();
  }

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={handleClose}
    >
      <View style={s.overlay}>
        {/* Backdrop — tap outside the card to close. Sits behind the card so it
            never intercepts gestures (scroll/swipe) directed at the card. */}
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />

        {/* Card — plain View so ScrollViews inside receive gestures directly */}
        <View style={s.card}>

          {/* ── Header — title changes per page ── */}
          <View style={[s.header, { borderBottomColor: theme.bgDivider }]}>
            <Text style={s.titleText}>{currentTitle}</Text>
            <Pressable onPress={handleClose} hitSlop={10} style={({ pressed }) => pressed && s.pressed}>
              <Text style={s.closeBtn}>✕</Text>
            </Pressable>
          </View>

          {/* ── Pager ── */}
          <View style={s.pager}>
            <ScrollView
              ref={scrollRef}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={handleMomentumEnd}
              scrollEventThrottle={16}
              style={s.pagerScroll}
              onLayout={(e) => setPageWidth(e.nativeEvent.layout.width)}
            >
              {pages.map((page) => (
                <View key={page.key} style={{ width: pageWidth, height: '100%' }}>
                  <ScrollView
                    style={{ flex: 1, width: pageWidth }}
                    showsVerticalScrollIndicator={false}
                    nestedScrollEnabled
                  >
                    {/* Explicit View so text has a hard width boundary and wraps correctly */}
                    <View style={[s.pageContent, { width: pageWidth }]}>
                      <PageItems items={page.items} s={s} theme={theme} />
                    </View>
                  </ScrollView>
                </View>
              ))}
            </ScrollView>
          </View>

          {/* ── Footer — dots above button ── */}
          <View style={[s.footer, { borderTopColor: theme.bgDivider }]}>
            {pages.length > 1 && (
              <View style={s.dots}>
                {pages.map((_, idx) => (
                  <Pressable
                    key={idx}
                    onPress={() => goToPage(idx)}
                    style={[s.dot, { backgroundColor: idx === activePage ? theme.accent : theme.border }]}
                  />
                ))}
              </View>
            )}
            <Pressable
              style={({ pressed }) => [s.gotItBtn, { backgroundColor: theme.accent }, pressed && s.pressed]}
              onPress={handleClose}
            >
              <Text style={[s.gotItText, { color: theme.bg }]}>{t('tutorial.gotIt')}</Text>
            </Pressable>
          </View>

        </View>
      </View>
    </Modal>
  );
}

// ─── Page content renderer ────────────────────────────────────────────────────

function PageItems({ items, s, theme }: { items: TutorialItem[]; s: ReturnType<typeof makeStyles>; theme: ThemeTokens }) {
  let stepCount = 0;
  return (
    <>
      {items.map((item, idx) => {
        if (item.type === 'step') {
          stepCount++;
          const num = stepCount;
          return (
            <View key={idx} style={s.stepRow}>
              <View style={[s.stepBadge, { borderColor: theme.border }]}>
                <Text style={[s.stepNum, { color: theme.textMuted }]}>{num}</Text>
              </View>
              <View style={s.stepBody}>
                <Text style={[s.stepTitle, { color: theme.text }]}>{item.title}</Text>
                {item.body ? <Text style={[s.itemBody, { color: theme.textMuted }]}>{item.body}</Text> : null}
              </View>
            </View>
          );
        }

        if (item.type === 'section') {
          stepCount = 0;
          return (
            <View key={idx} style={s.sectionBlock}>
              <Text style={[s.sectionLabel, { color: theme.accent }]}>{item.label}</Text>
              <Text style={[s.itemBody, { color: theme.textMuted }]}>{item.body}</Text>
            </View>
          );
        }

        if (item.type === 'tip') {
          return (
            <View key={idx} style={[s.tipBlock, { backgroundColor: theme.bg, borderLeftColor: theme.accent }]}>
              <Text style={[s.tipBody, { color: theme.textMuted }]}>{item.body}</Text>
            </View>
          );
        }

        if (item.type === 'node') {
          return <View key={idx}>{item.content}</View>;
        }

        return (
          <View key={idx} style={[s.imagePlaceholder, { backgroundColor: theme.bg, borderColor: theme.border }]}>
            <Text style={[s.imagePlaceholderText, { color: theme.textMuted }]}>{item.placeholder}</Text>
          </View>
        );
      })}
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const MAX_CARD_HEIGHT  = Math.round(SCREEN_HEIGHT * 0.78);
// Initial page width = card width on first render (overlay has Spacing.four padding each side, card maxWidth 380)
const INITIAL_PAGE_WIDTH = Math.min(SCREEN_WIDTH - Spacing.four * 2, 380);

function makeStyles(t: ThemeTokens) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.72)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: Spacing.four,
    },
    card: {
      width: '100%',
      maxWidth: 380,
      height: MAX_CARD_HEIGHT,
      backgroundColor: t.bgElement,
      borderRadius: BorderRadius.lg,
      borderWidth: 1,
      borderColor: t.border,
      overflow: 'hidden',
    },

    // Header
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.three,
      paddingVertical: Spacing.two,
      borderBottomWidth: 1,
    },
    titleText: {
      fontFamily: ButtonFont,
      fontSize: ButtonFontSize.xl,
      color: t.accent,
      letterSpacing: 1,
    },
    closeBtn: {
      color: t.textMuted,
      fontFamily: ButtonFont,
      fontSize: ButtonFontSize.lg,
    },

    // Pager
    pager: {
      flex: 1,
    },
    pagerScroll: {
      flex: 1,
    },
    pageContent: {
      padding: Spacing.three,
      gap: Spacing.two,
      paddingBottom: Spacing.four,
    },

    // Step
    stepRow: {
      flexDirection: 'row',
      gap: Spacing.two,
      alignItems: 'flex-start',
    },
    stepBadge: {
      width: 24,
      height: 24,
      borderRadius: 12,
      borderWidth: 1.5,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
      marginTop: 2,
    },
    stepNum: {
      fontFamily: Fonts.sans,
      fontSize: FontSize.xs,
      fontWeight: '700',
    },
    stepBody: {
      flex: 1,
      gap: 3,
    },
    stepTitle: {
      fontFamily: Fonts.sans,
      fontSize: FontSize.sm,
      fontWeight: '600',
    },

    // Section — plain text, no box
    sectionBlock: {
      gap: 4,
    },
    sectionLabel: {
      fontFamily: Fonts.sans,
      fontSize: FontSize.xs,
      fontWeight: '700',
      letterSpacing: 0.3,
      textTransform: 'uppercase',
    },

    // Shared body text
    itemBody: {
      fontFamily: Fonts.sans,
      fontSize: FontSize.sm,
      lineHeight: 20,
    },

    // Tip callout
    tipBlock: {
      borderLeftWidth: 3,
      paddingLeft: Spacing.two,
      paddingVertical: Spacing.one,
      borderRadius: BorderRadius.sm,
    },
    tipBody: {
      fontFamily: Fonts.sans,
      fontSize: FontSize.sm,
      lineHeight: 20,
      fontStyle: 'italic',
    },

    // Footer — column: dots on top, button full-width below
    footer: {
      alignItems: 'center',
      paddingHorizontal: Spacing.three,
      paddingVertical: Spacing.two,
      borderTopWidth: 1,
      gap: Spacing.two,
    },
    dots: {
      flexDirection: 'row',
      gap: 6,
      alignItems: 'center',
    },
    dot: {
      width: 7,
      height: 7,
      borderRadius: 4,
    },
    gotItBtn: {
      width: '100%',
      alignItems: 'center',
      paddingVertical: 10,
      borderRadius: BorderRadius.sm,
    },
    gotItText: {
      fontFamily: ButtonFont,
      fontSize: ButtonFontSize.md,
    },

    // Image placeholder
    imagePlaceholder: {
      height: 140,
      borderRadius: BorderRadius.md,
      borderWidth: 1,
      borderStyle: 'dashed',
      alignItems: 'center',
      justifyContent: 'center',
    },
    imagePlaceholderText: {
      fontFamily: Fonts.sans,
      fontSize: FontSize.sm,
      textAlign: 'center',
      paddingHorizontal: Spacing.three,
    },

    pressed: { opacity: 0.55 },
  });
}
