import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { Image } from "expo-image";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { Colors, Radii, Shadows, Type } from "@/constants/theme";
import { TVFocusable } from "@/components/tv-focusable";

export function AppText({ style, children, ...props }: React.ComponentProps<typeof Text>) {
  return (
    <Text selectable style={[Type.body, style]} {...props}>
      {children}
    </Text>
  );
}

export function GlassCard({
  children,
  style,
  intensity = 24,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  intensity?: number;
}) {
  return (
    <View style={[styles.glassShell, Shadows.card, style]}>
      {/* pointerEvents="none" prevents the BlurView from intercepting taps that
          should reach interactive children (Pressable, TVFocusable, etc.). */}
      <BlurView intensity={intensity} tint="dark" style={StyleSheet.absoluteFill} pointerEvents="none" />
      <View style={styles.glassContent}>{children}</View>
    </View>
  );
}

export function IconButton({
  icon,
  onPress,
  label,
  size = 42,
  active = false,
  hasTVPreferredFocus = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  label: string;
  size?: number;
  active?: boolean;
  hasTVPreferredFocus?: boolean;
}) {
  return (
    <TVFocusable
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={onPress}
      hasTVPreferredFocus={hasTVPreferredFocus}
      style={({ pressed }) => [
        styles.iconButton,
        { width: size, height: size, borderRadius: size / 2 },
        active && styles.iconButtonActive,
        pressed && styles.pressed,
      ]}
    >
      <Ionicons name={icon} size={size * 0.48} color={active ? Colors.blueBright : Colors.text} />
    </TVFocusable>
  );
}

export function SectionHeader({
  title,
  subtitle,
  onPress,
}: {
  title: string;
  subtitle?: string;
  onPress?: () => void;
}) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionHeaderCopy}>
        <AppText style={Type.section}>{title}</AppText>
        {subtitle ? <AppText style={styles.sectionSubtitle}>{subtitle}</AppText> : null}
      </View>
      {onPress ? (
        <TVFocusable accessibilityRole="button" accessibilityLabel={`Ver todos: ${title}`} onPress={onPress} style={styles.seeAllButton}>
          <AppText style={styles.seeAllText}>Ver todos</AppText>
          <Ionicons name="chevron-forward" size={15} color={Colors.blueBright} />
        </TVFocusable>
      ) : null}
    </View>
  );
}

export function Chip({
  label,
  selected,
  onPress,
  hasTVPreferredFocus = false,
  icon,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  hasTVPreferredFocus?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <TVFocusable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      hasTVPreferredFocus={hasTVPreferredFocus}
      style={({ pressed }) => [styles.chip, selected && styles.chipSelected, pressed && styles.pressed]}
    >
      {icon ? (
        <Ionicons
          name={icon}
          size={12}
          color={selected ? Colors.text : Colors.subtle}
          style={{ marginRight: 2 }}
        />
      ) : null}
      <AppText style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</AppText>
    </TVFocusable>
  );
}

/**
 * SearchField — fully decoupled from parent re-renders.
 *
 * Uses an UNCONTROLLED TextInput (no `value` prop) so React never pushes
 * state back into the native text field — the root cause of focus loss /
 * keyboard dismissal after each keystroke on Android and React-Native-Web.
 *
 * Text is tracked via a ref (zero extra renders) and propagated to the
 * parent via a debounced callback (280 ms).  The only React state kept here
 * is `hasText` (boolean), which drives the clear-button visibility.
 *
 * External clear (parent sets value="") is handled imperatively via
 * `inputRef.current.clear()` so the native field never re-mounts.
 */
export const SearchField = React.memo(function SearchField({
  value,
  onChangeText,
  placeholder = "Buscar no FlixPlay",
}: {
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
}) {
  const inputRef = useRef<TextInput>(null);
  const textRef = useRef(value);            // current text — no renders
  const [hasText, setHasText] = useState(value.length > 0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onChangeTextRef = useRef(onChangeText);

  useEffect(() => {
    onChangeTextRef.current = onChangeText;
  }, [onChangeText]);

  // When the parent clears the field externally (value → ""), imperatively
  // clear the native TextInput so the display matches without remounting.
  useEffect(() => {
    if (value === "" && textRef.current !== "") {
      textRef.current = "";
      setHasText(false);
      inputRef.current?.clear();
    }
  }, [value]);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const handleChange = useCallback((text: string) => {
    textRef.current = text;
    setHasText(text.length > 0); // cheap boolean — no focus impact
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onChangeTextRef.current(text);
    }, 280);
  }, []);

  const handleClear = useCallback(() => {
    textRef.current = "";
    setHasText(false);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    onChangeTextRef.current("");
    // Imperatively clear and keep keyboard open
    inputRef.current?.clear();
    inputRef.current?.focus();
  }, []);

  return (
    <View style={styles.searchField}>
      <Ionicons name="search" size={18} color={Colors.muted} />
      <TextInput
        ref={inputRef}
        accessibilityLabel={placeholder}
        placeholder={placeholder}
        defaultValue={value}
        onChangeText={handleChange}
        style={styles.searchInput}
        placeholderTextColor={Colors.subtle}
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
      />
      {hasText ? (
        <TVFocusable accessibilityLabel="Limpar busca" onPress={handleClear} hitSlop={8} style={styles.searchClearButton}>
          <Ionicons name="close-circle" size={17} color={Colors.muted} />
        </TVFocusable>
      ) : null}
    </View>
  );
});

export function PosterCard({
  title,
  image,
  meta,
  rating,
  quality,
  width = 142,
  onPress,
  progress,
  hasTVPreferredFocus = false,
}: {
  title: string;
  image: string;
  meta: string;
  rating?: number;
  quality?: string;
  width?: number;
  onPress: () => void;
  progress?: number;
  hasTVPreferredFocus?: boolean;
}) {
  return (
    <TVFocusable accessibilityRole="button" accessibilityLabel={`Abrir ${title}`} hasTVPreferredFocus={hasTVPreferredFocus} onPress={onPress} style={({ pressed }) => [styles.posterCard, { width }, pressed && styles.cardPressed]}>
      <View style={[styles.posterFrame, { height: width * 1.42 }]}>
        <Image source={{ uri: image }} contentFit="cover" transition={220} style={StyleSheet.absoluteFill} />
        <View style={styles.posterShade} />
        {quality ? (
          <View style={styles.qualityBadge}>
            <AppText style={styles.qualityText}>{quality}</AppText>
          </View>
        ) : null}
        {rating ? (
          <View style={styles.ratingBadge}>
            <Ionicons name="star" size={11} color={Colors.amber} />
            <AppText style={styles.ratingText}>{rating.toFixed(1)}</AppText>
          </View>
        ) : null}
        {progress !== undefined ? (
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress}%` }]} />
          </View>
        ) : null}
      </View>
      <AppText numberOfLines={1} style={styles.posterTitle}>{title}</AppText>
      <AppText numberOfLines={1} style={styles.posterMeta}>{meta}</AppText>
    </TVFocusable>
  );
}

export function ChannelLogo({ image, name, size = 58 }: { image: string; name: string; size?: number }) {
  return (
    <View style={[styles.channelLogo, { width: size, height: size, borderRadius: size / 2 }]}>
      <Image source={{ uri: image }} contentFit="cover" style={styles.logoImage} />
      <View style={styles.logoOverlay} />
      <AppText style={[styles.logoLetter, { fontSize: size * 0.2 }]}>{name.slice(0, 3).toUpperCase()}</AppText>
    </View>
  );
}

export function LoadingState({ label = "Carregando sua programação..." }: { label?: string }) {
  return (
    <View style={styles.stateContainer}>
      <ActivityIndicator size="large" color={Colors.blueBright} />
      <AppText style={styles.stateLabel}>{label}</AppText>
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <View style={styles.stateContainer}>
      <View style={styles.errorIcon}>
        <Ionicons name="cloud-offline-outline" size={24} color={Colors.red} />
      </View>
      <AppText style={styles.errorTitle}>Não foi possível carregar</AppText>
      <AppText style={styles.errorMessage}>{message}</AppText>
      <TVFocusable accessibilityRole="button" onPress={onRetry} style={styles.retryButton}>
        <Ionicons name="refresh" size={16} color={Colors.white} />
        <AppText style={styles.retryText}>Tentar novamente</AppText>
      </TVFocusable>
    </View>
  );
}

export function ScreenState({
  loading,
  error,
  retry,
  children,
}: {
  loading: boolean;
  error: string | null;
  retry: () => void;
  children: React.ReactNode;
}) {
  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={retry} />;
  return <>{children}</>;
}

export function HorizontalScroller({ children }: { children: React.ReactNode }) {
  const items = React.Children.toArray(children);
  return (
    <FlatList
      horizontal
      data={items}
      renderItem={({ item }) => <>{item}</>}
      keyExtractor={(item, index) => React.isValidElement(item) && item.key != null ? String(item.key) : String(index)}
      showsHorizontalScrollIndicator={false}
      style={styles.horizontalScroller}
      contentContainerStyle={styles.horizontalContent}
      initialNumToRender={7}
      maxToRenderPerBatch={7}
      windowSize={5}
      removeClippedSubviews={Platform.OS === "android"}
    />
  );
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <View style={styles.emptyState}>
      <Ionicons name="film-outline" size={28} color={Colors.subtle} />
      <AppText style={styles.emptyTitle}>{title}</AppText>
      <AppText style={styles.emptyBody}>{body}</AppText>
    </View>
  );
}

export const styles = StyleSheet.create({
  glassShell: {
    overflow: "hidden",
    borderRadius: Radii.medium,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.glass,
  },
  glassContent: {
    flex: 1,
  },
  iconButton: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: "rgba(255, 255, 255, 0.09)",
  },
  iconButtonActive: {
    backgroundColor: "rgba(59, 130, 246, 0.2)",
    borderColor: "rgba(96, 165, 250, 0.55)",
  },
  pressed: {
    opacity: 0.72,
    transform: [{ scale: 0.97 }],
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    marginBottom: 12,
  },
  sectionHeaderCopy: {
    flex: 1,
    gap: 2,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: Colors.subtle,
  },
  seeAllButton: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 4,
  },
  seeAllText: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: Colors.blueBright,
  },
  chip: {
    minHeight: 38,
    justifyContent: "center",
    paddingHorizontal: 15,
    borderRadius: Radii.pill,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.glassSoft,
  },
  chipSelected: {
    borderColor: Colors.blue,
    backgroundColor: Colors.blue,
  },
  chipText: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: Colors.muted,
  },
  chipTextSelected: {
    color: Colors.white,
  },
  searchField: {
    height: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 15,
    borderRadius: Radii.medium,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.glassSoft,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 0,
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: Colors.text,
  },
  searchClearButton: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
  },
  posterCard: {
    gap: 7,
  },
  cardPressed: {
    opacity: 0.76,
    transform: [{ scale: 0.985 }],
  },
  posterFrame: {
    overflow: "hidden",
    borderRadius: Radii.medium,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.backgroundRaised,
  },
  posterShade: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0, 0, 0, 0.12)",
  },
  qualityBadge: {
    position: "absolute",
    top: 9,
    left: 9,
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: "rgba(7, 9, 14, 0.76)",
  },
  qualityText: {
    fontFamily: "Inter_700Bold",
    fontSize: 9,
    color: Colors.white,
  },
  ratingBadge: {
    position: "absolute",
    right: 8,
    bottom: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 7,
    backgroundColor: "rgba(7, 9, 14, 0.8)",
  },
  ratingText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 10,
    color: Colors.text,
  },
  progressTrack: {
    position: "absolute",
    right: 10,
    bottom: 9,
    left: 10,
    height: 3,
    overflow: "hidden",
    borderRadius: 2,
    backgroundColor: "rgba(255, 255, 255, 0.28)",
  },
  progressFill: {
    height: "100%",
    borderRadius: 2,
    backgroundColor: Colors.blueBright,
  },
  posterTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    color: Colors.text,
  },
  posterMeta: {
    fontSize: 11,
    color: Colors.subtle,
  },
  channelLogo: {
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.24)",
    backgroundColor: Colors.glassStrong,
  },
  logoImage: {
    ...StyleSheet.absoluteFill,
    opacity: 0.58,
  },
  logoOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(7, 9, 14, 0.42)",
  },
  logoLetter: {
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.4,
    color: Colors.white,
  },
  stateContainer: {
    flex: 1,
    minHeight: 320,
    alignItems: "center",
    justifyContent: "center",
    padding: 28,
    gap: 12,
  },
  stateLabel: {
    fontSize: 13,
    color: Colors.muted,
  },
  errorIcon: {
    width: 54,
    height: 54,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 27,
    backgroundColor: "rgba(229, 9, 20, 0.13)",
  },
  errorTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 17,
    color: Colors.text,
  },
  errorMessage: {
    maxWidth: 280,
    textAlign: "center",
    fontSize: 13,
    color: Colors.muted,
  },
  retryButton: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    borderRadius: Radii.pill,
    backgroundColor: Colors.blue,
  },
  retryText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    color: Colors.white,
  },
  horizontalScroller: {
    flexGrow: 0,
    marginHorizontal: -20,
  },
  horizontalContent: {
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 9,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 220,
    padding: 24,
    gap: 8,
    borderRadius: Radii.medium,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.glassSoft,
  },
  emptyTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    color: Colors.text,
  },
  emptyBody: {
    maxWidth: 290,
    textAlign: "center",
    fontSize: 13,
    color: Colors.muted,
  },
});

export type ButtonPressProps = PressableProps;
