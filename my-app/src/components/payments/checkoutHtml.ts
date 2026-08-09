export interface CheckoutOptions {
  key: string;
  amount: number;
  currency: string;
  orderId: string;
  name: string;
  description: string;
  themeColor: string;
}

// Renders Razorpay's own checkout.js inside a WebView (their documented
// "Web Integration reused inside a mobile WebView" pattern) and posts the
// result back to React Native via window.ReactNativeWebView.postMessage.
// webview_intent: true is required for UPI apps to be launchable from here.
export function buildCheckoutHtml(options: CheckoutOptions): string {
  const razorpayOptions = {
    key: options.key,
    amount: options.amount,
    currency: options.currency,
    order_id: options.orderId,
    name: options.name,
    description: options.description,
    theme: { color: options.themeColor },
    webview_intent: true,
  };

  return `<!DOCTYPE html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
    <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
  </head>
  <body>
    <script>
      var options = ${JSON.stringify(razorpayOptions)};

      options.handler = function (response) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'success',
          razorpay_order_id: response.razorpay_order_id,
          razorpay_payment_id: response.razorpay_payment_id,
          razorpay_signature: response.razorpay_signature,
        }));
      };

      options.modal = {
        ondismiss: function () {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'dismiss' }));
        },
      };

      var rzp = new Razorpay(options);
      rzp.open();
    </script>
  </body>
</html>`;
}
