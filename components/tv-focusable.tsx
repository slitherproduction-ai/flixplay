import type React from "react";
import { forwardRef, useCallback, useImperativeHandle, useRef, useState } from "react";
import { findNodeHandle, Platform, Pressable, StyleSheet, type PressableProps, type StyleProp, type View, type ViewStyle } from "react-native";
import { Colors } from "@/constants/theme";
import { getTVRemoteEvent, type TVKeyDownEvent, type TVRemoteEvent } from "@/hooks/use-tv-remote";
import { getRememberedTvFocus, rememberTvFocus } from "@/core/navigation/tv-focus-memory";

export type TVFocusableHandle = {
  focus: () => void;
  getNodeHandle: () => number | null;
};

type TVFocusableProps = Omit<PressableProps, "style" | "onFocus" | "onBlur" | "onKeyDown"> & {
  style?: PressableProps["style"];
  focusStyle?: StyleProp<ViewStyle>;
  onFocus?: PressableProps["onFocus"];
  onBlur?: PressableProps["onBlur"];
  onKeyDown?: (event: TVKeyDownEvent) => void;
  onTVEvent?: (event: TVRemoteEvent) => void;
  focusId?: string;
  focusScope?: string;
  focusIndex?: number;
  restoreFocus?: boolean;
  nextFocusUp?: number;
  nextFocusDown?: number;
  nextFocusLeft?: number;
  nextFocusRight?: number;
};

type FocusTarget = View & {
  focus?: () => void;
};

export const TVFocusable = forwardRef<TVFocusableHandle, TVFocusableProps>(function TvFocusable(
  {
    children,
    disabled = false,
    focusable = true,
    hasTVPreferredFocus = false,
    style,
    focusStyle,
    onFocus,
    onBlur,
    onKeyDown,
    onTVEvent,
    focusId,
    focusScope,
    focusIndex,
    restoreFocus = false,
    ...rest
  },
  ref,
) {
  const [focused, setFocused] = useState(false);
  const pressableRef = useRef<View>(null);

  useImperativeHandle(ref, () => ({
    focus: () => {
      const target = pressableRef.current as FocusTarget | null;
      target?.focus?.();
    },
    getNodeHandle: () => findNodeHandle(pressableRef.current),
  }), []);

  const handleFocus = useCallback((event: Parameters<NonNullable<PressableProps["onFocus"]>>[0]) => {
    // Android handsets can assign accessibility focus to Pressables while a
    // screen is mounting.  This must not replace the visual treatment of
    // primary mobile actions with the TV focus ring.
    if (Platform.isTV) {
      setFocused(true);
      if (focusScope && focusId) rememberTvFocus(focusScope, focusId, focusIndex);
    }
    onFocus?.(event);
  }, [focusId, focusIndex, focusScope, onFocus]);

  const handleBlur = useCallback((event: Parameters<NonNullable<PressableProps["onBlur"]>>[0]) => {
    if (Platform.isTV) setFocused(false);
    onBlur?.(event);
  }, [onBlur]);

  const handleKeyDown = useCallback((event: TVKeyDownEvent) => {
    const remoteEvent = getTVRemoteEvent(event.nativeEvent.key, event.nativeEvent.code);
    if (remoteEvent) onTVEvent?.(remoteEvent);
    onKeyDown?.(event);
  }, [onKeyDown, onTVEvent]);

  const getStyle = useCallback((state: { pressed: boolean }) => {
    const baseStyle = typeof style === "function" ? style(state) : style;
    return [baseStyle, Platform.isTV && focused && styles.focused, Platform.isTV && focused && focusStyle];
  }, [focusStyle, focused, style]);

  const rememberedFocus = focusScope ? getRememberedTvFocus(focusScope) : undefined;
  const shouldRestoreFocus = restoreFocus && Boolean(focusId) && rememberedFocus?.itemId === focusId;

  const pressableProps = {
    ...rest,
    ref: pressableRef,
    collapsable: false,
    disabled,
    focusable: !disabled && focusable,
    hasTVPreferredFocus: hasTVPreferredFocus || shouldRestoreFocus,
    onFocus: handleFocus,
    onBlur: handleBlur,
    onKeyDown: handleKeyDown,
    style: getStyle,
  } as unknown as React.ComponentProps<typeof Pressable>;

  return (
    <Pressable {...pressableProps}>
      {children}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  focused: {
    borderWidth: 2,
    borderColor: Colors.blueBright,
    // Do not assign a background here. In React Native, "transparent" wins
    // over the background supplied by the control itself; that made white
    // actions reveal the dark screen behind them on Android TV. Keeping this
    // layer surface-neutral preserves each button's original visual state.
    opacity: 1,
    transform: [{ scale: 1.025 }],
    // Elevation is deliberately omitted. On Fire TV it can cast a dark
    // native shadow over light controls and looks like the button dimmed.
    elevation: 0,
  },
});

export type { TVFocusableProps };
