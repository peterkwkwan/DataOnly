import { Link, Stack } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { colors } from "@/lib/theme";

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: "Not found" }} />
      <View style={styles.container}>
        <Text style={styles.title}>Screen not found</Text>
        <Link href="/" style={styles.link}>
          <Text style={styles.linkText}>Go home</Text>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.canvas,
    padding: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.ink,
  },
  link: {
    marginTop: 16,
  },
  linkText: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.ink,
    textDecorationLine: "underline",
  },
});
