-- =========================
-- USERS & ROLES
-- =========================

CREATE TABLE roles (
  role_id SERIAL PRIMARY KEY,
  role_name VARCHAR(50) -- Admin, Merchant, Buyer, Guest
);

CREATE TABLE users (
  user_id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE,
  password_hash VARCHAR(255),
  full_name VARCHAR(100),
  phone VARCHAR(20),
  is_mfa_enabled BOOLEAN,
  created_at TIMESTAMP WITHOUT TIME ZONE,
  role_id INT,
  FOREIGN KEY (role_id) REFERENCES roles(role_id)
);

CREATE TABLE user_profiles (
  profile_id SERIAL PRIMARY KEY,
  user_id INT,
  address TEXT,
  profile_image VARCHAR(255),
  FOREIGN KEY (user_id) REFERENCES users(user_id)
);

-- =========================
-- MERCHANT & STORE
-- =========================

CREATE TABLE merchants (
  merchant_id SERIAL PRIMARY KEY,
  user_id INT,
  business_name VARCHAR(150),
  is_verified BOOLEAN,
  FOREIGN KEY (user_id) REFERENCES users(user_id)
);

CREATE TABLE stores (
  store_id SERIAL PRIMARY KEY,
  merchant_id INT,
  store_name VARCHAR(150),
  theme VARCHAR(100),
  status VARCHAR(50), -- Draft, Published
  created_at TIMESTAMP WITHOUT TIME ZONE,
  FOREIGN KEY (merchant_id) REFERENCES merchants(merchant_id)
);

-- =========================
-- PRODUCTS & CATALOG
-- =========================

CREATE TABLE categories (
  category_id SERIAL PRIMARY KEY,
  name VARCHAR(100)
);

CREATE TABLE products (
  product_id SERIAL PRIMARY KEY,
  store_id INT,
  category_id INT,
  name VARCHAR(150),
  description TEXT,
  price DECIMAL(10,2),
  inventory INT,
  rating FLOAT,
  FOREIGN KEY (store_id) REFERENCES stores(store_id),
  FOREIGN KEY (category_id) REFERENCES categories(category_id)
);

CREATE TABLE product_media (
  media_id SERIAL PRIMARY KEY,
  product_id INT,
  media_url VARCHAR(255),
  FOREIGN KEY (product_id) REFERENCES products(product_id)
);

CREATE TABLE reviews (
  review_id SERIAL PRIMARY KEY,
  product_id INT,
  user_id INT,
  rating INT,
  comment TEXT,
  created_at TIMESTAMP WITHOUT TIME ZONE,
  FOREIGN KEY (product_id) REFERENCES products(product_id),
  FOREIGN KEY (user_id) REFERENCES users(user_id)
);

-- =========================
-- CART & CHECKOUT
-- =========================

CREATE TABLE carts (
  cart_id SERIAL PRIMARY KEY,
  user_id INT,
  created_at TIMESTAMP WITHOUT TIME ZONE,
  FOREIGN KEY (user_id) REFERENCES users(user_id)
);

CREATE TABLE cart_items (
  cart_item_id SERIAL PRIMARY KEY,
  cart_id INT,
  product_id INT,
  quantity INT,
  FOREIGN KEY (cart_id) REFERENCES carts(cart_id),
  FOREIGN KEY (product_id) REFERENCES products(product_id)
);

-- =========================
-- ORDERS & PAYMENTS
-- =========================

CREATE TABLE orders (
  order_id SERIAL PRIMARY KEY,
  user_id INT,
  store_id INT,
  status VARCHAR(50), -- Pending, Shipped, Delivered
  total_amount DECIMAL(10,2),
  created_at TIMESTAMP WITHOUT TIME ZONE,
  FOREIGN KEY (user_id) REFERENCES users(user_id),
  FOREIGN KEY (store_id) REFERENCES stores(store_id)
);

CREATE TABLE order_items (
  order_item_id SERIAL PRIMARY KEY,
  order_id INT,
  product_id INT,
  quantity INT,
  price DECIMAL(10,2),
  FOREIGN KEY (order_id) REFERENCES orders(order_id),
  FOREIGN KEY (product_id) REFERENCES products(product_id)
);

CREATE TABLE payments (
  payment_id SERIAL PRIMARY KEY,
  order_id INT,
  payment_method VARCHAR(50), -- Stripe, Mada, STC Pay
  payment_status VARCHAR(50),
  paid_at TIMESTAMP WITHOUT TIME ZONE,
  FOREIGN KEY (order_id) REFERENCES orders(order_id)
);

CREATE TABLE invoices (
  invoice_id SERIAL PRIMARY KEY,
  order_id INT,
  issued_at TIMESTAMP WITHOUT TIME ZONE,
  FOREIGN KEY (order_id) REFERENCES orders(order_id)
);

-- =========================
-- DELIVERY SERVICE PROVIDER
-- =========================

CREATE TABLE delivery_providers (
  dsp_id SERIAL PRIMARY KEY,
  company_name VARCHAR(150)
);

CREATE TABLE deliveries (
  delivery_id SERIAL PRIMARY KEY,
  order_id INT,
  dsp_id INT,
  delivery_status VARCHAR(50),
  FOREIGN KEY (order_id) REFERENCES orders(order_id),
  FOREIGN KEY (dsp_id) REFERENCES delivery_providers(dsp_id)
);

-- =========================
-- AI ASSISTANT
-- =========================

CREATE TABLE ai_suggestions (
  suggestion_id SERIAL PRIMARY KEY,
  store_id INT,
  suggestion_text TEXT,
  accepted BOOLEAN,
  created_at TIMESTAMP WITHOUT TIME ZONE,
  FOREIGN KEY (store_id) REFERENCES stores(store_id)
);

-- =========================
-- NOTIFICATIONS
-- =========================

CREATE TABLE notifications (
  notification_id SERIAL PRIMARY KEY,
  user_id INT,
  message TEXT,
  channel VARCHAR(50), -- Email, SMS, WhatsApp
  sent_at TIMESTAMP WITHOUT TIME ZONE,
  FOREIGN KEY (user_id) REFERENCES users(user_id)
);

-- =========================
-- ANALYTICS & REPORTS
-- =========================

CREATE TABLE reports (
  report_id SERIAL PRIMARY KEY,
  store_id INT,
  report_type VARCHAR(100),
  generated_at TIMESTAMP WITHOUT TIME ZONE,
  FOREIGN KEY (store_id) REFERENCES stores(store_id)
);