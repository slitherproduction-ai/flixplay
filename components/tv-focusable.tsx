import type React from "react";
import { forwardRef, useCallback, useImperativeHandle, useRef, useState } from "react";
import { findNodeHandle, Pressable, StyleSheet, type PressableProps, type StyleProp, type View, type ViewStyle } from "react-native";
import { Colors, Shadows } from "@/constants/theme";
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
    setFocused(true);
    if (focusScope && focusId) rememberTvFocus(focusScope, focusId, focusIndex);
    onFocus?.(event);
  }, [focusId, focusIndex, focusScope, onFocus]);

  const handleBlur = useCallback((event: Parameters<NonNullable<PressableProps["onBlur"]>>[0]) => {
    setFocused(false);
    onBlur?.(event);
  }, [onBlur]);

  const handleKeyDown = useCallback((event: TVKeyDownEvent) => {
    const remoteEvent = getTVRemoteEvent(event.nativeEvent.key, event.nativeEvent.code);
    if (remoteEvent) onTVEvent?.(remoteEvent);
    onKeyDown?.(event);
  }, [onKeyDown, onTVEvent]);

  const getStyle = useCallback((state: { pressed: boolean }) => {
    const baseStyle = typeof style === "function" ? style(state) : style;
    return [baseStyle, focused && styles.focused, focused && focusStyle];
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
    backgroundColor: "rgba(59,130,246,0.18)",
    transform: [{ scale: 1.05 }],
    ...Shadows.card,
  },
});

export type { TVFocusableProps };
