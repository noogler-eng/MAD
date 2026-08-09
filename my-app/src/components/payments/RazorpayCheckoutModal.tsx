import { Button, Linking, Modal, SafeAreaView, StyleSheet, View } from "react-native";
import WebView from "react-native-webview";

import { buildCheckoutHtml, CheckoutOptions } from "./checkoutHtml";

interface PaymentSuccess {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

interface RazorpayCheckoutModalProps {
  visible: boolean;
  checkoutOptions: CheckoutOptions | null;
  onSuccess: (result: PaymentSuccess) => void;
  onDismiss: () => void;
  onError: (message: string) => void;
}

// UPI apps (and other non-http(s) intents like bank apps) are launched by
// handing their URL scheme off to the OS instead of letting the WebView try
// (and fail) to navigate to it. This is Razorpay's documented UPI-intent
// hardening for WebView checkout.
function handleShouldStartLoadWithRequest({ url }: { url: string }): boolean {
  if (/^https?:\/\//i.test(url)) {
    return true;
  }

  Linking.canOpenURL(url)
    .then((supported) => {
      if (supported) {
        return Linking.openURL(url);
      }
    })
    .catch(() => {
      // No matching app installed (or it refused to open) — nothing to do,
      // the checkout page itself will time out/show its own retry UI.
    });

  return false;
}

export default function RazorpayCheckoutModal({
  visible,
  checkoutOptions,
  onSuccess,
  onDismiss,
  onError,
}: RazorpayCheckoutModalProps) {
  if (!checkoutOptions) {
    return null;
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onDismiss}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Button title="Cancel" onPress={onDismiss} />
        </View>
        <WebView
          source={{ html: buildCheckoutHtml(checkoutOptions) }}
          onShouldStartLoadWithRequest={handleShouldStartLoadWithRequest}
          onMessage={(event) => {
            try {
              const data = JSON.parse(event.nativeEvent.data);
              if (data.type === "success") {
                onSuccess(data);
              } else if (data.type === "dismiss") {
                onDismiss();
              }
            } catch {
              onError("Failed to read payment result.");
            }
          }}
        />
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingHorizontal: 8,
  },
});
