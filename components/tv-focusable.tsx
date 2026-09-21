import type React from "react";
import { forwardRef, useCallback, useImperativeHandle, useRef, useState } from "react";
import { Pressable, StyleSheet, type PressableProps, type StyleProp, type View, type ViewStyle } from "react-native";
import { Colors, Shadows } from "@/constants/theme";
import { getTVRemoteEvent, type TVKeyDownEvent, type TVRemoteEvent } from "@/hooks/use-tv-remote";

export type TVFocusableHandle = {
  focus: () => void;
};

type TVFocusableProps = Omit<PressableProps, "style" | "onFocus" | "onBlur" | "onKeyDown"> & {
  style?: PressableProps["style"];
  focusStyle?: StyleProp<ViewStyle>;
  onFocus?: PressableProps["onFocus"];
  onBlur?: PressableProps["onBlur"];
  onKeyDown?: (event: TVKeyDownEvent) => void;
  onTVEvent?: (event: TVRemoteEvent) => void;
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
  }), []);

  const handleFocus = useCallback((event: Parameters<NonNullable<PressableProps["onFocus"]>>[0]) => {
    setFocused(true);
    onFocus?.(event);
  }, [onFocus]);

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

  const pressableProps = {
    ...rest,
    ref: pressableRef,
    disabled,
    focusable: !disabled && focusable,
    hasTVPreferredFocus,
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
    borderWidth: 1,
    borderColor: Colors.blueBright,
    backgroundColor: "rgba(59,130,246,0.18)",
    transform: [{ scale: 1.04 }],
    ...Shadows.card,
  },
});

export type { TVFocusableProps };
