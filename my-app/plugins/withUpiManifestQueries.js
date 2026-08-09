const { withAndroidManifest } = require('expo/config-plugins');

// Android 11+ (targetSdkVersion 30+) restricts package visibility, so the
// Razorpay WebView checkout needs an explicit <queries> block to be able to
// detect and launch installed UPI apps via UPI intent URLs.
const UPI_PACKAGES = [
  'com.google.android.apps.nbu.paisa.user', // Google Pay
  'com.phonepe.app', // PhonePe
  'net.one97.paytm', // Paytm
];

function withUpiManifestQueries(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;

    if (!manifest.queries) {
      manifest.queries = [{}];
    }

    const queries = manifest.queries[0];

    const existingPackages = new Set(
      (queries.package ?? []).map((entry) => entry.$['android:name'])
    );
    const newPackages = UPI_PACKAGES.filter((name) => !existingPackages.has(name)).map(
      (name) => ({ $: { 'android:name': name } })
    );
    queries.package = [...(queries.package ?? []), ...newPackages];

    const hasSendIntent = (queries.intent ?? []).some((entry) =>
      entry.action?.some((a) => a.$['android:name'] === 'android.intent.action.SEND')
    );
    if (!hasSendIntent) {
      queries.intent = [
        ...(queries.intent ?? []),
        { action: [{ $: { 'android:name': 'android.intent.action.SEND' } }] },
      ];
    }

    return config;
  });
}

module.exports = withUpiManifestQueries;
