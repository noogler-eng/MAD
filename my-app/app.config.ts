// auto reads and priority over app.json
// dynamic config for expo

const APP_ENV: any = process.env.EXPO_PUBLIC_APP_ENV ?? "development";
console.log("APP_ENV: ", APP_ENV);
const ENV_CONFIG: any = {
  development: {
    name: "my-app-dev",
  },
  staging: {
    name: "my-app-staging",
  },
  production: {
    name: "my-app",
  },
};

export default {
  expo: {
    name: ENV_CONFIG[APP_ENV].name,
    slug: "my-app",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "light",
    // Required by expo-router for deep linking
    // deepling: "myapp://"
    scheme: "myapp",

    // expo.extra.eas.projectId
    "extra": {
      "eas": {
        "projectId": "3839729d-8001-4479-86ba-3a1b3054a789"
      }
    },

    // Merged back from app.json
    ios: {
      supportsTablet: true,
      infoPlist: {
        // Lets the app check for/launch installed UPI apps from the Razorpay WebView checkout
        LSApplicationQueriesSchemes: ["upi", "gpay", "phonepe", "paytmmp", "tez", "credpay"],
      },
    },
    android: {
      package: "com.sharadpoddar.myapp",
      googleServicesFile: process.env.GOOGLE_SERVICES_JSON ?? "./google-services.json",
      adaptiveIcon: {
        backgroundColor: "#E6F4FE",
        foregroundImage: "./assets/android-icon-foreground.png",
        backgroundImage: "./assets/android-icon-background.png",
        monochromeImage: "./assets/android-icon-monochrome.png",
      },
      predictiveBackGestureEnabled: false,
    },
    web: {
      favicon: "./assets/favicon.png",
      bundler: "metro",
    },
    // expo-router config plugin
    plugins: ["expo-router", "expo-notifications", "./plugins/withUpiManifestQueries.js"],
    experiments: {
      typedRoutes: true,
    },
  },
};
