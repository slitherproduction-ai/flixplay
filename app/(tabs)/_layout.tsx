import { Tabs, useRouter } from "expo-router";
import { useState } from "react";
import { ListProblemDialog } from "@/components/list-problem-dialog";
import { listProblemFromMessage } from "@/features/login/listProblem";
import { useAppStore } from "@/store/useAppStore";
import { tr, useAppLanguage } from "@/core/i18n";
import { AppIcon } from "@/components/app-icon";
import type React from "react";
import { Platform, StyleSheet, View, type GestureResponderEvent, type StyleProp, type ViewStyle } from "react-native";
import { TVFocusable } from "@/components/tv-focusable";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors } from "@/constants/theme";
import { useXtreamSync } from "@/hooks/useXtreamSync";
import { useTVMode } from "@/hooks/use-tv-mode";

// ---------------------------------------------------------------------------
// Tab bar button
// ---------------------------------------------------------------------------
// On actual TV devices, wrap each tab button in TVFocusable so the focus ring
// and D-pad navigation work correctly.
// On smartphones and web, leave tabBarButton undefined so React Navigation uses
// its own default Pressable-based button which has proper touch handling.
// Using TVFocusable on phones previously caused tab taps to be dropped.

type TabButtonProps = {
  accessibilityLabel?: string;
  accessibilityRole?: string;
  accessibilityState?: { selected?: boolean };
  children?: React.ReactNode;
  disabled?: boolean | null;
  onLongPress?: ((e: GestureResponderEvent) => void) | null;
  onPress?: ((e: GestureResponderEvent) => void) | null;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

function TvTabButton({
  accessibilityLabel,
  accessibilityRole,
  accessibilityState,
  children,
  disabled,
  onLongPress,
  onPress,
  style,
  testID,
}: TabButtonProps) {
  return (
    <TVFocusable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={accessibilityRole as "button"}
      accessibilityState={accessibilityState}
      disabled={disabled ?? false}
      hasTVPreferredFocus={accessibilityState?.selected === true}
      onLongPress={onLongPress}
      onPress={onPress}
      style={style}
      testID={testID}
    >
      {children}
    </TVFocusable>
  );
}

const tabBarButton: ((props: TabButtonProps) => React.ReactNode) | undefined = Platform.isTV
  ? (props: TabButtonProps) => <TvTabButton {...props} />
  : undefined;

export default function TabsLayout() {
  useAppLanguage();
  const insets = useSafeAreaInsets();
  const tvMode = useTVMode();
  // Trigger real server sync as soon as tabs are mounted
  useXtreamSync();

  const navigator = (
    <Tabs
      screenOptions={{
        headerShown: false,
        // Keeps inactive TV surfaces out of the render pipeline while their
        // route state is retained for fast D-pad navigation.
        freezeOnBlur: tvMode,
        tabBarButton: tvMode ? undefined : tabBarButton,
        sceneStyle: {
          backgroundColor: Colors.background,
        },
        // Aba ativa: fundo elevado, ícone ciano preenchido e texto claro
        // (mesmo padrão da TV); inativas em contorno.
        tabBarActiveTintColor: Colors.text,
        tabBarInactiveTintColor: "#9AA6BD",
        tabBarActiveBackgroundColor: "#1A2438",
        tabBarItemStyle: {
          marginHorizontal: 3,
          marginVertical: 6,
          borderRadius: 14,
        },
        tabBarLabelStyle: {
          fontFamily: "Inter_600SemiBold",
          fontSize: 10,
          letterSpacing: 0.1,
          marginBottom: 2,
        },
        // Fundo sólido: o desfoque da barra era refeito a cada quadro de
        // rolagem e pesava em celulares de entrada.
        tabBarBackground: () => <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: "#0A101C" }]} />,
        tabBarStyle: {
          display: tvMode ? "none" : "flex",
          height: 64 + insets.bottom,
          paddingTop: 5,
          paddingBottom: Math.max(insets.bottom, 8),
          borderTopWidth: 1,
          borderTopColor: "#141F33",
          backgroundColor: "#0A101C",
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: tr("Início"),
          tabBarIcon: ({ color, size, focused }) => <AppIcon name="home" color={focused ? Colors.blueBright : color} size={size - 2} />,
        }}
      />
      <Tabs.Screen
        name="live"
        options={{
          title: tr("TV ao Vivo"),
          // Sem congelar: na TV a seção é descarregada ao voltar à Início
          // (withTvTabEviction), o que um congelamento impediria.
          freezeOnBlur: false,
          tabBarIcon: ({ color, size, focused }) => <AppIcon name="live" color={focused ? Colors.blueBright : color} size={size - 2} />,
        }}
      />
      <Tabs.Screen
        name="movies"
        options={{
          title: tr("Filmes"),
          // Sem congelar: na TV a seção é descarregada ao voltar à Início
          // (withTvTabEviction), o que um congelamento impediria.
          freezeOnBlur: false,
          tabBarIcon: ({ color, size, focused }) => <AppIcon name="film" color={focused ? Colors.blueBright : color} size={size - 2} />,
        }}
      />
      <Tabs.Screen
        name="series"
        options={{
          title: tr("Séries"),
          // Sem congelar: na TV a seção é descarregada ao voltar à Início
          // (withTvTabEviction), o que um congelamento impediria.
          freezeOnBlur: false,
          tabBarIcon: ({ color, size, focused }) => <AppIcon name="series" color={focused ? Colors.blueBright : color} size={size - 2} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: tr("Ajustes"),
          tabBarIcon: ({ color, size, focused }) => <AppIcon name="settings" color={focused ? Colors.blueBright : color} size={size - 2} />,
        }}
      />
    </Tabs>
  );

  // Como no Roku, na LG e no Samsung, a navegação da TV parte da Início:
  // seus blocos levam às seções e Voltar retorna a ela (backBehavior padrão
  // do Tabs: firstRoute). Sem menu lateral.
  return (
    <>
      {navigator}
      <ActiveListProblem />
    </>
  );
}

/**
 * A lista em uso não abriu (nenhuma categoria carregada e a sincronização
 * terminou com erro): janela com o motivo e o que fazer, como no login.
 */
function ActiveListProblem() {
  const router = useRouter();
  const syncError = useAppStore((state) => state.syncState.syncError);
  const isSyncing = useAppStore((state) => state.syncState.isSyncing);
  const empty = useAppStore((state) => !state.contentCache.liveCategories.length && !state.contentCache.vodCategories.length && !state.contentCache.seriesCategories.length);
  const forceResync = useAppStore((state) => state.forceResync);
  const [dismissed, setDismissed] = useState<string | null>(null);
  const show = Boolean(syncError) && !isSyncing && empty && dismissed !== syncError;
  return (
    <ListProblemDialog
      problem={show ? listProblemFromMessage(syncError) : null}
      onClose={() => setDismissed(syncError)}
      onRetry={forceResync}
      onOtherList={() => router.replace("/login")}
    />
  );
}

