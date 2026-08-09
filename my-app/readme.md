# my-app

Expo Router based React Native app. Is README mein architecture notes aur **Push Notifications feature**
ka poora setup, commands, aur real debugging journey documented hai.

---

## New Architecture Notes

- (TurboModules + Fabric), JSI (C++)
- TurboModules lazy-loading
- Fabric concurrent rendering supports concurrent rendering
- Hermes Engine app startup time (TTI — Time To Interactive)

---

## Push Notifications

### Architecture

```
[RN App]  --(1) permission + token generate-->  [Expo Push Service]
   |
   |--(2) register token-->  [FastAPI Backend]  (../fastapi/)
                                    |
                                    |--(3) trigger via Postman/curl--> [Expo Push API]
                                                                              |
                                                                              v
                                                                    [Firebase Cloud Messaging]
                                                                              |
                                                                              v
                                                                       [Device Notification]
```

**Key principle:** Frontend sirf **token register** karta hai (automatic, app open hote hi). Notification
**trigger karna purely backend/admin ka kaam hai** — Postman/curl se seedha `/api/notifications/send` ya
`/api/notifications/broadcast` call karke. Frontend mein koi "send" button/logic nahi hai.

---

### Prerequisites

| Cheez | Free? | Kyun chahiye |
|---|---|---|
| Expo/EAS account | ✅ | Build aur push service ke liye |
| Firebase project | ✅ | Android push (FCM) ke liye zaroori |
| Physical Android device | ✅ | Push notifications simulator/emulator pe kaam nahi karte |
| Development Build | ✅ (free EAS build minutes) | Expo Go SDK 53+ se remote push support nahi karta |

---

### Setup — Step by Step

#### 1. Packages install karo
```bash
npx expo install expo-notifications expo-device expo-constants --legacy-peer-deps
```
`--legacy-peer-deps` zaroori tha kyunki `expo-router@57` ke naye `@radix-ui` deps se peer-conflict aa raha tha.

#### 2. `app.config.ts` mein plugin add karo
```typescript
plugins: [
    "expo-router",
    "expo-notifications", // notification icon/sound native config ke liye
],
```

#### 3. EAS project ID lo
```bash
npx eas login
npx eas build:configure
```
Ye `app.config.ts` mein `extra.eas.projectId` daal deta hai — bina iske push token generate nahi hota.

#### 4. Firebase project banao (Android push ke liye zaroori)
1. [console.firebase.google.com](https://console.firebase.google.com) → naya project banao
2. Android app add karo — package name **exact match** hona chahiye app ke `android.package` se (yahan: `com.sharadpoddar.myapp`)
3. `google-services.json` download karke project root mein daalo

#### 5. `app.config.ts` mein Firebase config wire karo
```typescript
android: {
    package: "com.sharadpoddar.myapp",
    googleServicesFile: "./google-services.json",
    // ... baaki config
},
```

#### 6. FCM V1 Service Account Key generate karo
Firebase Console → ⚙️ Project Settings → **Service Accounts** tab → "Generate new private key" → JSON download hogi.

**⚠️ Isse kabhi git mein commit mat karna.**

#### 7. Key ko EAS ko do
```bash
eas credentials
```
Navigate karo: **Android** → **Google Service Account** → **"Set up a Google Service Account Key for Push Notifications (FCM V1)"** → **"Upload a local file"** → downloaded JSON file ka path do.

> ⚠️ **"FCM Legacy" wala option kabhi mat choose karna** — Google ne Legacy FCM API June 2024 mein band kar di thi, wo ab kaam nahi karta.

#### 8. Google Cloud IAM mein service account ko role do
Ye step easy se miss ho jaata hai — `eas credentials` se key upload karna kaafi nahi hai, **service account ko IAM permission bhi chahiye**:

1. [console.cloud.google.com](https://console.cloud.google.com) → apna Firebase project select karo
2. **IAM & Admin → IAM** → **"+ Grant access"**
3. New principal: service account ka email (JSON file ke `client_email` field se, e.g. `firebase-adminsdk-fbsvc@my-app-4e36b.iam.gserviceaccount.com`)
4. Role: **"Firebase Cloud Messaging API Admin"**
5. Save karo, **5-10 minute wait karo** (IAM propagation delay hota hai)

#### 9. Development Build banao
```bash
npx eas build --profile development --platform android
```
(Android se start karo — iOS ke liye real device pe install karne ke liye paid Apple Developer account chahiye)

#### 10. Install karke Metro se connect karo
```bash
npx expo start --dev-client
```

---

### Client-Side Code

`src/services/api/pushNotifications.ts` — do functions:

- **`registerForPushNotificationsAsync()`** — permission maangta hai, `Notifications.getExpoPushTokenAsync({ projectId })` se token generate karta hai. Real device check (`Device.isDevice`) karta hai kyunki simulators token generate nahi kar sakte.
- **`sendTokenToBackend(token, userId)`** — generated token ko FastAPI backend ke `/api/register-token` endpoint pe POST karta hai.

`app/(tabs)/home.tsx` mein `useEffect` (component mount hote hi, **automatic, koi button click nahi chahiye**):
```typescript
useEffect(() => {
  registerForPushNotificationsAsync().then((token) => {
    if (token) {
      setPushToken(token);
      sendTokenToBackend(token, "sharad");
    }
  });
}, []);
```

---

### Backend

Push trigger karne ka poora backend `../fastapi/` folder mein hai — uska apna README padho setup + endpoints ke liye.

---

## 🐛 Debugging Journey (Real Issues Faced + Fixes)

Ye poora setup pehli baar karte waqt jo actual errors aaye, unka record — future reference ke liye:

| # | Error/Problem | Root Cause | Fix |
|---|---|---|---|
| 1 | `Unable to get Firebase Messaging instance... Default FirebaseApp is not initialized` | `google-services.json` configure nahi tha `app.config.ts` mein | `android.googleServicesFile` add kiya + fresh native build |
| 2 | `eas credentials` "FCM Api Key" maang raha tha (ek string) | Galat menu option select kiya tha — "FCM Legacy" (deprecated Google API, ab kaam nahi karta) | "FCM V1" wala option choose kiya |
| 3 | `Reading credentials from credentials.json failed... Android credentials are missing` | Raw Firebase JSON ko `credentials.json` naam ki file mein daal ke "Upload credentials.json to EAS" (bulk/legacy flow) select kiya — ye galat schema expect karta hai | `credentials.json` delete kiya, "Google Service Account" → "Set up a Google Service Account Key for Push Notifications (FCM V1)" flow use kiya, seedha original Firebase JSON file point ki |
| 4 | Mobile pe token dikh raha tha, lekin backend DB mein register nahi ho raha tha | Client `userId` (camelCase) bhej raha tha, backend Pydantic model `user_id` (snake_case) expect karta tha — silent 422 validation error, jo `response.ok` check na hone ki wajah se console mein "success" print ho raha tha | Field name fix kiya (`user_id`), `response.ok` check add kiya taaki errors chhupein na |
| 5 | Backend se `/notifications/send` call karne pe Expo se error: `"Expected array, received object"` | Backend `json={"messages": messages}` bhej raha tha, Expo Push API top-level pe seedha array expect karta hai | `json=messages` (bina wrapper ke) kiya |
| 6 | Expo ne request accept kar li (`status: ok`) lekin phone pe kabhi notification nahi aayi | `getReceipts` API se pata chala: `403 PERMISSION_DENIED` — service account ke paas `cloudmessaging.messages.create` permission nahi thi | Google Cloud Console → IAM mein service account ko manually **"Firebase Cloud Messaging API Admin"** role diya |
| 7 | Role dene ke turant baad bhi wahi permission error | IAM changes turant propagate nahi hote, khaaskar Resource Manager-level checks ke liye | ~90 second — few minutes wait karke retry kiya, kaam kar gaya |

### Key Lessons

1. **`Device.isDevice` check** ki wajah se simulator/emulator pe kabhi push token nahi milega — real device chahiye.
2. **Expo Go SDK 53+ se remote push support nahi karta** — Development Build banana mandatory hai.
3. **Push Notification setup teen alag jagah credentials maangta hai**: (a) `google-services.json` client-side, (b) FCM V1 Service Account key EAS ko, (c) us service account ko IAM role Google Cloud Console mein — teeno alag steps hain, koi ek miss ho to silently fail ho jaata hai.
4. **`fetch()` sirf network failure pe throw karta hai**, 4xx/5xx HTTP errors pe nahi — hamesha `response.ok` explicitly check karo.
5. **Expo's push "ok" response sirf queued hone ki confirmation hai**, actual delivery ke liye `getReceipts` API se check karna padta hai.

---

## Useful Commands Reference

```bash
# Packages install
npx expo install expo-notifications expo-device expo-constants --legacy-peer-deps

# EAS setup
npx eas login
npx eas build:configure
npx eas credentials

# Development build
npx eas build --profile development --platform android

# Local dev server (dev-client mode)
npx expo start --dev-client

# Apna laptop ka LAN IP nikalna (backend URL ke liye .env mein)
ipconfig getifaddr en0
```
