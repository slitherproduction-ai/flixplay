import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Platform,
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

/**
 * Screens expose their visual root here so GlassCard can opt into Android's
 * native blur without every call site having to thread a ref through props.
 * A local prop still wins for cases such as the login poster backdrop.
 */
const GlassBlurTargetContext = React.createContext<React.RefObject<View | null> | undefined>(undefined);

export function GlassBlurTargetProvider({
  blurTarget,
  children,
}: {
  blurTarget: React.RefObject<View | null>;
  children: React.ReactNode;
}) {
  return <GlassBlurTargetContext.Provider value={blurTarget}>{children}</GlassBlurTargetContext.Provider>;
}

export function AppText({ style, children, selectable = !Platform.isTV, ...props }: React.ComponentProps<typeof Text>) {
  return (
    <Text selectable={selectable} style={[Type.body, style]} {...props}>
      {children}
    </Text>
  );
}

export function GlassCard({
  children,
  style,
  intensity = 60,
  blurTarget,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  intensity?: number;
  /** Visual layer behind this card. Required for native Android blur. */
  blurTarget?: React.RefObject<View | null>;
}) {
  const inheritedBlurTarget = React.useContext(GlassBlurTargetContext);
  const resolvedBlurTarget = blurTarget ?? inheritedBlurTarget;
  return (
    <View style={[styles.glassShell, Shadows.card, style]}>
      {/* pointerEvents="none" prevents the BlurView from intercepting taps that
          should reach interactive children (Pressable, TVFocusable, etc.). */}
      <BlurView
        blurTarget={resolvedBlurTarget}
        intensity={Math.max(68, intensity)}
        tint="dark"
        // Expo's Android implementation deliberately falls back to "none"
        // without a target. Do not request the native method until a screen
        // provides the visual layer to sample.
        blurMethod={Platform.OS === "android" && resolvedBlurTarget ? "dimezisBlurViewSdk31Plus" : undefined}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
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
      focusStyle={styles.iconButtonFocused}
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
  // Cabeçalho de fileira no estilo dos serviços de streaming: título forte,
  // contexto discreto e "Ver todos" como pílula de toque/foco.
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionHeaderCopy}>
        <AppText numberOfLines={1} style={[Type.section, styles.sectionTitle]}>{title}</AppText>
        {subtitle ? <AppText numberOfLines={1} style={styles.sectionSubtitle}>{subtitle}</AppText> : null}
      </View>
      {onPress ? (
        <TVFocusable
          accessibilityRole="button"
          accessibilityLabel={`Ver todos: ${title}`}
          onPress={onPress}
          focusStyle={styles.seeAllFocused}
          style={({ pressed }) => [styles.seeAllButton, pressed && styles.pressed]}
        >
          <AppText style={styles.seeAllText}>Ver todos</AppText>
          <Ionicons name="chevron-forward" size={13} color={Colors.blueBright} />
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
  selectedTone = "blue",
  compact = false,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  hasTVPreferredFocus?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  selectedTone?: "blue" | "light";
  /** Compact density for TV guide filters. */
  compact?: boolean;
}) {
  return (
    <TVFocusable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      hasTVPreferredFocus={hasTVPreferredFocus}
      // White selected filters use dark copy. Keep that surface white while
      // focused instead of letting TVFocusable's default blue overlay muddy
      // the active state.
      focusStyle={selected && selectedTone === "light" ? styles.chipSelectedLightFocused : undefined}
      style={({ pressed }) => [styles.chip, compact && styles.chipCompact, selected && (selectedTone === "light" ? styles.chipSelectedLight : styles.chipSelected), pressed && styles.pressed]}
    >
      {icon ? (
        <Ionicons
          name={icon}
          size={12}
          color={selected ? Colors.background : Colors.subtle}
          style={{ marginRight: 2 }}
        />
      ) : null}
      <AppText style={[styles.chipText, compact && styles.chipTextCompact, selected && (selectedTone === "light" ? styles.chipTextSelectedLight : styles.chipTextSelected)]}>{label}</AppText>
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
  placeholder = "Buscar no ELVANOQ",
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
  focusId,
  focusScope,
  focusIndex,
  restoreFocus = false,
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
  focusId?: string;
  focusScope?: string;
  focusIndex?: number;
  restoreFocus?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  const [failed, setFailed] = useState(false);
  const hasImage = Boolean(image) && !failed;
  return (
    <TVFocusable
      accessibilityRole="button"
      accessibilityLabel={`Abrir ${title}`}
      hasTVPreferredFocus={hasTVPreferredFocus}
      focusId={focusId}
      focusScope={focusScope}
      focusIndex={focusIndex}
      restoreFocus={restoreFocus}
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      // O destaque do foco fica só no pôster (como na Apple TV e no Prime),
      // não num retângulo em volta do pôster e do texto.
      focusStyle={styles.posterFocusReset}
      style={({ pressed }) => [styles.posterCard, { width }, pressed && styles.cardPressed]}
    >
      <View style={[styles.posterFrame, { height: Math.round(width * 1.42) }, focused && styles.posterFrameFocused]}>
        {/* Arte provisória: título sobre gradiente enquanto a imagem carrega
            ou quando o servidor não envia pôster — nunca um bloco cinza. */}
        <LinearGradient colors={["#1B2A45", "#0D1422"]} style={StyleSheet.absoluteFill} />
        <View style={styles.posterPlaceholder}>
          <AppText numberOfLines={4} style={styles.posterPlaceholderText}>{title}</AppText>
        </View>
        {hasImage ? (
          <Image
            source={{ uri: image }}
            contentFit="cover"
            transition={240}
            recyclingKey={image}
            onError={() => setFailed(true)}
            style={StyleSheet.absoluteFill}
          />
        ) : null}
        <LinearGradient
          pointerEvents="none"
          colors={["rgba(7,11,20,0)", "rgba(7,11,20,0.62)"]}
          locations={[0.62, 1]}
          style={StyleSheet.absoluteFill}
        />
        {quality ? (
          <View style={styles.qualityBadge}>
            <AppText style={styles.qualityText}>{quality}</AppText>
          </View>
        ) : null}
        {rating ? (
          <View style={styles.ratingBadge}>
            <Ionicons name="star" size={9} color={Colors.amber} />
            <AppText style={styles.ratingText}>{rating.toFixed(1)}</AppText>
          </View>
        ) : null}
        {progress !== undefined ? (
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress}%` }]} />
          </View>
        ) : null}
      </View>
      <AppText numberOfLines={1} style={[styles.posterTitle, focused && styles.posterTitleFocused]}>{title}</AppText>
      <AppText numberOfLines={1} style={styles.posterMeta}>{meta}</AppText>
    </TVFocusable>
  );
}

export function ChannelLogo({ image, name, size = 58 }: { image: string; name: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(image) && !failed;
  // O logotipo aparece inteiro e nítido; as iniciais só entram quando o canal
  // não tem imagem (antes ficavam sobrepostas a um logo esmaecido).
  return (
    <View style={[styles.channelLogo, { width: size, height: size, borderRadius: size / 2 }]}>
      <LinearGradient colors={["#1C2A44", "#0B1220"]} style={StyleSheet.absoluteFill} />
      {showImage ? (
        <Image
          source={{ uri: image }}
          contentFit="contain"
          recyclingKey={image}
          onError={() => setFailed(true)}
          style={{ width: size * 0.7, height: size * 0.7 }}
        />
      ) : (
        <AppText style={[styles.logoLetter, { fontSize: Math.max(10, size * 0.26) }]}>
          {name.replace(/[^\p{L}\p{N} ]/gu, "").trim().split(/\s+/).slice(0, 2).map((part) => part.charAt(0)).join("").toUpperCase() || "TV"}
        </AppText>
      )}
    </View>
  );
}

/** Pulso suave para esqueletos de carregamento (driver nativo). */
function usePulse() {
  const value = useRef(new Animated.Value(0.45)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(value, { toValue: 0.9, duration: 700, useNativeDriver: true }),
      Animated.timing(value, { toValue: 0.45, duration: 700, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [value]);
  return value;
}

/** Fileira de pôsteres-esqueleto, como os serviços de streaming exibem ao carregar. */
export function SkeletonPosterRow({ count = 5, width = 120 }: { count?: number; width?: number }) {
  const opacity = usePulse();
  return (
    <View style={styles.skeletonRow} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {Array.from({ length: count }, (_, index) => (
        <Animated.View key={index} style={[styles.skeletonPoster, { width, height: Math.round(width * 1.42), opacity }]} />
      ))}
    </View>
  );
}

export function LoadingState({ label = "Carregando sua programação..." }: { label?: string }) {
  return (
    <View style={styles.stateContainer} accessibilityLiveRegion="polite">
      <SkeletonPosterRow count={4} width={96} />
      <View style={styles.stateLabelRow}>
        <ActivityIndicator size="small" color={Colors.blueBright} />
        <AppText style={styles.stateLabel}>{label}</AppText>
      </View>
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <View style={styles.stateContainer}>
      <LinearGradient colors={["rgba(255,92,114,0.24)", "rgba(255,92,114,0.06)"]} style={styles.errorIcon}>
        <Ionicons name="cloud-offline-outline" size={24} color={Colors.red} />
      </LinearGradient>
      <AppText style={styles.errorTitle}>Não foi possível carregar</AppText>
      <AppText style={styles.errorMessage}>{message}</AppText>
      <TVFocusable accessibilityRole="button" onPress={onRetry} focusStyle={styles.retryFocused} style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}>
        <Ionicons name="refresh" size={16} color={Colors.background} />
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
      <LinearGradient colors={["rgba(0,215,255,0.16)", "rgba(20,125,255,0.04)"]} style={styles.emptyIcon}>
        <Ionicons name="film-outline" size={24} color={Colors.blueBright} />
      </LinearGradient>
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
    borderColor: "rgba(244,248,255,0.16)",
    backgroundColor: "rgba(7,11,20,0.5)",
  },
  iconButtonFocused: {
    borderWidth: 2,
    borderColor: Colors.blueBright,
    backgroundColor: "rgba(255,255,255,0.18)",
    transform: [{ scale: 1.08 }],
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
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 16,
    marginBottom: 10,
  },
  sectionTitle: { letterSpacing: -0.35 },
  sectionHeaderCopy: {
    flex: 1,
    gap: 2,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: Colors.muted,
  },
  seeAllButton: {
    minHeight: 32,
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    paddingLeft: 11,
    paddingRight: 8,
    marginBottom: 2,
    borderRadius: Radii.pill,
    borderWidth: 1,
    borderColor: "rgba(0,215,255,0.22)",
    backgroundColor: "rgba(0,215,255,0.06)",
  },
  seeAllFocused: {
    borderWidth: 2,
    borderColor: Colors.blueBright,
    backgroundColor: "rgba(0,215,255,0.18)",
    transform: [{ scale: 1.05 }],
  },
  seeAllText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
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
  chipCompact: {
    minHeight: 32,
    paddingHorizontal: 12,
  },
  chipSelected: {
    // Category filters are navigation controls, not a destructive/primary
    // confirmation. A saturated blue state remains legible on TV and avoids
    // the glaring white pill visible from across the room.
    borderColor: "rgba(111,207,255,0.96)",
    backgroundColor: Colors.white,
  },
  chipSelectedLight: {
    borderColor: "rgba(255,255,255,0.96)",
    backgroundColor: Colors.white,
  },
  chipSelectedLightFocused: {
    backgroundColor: Colors.white,
    borderWidth: 2,
    borderColor: Colors.blueBright,
    opacity: 1,
    transform: [{ scale: 1.025 }],
  },
  chipText: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: Colors.muted,
  },
  chipTextCompact: { fontSize: 11 },
  chipTextSelected: {
    color: Colors.background,
  },
  chipTextSelectedLight: {
    color: Colors.background,
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
    gap: 4,
    borderWidth: 0,
  },
  posterFocusReset: {
    // Neutraliza a moldura padrão do TVFocusable; o foco é desenhado no pôster.
    borderWidth: 0,
    transform: [{ scale: 1 }],
  },
  posterFrameFocused: {
    borderWidth: 2,
    borderColor: Colors.blueBright,
    transform: [{ scale: 1.06 }],
    shadowColor: "#000",
    shadowOpacity: 0.55,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
  },
  posterPlaceholder: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingBottom: 18,
  },
  posterPlaceholderText: {
    textAlign: "center",
    fontFamily: "Inter_700Bold",
    fontSize: 13,
    lineHeight: 16,
    letterSpacing: -0.2,
    color: "rgba(244,248,255,0.82)",
  },
  cardPressed: {
    opacity: 0.76,
    transform: [{ scale: 0.985 }],
  },
  posterFrame: {
    overflow: "hidden",
    marginBottom: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(190,222,255,0.10)",
    backgroundColor: Colors.backgroundRaised,
  },
  qualityBadge: {
    position: "absolute",
    top: 7,
    left: 7,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "rgba(244,248,255,0.35)",
    backgroundColor: "rgba(7,11,20,0.72)",
  },
  qualityText: {
    fontFamily: "Inter_700Bold",
    fontSize: 8,
    letterSpacing: 0.4,
    color: Colors.white,
  },
  ratingBadge: {
    position: "absolute",
    right: 7,
    bottom: 7,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: "rgba(7,11,20,0.78)",
  },
  ratingText: {
    fontFamily: "Inter_700Bold",
    fontSize: 9,
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
    paddingHorizontal: 2,
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    color: "#D6DEEB",
  },
  posterTitleFocused: { color: Colors.white },
  posterMeta: {
    paddingHorizontal: 2,
    fontSize: 10,
    color: Colors.subtle,
  },
  channelLogo: {
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(190,222,255,0.18)",
    backgroundColor: Colors.backgroundRaised,
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
  stateLabelRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 },
  skeletonRow: { flexDirection: "row", gap: 12 },
  skeletonPoster: { borderRadius: 12, backgroundColor: "rgba(136,148,168,0.16)" },
  emptyIcon: { width: 54, height: 54, alignItems: "center", justifyContent: "center", borderRadius: 27, marginBottom: 4 },
  retryFocused: { borderWidth: 2, borderColor: Colors.blueBright, transform: [{ scale: 1.05 }] },
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
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.82)",
    backgroundColor: Colors.white,
  },
  retryText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    color: Colors.background,
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
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(190,222,255,0.10)",
    backgroundColor: "rgba(13,20,34,0.6)",
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
