# my-app

Expo Router based React Native app. Ye README sirf setup instructions nahi hai — isme **concepts bhi
explain kiye gaye hain** taaki samajh aaye ki har step *kyun* zaroori hai, na sirf *kya* karna hai.

## Table of Contents

- [Architecture Notes](#architecture-notes)
- [Feature: Push Notifications](#feature-push-notifications)
- [Feature: Payments (Razorpay)](#feature-payments-razorpay)
- [Useful Commands Reference](#useful-commands-reference)

---

## Architecture Notes

- **New Architecture** (TurboModules + Fabric), JSI (C++) ke upar bana hai
- **TurboModules** — native modules ko lazy-load karte hain (jab tak zaroorat na ho, load nahi hote)
- **Fabric** — concurrent rendering support karta hai (React 18's concurrent features ke saath compatible)
- **Hermes Engine** — app ka startup time (TTI — Time To Interactive) kam karta hai, kyunki JS ko bytecode mein precompile karta hai

---

## Feature: Push Notifications

### Kya Problem Solve Ho Rahi Hai

Kisi bhi app ko user ko background/killed state mein message bhejna ho (e.g. "aapka order ship ho gaya"),
to app khud kuch nahi kar sakti — kyunki app hi nahi chal rahi hoti. Isliye ye kaam **OS-level push
services** (Android pe Firebase Cloud Messaging, iOS pe Apple Push Notification service) karte hain, aur
Expo inke upar ek unified layer deta hai jisse tumhe dono platforms ka alag code nahi likhna padta.

### Architecture — Poora Data Flow

```
[RN App]  --(1) permission maango + token generate karo-->  [Expo Push Service]
   |
   |--(2) apna token backend ko register karo-->  [FastAPI Backend]  (../fastapi/)
                                    |
                                    |--(3) TUM Postman/curl se trigger karte ho--> [Expo Push API]
                                                                                          |
                                                                                          v
                                                                                [Firebase Cloud Messaging]
                                                                                          |
                                                                                          v
                                                                                   [Device pe Notification]
```

**Sabse important concept jo samjho:** Frontend ka kaam sirf **"main yahan hoon, mujhe is token pe
message bhej sakte ho"** batana hai (automatic, app open hote hi). **Actually message bhejna kaunsa,
kab** — ye decision **backend/admin ke haath mein hota hai**, frontend ke control mein nahi. Isliye
app mein koi "Send Notification" button nahi hai — Postman se seedha backend ko trigger karte hain.

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
Ye `app.config.ts` mein `extra.eas.projectId` daal deta hai. **Kyun zaroori hai:** Expo ka push service
tumhare app ko ek unique ID se identify karta hai — bina isके uska pata hi nahi chalega ki token kis app
ke liye generate karna hai.

#### 4. Firebase project banao (Android push ke liye zaroori)
1. [console.firebase.google.com](https://console.firebase.google.com) → naya project banao
2. Android app add karo — package name **exact match** hona chahiye app ke `android.package` se (yahan: `com.sharadpoddar.myapp`)
3. `google-services.json` download karke project root mein daalo

**Kyun Firebase chahiye:** Expo khud FCM nahi provide karta — Expo sirf ek "proxy/middleman" hai jo tumhare
push request ko FCM/APNs tak forward karta hai. Android pe delivery karne ke liye asli engine **Google ka
FCM** hai, aur usse baat karne ke liye tumhara khud ka Firebase project chahiye.

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

**⚠️ Isse kabhi git mein commit mat karna** — ye ek server-side secret credential hai.

#### 7. Key ko EAS ko do
```bash
eas credentials
```
Navigate karo: **Android** → **Google Service Account** → **"Set up a Google Service Account Key for Push Notifications (FCM V1)"** → **"Upload a local file"** → downloaded JSON file ka path do.

> ⚠️ **"FCM Legacy" wala option kabhi mat choose karna** — Google ne Legacy FCM API June 2024 mein band kar di thi, wo ab kaam nahi karta.

#### 8. Google Cloud IAM mein service account ko role do
Ye step easy se miss ho jaata hai — `eas credentials` se key upload karna kaafi nahi hai, **service
account ko IAM permission bhi chahiye** (upload karna sirf "key hold karna" hai, "use karne ki
permission" alag cheez hai):

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

`src/services/api/pushNotifications.ts` mein do functions hain:

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

### Backend

Push trigger karne ka poora backend `../fastapi/` folder mein hai — uska apna README padho setup + endpoints ke liye.

---

### 🐛 Debugging Journey (Real Issues Faced + Fixes)

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

## Feature: Payments (Razorpay)

### Kya Problem Solve Ho Rahi Hai

App mein ek "Buy Premium" feature hai — real-world goods/services jaisi cheez (na ki Apple/Google's
IAP-mandatory digital-goods category), isliye Razorpay (ya Stripe) directly use kar sakte hain, App
Store/Play Store ke commission ke bina.

### Architecture — Poora Data Flow

```
[RN App: "Buy Premium" button]
        |
        v (1) order create request
[FastAPI: POST /api/payments/create-order]  --(2) Razorpay Orders API call--> [Razorpay]
        |
        v (3) order_id + key_id return
[RN App: Razorpay Checkout UI khulta hai (test card/UPI se pay karo)]
        |
        v (4) payment success callback (payment_id, order_id, signature)
[FastAPI: POST /api/payments/verify-payment]  --(5) HMAC signature verify--> [confirm genuine hai]
        |
        v
[Premium unlock ho jaata hai — SQLite mein mark hota hai]
```

---

### 🧠 Concepts Jo Samjhe Razorpay Integrate Karte Waqt

Ye sabse important section hai — sirf steps yaad karne se zyada important hai ye samajhna ki **kyun** har
step is tarah design kiya gaya hai:

#### 1. **Order vs Payment — do alag concepts hain**
Ek **Order** sirf ek "intent" hai — "is user ko itne amount ka bill dikhana hai." Order create hone ka
matlab paisa move nahi hua. **Payment** wo actual transaction hai jab user card/UPI se pay karta hai.
Isi wajah se flow two-step hai: pehle order banao (server-side), phir checkout dikhao jahan payment ho.

#### 2. **Client kabhi seedha payment "create" nahi kar sakta**
Order banane ke liye Razorpay **Key Secret** chahiye — jo kabhi client (RN app) mein nahi ja sakta
(reverse-engineer ho sakta hai APK se). Isliye order creation **hamesha backend se** hota hai — client
sirf "order_id" leta hai aur checkout UI dikhata hai.

#### 3. **Payment "success" hone ka matlab genuine hona zaroori nahi (signature verification)**
Jab checkout complete hota hai, Razorpay client ko `payment_id`, `order_id`, aur `signature` deta hai.
**Client khud bol sakta hai "success ho gaya"** (agar koi jailbreak/tamper kare) — isliye backend ko
**cryptographically verify** karna padta hai ki ye values genuinely Razorpay se aayi hain, na ki fake
JSON jo client ne khud bana diya. Ye HMAC-SHA256 signature ka kaam hai:
```
signature = HMAC-SHA256(order_id + "|" + payment_id, key_secret)
```
Agar client-supplied signature isi formula se match nahi karta, backend reject kar deta hai. **Isi
wajah se premium unlock backend mein hota hai, client mein nahi** — client sirf "verify karo" bolta hai,
decision backend leta hai.

#### 4. **Amount hamesha smallest currency unit mein jaata hai (paise, cents, etc.)**
Razorpay `amount` field mein **paise** expect karta hai, rupees nahi — isliye ₹100 ka matlab hai
`amount: 10000`. Ye floating-point precision errors avoid karne ke liye industry-wide convention hai
(agar rupees mein decimal amounts hote, rounding errors aa sakte the).

#### 5. **Test Mode aur Live Mode alag "universes" hain**
Test Mode ki keys (`rzp_test_...`) sirf test cards/UPI IDs ke saath kaam karti hain — koi real
transaction possible nahi hai, chahe tum real card number bhi daal do. Ye ek completely sandboxed
environment hai jahan koi financial risk nahi hota.

#### 6. **International payments by default disabled hote hain**
Naye Razorpay account (Test Mode mein bhi) sirf domestic (India-issued) cards accept karte hain by
default — international card use karne ke liye explicit business-level enablement chahiye hota hai
(compliance/fraud-prevention ke reasons se). Isliye domestic test card (`4111 1111 1111 1111`) hi
reliably kaam karega bina extra setup ke.

#### 7. **`EXPO_PUBLIC_` prefix — client-visible env vars ka rule**
(Push notifications se already pata tha, lekin phir se confirm hua): Expo sirf `EXPO_PUBLIC_` prefix
wale env vars ko client bundle mein include karta hai. Bina prefix ke (`BACKEND_URL` vs
`EXPO_PUBLIC_BACKEND_URL`) variable client-side `undefined` reh jaata hai — silently, koi error nahi
deta, isliye bugs pakadna mushkil ho jaata hai.

---

### Prerequisites

| Cheez | Free? | Kyun chahiye |
|---|---|---|
| Razorpay account (Test Mode) | ✅ | Order create + payment verify APIs ke liye |
| `react-native-razorpay` package | ✅ | Native checkout UI kholne ke liye — ye ek native module hai |
| Development Build (already bana hua hai push notifications ke liye) | ✅ | Native module ke liye Expo Go kaafi nahi hai, fresh rebuild bhi chahiye jab native package add ho |

---

### Setup — Step by Step

#### 1. Razorpay Test Account Banao
1. [dashboard.razorpay.com/signup](https://dashboard.razorpay.com/signup) — free signup (real mobile number chahiye, OTP verification ke liye — ye account-level hai, "Test Mode" se alag concept)
2. Login karke confirm karo top-right **"Test Mode"** toggle ON hai
3. **Settings → API Keys → "Generate Test Key"** — Key ID aur Key Secret milegi (secret sirf ek baar dikhta hai, turant copy karo)

#### 2. Python package install karo
```bash
cd fastapi
source venv/bin/activate
pip install razorpay
```
`requirements.txt` mein `razorpay==1.4.2` add karo.

#### 3. `.env` mein daalo (fastapi folder)
```
RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxxx
RAZORPAY_KEY_SECRET=<jo secret mila>
```

#### 4. RN app mein checkout SDK install karo
```bash
npx expo install react-native-razorpay --legacy-peer-deps
```

**⚠️ Ye ek native module hai — fresh Development Build banani padegi:**
```bash
npx eas build --profile development --platform android
```

#### 5. `.env` mein backend URL confirm karo (my-app folder)
```
EXPO_PUBLIC_BACKEND_URL=http://<laptop-ka-LAN-IP>:8000
```
(Same jo push notifications ke liye use kiya tha)

---

### Backend Endpoints

Poore endpoints ka detail `../fastapi/README.md` mein hai. Quick summary:

| Endpoint | Kaam |
|---|---|
| `POST /api/payments/create-order` | Razorpay order banata hai, `order_id` + `key_id` return karta hai |
| `POST /api/payments/verify-payment` | Signature verify karta hai, genuine hone pe premium unlock karta hai |

---

### Testing — Bina Real Card/UPI Ke

**Test Card (domestic — reliably kaam karega):**
| Field | Value |
|---|---|
| Card Number | `4111 1111 1111 1111` |
| Expiry | Koi bhi future date |
| CVV | Koi bhi 3 digit |
| OTP | `1234` |

**Test UPI ID:**
| Scenario | UPI ID |
|---|---|
| Success simulate karna | `success@razorpay` |
| Failure simulate karna | `failure@razorpay` |

International cards test karne ke liye Razorpay ke [official test card docs](https://razorpay.com/docs/payments/payments/test-card-details/) dekho — by default international payments account mein disabled hote hain.

---

### 🐛 Debugging Journey (Real Issues Faced + Fixes)

| # | Error/Problem | Root Cause | Fix |
|---|---|---|---|
| 1 | `useEffect` mein syntax error, app compile hi nahi hoti | `if (token) { ... }` block ka closing `}` missing tha | Missing brace add kiya |
| 2 | `payments.ts` mein `BACKEND_URL` hamesha `undefined` aata | `process.env.BACKEND_URL` use kiya, `EXPO_PUBLIC_` prefix ke bina | `EXPO_PUBLIC_BACKEND_URL` kiya |
| 3 | Backend calls 404 de rahe the | Client `/api/create-order` call kar raha tha, backend actual path `/api/payments/create-order` tha | Client-side URLs ko backend ke actual routes se match kiya |
| 4 | Checkout khulta hi nahi tha (`key` undefined error) | Backend ka `create_order` response sirf `order_id` return karta tha — `key_id`, `amount`, `currency` missing the jo checkout UI ko chahiye | Backend response mein saari fields add ki |
| 5 | "International cards are not supported" error | Naye Razorpay account mein international payments by default disabled hoti hain | Domestic test card (`4111 1111 1111 1111`) use kiya — testing goal ke liye ye kaafi hai |

### Key Lessons

1. **Order create karna aur payment karna do alag steps hain** — backend order banata hai (secret key
   ke saath), client sirf checkout dikhata hai (public key ke saath).
2. **Kabhi client ke "success" callback pe blindly trust mat karo** — signature verification backend
   mein hi honi chahiye, isi liye premium-unlock logic bhi backend mein hai, RN app mein nahi.
3. **Amount hamesha smallest unit mein** (paise, cents) — direct rupee/dollar value nahi bhejte.
4. **Test Mode completely isolated hai** — koi real money kabhi involve nahi hota, chahe kuch bhi try karo.
5. **Naye account mein international payments disabled hote hain by default** — ye account-level
   restriction hai, code ka bug nahi.

---

## Useful Commands Reference

```bash
# Packages install (push notifications)
npx expo install expo-notifications expo-device expo-constants --legacy-peer-deps

# Packages install (payments)
npx expo install react-native-razorpay --legacy-peer-deps

# EAS setup
npx eas login
npx eas build:configure
npx eas credentials

# Development build (chahiye jab bhi koi native module add/change ho)
npx eas build --profile development --platform android

# Local dev server (dev-client mode)
npx expo start --dev-client

# Apna laptop ka LAN IP nikalna (backend URL ke liye .env mein)
ipconfig getifaddr en0

# FastAPI backend chalana
cd ../fastapi && source venv/bin/activate && uvicorn main:app --reload --host 0.0.0.0 --port 8000
```
