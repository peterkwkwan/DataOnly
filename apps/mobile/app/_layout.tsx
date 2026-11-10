import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { StatusBar } from "expo-status-bar";
import "react-native-reanimated";

import { SavedProvider } from "@/context/SavedContext";
import { colors } from "@/lib/theme";

export { ErrorBoundary } from "expo-router";

export const unstable_settings = {
  anchor: "(tabs)",
};

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <SavedProvider>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerTintColor: colors.ink,
          contentStyle: { backgroundColor: colors.canvas },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="search"
          options={{ presentation: "modal", headerShown: false, animation: "slide_from_bottom" }}
        />
        <Stack.Screen name="datacuts/[slug]" options={{ title: "Datacut", headerBackTitle: "Back" }} />
        <Stack.Screen name="creators/[slug]" options={{ title: "Creator", headerBackTitle: "Back" }} />
        <Stack.Screen name="explore/[slug]" options={{ title: "Explore", headerBackTitle: "Back" }} />
        <Stack.Screen name="+not-found" />
      </Stack>
    </SavedProvider>
  );
}
