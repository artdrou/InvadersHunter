/**
 * Advanced color picker: a hue (across) x saturation (down) map with a vertical
 * brightness bar, and hue / saturation / brightness sliders for fine-tuning, all
 * driven by the same HSV. No native slider module (so it ships by OTA): tracks
 * and map are Skia gradients (Skia is already in the app for the markers).
 *
 * Drags follow the finger's screen movement from where it touched down: locationX
 * alone jumps around on Android while the view re-renders under the finger.
 */
import { useRef, useState } from 'react';
import { View, Text, StyleSheet, type GestureResponderEvent } from 'react-native';
import { Canvas, Rect, LinearGradient, vec } from '@shopify/react-native-skia';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/contexts/theme-context';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import { type ThemeTokens, ButtonFont, FontSize, Spacing } from '@/constants/theme';
import { hsvToHex, type Hsv } from '../hsv';

const TRACK_HEIGHT = 10;
const TRACK_BORDER = 2;
const THUMB_WIDTH = 5;
const MAP_HEIGHT = 150;
const VALUE_BAR_WIDTH = 22;
const MAP_DOT = 14;
// Exact in RGB: hue is linear between these 7 stops, saturation and brightness
// are linear between their two ends.
const HUE_STOPS = [0, 60, 120, 180, 240, 300, 360].map((h) => hsvToHex({ h, s: 1, v: 1 }));

type Channel = 'h' | 's' | 'v';

type Props = {
  hsv: Hsv;
  onChange: (hsv: Hsv) => void;
};

export function HsvSliders({ hsv, onChange }: Props) {
  const { t } = useTranslation();
  const styles = useThemedStyles(makeStyles);

  const channels: { key: Channel; label: string; value: string; colors: string[] }[] = [
    { key: 'h', label: t('colorPicker.hue'), value: `${Math.round(hsv.h)}°`, colors: HUE_STOPS },
    { key: 's', label: t('colorPicker.saturation'), value: `${Math.round(hsv.s * 100)}%`, colors: [hsvToHex({ ...hsv, s: 0 }), hsvToHex({ ...hsv, s: 1 })] },
    { key: 'v', label: t('colorPicker.brightness'), value: `${Math.round(hsv.v * 100)}%`, colors: ['#000000', hsvToHex({ ...hsv, v: 1 })] },
  ];

  return (
    <View style={styles.wrap}>
      {channels.map((c) => (
        <View key={c.key} style={styles.row}>
          <View style={styles.labelRow}>
            <Text style={styles.label}>{c.label}</Text>
            <Text style={styles.value}>{c.value}</Text>
          </View>
          <Track
            position={c.key === 'h' ? hsv.h / 360 : hsv[c.key]}
            colors={c.colors}
            onMove={(x) => onChange({ ...hsv, [c.key]: c.key === 'h' ? x * 360 : x })}
          />
        </View>
      ))}
    </View>
  );
}

function Track({ position, colors, onMove }: { position: number; colors: string[]; onMove: (x: number) => void }) {
  const { theme } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [width, setWidth] = useState(0); // inner width (inside the border)
  // Where the drag started, in the track and on screen: the position then follows
  // the finger's screen movement. locationX alone jumps around on Android while
  // the view re-renders under the finger.
  const drag = useRef({ x: 0, pageX: 0 });

  const emit = (x: number) => {
    if (width > 0) onMove(Math.max(0, Math.min(1, x / width)));
  };
  const grant = (e: GestureResponderEvent) => {
    drag.current = { x: e.nativeEvent.locationX - TRACK_BORDER, pageX: e.nativeEvent.pageX };
    emit(drag.current.x);
  };
  const move = (e: GestureResponderEvent) => emit(drag.current.x + e.nativeEvent.pageX - drag.current.pageX);

  return (
    <View
      style={[styles.track, { borderColor: theme.border }]}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width - 2 * TRACK_BORDER)}
      // Thin track, finger-sized touch area
      hitSlop={{ top: 12, bottom: 12 }}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      // Keep the drag even if the finger slides off vertically
      onResponderTerminationRequest={() => false}
      onResponderGrant={grant}
      onResponderMove={move}
    >
      {width > 0 && (
        <>
          {/* Doesn't take touches: the grant's locationX stays relative to the track */}
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <Canvas style={StyleSheet.absoluteFill}>
              <Rect x={0} y={0} width={width} height={TRACK_HEIGHT}>
                <LinearGradient start={vec(0, 0)} end={vec(width, 0)} colors={colors} />
              </Rect>
            </Canvas>
          </View>
          <View
            pointerEvents="none"
            style={[styles.thumb, { left: position * (width - THUMB_WIDTH), borderColor: theme.text, backgroundColor: theme.bg }]}
          />
        </>
      )}
    </View>
  );
}

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

export function HsvMap({ hsv, onChange }: Props) {
  const { theme } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [size, setSize] = useState({ w: 0, h: 0 }); // inner size of the map
  const [barH, setBarH] = useState(0);
  const mapDrag = useRef({ x: 0, y: 0, pageX: 0, pageY: 0 });
  const barDrag = useRef({ y: 0, pageY: 0 });

  const emitMap = (x: number, y: number) => {
    if (size.w > 0) onChange({ ...hsv, h: clamp01(x / size.w) * 360, s: 1 - clamp01(y / size.h) });
  };
  const emitBar = (y: number) => {
    if (barH > 0) onChange({ ...hsv, v: 1 - clamp01(y / barH) });
  };

  const top = hsvToHex({ ...hsv, v: 1 });

  return (
    <View style={styles.mapRow}>
      <View
        style={[styles.map, { borderColor: theme.border }]}
        onLayout={(e) => setSize({ w: e.nativeEvent.layout.width - 2 * TRACK_BORDER, h: MAP_HEIGHT })}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderTerminationRequest={() => false}
        onResponderGrant={(e) => {
          const n = e.nativeEvent;
          mapDrag.current = { x: n.locationX - TRACK_BORDER, y: n.locationY - TRACK_BORDER, pageX: n.pageX, pageY: n.pageY };
          emitMap(mapDrag.current.x, mapDrag.current.y);
        }}
        onResponderMove={(e) => {
          const d = mapDrag.current;
          emitMap(d.x + e.nativeEvent.pageX - d.pageX, d.y + e.nativeEvent.pageY - d.pageY);
        }}
      >
        {size.w > 0 && (
          <>
            <View style={StyleSheet.absoluteFill} pointerEvents="none">
              <Canvas style={StyleSheet.absoluteFill}>
                <Rect x={0} y={0} width={size.w} height={size.h}>
                  <LinearGradient start={vec(0, 0)} end={vec(size.w, 0)} colors={HUE_STOPS} />
                </Rect>
                {/* Saturation fades to white downwards, then brightness darkens it all */}
                <Rect x={0} y={0} width={size.w} height={size.h}>
                  <LinearGradient start={vec(0, 0)} end={vec(0, size.h)} colors={['#ffffff00', '#ffffff']} />
                </Rect>
                <Rect x={0} y={0} width={size.w} height={size.h} color="#000000" opacity={1 - hsv.v} />
              </Canvas>
            </View>
            <View
              pointerEvents="none"
              style={[styles.mapDot, {
                left: (hsv.h / 360) * size.w - MAP_DOT / 2,
                top: (1 - hsv.s) * size.h - MAP_DOT / 2,
                backgroundColor: hsvToHex(hsv),
                borderColor: '#ffffff',
              }]}
            />
          </>
        )}
      </View>

      <View
        style={[styles.valueBar, { borderColor: theme.border }]}
        onLayout={() => setBarH(MAP_HEIGHT)}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderTerminationRequest={() => false}
        onResponderGrant={(e) => {
          barDrag.current = { y: e.nativeEvent.locationY - TRACK_BORDER, pageY: e.nativeEvent.pageY };
          emitBar(barDrag.current.y);
        }}
        onResponderMove={(e) => emitBar(barDrag.current.y + e.nativeEvent.pageY - barDrag.current.pageY)}
      >
        {barH > 0 && (
          <>
            <View style={StyleSheet.absoluteFill} pointerEvents="none">
              <Canvas style={StyleSheet.absoluteFill}>
                <Rect x={0} y={0} width={VALUE_BAR_WIDTH} height={barH}>
                  <LinearGradient start={vec(0, 0)} end={vec(0, barH)} colors={[top, '#000000']} />
                </Rect>
              </Canvas>
            </View>
            <View
              pointerEvents="none"
              style={[styles.valueThumb, { top: (1 - hsv.v) * (barH - THUMB_WIDTH), borderColor: theme.text, backgroundColor: theme.bg }]}
            />
          </>
        )}
      </View>
    </View>
  );
}

function makeStyles(t: ThemeTokens) {
  return StyleSheet.create({
    wrap: { gap: Spacing.two },
    row: { gap: 4 },
    labelRow: { flexDirection: 'row', justifyContent: 'space-between' },
    label: { color: t.textMuted, fontFamily: ButtonFont, fontSize: FontSize.xs },
    value: { color: t.text, fontFamily: ButtonFont, fontSize: FontSize.xs },
    track: { height: TRACK_HEIGHT + 2 * TRACK_BORDER, borderWidth: TRACK_BORDER, borderRadius: 4, overflow: 'hidden', justifyContent: 'center' },
    thumb: { position: 'absolute', top: -2, bottom: -2, width: THUMB_WIDTH, borderWidth: 2 },
    mapRow: { flexDirection: 'row', gap: Spacing.two },
    map: { flex: 1, height: MAP_HEIGHT + 2 * TRACK_BORDER, borderWidth: TRACK_BORDER, borderRadius: 4, overflow: 'hidden' },
    mapDot: { position: 'absolute', width: MAP_DOT, height: MAP_DOT, borderRadius: MAP_DOT / 2, borderWidth: 2 },
    valueBar: {
      width: VALUE_BAR_WIDTH + 2 * TRACK_BORDER, height: MAP_HEIGHT + 2 * TRACK_BORDER,
      borderWidth: TRACK_BORDER, borderRadius: 4, overflow: 'hidden',
    },
    valueThumb: { position: 'absolute', left: -2, right: -2, height: THUMB_WIDTH, borderWidth: 2 },
  });
}
