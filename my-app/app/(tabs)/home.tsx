import { SafeAreaView } from "react-native-safe-area-context";
import { View, Text, Button, Alert } from "react-native";
import { useEffect, useState } from "react";
import {
  registerForPushNotificationsAsync,
  sendTokenToBackend
} from "../../src/services/api/pushNotifications";
import { createOrder, verifyPayment } from "../../src/services/api/payments";
import RazorpayCheckoutModal from "../../src/components/payments/RazorpayCheckoutModal";
import { CheckoutOptions } from "../../src/components/payments/checkoutHtml";

const USER_ID = "sharad";

export default function HomeScreen() {
  const [pushToken, setPushToken] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [checkoutOptions, setCheckoutOptions] = useState<CheckoutOptions | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    registerForPushNotificationsAsync().then((token) => {
      if (token) {
        setPushToken(token);
        sendTokenToBackend(token, USER_ID);
      }
    });
  }, []);

  return (
    <SafeAreaView>
      <View>
        <Text>Home page</Text>
        {pushToken && <Text>Push Token: {pushToken}</Text>}
        <Button
          title="Test Notification Trigger Karo"
          onPress={() => Alert.alert("Token", pushToken ?? "No token yet")}
        />
        <Button
          title="Buy Premium (Test Mode - ₹100)"
          disabled={checking}
          onPress={async () => {
            if (checking) return;
            setChecking(true);
            const order = await createOrder(USER_ID);
            setChecking(false);
            if (!order) {
              Alert.alert("Payment Failed", "There was an issue with your payment. Please try again.");
              return;
            }
            setCheckoutOptions(order);
            setModalVisible(true);
          }}
        />
      </View>
      <RazorpayCheckoutModal
        visible={modalVisible}
        checkoutOptions={checkoutOptions}
        onSuccess={async (result) => {
          setModalVisible(false);
          const success = await verifyPayment({ ...result, user_id: USER_ID });
          if (success) {
            Alert.alert("Payment Successful", "You have successfully purchased the premium subscription.");
          } else {
            Alert.alert("Payment Failed", "There was an issue with your payment. Please try again.");
          }
        }}
        onDismiss={() => setModalVisible(false)}
        onError={() => {
          setModalVisible(false);
          Alert.alert("Payment Failed", "There was an issue with your payment. Please try again.");
        }}
      />
    </SafeAreaView>
  );
}
