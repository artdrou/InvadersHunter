import { useRef, useState } from 'react';
import {
  View, Text, Pressable, ScrollView, Modal,
  StyleSheet, Dimensions,
} from 'react-native';
import { useTheme } from '@/contexts/theme-context';
import { useTranslation } from 'react-i18next';
import {
  type ThemeTokens,
  ButtonFont, ButtonFontSize, BorderRadius, Spacing,
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
  const [pageWidth, setPageWidth]   = useState(0);
  const scrollRef = useRef<ScrollView>(null);

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
      <Pressable style={s.overlay} onPress={handleClose}>
        {/* Stop press propagation on the card itself */}
        <Pressable
          style={s.card}
          onPress={(e) => e.stopPropagation()}
        >
          {/* ── Header ── */}
          <View style={[s.header, { borderBottomColor: theme.bgDivider }]}>
            <Text style={s.titleText}>{title}</Text>
            <Pressable onPress={handleClose} hitSlop={10} style={({ pressed }) => pressed && s.pressed}>
              <Text style={s.closeBtn}>✕</Text>
            </Pressable>
          </View>

          {/* ── Tab bar ── */}
          {pages.length > 1 && (
            <View style={[s.tabBar, { borderBottomColor: theme.bgDivider }]}>
              {pages.map((page, idx) => {
                const active = idx === activePage;
                return (
                  <Pressable
                    key={page.key}
                    style={({ pressed }) => [
                      s.tab,
                      active && { borderBottomColor: theme.accent },
                      pressed && s.pressed,
                    ]}
                    onPress={() => goToPage(idx)}
                  >
                    <Text style={[s.tabText, { color: active ? theme.accent : theme.textMuted }]}>
                      {page.tab}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}

          {/* ── Pager ── */}
          <View
            style={s.pager}
            onLayout={(e) => setPageWidth(e.nativeEvent.layout.width)}
          >
            <ScrollView
              ref={scrollRef}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={handleMomentumEnd}
              scrollEventThrottle={16}
              style={s.pagerScroll}
            >
              {pages.map((page) => (
                <View key={page.key} style={[s.page, { width: pageWidth || undefined }]}>
                  <ScrollView
                    contentContainerStyle={s.pageContent}
                    showsVerticalScrollIndicator={false}
                  >
                    <PageItems items={page.items} s={s} theme={theme} />
                  </ScrollView>
                </View>
              ))}
            </ScrollView>
          </View>

          {/* ── Footer ── */}
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
        </Pressable>
      </Pressable>
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
              <View style={[s.stepBadge, { backgroundColor: theme.accent }]}>
                <Text style={[s.stepNum, { color: theme.bg }]}>{num}</Text>
              </View>
              <View style={s.stepBody}>
                <Text style={[s.stepTitle, { color: theme.text }]}>{item.title}</Text>
                {item.body ? <Text style={[s.itemBody, { color: theme.textMuted }]}>{item.body}</Text> : null}
              </View>
            </View>
          );
        }

        if (item.type === 'section') {
          stepCount = 0; // reset step counter after each section header
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

        // image placeholder
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

const SCREEN_HEIGHT = Dimensions.get('window').height;
const MAX_CARD_HEIGHT = Math.round(SCREEN_HEIGHT * 0.78);

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
      maxHeight: MAX_CARD_HEIGHT,
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

    // Tabs
    tabBar: {
      flexDirection: 'row',
      borderBottomWidth: 1,
    },
    tab: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: Spacing.two,
      borderBottomWidth: 2,
      borderBottomColor: 'transparent',
    },
    tabText: {
      fontFamily: ButtonFont,
      fontSize: ButtonFontSize.sm,
      letterSpacing: 1,
      textTransform: 'uppercase',
    },

    // Pager
    pager: {
      flex: 1,
    },
    pagerScroll: {
      flex: 1,
    },
    page: {
      flex: 1,
    },
    pageContent: {
      padding: Spacing.three,
      gap: Spacing.three,
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
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
      marginTop: 1,
    },
    stepNum: {
      fontFamily: ButtonFont,
      fontSize: ButtonFontSize.sm,
    },
    stepBody: {
      flex: 1,
      gap: 4,
    },
    stepTitle: {
      fontFamily: ButtonFont,
      fontSize: ButtonFontSize.md,
    },

    // Section header
    sectionBlock: {
      gap: 6,
    },
    sectionLabel: {
      fontFamily: ButtonFont,
      fontSize: ButtonFontSize.sm,
      letterSpacing: 1,
      textTransform: 'uppercase',
    },

    // Shared body text
    itemBody: {
      fontFamily: ButtonFont,
      fontSize: ButtonFontSize.sm,
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
      fontFamily: ButtonFont,
      fontSize: ButtonFontSize.sm,
      lineHeight: 20,
      fontStyle: 'italic',
    },

    // Footer
    footer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.three,
      paddingVertical: Spacing.two,
      borderTopWidth: 1,
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
      paddingHorizontal: Spacing.four,
      paddingVertical: 10,
      borderRadius: BorderRadius.sm,
      marginLeft: 'auto',
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
      fontFamily: ButtonFont,
      fontSize: ButtonFontSize.sm,
      textAlign: 'center',
      paddingHorizontal: Spacing.three,
    },

    pressed: { opacity: 0.55 },
  });
}
