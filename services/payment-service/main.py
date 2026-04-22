from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel
import psycopg2, psycopg2.extras, os, jwt, random, string, datetime

app = FastAPI(title="UpvShop - Payment Service", version="1.0.0")

app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://admin:secret123@db:5432/upvshop")
JWT_SECRET = os.getenv("JWT_SECRET", "upvshop-super-secret-jwt-key-2024")

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="http://users-service:8000/login")

def get_db():
    conn = psycopg2.connect(DATABASE_URL)
    try:
        yield conn
    finally:
        conn.close()

def get_current_user(token: str = Depends(oauth2_scheme)):
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expirado")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token inválido")

def generate_transaction_id():
    return "TXN-" + "".join(random.choices(string.ascii_uppercase + string.digits, k=12))

def simulate_payment(method: str, amount: float) -> dict:
    """Simulates payment processing. 90% success rate."""
    success = random.random() > 0.1
    return {
        "success": success,
        "transaction_id": generate_transaction_id() if success else None,
        "message": "Pago procesado exitosamente" if success else "Pago rechazado por el banco"
    }

class PaymentRequest(BaseModel):
    order_id: int
    method: str = "card"  # card, paypal, transfer

class PaymentConfirm(BaseModel):
    payment_id: int

@app.get("/health")
def health():
    return {"status": "ok", "service": "payment-service"}

@app.post("/payments/process", status_code=201)
def process_payment(data: PaymentRequest, user=Depends(get_current_user), db=Depends(get_db)):
    user_id = int(user["sub"])
    cur = db.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    # Verify order exists and belongs to user
    cur.execute("SELECT * FROM orders WHERE id = %s AND user_id = %s", (data.order_id, user_id))
    order = cur.fetchone()
    if not order:
        raise HTTPException(status_code=404, detail="Orden no encontrada")
    if order["status"] not in ["pending", "processing"]:
        raise HTTPException(status_code=400, detail=f"No se puede pagar una orden con estado: {order['status']}")

    # Check for existing payment
    cur.execute("SELECT * FROM payments WHERE order_id = %s AND status = 'completed'", (data.order_id,))
    if cur.fetchone():
        raise HTTPException(status_code=400, detail="Esta orden ya fue pagada")

    # Simulate payment
    result = simulate_payment(data.method, float(order["total"]))

    status = "completed" if result["success"] else "failed"
    cur.execute(
        "INSERT INTO payments (order_id, amount, method, status, transaction_id) VALUES (%s, %s, %s, %s, %s) RETURNING *",
        (data.order_id, order["total"], data.method, status, result["transaction_id"])
    )
    payment = cur.fetchone()

    # Update order status
    if result["success"]:
        cur.execute("UPDATE orders SET status = 'processing', updated_at = NOW() WHERE id = %s", (data.order_id,))

    db.commit()

    return {
        "payment_id": payment["id"],
        "order_id": data.order_id,
        "amount": float(order["total"]),
        "status": status,
        "transaction_id": result["transaction_id"],
        "message": result["message"],
        "method": data.method,
        "success": result["success"]
    }

@app.get("/payments/order/{order_id}")
def get_payment_by_order(order_id: int, user=Depends(get_current_user), db=Depends(get_db)):
    user_id = int(user["sub"])
    cur = db.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute("SELECT * FROM orders WHERE id = %s AND user_id = %s", (order_id, user_id))
    if not cur.fetchone():
        raise HTTPException(status_code=403, detail="No autorizado")
    cur.execute("SELECT * FROM payments WHERE order_id = %s ORDER BY created_at DESC", (order_id,))
    payments = cur.fetchall()
    return [dict(p) for p in payments]

@app.get("/payments/my")
def my_payments(user=Depends(get_current_user), db=Depends(get_db)):
    user_id = int(user["sub"])
    cur = db.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute("""
        SELECT p.*, o.user_id
        FROM payments p
        JOIN orders o ON p.order_id = o.id
        WHERE o.user_id = %s
        ORDER BY p.created_at DESC
    """, (user_id,))
    return [dict(p) for p in cur.fetchall()]

@app.get("/payments/admin/all")
def all_payments(user=Depends(get_current_user), db=Depends(get_db)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Solo administradores")
    cur = db.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute("SELECT * FROM payments ORDER BY created_at DESC")
    return [dict(p) for p in cur.fetchall()]
