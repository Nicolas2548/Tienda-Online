from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel
import psycopg2, psycopg2.extras, os, jwt, httpx

app = FastAPI(title="UpvShop - Order Service", version="1.0.0")

app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://admin:secret123@db:5432/upvshop")
JWT_SECRET = os.getenv("JWT_SECRET", "upvshop-super-secret-jwt-key-2024")
PAYMENT_SERVICE_URL = os.getenv("PAYMENT_SERVICE_URL", "http://payment-service:8000")

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

class OrderCreate(BaseModel):
    items: list[dict]  # [{product_id, quantity}]

class OrderStatusUpdate(BaseModel):
    status: str  # pending, processing, shipped, delivered, cancelled

VALID_STATUSES = ["pending", "processing", "shipped", "delivered", "cancelled"]

@app.get("/health")
def health():
    return {"status": "ok", "service": "order-service"}

@app.post("/orders", status_code=201)
def create_order(data: OrderCreate, user=Depends(get_current_user), db=Depends(get_db)):
    user_id = int(user["sub"])
    cur = db.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    if not data.items:
        raise HTTPException(status_code=400, detail="La orden debe tener al menos un producto")

    total = 0.0
    order_items = []

    for item in data.items:
        cur.execute("SELECT id, name, price, stock FROM products WHERE id = %s", (item["product_id"],))
        product = cur.fetchone()
        if not product:
            raise HTTPException(status_code=404, detail=f"Producto {item['product_id']} no encontrado")
        if product["stock"] < item["quantity"]:
            raise HTTPException(status_code=400, detail=f"Stock insuficiente para {product['name']}")
        total += float(product["price"]) * item["quantity"]
        order_items.append({
            "product_id": item["product_id"],
            "quantity": item["quantity"],
            "unit_price": float(product["price"])
        })

    # Create order
    cur.execute(
        "INSERT INTO orders (user_id, total, status) VALUES (%s, %s, 'pending') RETURNING id",
        (user_id, round(total, 2))
    )
    order_id = cur.fetchone()["id"]

    # Insert order items and reduce stock
    for item in order_items:
        cur.execute(
            "INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES (%s, %s, %s, %s)",
            (order_id, item["product_id"], item["quantity"], item["unit_price"])
        )
        cur.execute(
            "UPDATE products SET stock = stock - %s WHERE id = %s",
            (item["quantity"], item["product_id"])
        )

    db.commit()
    return {"order_id": order_id, "total": round(total, 2), "status": "pending", "message": "Orden creada exitosamente"}

@app.get("/orders")
def list_orders(user=Depends(get_current_user), db=Depends(get_db)):
    user_id = int(user["sub"])
    cur = db.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute(
        "SELECT * FROM orders WHERE user_id = %s ORDER BY created_at DESC",
        (user_id,)
    )
    orders = cur.fetchall()
    return [dict(o) for o in orders]

@app.get("/orders/{order_id}")
def get_order(order_id: int, user=Depends(get_current_user), db=Depends(get_db)):
    user_id = int(user["sub"])
    cur = db.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute("SELECT * FROM orders WHERE id = %s", (order_id,))
    order = cur.fetchone()
    if not order:
        raise HTTPException(status_code=404, detail="Orden no encontrada")
    if order["user_id"] != user_id and user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="No autorizado")

    cur.execute("""
        SELECT oi.*, p.name as product_name, p.image_url
        FROM order_items oi
        JOIN products p ON oi.product_id = p.id
        WHERE oi.order_id = %s
    """, (order_id,))
    items = cur.fetchall()
    result = dict(order)
    result["items"] = [dict(i) for i in items]
    return result

@app.put("/orders/{order_id}/status")
def update_order_status(order_id: int, data: OrderStatusUpdate, user=Depends(get_current_user), db=Depends(get_db)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Solo administradores pueden cambiar el estado")
    if data.status not in VALID_STATUSES:
        raise HTTPException(status_code=400, detail=f"Estado inválido. Válidos: {VALID_STATUSES}")
    cur = db.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute(
        "UPDATE orders SET status = %s, updated_at = NOW() WHERE id = %s RETURNING *",
        (data.status, order_id)
    )
    updated = cur.fetchone()
    if not updated:
        raise HTTPException(status_code=404, detail="Orden no encontrada")
    db.commit()
    return dict(updated)

@app.get("/orders/admin/all")
def all_orders(user=Depends(get_current_user), db=Depends(get_db)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Solo administradores")
    cur = db.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute("SELECT * FROM orders ORDER BY created_at DESC")
    return [dict(o) for o in cur.fetchall()]
