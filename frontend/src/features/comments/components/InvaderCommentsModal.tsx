import { useEffect, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  TextInput,
  FlatList,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/contexts/theme-context';
import { type ThemeTokens, FontSize, BorderRadius, Spacing, ButtonFont } from '@/constants/theme';
import { useAuthStore } from '@/features/auth/store';
import { useAccountGateStore } from '@/features/auth/gate-store';
import { useInvaderComments } from '../hooks/use-invader-comments';
import type { Comment } from '../types';

const MAX_LENGTH = 500;

type Props = {
  visible: boolean;
  invaderId: number | null;
  invaderName: string;
  onClose: () => void;
};

/**
 * Full-screen comment wall for one invader. Reading is public; posting,
 * reporting and deleting require an account — guests are bounced to the
 * account gate (the modal closes first so the gate/register screen isn't
 * stacked underneath it).
 */
export function InvaderCommentsModal({ visible, invaderId, invaderName, onClose }: Props) {
  const { t } = useTranslation();
  const { theme, appFont, fontScale } = useTheme();
  const styles = makeStyles(theme, appFont, fontScale);
  const insets = useSafeAreaInsets();

  const user = useAuthStore((s) => s.user);
  const isGuest = useAuthStore((s) => s.isGuest);

  const { comments, loading, error, reload, add, remove, report } = useInvaderComments(invaderId, visible);

  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const listRef = useRef<FlatList<Comment>>(null);

  useEffect(() => {
    if (!visible) {
      setText('');
      setNotice(null);
      setSending(false);
    }
  }, [visible]);

  // Guests can read but not write — send them to create/log in.
  function requireAccount(action: () => void) {
    if (isGuest) {
      onClose();
      useAccountGateStore.getState().open();
      return;
    }
    action();
  }

  async function handleSend() {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    setNotice(null);
    try {
      const created = await add(body);
      setText('');
      if (created?.status === 'hidden') {
        setNotice(t('comments.hiddenNotice'));
      } else if (created?.status === 'pending_review') {
        setNotice(t('comments.pendingNotice'));
      } else {
        listRef.current?.scrollToOffset({ offset: 0, animated: true });
      }
    } catch {
      setNotice(t('comments.postError'));
    } finally {
      setSending(false);
    }
  }

  async function handleReport(comment: Comment) {
    try {
      await report(comment.id);
      setNotice(t('comments.reportedNotice'));
    } catch {
      setNotice(t('comments.actionError'));
    }
  }

  async function handleDelete(comment: Comment) {
    try {
      await remove(comment.id);
    } catch {
      setNotice(t('comments.actionError'));
    }
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={[styles.container, { paddingTop: insets.top }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <View style={styles.headerTitles}>
            <Text style={styles.title} numberOfLines={1}>{invaderName}</Text>
            <Text style={styles.subtitle}>{t('comments.title')}</Text>
          </View>
          <Pressable onPress={onClose} hitSlop={10} accessibilityLabel={t('common.close')}
            style={({ pressed }) => pressed && styles.pressed}>
            <Ionicons name="close" size={26} color={theme.textMuted} />
          </Pressable>
        </View>

        {loading && comments.length === 0 ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={theme.accent} />
          </View>
        ) : error ? (
          <View style={styles.center}>
            <Text style={styles.muted}>{t('comments.loadError')}</Text>
            <Pressable onPress={reload} style={({ pressed }) => [styles.retryBtn, pressed && styles.pressed]}>
              <Text style={styles.retryText}>{t('common.ok')}</Text>
            </Pressable>
          </View>
        ) : comments.length === 0 ? (
          <View style={styles.center}>
            <Text style={styles.muted}>{t('comments.empty')}</Text>
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={comments}
            keyExtractor={(c) => String(c.id)}
            renderItem={({ item }) => (
              <CommentRow
                comment={item}
                isOwn={item.user_id === user?.id}
                onReport={() => requireAccount(() => handleReport(item))}
                onDelete={() => handleDelete(item)}
                styles={styles}
                theme={theme}
                t={t}
              />
            )}
            contentContainerStyle={styles.listContent}
            keyboardShouldPersistTaps="handled"
          />
        )}

        {notice && (
          <View style={styles.notice}>
            <Text style={styles.noticeText}>{notice}</Text>
          </View>
        )}

        {isGuest ? (
          <Pressable
            onPress={() => requireAccount(() => {})}
            style={({ pressed }) => [styles.guestBar, pressed && styles.pressed]}
          >
            <Ionicons name="lock-closed-outline" size={16} color={theme.textMuted} />
            <Text style={styles.guestBarText}>{t('comments.guestPrompt')}</Text>
          </Pressable>
        ) : (
          <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, Spacing.two) }]}>
            <TextInput
              style={styles.input}
              value={text}
              onChangeText={(v) => { setText(v); if (notice) setNotice(null); }}
              placeholder={t('comments.placeholder')}
              placeholderTextColor={theme.textMuted}
              multiline
              maxLength={MAX_LENGTH}
              editable={!sending}
            />
            <Pressable
              onPress={handleSend}
              disabled={!text.trim() || sending}
              style={({ pressed }) => [
                styles.sendBtn,
                (!text.trim() || sending) && styles.sendBtnDisabled,
                pressed && styles.pressed,
              ]}
              accessibilityLabel={t('comments.send')}
            >
              {sending
                ? <ActivityIndicator size="small" color={theme.bg} />
                : <Ionicons name="send" size={18} color={theme.bg} />}
            </Pressable>
          </View>
        )}
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── comment row ───────────────────────────────────────────────────────────────

type RowProps = {
  comment: Comment;
  isOwn: boolean;
  onReport: () => void;
  onDelete: () => void;
  styles: ReturnType<typeof makeStyles>;
  theme: ThemeTokens;
  t: (k: string) => string;
};

function CommentRow({ comment, isOwn, onReport, onDelete, styles, theme, t }: RowProps) {
  return (
    <View style={styles.row}>
      <View style={styles.rowHead}>
        <Text style={styles.author} numberOfLines={1}>{comment.username}</Text>
        <Text style={styles.date}>{formatCommentDate(comment.created_at)}</Text>
        {isOwn ? (
          <Pressable onPress={onDelete} hitSlop={8} style={({ pressed }) => pressed && styles.pressed}
            accessibilityLabel={t('comments.delete')}>
            <Ionicons name="trash-outline" size={16} color={theme.textMuted} />
          </Pressable>
        ) : (
          <Pressable onPress={onReport} hitSlop={8} style={({ pressed }) => pressed && styles.pressed}
            accessibilityLabel={t('comments.report')}>
            <Ionicons name="flag-outline" size={16} color={theme.textMuted} />
          </Pressable>
        )}
      </View>
      <Text style={styles.body}>{comment.body}</Text>
      {comment.status === 'pending_review' && (
        <Text style={styles.reviewTag}>{t('comments.underReview')}</Text>
      )}
    </View>
  );
}

/**
 * Server timestamps are naive UTC (datetime.utcnow with no tz suffix); mark
 * them UTC so JS doesn't reinterpret as local time. Formatted manually to avoid
 * relying on Hermes Intl.
 */
function formatCommentDate(iso: string): string {
  const hasTz = /(?:Z|[+-]\d\d:?\d\d)$/.test(iso);
  const d = new Date(hasTz ? iso : iso + 'Z');
  if (isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${String(d.getFullYear()).slice(2)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ─── styles ──────────────────────────────────────────────────────────────────

function makeStyles(t: ThemeTokens, font: string, scale: number) {
  const sz = (n: number) => Math.round(n * scale);
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: t.bg },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.three,
      paddingVertical: Spacing.two,
      borderBottomWidth: 1,
      borderBottomColor: t.bgDivider,
    },
    headerTitles: { flexShrink: 1, gap: 2 },
    title: {
      color: t.accent,
      fontFamily: font,
      fontSize: sz(FontSize.xl),
      letterSpacing: 1,
    },
    subtitle: {
      color: t.textMuted,
      fontFamily: font,
      fontSize: sz(FontSize.xs),
    },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.four, gap: Spacing.two },
    muted: { color: t.textMuted, fontFamily: font, fontSize: sz(FontSize.sm), textAlign: 'center' },
    retryBtn: {
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: BorderRadius.sm,
      paddingHorizontal: Spacing.three,
      paddingVertical: Spacing.one,
    },
    retryText: { color: t.text, fontFamily: ButtonFont, fontSize: FontSize.md },
    listContent: { padding: Spacing.three, gap: Spacing.three },
    row: { gap: 4 },
    rowHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
    author: { color: t.accent, fontFamily: font, fontSize: sz(FontSize.sm), flexShrink: 1 },
    date: { color: t.textMuted, fontFamily: font, fontSize: sz(FontSize.xxs), flex: 1 },
    body: { color: t.text, fontFamily: font, fontSize: sz(FontSize.sm), lineHeight: sz(FontSize.sm) + 6 },
    reviewTag: { color: t.textMuted, fontFamily: font, fontSize: sz(FontSize.xxs), fontStyle: 'italic' },
    notice: {
      backgroundColor: t.bgElement,
      borderTopWidth: 1,
      borderTopColor: t.bgDivider,
      paddingHorizontal: Spacing.three,
      paddingVertical: Spacing.two,
    },
    noticeText: { color: t.textMuted, fontFamily: font, fontSize: sz(FontSize.xs), textAlign: 'center' },
    composer: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: Spacing.two,
      paddingHorizontal: Spacing.three,
      paddingTop: Spacing.two,
      borderTopWidth: 1,
      borderTopColor: t.bgDivider,
    },
    input: {
      flex: 1,
      maxHeight: 120,
      minHeight: 42,
      backgroundColor: t.bgElement,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: BorderRadius.sm,
      paddingHorizontal: Spacing.two,
      paddingTop: Spacing.two,
      paddingBottom: Spacing.two,
      color: t.text,
      fontFamily: font,
      fontSize: sz(FontSize.sm),
    },
    sendBtn: {
      width: 42,
      height: 42,
      borderRadius: BorderRadius.sm,
      backgroundColor: t.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sendBtnDisabled: { opacity: 0.4 },
    guestBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.two,
      paddingVertical: Spacing.three,
      paddingBottom: Spacing.four,
      borderTopWidth: 1,
      borderTopColor: t.bgDivider,
    },
    guestBarText: { color: t.textMuted, fontFamily: font, fontSize: sz(FontSize.sm) },
    pressed: { opacity: 0.6 },
  });
}
