import { Tabs } from "expo-router";

import { DataOnlyTabBar } from "@/components/TabBar";

export default function TabLayout() {
  return (
    <Tabs
      tabBar={({ state }) => {
        const route = state.routes[state.index]?.name;
        const active =
          route === "explore"
            ? "explore"
            : route === "creators"
              ? "creators"
              : route === "saved"
                ? "saved"
                : "index";
        return <DataOnlyTabBar active={active} />;
      }}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Home" }} />
      <Tabs.Screen name="explore" options={{ title: "Explore" }} />
      <Tabs.Screen name="creators" options={{ title: "Creators" }} />
      <Tabs.Screen name="saved" options={{ title: "Saved" }} />
    </Tabs>
  );
}
