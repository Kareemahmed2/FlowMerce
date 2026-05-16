-- =========================
-- USERS & ROLES
-- =========================

-- roles table kept for reference only
-- actual role is stored as enum directly in users table
CREATE TABLE IF NOT EXISTS roles (
                                     role_id   SERIAL PRIMARY KEY,
                                     role_name VARCHAR(50) UNIQUE
    );

CREATE TABLE IF NOT EXISTS users (
                                     user_id        SERIAL PRIMARY KEY,
                                     email          VARCHAR(255) UNIQUE NOT NULL,
    password_hash  VARCHAR(255) NOT NULL,
    full_name      VARCHAR(100),
    phone          VARCHAR(20),
    is_mfa_enabled BOOLEAN DEFAULT false,
    created_at     TIMESTAMP WITHOUT TIME ZONE,
    role           VARCHAR(50) NOT NULL  -- ADMIN, MERCHANT, BUYER, GUEST (Java enum)
    );

CREATE TABLE IF NOT EXISTS sessions (
                                        session_id SERIAL PRIMARY KEY,
                                        user_id    INT NOT NULL,
                                        token      VARCHAR(512) NOT NULL,
    is_revoked BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITHOUT TIME ZONE,
    expires_at TIMESTAMP WITHOUT TIME ZONE,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
    );

CREATE TABLE IF NOT EXISTS admins (
                                      admin_id SERIAL PRIMARY KEY,
                                      user_id  INT UNIQUE NOT NULL,
                                      FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
    );

CREATE TABLE IF NOT EXISTS customers (
                                         customer_id SERIAL PRIMARY KEY,
                                         user_id     INT UNIQUE NOT NULL,
                                         FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
    );

CREATE TABLE IF NOT EXISTS user_profiles (
                                             profile_id    SERIAL PRIMARY KEY,
                                             user_id       INT UNIQUE NOT NULL,
                                             address       TEXT,
                                             profile_image VARCHAR(255),
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
    );

-- =========================
-- MERCHANT & STORE
-- =========================

CREATE TABLE IF NOT EXISTS merchants (
                                         merchant_id   SERIAL PRIMARY KEY,
                                         user_id       INT UNIQUE NOT NULL,
                                         business_name VARCHAR(150),
    is_verified   BOOLEAN DEFAULT false,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
    );

CREATE TABLE IF NOT EXISTS stores (
                                      store_id    SERIAL PRIMARY KEY,
                                      merchant_id INT NOT NULL,
                                      store_name  VARCHAR(150) NOT NULL,
    store_url   VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    logo        VARCHAR(255),
    status      VARCHAR(50) DEFAULT 'DRAFT',  -- DRAFT, PUBLISHED, DEACTIVATED (Java enum)
    created_at  TIMESTAMP WITHOUT TIME ZONE,
    FOREIGN KEY (merchant_id) REFERENCES merchants(merchant_id) ON DELETE CASCADE
    );

CREATE TABLE IF NOT EXISTS store_settings (
                                              settings_id       SERIAL PRIMARY KEY,
                                              store_id          INT NOT NULL UNIQUE,
                                              currency          VARCHAR(10)  DEFAULT 'USD',
    timezone          VARCHAR(100) DEFAULT 'UTC',
    language          VARCHAR(20)  DEFAULT 'en',
    tax_settings      TEXT,
    shipping_settings TEXT,
    FOREIGN KEY (store_id) REFERENCES stores(store_id) ON DELETE CASCADE
    );

-- =========================
-- PRODUCTS & CATALOG
-- =========================

CREATE TABLE IF NOT EXISTS categories (
                                          category_id SERIAL PRIMARY KEY,
                                          name        VARCHAR(100) NOT NULL,
    description TEXT
    );

CREATE TABLE IF NOT EXISTS products (
                                        product_id  SERIAL PRIMARY KEY,
                                        store_id    INT NOT NULL,
                                        category_id INT,
                                        name        VARCHAR(150) NOT NULL,
    description TEXT,
    base_price  DECIMAL(10,2) NOT NULL,
    -- quantity removed from here
    -- actual quantity lives in inventory table (source of truth)
    is_active   BOOLEAN DEFAULT true,
    rating      FLOAT DEFAULT 0.0,
    created_at  TIMESTAMP WITHOUT TIME ZONE,
    updated_at  TIMESTAMP WITHOUT TIME ZONE,
    FOREIGN KEY (store_id)    REFERENCES stores(store_id)        ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES categories(category_id)
    );

CREATE TABLE IF NOT EXISTS product_media (
                                             media_id   SERIAL PRIMARY KEY,
                                             product_id INT NOT NULL,
                                             media_url  VARCHAR(255) NOT NULL,
    media_type VARCHAR(50) DEFAULT 'IMAGE',  -- IMAGE, VIDEO
    alt_text   VARCHAR(255),
    FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE CASCADE
    );

CREATE TABLE IF NOT EXISTS reviews (
                                       review_id   SERIAL PRIMARY KEY,
                                       product_id  INT NOT NULL,
                                       customer_id INT NOT NULL,
                                       rating      INT NOT NULL CHECK (rating BETWEEN 1 AND 5),  -- enforced at DB level
    title       VARCHAR(150),
    comment     TEXT,
    created_at  TIMESTAMP WITHOUT TIME ZONE,
    FOREIGN KEY (product_id)  REFERENCES products(product_id)   ON DELETE CASCADE,
    FOREIGN KEY (customer_id) REFERENCES customers(customer_id) ON DELETE CASCADE
    );

-- =========================
-- INVENTORY
-- =========================

CREATE TABLE IF NOT EXISTS inventory (
                                         inventory_id        SERIAL PRIMARY KEY,
                                         product_id          BIGINT NOT NULL UNIQUE,
                                         quantity            INT NOT NULL DEFAULT 0,      -- total available stock
                                         reserved_quantity   INT NOT NULL DEFAULT 0,      -- held during checkout process
                                         low_stock_threshold INT NOT NULL DEFAULT 10,     -- triggers SSE low stock alert
                                         version             INT NOT NULL DEFAULT 0,      -- optimistic locking (@Version)
                                         FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE CASCADE
    );

-- =========================
-- CART & CHECKOUT
-- =========================

-- one cart per customer, expires after 7 days of inactivity
-- CartCleanupScheduler runs at 2AM daily to delete expired carts
-- and release their reserved stock back to inventory
CREATE TABLE IF NOT EXISTS shopping_carts (
                                              cart_id     SERIAL PRIMARY KEY,
                                              customer_id INT NOT NULL UNIQUE,  -- one cart per customer
                                              created_at  TIMESTAMP WITHOUT TIME ZONE,
                                              expires_at  TIMESTAMP WITHOUT TIME ZONE,  -- set to now() + 7 days on creation
                                              FOREIGN KEY (customer_id) REFERENCES customers(customer_id) ON DELETE CASCADE
    );

CREATE TABLE IF NOT EXISTS cart_items (
                                          cart_item_id SERIAL PRIMARY KEY,
                                          cart_id      INT NOT NULL,
                                          product_id   INT NOT NULL,
                                          quantity     INT NOT NULL DEFAULT 1,
                                          price_at_add DECIMAL(10,2) NOT NULL,  -- price snapshot at the time of adding to cart
-- protects buyer if merchant changes price later
    added_at     TIMESTAMP WITHOUT TIME ZONE,
    FOREIGN KEY (cart_id)    REFERENCES shopping_carts(cart_id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(product_id)
    );

-- wishlist: buyer saves products to buy later
-- one product per user enforced by UNIQUE constraint
CREATE TABLE IF NOT EXISTS wishlists (
                                         wishlist_id SERIAL PRIMARY KEY,
                                         user_id     INT NOT NULL,
                                         product_id  INT NOT NULL,
                                         created_at  TIMESTAMP WITHOUT TIME ZONE,
                                         UNIQUE (user_id, product_id),  -- prevent duplicate wishlist entries
    FOREIGN KEY (user_id)    REFERENCES users(user_id)       ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE CASCADE
    );

-- =========================
-- ORDERS & PAYMENTS
-- =========================

CREATE TABLE IF NOT EXISTS orders (
                                      order_id         SERIAL PRIMARY KEY,
                                      customer_id      INT NOT NULL,
                                      store_id         INT NOT NULL,
                                      status           VARCHAR(50) DEFAULT 'PENDING',  -- PENDING, SHIPPED, DELIVERED, CANCELLED
    order_date       TIMESTAMP WITHOUT TIME ZONE,
    shipping_address TEXT,
    billing_address  TEXT,
    subtotal         DECIMAL(10,2),
    tax              DECIMAL(10,2) DEFAULT 0,  -- 0 for MVP, configurable via app.tax.rate
    shipping_cost    DECIMAL(10,2),            -- flat rate, configurable via app.shipping.flat-rate
    total            DECIMAL(10,2),
    payment_method   VARCHAR(50),  -- STRIPE, MADA, STC_PAY
    FOREIGN KEY (customer_id) REFERENCES customers(customer_id),
    FOREIGN KEY (store_id)    REFERENCES stores(store_id)
    );

CREATE TABLE IF NOT EXISTS order_items (
                                           order_item_id SERIAL PRIMARY KEY,
                                           order_id      INT NOT NULL,
                                           product_id    INT NOT NULL,
                                           quantity      INT NOT NULL,
                                           price         DECIMAL(10,2) NOT NULL,
    discount      DECIMAL(10,2) DEFAULT 0,
    tax           DECIMAL(10,2) DEFAULT 0,
    FOREIGN KEY (order_id)   REFERENCES orders(order_id)   ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(product_id)
    );

CREATE TABLE IF NOT EXISTS payments (
                                        payment_id     SERIAL PRIMARY KEY,
                                        order_id       INT NOT NULL,
                                        amount         DECIMAL(10,2) NOT NULL,
    payment_method VARCHAR(50),   -- STRIPE, MADA, STC_PAY
    transaction_id VARCHAR(255),
    status         VARCHAR(50),   -- PENDING, SUCCESS, FAILED, REFUNDED
    processed_at   TIMESTAMP WITHOUT TIME ZONE,
    FOREIGN KEY (order_id) REFERENCES orders(order_id)
    );

CREATE TABLE IF NOT EXISTS invoices (
                                        invoice_id SERIAL PRIMARY KEY,
                                        order_id   INT NOT NULL,
                                        issued_at  TIMESTAMP WITHOUT TIME ZONE,
                                        FOREIGN KEY (order_id) REFERENCES orders(order_id)
    );

-- =========================
-- DELIVERY & SHIPPING
-- =========================

CREATE TABLE IF NOT EXISTS delivery_providers (
                                                  provider_id  SERIAL PRIMARY KEY,
                                                  name         VARCHAR(150) NOT NULL,
    api_endpoint VARCHAR(255)
    );

CREATE TABLE IF NOT EXISTS shipments (
                                         shipment_id     SERIAL PRIMARY KEY,
                                         order_id        INT NOT NULL,
                                         provider_id     INT,
                                         tracking_number VARCHAR(255),
    shipped_date    TIMESTAMP WITHOUT TIME ZONE,
    delivery_date   TIMESTAMP WITHOUT TIME ZONE,
    status          VARCHAR(50),  -- PENDING, SHIPPED, DELIVERED, RETURNED
    FOREIGN KEY (order_id)    REFERENCES orders(order_id),
    FOREIGN KEY (provider_id) REFERENCES delivery_providers(provider_id)
    );

CREATE TABLE IF NOT EXISTS tracking_info (
                                             tracking_id SERIAL PRIMARY KEY,
                                             shipment_id INT NOT NULL,
                                             status      VARCHAR(100),
    location    VARCHAR(255),
    timestamp   TIMESTAMP WITHOUT TIME ZONE,
    FOREIGN KEY (shipment_id) REFERENCES shipments(shipment_id) ON DELETE CASCADE
    );

-- =========================
-- NOTIFICATIONS
-- =========================

CREATE TABLE IF NOT EXISTS notifications (
                                             notification_id SERIAL PRIMARY KEY,
                                             user_id         INT NOT NULL,
                                             type            VARCHAR(50),   -- ORDER_UPDATE, ACCOUNT_ACTIVITY, LOW_STOCK, SYSTEM_ALERT
    message         TEXT NOT NULL,
    channel         VARCHAR(50),   -- EMAIL, SMS, SSE
    status          VARCHAR(50) DEFAULT 'PENDING',  -- PENDING, SENT, FAILED
    sent_at         TIMESTAMP WITHOUT TIME ZONE,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
    );

-- =========================
-- AI ASSISTANT
-- =========================

CREATE TABLE IF NOT EXISTS ai_suggestions (
                                              suggestion_id SERIAL PRIMARY KEY,
                                              store_id      INT NOT NULL,
                                              type          VARCHAR(100),
    title         VARCHAR(255),
    description   TEXT,
    priority      VARCHAR(50),
    status        VARCHAR(50) DEFAULT 'PENDING',  -- PENDING, ACCEPTED, REJECTED
    created_at    TIMESTAMP WITHOUT TIME ZONE,
    FOREIGN KEY (store_id) REFERENCES stores(store_id) ON DELETE CASCADE
    );

-- =========================
-- ANALYTICS & REPORTS
-- =========================

CREATE TABLE IF NOT EXISTS analytics (
                                         analytics_id SERIAL PRIMARY KEY,
                                         store_id     INT NOT NULL,
                                         period       VARCHAR(50),  -- DAILY, WEEKLY, MONTHLY
    metrics      TEXT,         -- stored as JSON string
    FOREIGN KEY (store_id) REFERENCES stores(store_id) ON DELETE CASCADE
    );

CREATE TABLE IF NOT EXISTS sales_reports (
                                             report_id       SERIAL PRIMARY KEY,
                                             store_id        INT NOT NULL,
                                             date_range      VARCHAR(100),
    total_sales     DECIMAL(10,2),
    order_count     INT,
    avg_order_value DECIMAL(10,2),
    generated_at    TIMESTAMP WITHOUT TIME ZONE,
    FOREIGN KEY (store_id) REFERENCES stores(store_id) ON DELETE CASCADE
    );