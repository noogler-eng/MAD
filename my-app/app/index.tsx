import { View, Text, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

export default function LandingScreen() {
  const router = useRouter();

  return (
    <SafeAreaView>
      <View>
        <Text>Welcome to the Landing Screen!</Text>
      </View>
      <View>
        <Pressable onPress={() => router.push("/login")}>
          <Text>Login</Text>
        </Pressable>
        <Pressable onPress={() => router.push("/signup")}>
          <Text>Signup</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
