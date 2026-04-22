from fastapi import FastAPI, HTTPException, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel
import psycopg2, psycopg2.extras, os, jwt

app = FastAPI(title="UpvShop - Catalog Service", version="1.0.0")

app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://admin:secret123@db:5432/upvshop")
JWT_SECRET = os.getenv("JWT_SECRET", "upvshop-super-secret-jwt-key-2024")

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="http://users-service:8000/login", auto_error=False)

def get_db():
    conn = psycopg2.connect(DATABASE_URL)
    try:
        yield conn
    finally:
        conn.close()

def get_current_user(token: str = Depends(oauth2_scheme)):
    if not token:
        return None
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
    except:
        return None

def require_admin(token: str = Depends(oauth2_scheme)):
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        if payload.get("role") != "admin":
            raise HTTPException(status_code=403, detail="Solo administradores")
        return payload
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token inválido")

class ProductCreate(BaseModel):
    name: str
    description: str | None = None
    price: float
    stock: int = 0
    category: str | None = None
    image_url: str | None = None

class ProductUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    price: float | None = None
    stock: int | None = None
    category: str | None = None
    image_url: str | None = None

@app.get("/health")
def health():
    return {"status": "ok", "service": "catalog-service"}

@app.get("/products")
def list_products(
    category: str | None = None,
    search: str | None = None,
    skip: int = 0,
    limit: int = 20,
    db=Depends(get_db)
):
    cur = db.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    query = "SELECT * FROM products WHERE 1=1"
    params = []
    if category:
        query += " AND category = %s"
        params.append(category)
    if search:
        query += " AND (name ILIKE %s OR description ILIKE %s)"
        params.extend([f"%{search}%", f"%{search}%"])
    query += " ORDER BY created_at DESC LIMIT %s OFFSET %s"
    params.extend([limit, skip])
    cur.execute(query, params)
    products = cur.fetchall()
    cur.execute("SELECT COUNT(*) FROM products WHERE 1=1")
    total = cur.fetchone()["count"]
    return {"products": [dict(p) for p in products], "total": total}

@app.get("/products/{product_id}")
def get_product(product_id: int, db=Depends(get_db)):
    cur = db.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute("SELECT * FROM products WHERE id = %s", (product_id,))
    product = cur.fetchone()
    if not product:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    return dict(product)

@app.get("/categories")
def list_categories(db=Depends(get_db)):
    cur = db.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute("SELECT DISTINCT category FROM products WHERE category IS NOT NULL ORDER BY category")
    return [row["category"] for row in cur.fetchall()]

@app.post("/products", status_code=201)
def create_product(product: ProductCreate, admin=Depends(require_admin), db=Depends(get_db)):
    cur = db.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute(
        "INSERT INTO products (name, description, price, stock, category, image_url) VALUES (%s,%s,%s,%s,%s,%s) RETURNING *",
        (product.name, product.description, product.price, product.stock, product.category, product.image_url)
    )
    new = cur.fetchone()
    db.commit()
    return dict(new)

@app.put("/products/{product_id}")
def update_product(product_id: int, data: ProductUpdate, admin=Depends(require_admin), db=Depends(get_db)):
    cur = db.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    fields = {k: v for k, v in data.model_dump().items() if v is not None}
    if not fields:
        raise HTTPException(status_code=400, detail="No hay campos para actualizar")
    set_clause = ", ".join(f"{k} = %s" for k in fields)
    cur.execute(f"UPDATE products SET {set_clause} WHERE id = %s RETURNING *", [*fields.values(), product_id])
    updated = cur.fetchone()
    if not updated:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    db.commit()
    return dict(updated)

@app.delete("/products/{product_id}", status_code=204)
def delete_product(product_id: int, admin=Depends(require_admin), db=Depends(get_db)):
    cur = db.cursor()
    cur.execute("DELETE FROM products WHERE id = %s", (product_id,))
    if cur.rowcount == 0:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    db.commit()
