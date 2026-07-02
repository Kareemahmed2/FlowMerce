-- =========================
-- USERS & ROLES
-- =========================

-- roles table removed — role is stored as VARCHAR in users.role column

CREATE TABLE IF NOT EXISTS users (
                                     user_id        SERIAL PRIMARY KEY,
                                     email          VARCHAR(255) UNIQUE NOT NULL,
    password_hash  VARCHAR(255) NOT NULL,
    full_name      VARCHAR(100),
    phone          VARCHAR(20),
    role           VARCHAR(50)  NOT NULL DEFAULT 'BUYER',
    is_active      BOOLEAN      NOT NULL DEFAULT FALSE,
    is_mfa_enabled BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at     TIMESTAMP WITHOUT TIME ZONE
    );

CREATE TABLE IF NOT EXISTS sessions (
                                        session_id SERIAL PRIMARY KEY,
                                        user_id    INT NOT NULL,
                                        token      VARCHAR(512) NOT NULL,
    is_revoked BOOLEAN      DEFAULT false,
    created_at TIMESTAMP WITHOUT TIME ZONE,
    expires_at TIMESTAMP WITHOUT TIME ZONE,
    FOREIGN KEY (user_id) REFERENCES users(user_id)
    );

CREATE TABLE IF NOT EXISTS verification_tokens (
                                                   token      VARCHAR(255) PRIMARY KEY,
    email      VARCHAR(255) NOT NULL,
    type       VARCHAR(30)  NOT NULL,
    expires_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    used       BOOLEAN      NOT NULL DEFAULT FALSE
    );

CREATE TABLE IF NOT EXISTS admins (
                                      admin_id SERIAL PRIMARY KEY,
                                      user_id  INT UNIQUE NOT NULL,
                                      FOREIGN KEY (user_id) REFERENCES users(user_id)
    );

CREATE TABLE IF NOT EXISTS customers (
                                         customer_id SERIAL PRIMARY KEY,
                                         user_id     INT UNIQUE NOT NULL,
                                         FOREIGN KEY (user_id) REFERENCES users(user_id)
    );

CREATE TABLE IF NOT EXISTS user_profiles (
                                             profile_id    SERIAL PRIMARY KEY,
                                             user_id       INT,
                                             address       TEXT,
                                             profile_image VARCHAR(255),
    FOREIGN KEY (user_id) REFERENCES users(user_id)
    );

-- =========================
-- MERCHANT & STORE
-- =========================

CREATE TABLE IF NOT EXISTS merchants (
                                         merchant_id   SERIAL PRIMARY KEY,
                                         user_id       INT,
                                         business_name VARCHAR(150),
    is_verified   BOOLEAN,
    FOREIGN KEY (user_id) REFERENCES users(user_id)
    );

CREATE TABLE IF NOT EXISTS stores (
                                      store_id        SERIAL PRIMARY KEY,
                                      merchant_id     INT NOT NULL,
                                      store_name      VARCHAR(150) NOT NULL,
    store_url       VARCHAR(255) UNIQUE,
    description     TEXT,
    logo            VARCHAR(255),
    status          VARCHAR(50)  DEFAULT 'DRAFT',
    current_step    INT          NOT NULL DEFAULT 0,
    payment_methods TEXT,
    created_at      TIMESTAMP WITHOUT TIME ZONE,
    FOREIGN KEY (merchant_id) REFERENCES merchants(merchant_id)
    );

CREATE TABLE IF NOT EXISTS store_settings (
                                              settings_id       SERIAL PRIMARY KEY,
                                              store_id          INT NOT NULL UNIQUE,
                                              currency          VARCHAR(10)  DEFAULT 'EGP',
    timezone          VARCHAR(100) DEFAULT 'Africa/Cairo',
    language          VARCHAR(20)  DEFAULT 'ar',
    tax_settings      TEXT,
    shipping_settings TEXT,
    FOREIGN KEY (store_id) REFERENCES stores(store_id)
    );

-- =========================
-- PRODUCTS & CATALOG
-- =========================

-- Categories can be global (store_id NULL) or store-scoped (store_id SET)
CREATE TABLE IF NOT EXISTS categories (
                                          category_id SERIAL PRIMARY KEY,
                                          store_id    INT,
                                          name        VARCHAR(100) NOT NULL,
    description TEXT,
    created_at  TIMESTAMP WITHOUT TIME ZONE,
    FOREIGN KEY (store_id) REFERENCES stores(store_id) ON DELETE CASCADE
    );
ALTER TABLE categories ADD COLUMN IF NOT EXISTS
    created_at TIMESTAMP WITHOUT TIME ZONE;
CREATE INDEX IF NOT EXISTS idx_categories_store ON categories(store_id);

CREATE TABLE IF NOT EXISTS products (
                                        product_id  SERIAL PRIMARY KEY,
                                        store_id    INT         NOT NULL,
                                        category_id INT,
                                        name        VARCHAR(150) NOT NULL,
    description TEXT,
    base_price  DECIMAL(10,2) NOT NULL,
    is_active   BOOLEAN       NOT NULL DEFAULT TRUE,
    rating      FLOAT                  DEFAULT 0.0,
    created_at  TIMESTAMP WITHOUT TIME ZONE,
    updated_at  TIMESTAMP WITHOUT TIME ZONE,
    FOREIGN KEY (store_id)    REFERENCES stores(store_id)        ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES categories(category_id)
    );
CREATE INDEX IF NOT EXISTS idx_products_store    ON products(store_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);

CREATE TABLE IF NOT EXISTS product_media (
                                             media_id   SERIAL PRIMARY KEY,
                                             product_id INT          NOT NULL,
                                             media_url  VARCHAR(255) NOT NULL,
    media_type VARCHAR(50)           DEFAULT 'IMAGE',
    alt_text   VARCHAR(255),
    FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE CASCADE
    );

CREATE TABLE IF NOT EXISTS reviews (
                                       review_id   SERIAL PRIMARY KEY,
                                       product_id  INT NOT NULL,
                                       customer_id INT NOT NULL,
                                       rating      INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    title       VARCHAR(150),
    comment     TEXT,
    created_at  TIMESTAMP WITHOUT TIME ZONE,
    FOREIGN KEY (product_id)  REFERENCES products(product_id)   ON DELETE CASCADE,
    FOREIGN KEY (customer_id) REFERENCES customers(customer_id) ON DELETE CASCADE,
    UNIQUE (product_id, customer_id)
    );

-- =========================
-- INVENTORY
-- =========================

CREATE TABLE IF NOT EXISTS inventory (
                                         inventory_id        SERIAL PRIMARY KEY,
                                         product_id          INT    NOT NULL UNIQUE,
                                         store_id            INT    NOT NULL DEFAULT 0,
                                         quantity            INT    NOT NULL DEFAULT 0,
                                         reserved_quantity   INT    NOT NULL DEFAULT 0,
                                         low_stock_threshold INT    NOT NULL DEFAULT 5,
                                         version             INT    NOT NULL DEFAULT 0,      -- optimistic locking (@Version)
                                         updated_at          TIMESTAMP WITHOUT TIME ZONE,
                                         FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE CASCADE
    );
ALTER TABLE inventory ALTER COLUMN product_id TYPE INT;

CREATE TABLE IF NOT EXISTS inventory_transactions (
                                                      txn_id          SERIAL PRIMARY KEY,
                                                      product_id      BIGINT      NOT NULL,
                                                      store_id        INT         NOT NULL,
                                                      type            VARCHAR(20) NOT NULL,
    quantity_change INT         NOT NULL,
    qty_before      INT         NOT NULL,
    qty_after       INT         NOT NULL,
    reference_id    VARCHAR(50),
    note            TEXT,
    created_at      TIMESTAMP WITHOUT TIME ZONE,
    created_by      VARCHAR(255)
    );
CREATE INDEX IF NOT EXISTS idx_inv_txn_product ON inventory_transactions(product_id);
CREATE INDEX IF NOT EXISTS idx_inv_txn_store   ON inventory_transactions(store_id);

-- =========================
-- CART & CHECKOUT
-- =========================

-- One cart per (customer, store) pair; expires after 7 days of inactivity.
-- CartCleanupScheduler runs at 2 AM daily to delete expired carts
-- and release their reserved stock back to inventory.
CREATE TABLE IF NOT EXISTS shopping_carts (
                                              cart_id     SERIAL PRIMARY KEY,
                                              customer_id INT NOT NULL,
                                              store_id    INT NOT NULL,
                                              created_at  TIMESTAMP WITHOUT TIME ZONE,
                                              expires_at  TIMESTAMP WITHOUT TIME ZONE,
                                              UNIQUE (customer_id, store_id),
    FOREIGN KEY (customer_id) REFERENCES customers(customer_id) ON DELETE CASCADE,
    FOREIGN KEY (store_id)    REFERENCES stores(store_id) ON DELETE CASCADE
    );

CREATE TABLE IF NOT EXISTS cart_items (
                                          cart_item_id SERIAL PRIMARY KEY,
                                          cart_id      INT NOT NULL,
                                          product_id   INT NOT NULL,
                                          quantity     INT NOT NULL DEFAULT 1,
                                          price_at_add DECIMAL(10,2) NOT NULL,  -- price snapshot at the time of adding to cart
    added_at     TIMESTAMP WITHOUT TIME ZONE,
    FOREIGN KEY (cart_id)    REFERENCES shopping_carts(cart_id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(product_id)
    );
ALTER TABLE cart_items
DROP CONSTRAINT IF EXISTS cart_items_product_id_fkey,
  ADD CONSTRAINT fk_cart_items_product
    FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_cart_items_cart ON cart_items(cart_id);

-- Wishlist: one product per customer enforced by UNIQUE
CREATE TABLE IF NOT EXISTS wishlists (
                                         wishlist_id SERIAL PRIMARY KEY,
                                         customer_id INT NOT NULL,
                                         product_id  INT NOT NULL,
                                         created_at  TIMESTAMP WITHOUT TIME ZONE,
                                         UNIQUE (customer_id, product_id),
    FOREIGN KEY (customer_id) REFERENCES customers(customer_id) ON DELETE CASCADE,
    FOREIGN KEY (product_id)  REFERENCES products(product_id)  ON DELETE CASCADE
    );
ALTER TABLE wishlists DROP CONSTRAINT IF EXISTS wishlists_user_id_fkey;
ALTER TABLE wishlists RENAME COLUMN user_id TO customer_id;
ALTER TABLE wishlists
    ADD CONSTRAINT fk_wishlists_customer
        FOREIGN KEY (customer_id) REFERENCES customers(customer_id) ON DELETE CASCADE;

-- =========================
-- ORDERS & PAYMENTS
-- =========================

-- status transitions: PENDING → CONFIRMED → SHIPPED → DELIVERED
--                     PENDING → CANCELLED (customer only)
CREATE TABLE IF NOT EXISTS orders (
                                      order_id         SERIAL PRIMARY KEY,
                                      customer_id      INT          NOT NULL,
                                      store_id         INT          NOT NULL,
                                      status           VARCHAR(50)  NOT NULL DEFAULT 'PENDING', -- PENDING, CONFIRMED, SHIPPED, DELIVERED, CANCELLED
    order_date       TIMESTAMP WITHOUT TIME ZONE,
    shipping_address TEXT,
    billing_address  TEXT,
    subtotal         DECIMAL(10,2),
    tax              DECIMAL(10,2)          DEFAULT 0,        -- 0 for MVP, configurable via app.tax.rate
    shipping_cost    DECIMAL(10,2),                           -- flat rate, configurable via app.shipping.flat-rate
    total            DECIMAL(10,2),
    payment_method   VARCHAR(50),                             -- STRIPE, MADA, STC_PAY
    tracking_number  VARCHAR(100),                            -- denormalized copy of shipments.tracking_number
    shipping_carrier  VARCHAR(20),                             -- denormalized copy of shipments.carrier
    idempotency_key  VARCHAR(36) UNIQUE,                       -- order-level dedup, mirrors payments.idempotency_key
    FOREIGN KEY (customer_id) REFERENCES customers(customer_id),
    FOREIGN KEY (store_id)    REFERENCES stores(store_id)
    );

CREATE TABLE IF NOT EXISTS order_items (
                                           order_item_id SERIAL PRIMARY KEY,
                                           order_id      INT           NOT NULL,
                                           product_id    INT           NOT NULL,
                                           quantity      INT           NOT NULL,
                                           price         DECIMAL(10,2) NOT NULL,  -- price snapshot at time of order
    discount      DECIMAL(10,2)            DEFAULT 0,
    tax           DECIMAL(10,2)            DEFAULT 0,
    FOREIGN KEY (order_id)   REFERENCES orders(order_id)   ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(product_id)
    );

-- invoice auto-generated when order is created
-- format: INV-{year}-{orderId padded to 5 digits} e.g. INV-2026-00001
CREATE TABLE IF NOT EXISTS invoices (
                                        invoice_id     SERIAL PRIMARY KEY,
                                        order_id       INT          NOT NULL UNIQUE,
                                        invoice_number VARCHAR(50)  UNIQUE,
    issued_at      TIMESTAMP WITHOUT TIME ZONE,
    FOREIGN KEY (order_id) REFERENCES orders(order_id)
    );

CREATE TABLE IF NOT EXISTS payments (
                                        payment_id     SERIAL PRIMARY KEY,
                                        order_id       INT           NOT NULL,
                                        amount         DECIMAL(10,2) NOT NULL,
    payment_method VARCHAR(50),   -- STRIPE, MADA, STC_PAY
    transaction_id VARCHAR(255),
    status         VARCHAR(50),   -- PENDING, SUCCESS, FAILED, REFUNDED
    processed_at   TIMESTAMP WITHOUT TIME ZONE,
    FOREIGN KEY (order_id) REFERENCES orders(order_id)
    );

-- =========================
-- DELIVERY SERVICE PROVIDER
-- =========================

CREATE TABLE IF NOT EXISTS delivery_providers (
                                                  dsp_id       SERIAL PRIMARY KEY,
                                                  company_name VARCHAR(150)
    );

CREATE TABLE IF NOT EXISTS deliveries (
                                          delivery_id     SERIAL PRIMARY KEY,
                                          order_id        INT,
                                          dsp_id          INT,
                                          delivery_status VARCHAR(50),
    FOREIGN KEY (order_id) REFERENCES orders(order_id),
    FOREIGN KEY (dsp_id)   REFERENCES delivery_providers(dsp_id)
    );

-- =========================
-- PER-STORE PROVIDER INTEGRATIONS (bring-your-own gateway/carrier)
-- Each merchant supplies their own Paymob/DHL/Aramex/Bosta credentials; FlowMerce
-- never holds a shared account. See IntegrationManagement / ShippingManagement.
-- =========================

CREATE TABLE IF NOT EXISTS store_integrations (
                                                  integration_id        SERIAL PRIMARY KEY,
                                                  store_id               INT          NOT NULL,
                                                  provider                VARCHAR(20)  NOT NULL,             -- PAYMOB, DHL, ARAMEX, BOSTA
    enabled                 BOOLEAN      NOT NULL DEFAULT FALSE,
    credentials_encrypted   TEXT         NOT NULL,             -- AES-GCM encrypted JSON credential map
    last_verified_at        TIMESTAMP WITHOUT TIME ZONE,
    last_verified_status    VARCHAR(20),                       -- UNVERIFIED, SUCCESS, FAILED
    created_at              TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
    updated_at              TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
    FOREIGN KEY (store_id) REFERENCES stores(store_id),
    CONSTRAINT uq_store_integration UNIQUE (store_id, provider)
    );

CREATE TABLE IF NOT EXISTS shipments (
                                         shipment_id       SERIAL PRIMARY KEY,
                                         order_id          INT          NOT NULL UNIQUE,
                                         carrier           VARCHAR(20)  NOT NULL,                   -- DHL, ARAMEX, BOSTA
    tracking_number   VARCHAR(100),
    status            VARCHAR(20)  NOT NULL DEFAULT 'CREATED',  -- CREATED, IN_TRANSIT, DELIVERED, FAILED, CANCELLED
    label_url         TEXT,
    carrier_response  TEXT,
    failure_reason    TEXT,
    created_at        TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
    updated_at        TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
    FOREIGN KEY (order_id) REFERENCES orders(order_id)
    );

-- =========================
-- AI ASSISTANT
-- =========================

CREATE TABLE IF NOT EXISTS ai_suggestions (
                                              suggestion_id   SERIAL PRIMARY KEY,
                                              store_id        INT,
                                              suggestion_text TEXT,
                                              accepted        BOOLEAN,
                                              created_at      TIMESTAMP WITHOUT TIME ZONE,
                                              FOREIGN KEY (store_id) REFERENCES stores(store_id)
    );

-- =========================
-- NOTIFICATIONS
-- =========================

CREATE TABLE IF NOT EXISTS notifications (
                                             notification_id SERIAL PRIMARY KEY,
                                             user_id         INT,
                                             message         TEXT,
                                             channel         VARCHAR(50),
    sent_at         TIMESTAMP WITHOUT TIME ZONE,
    FOREIGN KEY (user_id) REFERENCES users(user_id)
    );

-- ===================================
-- STOREFRONT CUSTOMIZATION
-- ===================================

CREATE TABLE IF NOT EXISTS theme_templates (
                                               theme_id   SERIAL PRIMARY KEY,
                                               background VARCHAR(7)  NOT NULL DEFAULT '#FFFFFF',
    header     VARCHAR(7)  NOT NULL DEFAULT '#1A1A2E',
    footer     VARCHAR(7)  NOT NULL DEFAULT '#16213E',
    accent     VARCHAR(7)  NOT NULL DEFAULT '#E94560',
    text_color VARCHAR(7)  NOT NULL DEFAULT '#1A1A1A',
    card       VARCHAR(7)  NOT NULL DEFAULT '#F9F9F9',
    created_at TIMESTAMP WITHOUT TIME ZONE,
    updated_at TIMESTAMP WITHOUT TIME ZONE
    );

CREATE TABLE IF NOT EXISTS storefront_templates (
                                                    template_id  SERIAL PRIMARY KEY,
                                                    store_id     INT  NOT NULL UNIQUE,
                                                    theme_id     INT,
                                                    status       VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    version      INT         NOT NULL DEFAULT 1,
    published_at TIMESTAMP WITHOUT TIME ZONE,
    created_at   TIMESTAMP WITHOUT TIME ZONE,
    updated_at   TIMESTAMP WITHOUT TIME ZONE,
    FOREIGN KEY (store_id) REFERENCES stores(store_id)          ON DELETE CASCADE,
    FOREIGN KEY (theme_id) REFERENCES theme_templates(theme_id) ON DELETE SET NULL
    );

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
    FOREIGN KEY (store_id) REFERENCES stores(store_id)          ON DELETE CASCADE,
    FOREIGN KEY (page_id)  REFERENCES storefront_pages(page_id) ON DELETE CASCADE
    );

CREATE TABLE IF NOT EXISTS storefront_media (
                                                media_id    SERIAL PRIMARY KEY,
                                                store_id    INT         NOT NULL,
                                                url         VARCHAR(512) NOT NULL,
    name        VARCHAR(255),
    media_type  VARCHAR(50)  NOT NULL DEFAULT 'IMAGE',
    uploaded_at TIMESTAMP WITHOUT TIME ZONE,
    FOREIGN KEY (store_id) REFERENCES stores(store_id) ON DELETE CASCADE
    );
CREATE INDEX IF NOT EXISTS idx_sf_media_store ON storefront_media(store_id);

CREATE TABLE IF NOT EXISTS component_decorators (
                                                    decorator_id BIGSERIAL    PRIMARY KEY,
                                                    component_id BIGINT       NOT NULL,
                                                    priority     INT          NOT NULL DEFAULT 0,
                                                    data         TEXT         NOT NULL DEFAULT '{}',
                                                    created_at   TIMESTAMP WITHOUT TIME ZONE,
                                                    updated_at   TIMESTAMP WITHOUT TIME ZONE,
                                                    CONSTRAINT fk_decorator_component
                                                    FOREIGN KEY (component_id)
    REFERENCES base_components(component_id) ON DELETE CASCADE
    );
CREATE INDEX IF NOT EXISTS idx_decorators_component_id
    ON component_decorators(component_id);

-- =========================
-- ANALYTICS & REPORTS
-- =========================

CREATE TABLE IF NOT EXISTS reports (
                                       report_id    SERIAL PRIMARY KEY,
                                       store_id     INT,
                                       report_type  VARCHAR(100),
    generated_at TIMESTAMP WITHOUT TIME ZONE,
    FOREIGN KEY (store_id) REFERENCES stores(store_id)
    );

-- =========================
-- FILE METADATA
-- =========================

CREATE TABLE IF NOT EXISTS file_metadata (
                                             id           BIGSERIAL    PRIMARY KEY,
                                             file_name    VARCHAR(255) NOT NULL,
    file_url     VARCHAR(512) NOT NULL,
    file_type    VARCHAR(50),   -- IMAGE, PDF, VIDEO, DOCUMENT
    entity_type  VARCHAR(50),   -- PRODUCT, STORE, THEME, USER, ORDER, STOREFRONT, ATTACHMENT, AI_ASSET
    entity_id    INT,           -- ID of the owning entity
    bucket_name  VARCHAR(100)   DEFAULT 'flowmerce',
    folder       VARCHAR(100),  -- which folder inside the bucket
    size_bytes   BIGINT,
    content_type VARCHAR(100),
    uploaded_by  INT,           -- user_id who uploaded
    uploaded_at  TIMESTAMP WITHOUT TIME ZONE,
    is_deleted   BOOLEAN        DEFAULT false,  -- soft delete
    FOREIGN KEY (uploaded_by) REFERENCES users(user_id)
    );

CREATE INDEX IF NOT EXISTS idx_file_metadata_entity
    ON file_metadata(entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_file_metadata_uploaded_by
    ON file_metadata(uploaded_by);