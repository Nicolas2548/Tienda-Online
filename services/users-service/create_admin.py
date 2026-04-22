import bcrypt, psycopg2, os, time, sys

print("Esperando base de datos...")
for i in range(30):
    try:
        conn = psycopg2.connect(os.getenv("DATABASE_URL"))
        break
    except Exception:
        time.sleep(2)
else:
    print("No se pudo conectar a la BD")
    sys.exit(1)

pw = bcrypt.hashpw(b"Admin123!", bcrypt.gensalt()).decode()
cur = conn.cursor()
cur.execute("""
    INSERT INTO users (name, email, password_hash, role)
    VALUES ('Administrador', 'admin@upvshop.com', %s, 'admin')
    ON CONFLICT (email) DO UPDATE SET password_hash = %s, role = 'admin'
""", (pw, pw))
conn.commit()
conn.close()
print("Admin creado: admin@upvshop.com / Admin123!")
