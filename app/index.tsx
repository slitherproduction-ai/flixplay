import { Redirect } from "expo-router";
import { View } from "react-native";

export default function Index() {
  return <View testID="placeholder-screen"><Redirect href="/(tabs)" /></View>;
}
