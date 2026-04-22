from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel
import psycopg2, psycopg2.extras, os, jwt

app = FastAPI(title="UpvShop - Cart Service", version="1.0.0")

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

def get_or_create_cart(user_id: int, db) -> int:
    cur = db.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute("SELECT id FROM carts WHERE user_id = %s", (user_id,))
    cart = cur.fetchone()
    if cart:
        return cart["id"]
    cur.execute("INSERT INTO carts (user_id) VALUES (%s) RETURNING id", (user_id,))
    cart_id = cur.fetchone()["id"]
    db.commit()
    return cart_id

class CartItemAdd(BaseModel):
    product_id: int
    quantity: int = 1

class CartItemUpdate(BaseModel):
    quantity: int

@app.get("/health")
def health():
    return {"status": "ok", "service": "cart-service"}

@app.get("/cart")
def get_cart(user=Depends(get_current_user), db=Depends(get_db)):
    user_id = int(user["sub"])
    cart_id = get_or_create_cart(user_id, db)
    cur = db.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute("""
        SELECT ci.id, ci.quantity, ci.added_at,
               p.id as product_id, p.name, p.price, p.image_url, p.stock
        FROM cart_items ci
        JOIN products p ON ci.product_id = p.id
        WHERE ci.cart_id = %s
        ORDER BY ci.added_at DESC
    """, (cart_id,))
    items = cur.fetchall()
    total = sum(float(item["price"]) * item["quantity"] for item in items)
    return {
        "cart_id": cart_id,
        "items": [dict(i) for i in items],
        "total": round(total, 2),
        "item_count": len(items)
    }

@app.post("/cart/items", status_code=201)
def add_item(item: CartItemAdd, user=Depends(get_current_user), db=Depends(get_db)):
    user_id = int(user["sub"])
    cart_id = get_or_create_cart(user_id, db)
    cur = db.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    # Check product exists and has stock
    cur.execute("SELECT id, stock FROM products WHERE id = %s", (item.product_id,))
    product = cur.fetchone()
    if not product:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    if product["stock"] < item.quantity:
        raise HTTPException(status_code=400, detail="Stock insuficiente")

    # If already in cart, update quantity
    cur.execute("SELECT id, quantity FROM cart_items WHERE cart_id = %s AND product_id = %s", (cart_id, item.product_id))
    existing = cur.fetchone()
    if existing:
        new_qty = existing["quantity"] + item.quantity
        cur.execute("UPDATE cart_items SET quantity = %s WHERE id = %s RETURNING *", (new_qty, existing["id"]))
    else:
        cur.execute(
            "INSERT INTO cart_items (cart_id, product_id, quantity) VALUES (%s, %s, %s) RETURNING *",
            (cart_id, item.product_id, item.quantity)
        )
    db.commit()
    return {"message": "Producto agregado al carrito"}

@app.put("/cart/items/{item_id}")
def update_item(item_id: int, data: CartItemUpdate, user=Depends(get_current_user), db=Depends(get_db)):
    user_id = int(user["sub"])
    cart_id = get_or_create_cart(user_id, db)
    cur = db.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    if data.quantity <= 0:
        raise HTTPException(status_code=400, detail="La cantidad debe ser mayor a 0")
    cur.execute(
        "UPDATE cart_items SET quantity = %s WHERE id = %s AND cart_id = %s RETURNING *",
        (data.quantity, item_id, cart_id)
    )
    updated = cur.fetchone()
    if not updated:
        raise HTTPException(status_code=404, detail="Item no encontrado en el carrito")
    db.commit()
    return dict(updated)

@app.delete("/cart/items/{item_id}", status_code=204)
def remove_item(item_id: int, user=Depends(get_current_user), db=Depends(get_db)):
    user_id = int(user["sub"])
    cart_id = get_or_create_cart(user_id, db)
    cur = db.cursor()
    cur.execute("DELETE FROM cart_items WHERE id = %s AND cart_id = %s", (item_id, cart_id))
    if cur.rowcount == 0:
        raise HTTPException(status_code=404, detail="Item no encontrado")
    db.commit()

@app.delete("/cart", status_code=204)
def clear_cart(user=Depends(get_current_user), db=Depends(get_db)):
    user_id = int(user["sub"])
    cart_id = get_or_create_cart(user_id, db)
    cur = db.cursor()
    cur.execute("DELETE FROM cart_items WHERE cart_id = %s", (cart_id,))
    db.commit()
