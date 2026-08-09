import * as Notifications from "expo-notifications";
import * as Device from "expo-device";

import Constants from "expo-constants";
import { Platform } from "react-native";

// behaviour of the notification when the app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowList: true,
  }),
});

export async function registerForPushNotificationsAsync(): Promise<
  string | null
> {
  if (!Device.isDevice) {
    console.log("Must use physical device for Push Notifications");
    return null;
  }

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#FF231F7C",
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    console.log("User ne push notification permission deny kar diya.");
    return null;
  }

  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId) {
    console.log("EAS project ID not found in app config.");
    return null;
  }

  try {
    const tokenResponse = await Notifications.getExpoPushTokenAsync({
      projectId,
    });
    const token = tokenResponse.data;
    console.log("Push notification token: ", token);
    return token;
  } catch (error: any) {
    console.log("Token generate error:", error);
    return null;
  }
}

export async function sendTokenToBackend(
  token: string,
  userId?: string,
): Promise<void> {
  const BACKEND_URL: any = process.env.EXPO_PUBLIC_BACKEND_URL;
  if (!BACKEND_URL) {
    console.log("set backend url properly");
    return;
  }

  try {
    const response = await fetch(`${BACKEND_URL}/api/register-token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        token: token,
        userId: userId ?? null
      }),
    });

    console.log("token register successfully!");
  } catch (error) {
    console.log("error while regesting token with backend");
  }
}
