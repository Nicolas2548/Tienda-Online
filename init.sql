-- UpvShop Database Schema

-- USERS
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'customer',
    created_at TIMESTAMP DEFAULT NOW()
);

-- PRODUCTS
CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    price NUMERIC(10,2) NOT NULL,
    stock INTEGER DEFAULT 0,
    category VARCHAR(100),
    image_url VARCHAR(500),
    created_at TIMESTAMP DEFAULT NOW()
);

-- CARTS
CREATE TABLE IF NOT EXISTS carts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cart_items (
    id SERIAL PRIMARY KEY,
    cart_id INTEGER REFERENCES carts(id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES products(id),
    quantity INTEGER NOT NULL DEFAULT 1,
    added_at TIMESTAMP DEFAULT NOW()
);

-- ORDERS
CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    total NUMERIC(10,2) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS order_items (
    id SERIAL PRIMARY KEY,
    order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES products(id),
    quantity INTEGER NOT NULL,
    unit_price NUMERIC(10,2) NOT NULL
);

-- PAYMENTS
CREATE TABLE IF NOT EXISTS payments (
    id SERIAL PRIMARY KEY,
    order_id INTEGER REFERENCES orders(id),
    amount NUMERIC(10,2) NOT NULL,
    method VARCHAR(50) DEFAULT 'card',
    status VARCHAR(50) DEFAULT 'pending',
    transaction_id VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Productos de muestra
INSERT INTO products (name, description, price, stock, category, image_url) VALUES
  ('Laptop Pro 15"',      'Laptop de alto rendimiento con procesador i7 y 16GB RAM',    1299.99, 20, 'Electronics',  'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=400&q=80'),
  ('Mouse Inalámbrico',   'Mouse ergonómico con 3 años de batería y DPI ajustable',       39.99,100, 'Electronics',  'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=400&q=80'),
  ('Teclado Mecánico',    'Teclado mecánico RGB con switches Cherry MX Red',              89.99, 50, 'Electronics',  'https://images.unsplash.com/photo-1541140532154-b024d705b90a?w=400&q=80'),
  ('Monitor 27" 4K',      'Monitor 4K IPS 144Hz con HDR y tiempo respuesta 1ms',        499.99, 15, 'Electronics',  'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=400&q=80'),
  ('Auriculares BT',      'Cancelación activa de ruido, 30h de batería, Hi-Res Audio',  149.99, 35, 'Electronics',  'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&q=80'),
  ('Mochila Laptop',      'Mochila impermeable para laptop hasta 17" con USB integrado', 59.99, 60, 'Accessories',  'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=400&q=80'),
  ('Webcam 1080p',        'Webcam Full HD 60fps con micrófono con cancelación de ruido', 79.99, 40, 'Electronics',  'https://images.unsplash.com/photo-1587826080692-f439cd0b70da?w=400&q=80'),
  ('Hub USB-C 7 en 1',    'Hub con HDMI 4K, 3x USB 3.0, SD, MicroSD y carga 100W',      45.99, 80, 'Electronics',  'https://images.unsplash.com/photo-1625842268584-8f3296236761?w=400&q=80'),
  ('SSD Externo 1TB',     'Unidad SSD portátil USB 3.2 Gen2, velocidad 1050 MB/s',       89.99, 45, 'Electronics',  'https://images.unsplash.com/photo-1597852074816-d933c7d2b988?w=400&q=80'),
  ('Silla Gamer Pro',     'Silla ergonómica con soporte lumbar y reposabrazos 4D',      299.99, 10, 'Furniture',    'https://images.unsplash.com/photo-1598550476439-6847785fcea6?w=400&q=80'),
  ('Desk Pad XL',         'Tapete de escritorio 90x40cm, base antideslizante',            19.99, 90, 'Accessories',  'https://images.unsplash.com/photo-1587202372775-e229f172b9d7?w=400&q=80'),
  ('Lámpara de Escritorio','Lámpara LED regulable con carga inalámbrica integrada',       49.99, 30, 'Furniture',    'https://images.unsplash.com/photo-1513506003901-1e6a35eed694?w=400&q=80'),
  ('Soporte para Monitor', 'Soporte articulado de aluminio con gestión de cables',        69.99, 25, 'Accessories',  'https://images.unsplash.com/photo-1527443195645-1133f7f28990?w=400&q=80'),
  ('Altavoces 2.1',        'Sistema de audio 2.1 con subwoofer, potencia 60W RMS',       119.99, 20, 'Electronics',  'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=400&q=80'),
  ('iPad Stand',           'Soporte ajustable de aluminio para tablet y teléfono',        24.99, 70, 'Accessories',  'https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=400&q=80')
ON CONFLICT DO NOTHING;
