import { View, Text, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { StyleSheet } from "react-native";

export default function LandingScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Welcome to the Landing Screen!</Text>
        <Text style={styles.tagline}>Get started by exploring our app.</Text>
      </View>
      <View style={styles.actions}>
        <Pressable style={styles.primaryButton} onPress={() => router.push("/login")}>
          <Text style={styles.primaryButtonText}>Login</Text>
        </Pressable>
        <Pressable style={styles.secondaryButton} onPress={() => router.push("/home")}>
          <Text style={styles.secondaryText}>Signup</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
    justifyContent: "space-between",
    padding: 24,
  },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    fontSize: 32,
    fontWeight: "700",
  },
  tagline: {
    fontSize: 16,
    color: "#666",
    marginTop: 8,
  },
  actions: {
    gap: 16,
    alignItems: "center",
    paddingBottom: 16,
  },
  primaryButton: {
    backgroundColor: "#000000",
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderWidth: 1,
    borderColor: "#000000",
    borderRadius: 12,
    width: "100%",
    alignItems: "center",
  },
  secondaryButton: {
    backgroundColor: "#ffffff",
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    borderWidth: 1,
    width: "100%",
    alignItems: "center",
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },
  secondaryText: {
    fontSize: 14,
    color: "#000000",
  },
});