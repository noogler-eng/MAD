from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from dotenv import load_dotenv
from typing import Optional
import razorpay
import sqlite3
import hashlib 
import hmac
import httpx
import os

load_dotenv()

EXPO_ACCESS_TOKEN = os.getenv("EXPO_ACCESS_TOKEN")
EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"

RAZORPAY_KEY_ID = os.getenv("RAZORPAY_KEY_ID")
RAZORPAY_KEY_SECRET = os.getenv("RAZORPAY_KEY_SECRET")

app = FastAPI(title="Push Notification Service")
DB_PATH = "push_tokens.db"

# Initialize the database and create the tokens table if it doesn't exist
def init_db():
    conn = sqlite3.connect(DB_PATH)
    conn.execute('''
        CREATE TABLE IF NOT EXISTS tokens (
            user_id TEXT PRIMARY KEY,
            token TEXT NOT NULL
        )
    ''')
    conn.commit()
    conn.close()

init_db()
# single client instance for Razorpay
razorpay_client = razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))


# Notification related request models
class RegisterTokenRequest(BaseModel):
    user_id: str | None
    token: str

class SendNotificationRequest(BaseModel):
    user_id: str | None
    title: str
    message: str
    data: Optional[dict] = None

class BroadcastRequest(BaseModel):
    title: str
    message: str
    data: Optional[dict] = None

# Razorpay related request models
class CreateOrderRequest(BaseModel):
    amount: int
    user_id: str | None

class VerifyPaymentRequest(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str
    user_id: str | None


@app.get("/api/health")
def health_check():
    return {"status": "ok"}


# Notification related endpoints
@app.post("/api/register-token")
def register_token(request: RegisterTokenRequest):
    conn = sqlite3.connect(DB_PATH)
    conn.execute("INSERT OR REPLACE INTO tokens (user_id, token) VALUES (?, ?)", (request.user_id, request.token))
    conn.commit()
    conn.close()

    return {"status": "success", "message": "Token registered successfully."}

def get_token_for_user(user_id: str) -> str | None:
    conn = sqlite3.connect(DB_PATH)
    row = conn.execute("SELECT token FROM tokens WHERE user_id = ?", (user_id,)).fetchone()
    conn.close()
    if row:
        return row[0]
    else:
        return None

def get_all_tokens() -> list[str]:
    conn = sqlite3.connect(DB_PATH)
    rows = conn.execute("SELECT token FROM tokens").fetchall()
    conn.close()
    return [row[0] for row in rows]

async def send_expo_push(tokens: list[str], title: str, body: str, data: Optional[dict] = None):

    if not tokens:
        raise HTTPException(status_code=400, detail="No tokens provided for push notification.")

    messages = [
        {
            "to": token,
            "sound": "default",
            "title": title,
            "body": body,
            "data": data or {}
        }
        for token in tokens
    ]

    headers = {"Content-Type": "application/json"}
    if EXPO_ACCESS_TOKEN:
        headers["Authorization"] = f"Bearer {EXPO_ACCESS_TOKEN}"

    async with httpx.AsyncClient() as client:
        response = await client.post(
            EXPO_PUSH_URL,
            json=messages,   # Expo ka API top-level pe seedha array expect karta hai, {"messages": [...]} wrapper nahi
            headers=headers,
            timeout=10,
        )
        
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail=f"Failed to send push notification: {response.text}")


@app.post("/api/notifications/send")
async def send_notification(request: SendNotificationRequest):
    token = get_token_for_user(request.user_id)
    if not token:
        raise HTTPException(status_code=404, detail="Token not found for the specified user_id.")

    await send_expo_push([token], request.title, request.message, request.data)
    return {"status": "success", "message": "Notification sent successfully."}


@app.post("/api/notifications/broadcast")
async def broadcast_notification(request: BroadcastRequest):
    tokens = get_all_tokens()
    if not tokens:
        raise HTTPException(status_code=404, detail="No tokens found for broadcasting.")

    await send_expo_push(tokens, request.title, request.message, request.data)
    return {"status": "success", "message": "Broadcast notification sent successfully."}



# Razorpay related endpoints
@app.post("/api/payments/create-order")
def create_order(request: CreateOrderRequest):
    # amount in paise (1 INR = 100 paise)
    # 1 means automatic capture of payment after authorization
    try:
        order_data = {
            "amount": request.amount * 100,  
            "currency": "INR",
            "payment_capture": 1
        }

        order = razorpay_client.order.create(data=order_data)
        return {
            "status": "success",
            "order_id": order["id"],
            "key_id": RAZORPAY_KEY_ID,
            "amount": order_data["amount"],
            "currency": order_data["currency"],
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create order: {str(e)}")

@app.post("/api/payments/verify-payment")
def verify_payment(request: VerifyPaymentRequest):
    try:
        razorpay_client.utility.verify_payment_signature({
            "razorpay_order_id": request.razorpay_order_id,
            "razorpay_payment_id": request.razorpay_payment_id,
            "razorpay_signature": request.razorpay_signature
        })


    except razorpay.errors.SignatureVerificationError as e:
        raise HTTPException(status_code=500, detail=f"Failed to verify payment: {str(e)}")


    conn = sqlite3.connect(DB_PATH)
    conn.execute("CREATE TABLE IF NOT EXISTS premium_users (user_id TEXT PRIMARY KEY, payment_id TEXT)")
    conn.execute("INSERT OR REPLACE INTO premium_users (user_id, payment_id) VALUES (?, ?)", (request.user_id, request.razorpay_payment_id))
    conn.commit()
    conn.close()

    return {"status": "success", "message": "Payment verified, premium unlocked"}