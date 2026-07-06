import { useRef, useEffect } from "react";
import { Animated } from "react-native";
import { Motion } from "@/constants/theme";

/**
 * A one-shot fading toast. `show()` snaps to full opacity, holds, then fades out.
 * Returns the animated `opacity` to bind to a view (see {@link MapToast}).
 */
export function useToast() {
  const opacity = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  function show() {
    if (timer.current) clearTimeout(timer.current);
    opacity.setValue(1);
    timer.current = setTimeout(() => {
      Animated.timing(opacity, {
        toValue: 0,
        duration: Motion.toastFade,
        useNativeDriver: true,
      }).start();
    }, Motion.toastHold);
  }

  return { opacity, show };
}
