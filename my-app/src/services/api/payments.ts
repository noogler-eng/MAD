import { CheckoutOptions } from "../../components/payments/checkoutHtml";

interface VerifyPaymentParams {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
  user_id: string;
}

export async function createOrder(user_id: string): Promise<CheckoutOptions | null> {
  const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
  if (!BACKEND_URL) {
    console.error("BACKEND_URL is not defined in environment variables.");
    return null;
  }

  try {
    const response = await fetch(`${BACKEND_URL}/api/payments/create-order`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ amount: 100, user_id }), // amount in paise (100 paise = 1 INR)
    });

    if (!response.ok) {
      console.error("Failed to create order. Status:", response.status);
      return null;
    }

    const data = await response.json();

    return {
      key: data.key_id,
      amount: data.amount,
      currency: data.currency,
      orderId: data.order_id,
      name: "My App",
      description: "Premium Subscription",
      themeColor: "#F37254",
    };
  } catch (error) {
    console.error("Error occurred while creating order:", error);
    return null;
  }
}

export async function verifyPayment(params: VerifyPaymentParams): Promise<boolean> {
  const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
  if (!BACKEND_URL) {
    console.error("BACKEND_URL is not defined in environment variables.");
    return false;
  }

  try {
    const verifyResponse = await fetch(`${BACKEND_URL}/api/payments/verify-payment`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(params),
    });

    if (!verifyResponse.ok) {
      console.error("Failed to verify payment. Status:", verifyResponse.status);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Error occurred while verifying payment:", error);
    return false;
  }
}
