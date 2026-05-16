-- =========================
-- USERS & ROLES
-- =========================

CREATE TABLE IF NOT EXISTS roles  (
  role_id SERIAL PRIMARY KEY,
  role_name VARCHAR(50) UNIQUE   -- Admin, Merchant, Buyer, Guest,,,add unique without it the ON CONFLICT (role_name) in data.sql will throw an error
);

CREATE TABLE IF NOT EXISTS users (
  user_id SERIAL PRIMARY KEY,
  role_id INT,
  email VARCHAR(255) UNIQUE,
  password_hash VARCHAR(255),
  full_name VARCHAR(100),
  phone VARCHAR(20),
  is_mfa_enabled BOOLEAN,
  created_at TIMESTAMP WITHOUT TIME ZONE,
  FOREIGN KEY (role_id) REFERENCES roles(role_id)
);

CREATE TABLE IF NOT EXISTS sessions (
  session_id SERIAL PRIMARY KEY,
  user_id INT NOT NULL,
  token VARCHAR(512) NOT NULL,
  is_revoked BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITHOUT TIME ZONE,
  expires_at TIMESTAMP WITHOUT TIME ZONE,
  FOREIGN KEY (user_id) REFERENCES users(user_id)
);

CREATE TABLE IF NOT EXISTS admins (
  admin_id SERIAL PRIMARY KEY,
  user_id INT UNIQUE NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(user_id)
);

CREATE TABLE IF NOT EXISTS customers (
  customer_id SERIAL PRIMARY KEY,
  user_id INT UNIQUE NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(user_id)
);

CREATE TABLE IF NOT EXISTS user_profiles (
  profile_id SERIAL PRIMARY KEY,
  user_id INT,
  address TEXT,
  profile_image VARCHAR(255),
  FOREIGN KEY (user_id) REFERENCES users(user_id)
);

-- =========================
-- MERCHANT & STORE
-- =========================

CREATE TABLE IF NOT EXISTS merchants (
  merchant_id SERIAL PRIMARY KEY,
  user_id INT,
  business_name VARCHAR(150),
  is_verified BOOLEAN,
  FOREIGN KEY (user_id) REFERENCES users(user_id)
);

CREATE TABLE IF NOT EXISTS stores (
  store_id    SERIAL PRIMARY KEY,
  merchant_id INT NOT NULL,
  store_name  VARCHAR(150) NOT NULL,
  store_url   VARCHAR(255) UNIQUE,
  description TEXT,
  logo        VARCHAR(255),
  status      VARCHAR(50) DEFAULT 'DRAFT',
  created_at  TIMESTAMP WITHOUT TIME ZONE,
  FOREIGN KEY (merchant_id) REFERENCES merchants(merchant_id)
);

CREATE TABLE IF NOT EXISTS store_settings (
  settings_id       SERIAL PRIMARY KEY,
  store_id          INT NOT NULL UNIQUE,
  currency          VARCHAR(10)  DEFAULT 'USD',
  timezone          VARCHAR(100) DEFAULT 'UTC',
  language          VARCHAR(20)  DEFAULT 'en',
  tax_settings      TEXT,
  shipping_settings TEXT,
  FOREIGN KEY (store_id) REFERENCES stores(store_id)
);


-- =========================
-- PRODUCTS & CATALOG
-- =========================

CREATE TABLE IF NOT EXISTS categories (
  category_id SERIAL PRIMARY KEY,
  name VARCHAR(100)
);

CREATE TABLE IF NOT EXISTS products (
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

CREATE TABLE IF NOT EXISTS product_media (
  media_id SERIAL PRIMARY KEY,
  product_id INT,
  media_url VARCHAR(255),
  FOREIGN KEY (product_id) REFERENCES products(product_id)
);

CREATE TABLE IF NOT EXISTS reviews (
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

CREATE TABLE IF NOT EXISTS carts (
  cart_id SERIAL PRIMARY KEY,
  user_id INT,
  created_at TIMESTAMP WITHOUT TIME ZONE,
  FOREIGN KEY (user_id) REFERENCES users(user_id)
);

CREATE TABLE IF NOT EXISTS cart_items (
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

CREATE TABLE IF NOT EXISTS orders (
  order_id SERIAL PRIMARY KEY,
  user_id INT,
  store_id INT,
  status VARCHAR(50), -- Pending, Shipped, Delivered
  total_amount DECIMAL(10,2),
  created_at TIMESTAMP WITHOUT TIME ZONE,
  FOREIGN KEY (user_id) REFERENCES users(user_id),
  FOREIGN KEY (store_id) REFERENCES stores(store_id)
);

CREATE TABLE IF NOT EXISTS order_items (
  order_item_id SERIAL PRIMARY KEY,
  order_id INT,
  product_id INT,
  quantity INT,
  price DECIMAL(10,2),
  FOREIGN KEY (order_id) REFERENCES orders(order_id),
  FOREIGN KEY (product_id) REFERENCES products(product_id)
);

CREATE TABLE IF NOT EXISTS payments (
  payment_id SERIAL PRIMARY KEY,
  order_id INT,
  payment_method VARCHAR(50), -- Stripe, Mada, STC Pay
  payment_status VARCHAR(50),
  paid_at TIMESTAMP WITHOUT TIME ZONE,
  FOREIGN KEY (order_id) REFERENCES orders(order_id)
);

CREATE TABLE IF NOT EXISTS invoices (
  invoice_id SERIAL PRIMARY KEY,
  order_id INT,
  issued_at TIMESTAMP WITHOUT TIME ZONE,
  FOREIGN KEY (order_id) REFERENCES orders(order_id)
);

-- =========================
-- DELIVERY SERVICE PROVIDER
-- =========================

CREATE TABLE IF NOT EXISTS delivery_providers (
  dsp_id SERIAL PRIMARY KEY,
  company_name VARCHAR(150)
);

CREATE TABLE IF NOT EXISTS deliveries (
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

CREATE TABLE IF NOT EXISTS ai_suggestions (
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

CREATE TABLE IF NOT EXISTS notifications (
  notification_id SERIAL PRIMARY KEY,
  user_id INT,
  message TEXT,
  channel VARCHAR(50), -- Email, SMS, WhatsApp
  sent_at TIMESTAMP WITHOUT TIME ZONE,
  FOREIGN KEY (user_id) REFERENCES users(user_id)
);

-- ===================================
-- STOREFRONT CUSTOMIZATION
-- ===================================

-- Six theme colour tokens (spec §3.3): background, header, footer, accent, text, card.
-- One ThemeTemplate belongs to one StorefrontTemplate (1:1, owned side).
CREATE TABLE IF NOT EXISTS theme_templates (
  theme_id    SERIAL PRIMARY KEY,
  background  VARCHAR(7)  NOT NULL DEFAULT '#FFFFFF',
  header      VARCHAR(7)  NOT NULL DEFAULT '#1A1A2E',
  footer      VARCHAR(7)  NOT NULL DEFAULT '#16213E',
  accent      VARCHAR(7)  NOT NULL DEFAULT '#E94560',
  text_color  VARCHAR(7)  NOT NULL DEFAULT '#1A1A1A',
  card        VARCHAR(7)  NOT NULL DEFAULT '#F9F9F9',
  created_at  TIMESTAMP WITHOUT TIME ZONE,
  updated_at  TIMESTAMP WITHOUT TIME ZONE
);

-- Top-level aggregate for a merchant's storefront presentation.
-- One Store → One StorefrontTemplate (1:1, unique on store_id).
CREATE TABLE IF NOT EXISTS storefront_templates (
  template_id  SERIAL PRIMARY KEY,
  store_id     INT  NOT NULL UNIQUE,
  theme_id     INT,
  status       VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
  version      INT         NOT NULL DEFAULT 1,
  published_at TIMESTAMP WITHOUT TIME ZONE,
  created_at   TIMESTAMP WITHOUT TIME ZONE,
  updated_at   TIMESTAMP WITHOUT TIME ZONE,
  FOREIGN KEY (store_id) REFERENCES stores(store_id)  ON DELETE CASCADE,
  FOREIGN KEY (theme_id) REFERENCES theme_templates(theme_id) ON DELETE SET NULL
);

-- Individual navigable pages within a storefront.
-- Slug must be unique per storefront. "home" is reserved and auto-created.
CREATE TABLE IF NOT EXISTS storefront_pages (
  page_id          SERIAL PRIMARY KEY,
  storefront_id    INT          NOT NULL,
  title            VARCHAR(100) NOT NULL,
  slug             VARCHAR(100) NOT NULL,
  page_type        VARCHAR(20)  NOT NULL DEFAULT 'CUSTOM',
  is_published     BOOLEAN      NOT NULL DEFAULT false,
  meta_description VARCHAR(300),
  nav_order        INT          NOT NULL DEFAULT 0,
  show_in_nav      BOOLEAN      NOT NULL DEFAULT true,
  created_at       TIMESTAMP WITHOUT TIME ZONE,
  updated_at       TIMESTAMP WITHOUT TIME ZONE,
  FOREIGN KEY (storefront_id) REFERENCES storefront_templates(template_id) ON DELETE CASCADE,
  CONSTRAINT uq_storefront_page_slug UNIQUE (storefront_id, slug)
);

-- Atomic UI elements placed on a storefront page.
-- is_visible is the core flag: false hides the component from the frontend renderer.
-- content is a JSON string whose schema varies per component_type.
CREATE TABLE IF NOT EXISTS base_components (
  component_id   SERIAL PRIMARY KEY,
  store_id       INT          NOT NULL,
  page_id        INT          NOT NULL,
  component_type VARCHAR(50)  NOT NULL,
  name           VARCHAR(100) NOT NULL,
  content        TEXT,
  sort_order     INT          NOT NULL DEFAULT 0,
  is_visible     BOOLEAN      NOT NULL DEFAULT true,
  created_at     TIMESTAMP WITHOUT TIME ZONE,
  updated_at     TIMESTAMP WITHOUT TIME ZONE,
  FOREIGN KEY (store_id) REFERENCES stores(store_id) ON DELETE CASCADE,
  FOREIGN KEY (page_id)  REFERENCES storefront_pages(page_id) ON DELETE CASCADE
);

-- =========================
-- ANALYTICS & REPORTS
-- =========================

CREATE TABLE IF NOT EXISTS reports (
  report_id SERIAL PRIMARY KEY,
  store_id INT,
  report_type VARCHAR(100),
  generated_at TIMESTAMP WITHOUT TIME ZONE,
  FOREIGN KEY (store_id) REFERENCES stores(store_id)
);