-- Roles (unique on role_name)
INSERT INTO roles (role_name)
VALUES ('Admin'), ('Merchant'), ('Buyer'), ('Guest')
ON CONFLICT (role_name) DO NOTHING;

-- Debug user so we can easily see if it worked
INSERT INTO users (email, password_hash, full_name, phone, is_mfa_enabled, role_id)
VALUES (
    'debug@flowmerce.com',
    'debug_hash_123',           -- fake hash – change later
    'Debug User Visible',
    '0000000000',
    false,
    (SELECT role_id FROM roles WHERE role_name = 'Admin')
)
ON CONFLICT (email) DO NOTHING;