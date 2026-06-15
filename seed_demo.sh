#!/usr/bin/env bash
# FlowMerce Demo Data Seed Script
# Usage: bash seed_demo.sh
# Requires: curl, python3, running stack (docker compose up -d)
set -e

BASE="http://localhost:8080/api/v1"
echo "=== FlowMerce Demo Seed ==="
echo "Backend: $BASE"

# 1. Admin login
echo ""
echo "[1/8] Admin login..."
ADMIN_TOKEN=$(curl -s -X POST "$BASE/auth/merchant/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@flowmerce.com","password":"ChangeMe!2026"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('accessToken',''))")
[ -z "$ADMIN_TOKEN" ] && echo "ERROR: Admin login failed" && exit 1
echo "  ✓ Admin token obtained"

# 2. Register demo merchant
echo ""
echo "[2/8] Register demo merchant..."
curl -s -X POST "$BASE/auth/merchant/register" \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@flowmerce.com","password":"Demo1234!","fullName":"Demo Store Owner"}' > /dev/null

# 3. Activate via DB (local dev only)
echo ""
echo "[3/8] Activate demo accounts via DB..."
docker exec backend-postgres-1 psql -U myuser -d mydatabase -c \
  "UPDATE users SET is_active = true WHERE email IN ('demo@flowmerce.com','testcustomer_qa@test.com');" 2>/dev/null \
  || echo "  (DB activation skipped — activate via email in prod)"

# 4. Register demo customer
echo ""
echo "[4/8] Register demo customer..."
curl -s -X POST "$BASE/auth/customer/register" \
  -H "Content-Type: application/json" \
  -d '{"email":"testcustomer_qa@test.com","password":"Test1234!","fullName":"QA Customer","phone":"01000000000","address":"Cairo","city":"Cairo"}' > /dev/null

# Activate customer too
docker exec backend-postgres-1 psql -U myuser -d mydatabase -c \
  "UPDATE users SET is_active = true WHERE email = 'testcustomer_qa@test.com';" 2>/dev/null || true

# 5. Merchant login + create store
echo ""
echo "[5/8] Merchant login and create store..."
MERCHANT_TOKEN=$(curl -s -X POST "$BASE/auth/merchant/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@flowmerce.com","password":"Demo1234!"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('accessToken',''))")

STORE_ID=$(curl -s -X POST "$BASE/stores" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $MERCHANT_TOKEN" \
  -d '{"storeName":"FlowMerce Demo Shop","storeUrl":"demo-shop","description":"A demo store for testing.","currency":"EGP"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('storeId',''))")
echo "  ✓ Store created: storeId=$STORE_ID"

# 6. Create categories
echo ""
echo "[6/8] Create categories..."
for CAT in "Electronics" "Clothing" "Home & Living"; do
  CAT_ID=$(curl -s -X POST "$BASE/stores/$STORE_ID/categories" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $MERCHANT_TOKEN" \
    -d "{\"name\":\"$CAT\"}" \
    | python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('categoryId','?'))")
  echo "  ✓ '$CAT' → categoryId=$CAT_ID"
done

# Get category IDs
CATS=$(curl -s "$BASE/stores/$STORE_ID/categories" \
  -H "Authorization: Bearer $MERCHANT_TOKEN" \
  | python3 -c "import sys,json; cats=json.load(sys.stdin).get('data',[]); [print(c['categoryId'],c['name']) for c in cats]")
ELEC_ID=$(echo "$CATS" | grep Electronics | awk '{print $1}')
CLOTH_ID=$(echo "$CATS" | grep Clothing | awk '{print $1}')
HOME_ID=$(echo "$CATS" | grep Home | awk '{print $1}')

# 7. Create products
echo ""
echo "[7/8] Create products..."
create_product() {
  local NAME="$1" DESC="$2" PRICE="$3" CAT_ID="$4" QTY="$5" THRESH="$6"
  PID=$(curl -s -X POST "$BASE/stores/$STORE_ID/products" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $MERCHANT_TOKEN" \
    -d "{\"name\":\"$NAME\",\"description\":\"$DESC\",\"basePrice\":$PRICE,\"categoryId\":$CAT_ID,\"initialQuantity\":$QTY,\"lowStockThreshold\":$THRESH}" \
    | python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('productId','?'))")
  echo "  ✓ '$NAME' → productId=$PID @ EGP $PRICE (qty=$QTY)"
}

create_product "Wireless Headphones" "Bluetooth headphones 30hr battery" 599.99 $ELEC_ID 50 5
create_product "Smart Watch Pro" "Smartwatch with health monitoring GPS" 1299.99 $ELEC_ID 30 3
create_product "Bluetooth Speaker" "Portable waterproof speaker 12hr" 449.99 $ELEC_ID 60 8
create_product "Cotton T-Shirt" "Premium 100% cotton t-shirt" 149.99 $CLOTH_ID 200 20
create_product "Denim Jeans" "Classic slim-fit denim jeans" 399.99 $CLOTH_ID 100 10
create_product "Running Shoes" "Lightweight breathable running shoes" 699.99 $CLOTH_ID 80 10
create_product "Ceramic Coffee Mug" "Handcrafted 350ml microwave safe" 89.99 $HOME_ID 75 10
create_product "Desk Lamp LED" "Modern adjustable brightness USB port" 249.99 $HOME_ID 40 5

# 8. Init and publish storefront
echo ""
echo "[8/8] Init and publish storefront..."
curl -s -X POST "$BASE/stores/$STORE_ID/storefront/init" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $MERCHANT_TOKEN" \
  -d '{}' > /dev/null

curl -s -X PUT "$BASE/stores/$STORE_ID/storefront/colors" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $MERCHANT_TOKEN" \
  -d '{"background":"#ffffff","text":"#0f172a","accent":"#2563eb","card":"#f8fafc","header":"#1e293b"}' > /dev/null

PUB_STATUS=$(curl -s -X POST "$BASE/stores/$STORE_ID/storefront/publish" \
  -H "Authorization: Bearer $MERCHANT_TOKEN" \
  | python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('status','?'))")
echo "  ✓ Storefront status: $PUB_STATUS"

echo ""
echo "=== SEED COMPLETE ==="
echo ""
echo "Demo accounts:"
echo "  Merchant: demo@flowmerce.com / Demo1234!"
echo "  Customer:  testcustomer_qa@test.com / Test1234!"
echo "  Admin:     admin@flowmerce.com / ChangeMe!2026"
echo ""
echo "Storefront URL: http://localhost:3000/store/demo-shop"
echo "Dashboard URL:  http://localhost:3000/dashboard"
echo "Admin URL:      http://localhost:3000/admin"
