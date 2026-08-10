# Backend (FastAPI) — Push Notifications + Payments

Ye ek chhota FastAPI server hai jo `../my-app/` (RN app) ke liye do features backend karta hai:

1. **Push Notifications** — Expo push tokens store karta hai, aur unhe **Postman/curl se manually
   trigger** karne ke liye endpoints deta hai. Frontend sirf apna token register karta hai (automatic),
   **notification trigger karna is backend ka kaam hai, jo tum khud Postman se control karte ho** — koi
   frontend button nahi hai jo notification bhejta ho.
2. **Payments (Razorpay)** — Razorpay orders create karta hai aur payment signatures verify karta hai,
   taaki koi client-side "success" claim bina server-side proof ke premium unlock na kar sake.

Concepts (order vs payment, signature verification, kyun secret key kabhi client mein nahi jaati) ka
detailed explanation `../my-app/readme.md` mein hai — yahan sirf API-level docs hain.

---

## Table of Contents

- [Setup](#setup)
- [Server Chalao](#server-chalao)
- [Storage](#storage)
- [Endpoints — Push Notifications](#endpoints--push-notifications)
- [Endpoints — Payments](#endpoints--payments)
- [Debugging Guide](#debugging-guide)
- [Known Limitations](#known-limitations--future-improvement)

---

## Setup

```bash
cd fastapi
python3 -m venv venv              # isolated Python environment
source venv/bin/activate          # activate karo (Windows: venv\Scripts\activate)
pip install -r requirements.txt   # dependencies install karo
```

### `.env` file
```
EXPO_ACCESS_TOKEN=
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
```
- `EXPO_ACCESS_TOKEN` — optional, Expo dashboard (expo.dev → Account Settings → Access Tokens) se free mein bana sakte ho, better rate limits ke liye. Khali bhi chal jaayega.
- `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` — Razorpay Dashboard (Test Mode) → Settings → API Keys se milte hain. **Key Secret kabhi commit mat karna.**

---

## Server Chalao

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

`--host 0.0.0.0` zaroori hai warna sirf `localhost` pe bind hoga aur phone se accessible nahi hoga.

Interactive API docs (Swagger UI): **http://localhost:8000/docs**

---

## Storage

SQLite database (`push_tokens.db`, is folder mein auto-create hoti hai) — ek simple `tokens` table
(`user_id` PRIMARY KEY, `token`). Har naye `register-token` call pe existing `user_id` ka token
upsert (insert-or-replace) hota hai.

---

## Endpoints — Push Notifications

| Method | Path | Kaam | Kaun call karta hai |
|---|---|---|---|
| GET | `/api/health` | Server up hai check karne ke liye | Manual/monitoring |
| POST | `/api/register-token` | Ek device ka push token save/update karta hai | RN app (automatic, app open hote hi) |
| POST | `/api/notifications/send` | Ek specific `user_id` ko notification bhejta hai | **Tum, Postman se** |
| POST | `/api/notifications/broadcast` | Saare registered tokens ko ek saath bhejta hai | **Tum, Postman se** |

### `POST /api/register-token`
```bash
curl -X POST http://localhost:8000/api/register-token \
  -H "Content-Type: application/json" \
  -d '{"token": "ExponentPushToken[xxxxxxxxxxxx]", "user_id": "sharad"}'
```
Response: `{"status": "success", "message": "Token registered successfully."}`

### `POST /api/notifications/send`
```bash
curl -X POST http://localhost:8000/api/notifications/send \
  -H "Content-Type: application/json" \
  -d '{"user_id": "sharad", "title": "Hello", "message": "Postman se trigger kiya!"}'
```
> Note: field ka naam `message` hai, `body` nahi.

Response: `{"status": "success", "message": "Notification sent successfully."}`

### `POST /api/notifications/broadcast`
```bash
curl -X POST http://localhost:8000/api/notifications/broadcast \
  -H "Content-Type: application/json" \
  -d '{"title": "Announcement", "message": "Sabko ek saath"}'
```

---

## Internally Kya Ho Raha Hai

`send_expo_push()` function:
1. Har token ke liye ek message object banata hai (`to`, `title`, `body`, `data`, `sound`)
2. Poori list ko **seedha array format mein** (`json=messages`, koi `{"messages": [...]}` wrapper nahi)
   Expo ke official endpoint ko POST karta hai: `https://exp.host/--/api/v2/push/send`
3. Expo turant ek "ticket" response deta hai (`status: "ok"` ya `"error"`) — **ye sirf queue confirmation
   hai, guaranteed delivery nahi**

### Real Delivery Verify Karna (Receipts)

Agar Expo "ok" bole lekin phone pe notification na aaye, **receipt check karo**:
```bash
curl -X POST https://exp.host/--/api/v2/push/getReceipts \
  -H "Content-Type: application/json" \
  -d '{"ids": ["<ticket-id-jo-send-response-mein-mila>"]}'
```
Ye asli FCM-level delivery status/errors dikhata hai (e.g. `PERMISSION_DENIED`, `DeviceNotRegistered`).

---

## Endpoints — Payments

| Method | Path | Kaam | Kaun call karta hai |
|---|---|---|---|
| POST | `/api/payments/create-order` | Razorpay se ek order banwata hai, checkout ke liye `order_id`/`key_id`/`amount`/`currency` return karta hai | RN app ("Buy Premium" button pe tap) |
| POST | `/api/payments/verify-payment` | Checkout complete hone ke baad signature verify karta hai, genuine hone pe `premium_users` table mein user ko mark karta hai | RN app (checkout complete hone ke baad, automatic) |

### `POST /api/payments/create-order`
```bash
curl -X POST http://localhost:8000/api/payments/create-order \
  -H "Content-Type: application/json" \
  -d '{"amount": 100, "user_id": "sharad"}'
```
> `amount` yahan **rupees** mein diya jaata hai — backend internally `* 100` karke Razorpay ko **paise**
> mein bhejta hai (Razorpay ka API paise expect karta hai, rupees nahi).

Response:
```json
{"status": "success", "order_id": "order_xxxxxxxxxxxxx", "amount": 10000, "currency": "INR", "key_id": "rzp_test_xxxxxxxxxxxxx"}
```

### `POST /api/payments/verify-payment`
Checkout SDK se milne wali teen values yahan bhejo:
```bash
curl -X POST http://localhost:8000/api/payments/verify-payment \
  -H "Content-Type: application/json" \
  -d '{
    "razorpay_order_id": "order_xxxxxxxxxxxxx",
    "razorpay_payment_id": "pay_xxxxxxxxxxxxx",
    "razorpay_signature": "<signature-string>",
    "user_id": "sharad"
  }'
```
Response (genuine signature): `{"status": "success", "message": "Payment verified, premium unlocked"}`
Response (fake/tampered signature): `400 Bad Request` — order/premium unlock nahi hota.

### Internally Kya Ho Raha Hai

1. `create_order` — Razorpay SDK (`razorpay_client.order.create(...)`) ko call karta hai secret key ke
   saath (ye kabhi client ko nahi milti), aur checkout ke liye zaroori sab fields return karta hai.
2. `verify_payment` — Razorpay SDK ka `utility.verify_payment_signature()` helper use karta hai jo
   `order_id + "|" + payment_id` ko `key_secret` se HMAC-SHA256 sign karke client-supplied signature se
   compare karta hai. Match nahi hone pe `SignatureVerificationError` throw hota hai — ye woh moment hai
   jo fake/tampered "payment success" claims ko rok deta hai.
3. Genuine signature pe hi `premium_users` SQLite table mein `user_id` insert/update hota hai.

---

## Debugging Guide

### Push Notifications

| Symptom | Kya check karo |
|---|---|
| `curl /api/health` fail | Server chal raha hai? `uvicorn` command sahi terminal mein active hai? |
| `register-token` 422 error | Request body mein field names exactly `token` aur `user_id` (snake_case) hone chahiye |
| `/notifications/send` → 404 "Token not found" | Pehle `register-token` call hui thi? `user_id` exactly match kar raha hai (case-sensitive)? |
| Expo response `"status":"error"` on send | Token format galat ho sakta hai, ya `DeviceNotRegistered` (user ne app uninstall kar di — us token ko DB se delete karo) |
| Expo response `"status":"ok"` lekin phone pe kuch nahi aata | `getReceipts` se asli error dekho — 90%+ cases mein ye Firebase/IAM permission issue hota hai (`cloudmessaging.messages.create` denied) |
| Firebase `403 PERMISSION_DENIED` on receipt | Google Cloud Console → IAM mein service account ko **"Firebase Cloud Messaging API Admin"** role do (poora setup `../my-app/readme.md` mein hai). IAM changes propagate hone mein 5-10 min lag sakte hain |
| RN app se request hi backend tak nahi pahunch rahi | `.env` mein `EXPO_PUBLIC_BACKEND_URL` — `localhost` use to nahi kiya (phone ke liye kaam nahi karega)? Laptop ka LAN IP do (`ipconfig getifaddr en0`). Phone aur laptop same WiFi pe hain? |

### Payments

| Symptom | Kya check karo |
|---|---|
| `create-order` 500 error | `.env` mein `RAZORPAY_KEY_ID`/`RAZORPAY_KEY_SECRET` sahi hain? Test mode wale hain (galti se live keys mismatch to nahi)? |
| RN app mein checkout khulta hi nahi, `key` undefined error | `create_order` response mein `key_id`, `amount`, `currency` saari fields return ho rahi hain? (sirf `order_id` kaafi nahi hai) |
| `verify-payment` 400 "signature verification failed" | Genuine bug ho sakta hai, ya order create test key se hua aur verify live key se ho raha hai (mismatch) |
| "International cards are not supported" | Account-level restriction hai, code ka bug nahi — domestic test card (`4111 1111 1111 1111`) use karo |
| Payment ho gaya lekin app mein "failed" dikha | RN se backend tak request pahunchi ya nahi check karo — same debugging jaisa push notifications mein kiya (`.env` URL, same WiFi, `response.ok` check) |

---

## Known Limitations / Future Improvement

- `send_expo_push` abhi ek loop mein sabhi tokens ke liye single request banata hai — bade scale
  (jaise 10,000+ users ko broadcast) ke liye Expo ki **chunking** recommendation follow karni chahiye
  (max ~100 messages per request), abhi ke liye chhote user-base ke liye theek hai.
- Invalid/expired tokens (jo `DeviceNotRegistered` error dete hain) abhi automatically DB se delete
  nahi hote — production mein `getReceipts` response check karke aisi cleanup job add karni chahiye.
- Payments abhi sirf Test Mode ke liye hain — live keys pe switch karne se pehle ch.15 (Payments) ka
  subscription state machine aur webhook-based reconciliation padhna chahiye (kya hota hai agar
  `verify-payment` call kabhi backend tak pahunchi hi nahi — abhi koi fallback nahi hai).
- Currency hardcoded `"INR"` hai `create_order` mein — multi-currency support chahiye ho to ye
  request body se parameterize karna hoga.
