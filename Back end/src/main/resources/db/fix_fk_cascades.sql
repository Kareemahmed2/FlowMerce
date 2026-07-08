-- FlowMerce: fix FK ON DELETE actions in the live Supabase database.
--
-- Root cause: spring.jpa.hibernate.ddl-auto=update (application.properties) is what
-- actually built this schema — schema.sql's ON DELETE CASCADE clauses never ran
-- against this DB (spring.sql.init.mode is never set to "always", and it defaults to
-- "embedded", i.e. schema.sql only auto-runs for embedded DBs like H2). Hibernate's
-- auto-DDL creates FKs as a plain FOREIGN KEY (NO ACTION) unless the entity carries
-- @OnDelete, so every constraint below is currently NO ACTION regardless of what
-- schema.sql says, and currently has an auto-generated hash name (e.g.
-- "fknt3feqa31eswws4aw9r00fyl9") instead of the descriptive name applied here.
--
-- This script finds whatever constraint currently exists on each (table, column) —
-- by name lookup, since the live names are unpredictable — drops it, and replaces
-- it with a descriptively-named constraint carrying the correct ON DELETE action.
-- Idempotent / safe to re-run.
--
-- Run this against the Supabase database directly (e.g. via the SQL editor or psql).

CREATE OR REPLACE FUNCTION _flowmerce_fix_fk(
    p_table text, p_column text, p_ref_table text, p_ref_column text,
    p_constraint_name text, p_on_delete text
) RETURNS void AS $$
DECLARE
    existing_name text;
BEGIN
    SELECT tc.constraint_name INTO existing_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
    WHERE tc.table_schema = 'public'
      AND tc.table_name = p_table
      AND tc.constraint_type = 'FOREIGN KEY'
      AND kcu.column_name = p_column
    LIMIT 1;

    IF existing_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I', p_table, existing_name);
    END IF;

    EXECUTE format(
        'ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES %I(%I) ON DELETE %s',
        p_table, p_constraint_name, p_column, p_ref_table, p_ref_column, p_on_delete
    );
END;
$$ LANGUAGE plpgsql;

-- Catalog: category/product/media, scoped to a store
SELECT _flowmerce_fix_fk('categories',            'store_id',      'stores',               'store_id',      'fk_categories_store',             'CASCADE');
SELECT _flowmerce_fix_fk('products',              'store_id',      'stores',               'store_id',      'fk_products_store',               'CASCADE');
-- Deleting a category should un-categorize its products, not delete them or block the delete.
SELECT _flowmerce_fix_fk('products',              'category_id',   'categories',           'category_id',   'fk_products_category',            'SET NULL');
SELECT _flowmerce_fix_fk('product_media',         'product_id',    'products',             'product_id',    'fk_product_media_product',        'CASCADE');
SELECT _flowmerce_fix_fk('reviews',               'product_id',    'products',             'product_id',    'fk_reviews_product',              'CASCADE');
SELECT _flowmerce_fix_fk('reviews',               'customer_id',   'customers',            'customer_id',   'fk_reviews_customer',             'CASCADE');
SELECT _flowmerce_fix_fk('inventory',             'product_id',    'products',             'product_id',    'fk_inventory_product',            'CASCADE');

-- Cart / wishlist
SELECT _flowmerce_fix_fk('shopping_carts',        'customer_id',   'customers',            'customer_id',   'fk_shopping_carts_customer',      'CASCADE');
SELECT _flowmerce_fix_fk('shopping_carts',        'store_id',      'stores',               'store_id',      'fk_shopping_carts_store',         'CASCADE');
SELECT _flowmerce_fix_fk('cart_items',            'cart_id',       'shopping_carts',       'cart_id',       'fk_cart_items_cart',              'CASCADE');
SELECT _flowmerce_fix_fk('cart_items',            'product_id',    'products',             'product_id',    'fk_cart_items_product',           'CASCADE');
SELECT _flowmerce_fix_fk('wishlists',             'customer_id',   'customers',            'customer_id',   'fk_wishlists_customer',           'CASCADE');
SELECT _flowmerce_fix_fk('wishlists',             'product_id',    'products',             'product_id',    'fk_wishlists_product',            'CASCADE');

-- Orders: order_items cascades with the order itself (payments/shipments/customers/
-- stores deliberately stay NO ACTION — those are cleaned up in app code, in order,
-- to preserve the financial/audit trail; see UserService/MerchantService/StoreService).
SELECT _flowmerce_fix_fk('order_items',           'order_id',      'orders',               'order_id',      'fk_order_items_order',            'CASCADE');

-- Storefront customization, scoped to a store
SELECT _flowmerce_fix_fk('storefront_templates',  'store_id',      'stores',               'store_id',      'fk_storefront_templates_store',   'CASCADE');
SELECT _flowmerce_fix_fk('storefront_templates',  'theme_id',      'theme_templates',      'theme_id',      'fk_storefront_templates_theme',   'SET NULL');
SELECT _flowmerce_fix_fk('storefront_pages',      'storefront_id', 'storefront_templates', 'template_id',   'fk_storefront_pages_template',    'CASCADE');
SELECT _flowmerce_fix_fk('base_components',       'store_id',      'stores',               'store_id',      'fk_base_components_store',        'CASCADE');
SELECT _flowmerce_fix_fk('base_components',       'page_id',       'storefront_pages',     'page_id',       'fk_base_components_page',         'CASCADE');
SELECT _flowmerce_fix_fk('storefront_media',      'store_id',      'stores',               'store_id',      'fk_storefront_media_store',       'CASCADE');
SELECT _flowmerce_fix_fk('component_decorators',  'component_id',  'base_components',      'component_id',  'fk_component_decorators_component', 'CASCADE');

-- Per-store provider credentials — meaningless without the store, safe to cascade
-- (schema.sql never declared this one as CASCADE at all; it should have).
SELECT _flowmerce_fix_fk('store_integrations',    'store_id',      'stores',               'store_id',      'fk_store_integrations_store',     'CASCADE');

-- File metadata should survive its uploader's account deletion; just lose attribution.
SELECT _flowmerce_fix_fk('file_metadata',         'uploaded_by',   'users',                'user_id',       'fk_file_metadata_uploaded_by',    'SET NULL');

DROP FUNCTION _flowmerce_fix_fk(text, text, text, text, text, text);
