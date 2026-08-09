# Push Notification Backend (FastAPI)

Ye ek chhota FastAPI server hai jo Expo push tokens store karta hai aur unhe **Postman/curl se manually
trigger** karne ke liye endpoints deta hai. Iska frontend (`../my-app/`) ke saath relation simple hai:
frontend sirf apna token register karta hai (automatic), **notification trigger karna is backend ka kaam
hai, jo tum khud Postman se control karte ho** — koi frontend button nahi hai jo notification bhejta ho.

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
```
Optional — Expo dashboard (expo.dev → Account Settings → Access Tokens) se free mein bana sakte ho, better rate limits ke liye. Khali bhi chal jaayega.

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

## Endpoints

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

## Debugging Guide

| Symptom | Kya check karo |
|---|---|
| `curl /api/health` fail | Server chal raha hai? `uvicorn` command sahi terminal mein active hai? |
| `register-token` 422 error | Request body mein field names exactly `token` aur `user_id` (snake_case) hone chahiye |
| `/notifications/send` → 404 "Token not found" | Pehle `register-token` call hui thi? `user_id` exactly match kar raha hai (case-sensitive)? |
| Expo response `"status":"error"` on send | Token format galat ho sakta hai, ya `DeviceNotRegistered` (user ne app uninstall kar di — us token ko DB se delete karo) |
| Expo response `"status":"ok"` lekin phone pe kuch nahi aata | `getReceipts` se asli error dekho — 90%+ cases mein ye Firebase/IAM permission issue hota hai (`cloudmessaging.messages.create` denied) |
| Firebase `403 PERMISSION_DENIED` on receipt | Google Cloud Console → IAM mein service account ko **"Firebase Cloud Messaging API Admin"** role do (poora setup `../my-app/readme.md` mein hai). IAM changes propagate hone mein 5-10 min lag sakte hain |
| RN app se request hi backend tak nahi pahunch rahi | `.env` mein `EXPO_PUBLIC_BACKEND_URL` — `localhost` use to nahi kiya (phone ke liye kaam nahi karega)? Laptop ka LAN IP do (`ipconfig getifaddr en0`). Phone aur laptop same WiFi pe hain? |

---

## Known Limitation / Future Improvement

- `send_expo_push` abhi ek loop mein sabhi tokens ke liye single request banata hai — bade scale
  (jaise 10,000+ users ko broadcast) ke liye Expo ki **chunking** recommendation follow karni chahiye
  (max ~100 messages per request), abhi ke liye chhote user-base ke liye theek hai.
- Invalid/expired tokens (jo `DeviceNotRegistered` error dete hain) abhi automatically DB se delete
  nahi hote — production mein `getReceipts` response check karke aisi cleanup job add karni chahiye.
