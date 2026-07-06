import { useRef } from "react";
import { View, PanResponder, type LayoutChangeEvent, type GestureResponderEvent } from "react-native";
import type { ThemeTokens } from "@/constants/theme";
import type { ToolbarStyles } from "./styles";

type SliderProps = {
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  theme: ThemeTokens;
  styles: ToolbarStyles;
};

/** Draggable discrete slider used to pick the mosaic grid column count. */
export function GridSlider({ value, min, max, onChange, theme, styles }: SliderProps) {
  const trackRef = useRef<View>(null);
  const trackPageX = useRef(0);
  const trackWidth = useRef(0);

  function updateFromPageX(pageX: number) {
    if (trackWidth.current === 0) return;
    const x = Math.max(0, Math.min(pageX - trackPageX.current, trackWidth.current));
    const ratio = x / trackWidth.current;
    const val = Math.round(min + ratio * (max - min));
    onChange(Math.max(min, Math.min(max, val)));
  }

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e: GestureResponderEvent) => {
        trackRef.current?.measureInWindow((x, _y, w) => {
          trackPageX.current = x;
          trackWidth.current = w;
          updateFromPageX(e.nativeEvent.pageX);
        });
      },
      onPanResponderMove: (e: GestureResponderEvent) => {
        updateFromPageX(e.nativeEvent.pageX);
      },
    })
  ).current;

  function onLayout(e: LayoutChangeEvent) {
    trackWidth.current = e.nativeEvent.layout.width;
    trackRef.current?.measureInWindow((x) => { trackPageX.current = x; });
  }

  const fillRatio = (value - min) / (max - min);
  const thumbLeft = `${fillRatio * 100}%` as `${number}%`;

  return (
    <View
      ref={trackRef}
      style={styles.sliderTrackOuter}
      onLayout={onLayout}
      {...panResponder.panHandlers}
    >
      <View style={[styles.sliderTrack, { backgroundColor: theme.border }]}>
        <View style={[styles.sliderFill, { flex: fillRatio, backgroundColor: theme.accent }]} />
        <View style={{ flex: 1 - fillRatio }} />
      </View>
      <View style={[styles.sliderThumb, { backgroundColor: theme.accent, borderColor: theme.bg, left: thumbLeft }]} />
    </View>
  );
}
