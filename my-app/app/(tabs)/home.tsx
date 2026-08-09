import { SafeAreaView } from "react-native-safe-area-context";
import { View, Text, Button, Alert } from "react-native";
import { useEffect, useState } from "react";
import {
  registerForPushNotificationsAsync,
  sendTokenToBackend
} from "../../src/services/api/pushNotifications";

export default function HomeScreen() {
  const [pushToken, setPushToken] = useState<string | null>(null);

  useEffect(() => {
    registerForPushNotificationsAsync().then((token) => {
      if (token) {
        setPushToken(token);
        sendTokenToBackend(token, "sharad"); // fixed user_id testing ke liye, taaki curl se bhi isi user_id se query kar sakein
      }
    });
  }, []);

  return (
    <SafeAreaView>
      <View>
        <Text>Home page</Text>
        {pushToken && <Text>Push Token: {pushToken}</Text>}
        <Button
          title="Test Notification Trigger Karo" // button ka label
          onPress={() => Alert.alert("Token", pushToken ?? "No token yet")} // tap pe alert dikhayega (sirf debug ke liye)
        />
      </View>
    </SafeAreaView>
  );
}
