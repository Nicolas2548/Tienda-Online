from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel, EmailStr
import psycopg2, psycopg2.extras, os, jwt, bcrypt, datetime, uuid

app = FastAPI(title="UpvShop - Users Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://admin:secret123@db:5432/upvshop")
JWT_SECRET = os.getenv("JWT_SECRET", "upvshop-super-secret-jwt-key-2024")
JWT_ALGORITHM = "HS256"
JWT_EXP_HOURS = 24

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/login")

def get_db():
    conn = psycopg2.connect(DATABASE_URL)
    try:
        yield conn
    finally:
        conn.close()

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())

def create_token(user_id: int, email: str, role: str) -> str:
    payload = {
        "sub": str(user_id),
        "email": email,
        "role": role,
        "exp": datetime.datetime.utcnow() + datetime.timedelta(hours=JWT_EXP_HOURS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def get_current_user(token: str = Depends(oauth2_scheme)):
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expirado")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token inválido")

# --- Schemas ---
class UserCreate(BaseModel):
    name: str
    email: str
    password: str

class UserUpdate(BaseModel):
    name: str | None = None
    email: str | None = None

# --- Endpoints ---
@app.get("/health")
def health():
    return {"status": "ok", "service": "users-service"}

@app.post("/register", status_code=201)
def register(user: UserCreate, db=Depends(get_db)):
    cur = db.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute("SELECT id FROM users WHERE email = %s", (user.email,))
    if cur.fetchone():
        raise HTTPException(status_code=400, detail="El email ya está registrado")
    hashed = hash_password(user.password)
    cur.execute(
        "INSERT INTO users (name, email, password_hash) VALUES (%s, %s, %s) RETURNING id, name, email, role",
        (user.name, user.email, hashed)
    )
    new_user = cur.fetchone()
    db.commit()
    token = create_token(new_user["id"], new_user["email"], new_user["role"])
    return {"user": dict(new_user), "access_token": token, "token_type": "bearer"}

@app.post("/login")
def login(form: OAuth2PasswordRequestForm = Depends(), db=Depends(get_db)):
    cur = db.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute("SELECT * FROM users WHERE email = %s", (form.username,))
    user = cur.fetchone()
    if not user or not verify_password(form.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Credenciales inválidas")
    token = create_token(user["id"], user["email"], user["role"])
    return {"access_token": token, "token_type": "bearer", "user": {"id": user["id"], "name": user["name"], "email": user["email"], "role": user["role"]}}

@app.get("/me")
def get_me(current_user=Depends(get_current_user), db=Depends(get_db)):
    cur = db.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute("SELECT id, name, email, role, created_at FROM users WHERE id = %s", (current_user["sub"],))
    user = cur.fetchone()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    return dict(user)

@app.put("/me")
def update_me(data: UserUpdate, current_user=Depends(get_current_user), db=Depends(get_db)):
    cur = db.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    if data.name:
        cur.execute("UPDATE users SET name = %s WHERE id = %s", (data.name, current_user["sub"]))
    if data.email:
        cur.execute("UPDATE users SET email = %s WHERE id = %s", (data.email, current_user["sub"]))
    db.commit()
    cur.execute("SELECT id, name, email, role FROM users WHERE id = %s", (current_user["sub"],))
    return dict(cur.fetchone())

@app.get("/users")
def list_users(current_user=Depends(get_current_user), db=Depends(get_db)):
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Solo administradores")
    cur = db.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute("SELECT id, name, email, role, created_at FROM users ORDER BY created_at DESC")
    return cur.fetchall()

@app.post("/verify-token")
def verify_token(token: str = Depends(oauth2_scheme)):
    return get_current_user(token)
