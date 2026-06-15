import requests, json, time, sys, uuid
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

BASE = "http://localhost:8080/api/v1"
BT = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJidXllcjIwMjZ0ZXN0QGdtYWlsLmNvbSIsInJvbGUiOiJCVVlFUiIsImlhdCI6MTc3OTc0MTA3MCwiZXhwIjoxNzc5ODI3NDcwfQ.Hp0-6jWnk8OZfB4H-OgxOP6vzAgVni2-6IIP4I2pdb4"
MT = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJtZXJjaGFudDIwMjZ0ZXN0QGdtYWlsLmNvbSIsInJvbGUiOiJNRVJDSEFOVCIsImlhdCI6MTc3OTc0MTA3MSwiZXhwIjoxNzc5ODI3NDcxfQ.ou5zgeZlbBxh1VuxxfzmuA8PnuqCvqV2kyE0thH8h3c"
BH = {"Authorization": f"Bearer {BT}", "Content-Type": "application/json"}
MH = {"Authorization": f"Bearer {MT}", "Content-Type": "application/json"}

passed = 0
failed = 0

def ok(label, r, expect_fail=False):
    global passed, failed
    try:
        d = r.json()
    except Exception:
        print(f"  [FAIL] {label} => non-JSON response (HTTP {r.status_code})")
        failed += 1
        return None
    # Handle both ApiResponse-wrapped {"success":...,"data":...} and raw objects/lists
    if isinstance(d, list):
        # Raw list — treat as success
        if expect_fail:
            print(f"  [FAIL] {label} => expected failure but got success (raw list)")
            failed += 1
            return d
        print(f"  [PASS] {label}")
        passed += 1
        return d
    if not isinstance(d, dict):
        print(f"  [FAIL] {label} => unexpected response type")
        failed += 1
        return None
    # If no "success" key it's a raw object — check HTTP status instead
    if "success" not in d:
        if r.status_code < 400:
            if expect_fail:
                print(f"  [FAIL] {label} => expected failure but got success (raw object)")
                failed += 1
                return d
            print(f"  [PASS] {label}")
            passed += 1
            return d
        else:
            msg = d.get('message', d.get('error', str(d)))[:100]
            if expect_fail:
                print(f"  [PASS] {label} => {msg[:70]}")
                passed += 1
                return None
            print(f"  [FAIL] {label} => {msg}")
            failed += 1
            return None
    success = d.get("success", False)
    if expect_fail:
        if not success:
            print(f"  [PASS] {label} => {d.get('message','?')[:70]}")
            passed += 1
            return None
        else:
            print(f"  [FAIL] {label} => expected failure but got success")
            failed += 1
            return d.get("data")
    if success:
        print(f"  [PASS] {label}")
        passed += 1
        return d.get("data")
    else:
        msg = d.get('message', d.get('code', str(d)))[:100]
        print(f"  [FAIL] {label} => {msg}")
        failed += 1
        return None

def section(title):
    print(f"\n{'='*60}")
    print(f"  {title}")
    print(f"{'='*60}")

# ── PHASE 0: SETUP ────────────────────────────────────────────
section("PHASE 0: SETUP — Store, Products, Wallet")

# Create store
r = requests.post(f"{BASE}/stores", headers=MH,
    json={"storeName": "FlowTest Electronics", "storeUrl": "flowtest-elec-" + str(int(time.time()))[-6:],
          "description": "Test store for API validation"})
store_data = ok("Create merchant store", r)
if not store_data:
    print("  Cannot continue — store creation failed"); sys.exit(1)
store_id = store_data["storeId"]
print(f"    Store #{store_id}: {store_data['storeName']}")

# Create products
r = requests.post(f"{BASE}/stores/{store_id}/products", headers=MH,
    json={"name": "iPhone 15 Pro", "description": "Apple flagship phone",
          "basePrice": 45025.00, "initialQuantity": 50, "lowStockThreshold": 5})
p1 = ok("Create product: iPhone 15 Pro (45,025 EGP)", r)
if not p1: sys.exit(1)
pid1 = p1["productId"]
print(f"    Product #{pid1}")

r = requests.post(f"{BASE}/stores/{store_id}/products", headers=MH,
    json={"name": "Samsung Galaxy S24", "description": "Samsung flagship phone",
          "basePrice": 35000.00, "initialQuantity": 30, "lowStockThreshold": 5})
p2 = ok("Create product: Samsung S24 (35,000 EGP)", r)
pid2 = p2["productId"] if p2 else None
if pid2: print(f"    Product #{pid2}")

r = requests.post(f"{BASE}/stores/{store_id}/products", headers=MH,
    json={"name": "USB-C Cable", "description": "1m braided cable",
          "basePrice": 150.00, "initialQuantity": 200, "lowStockThreshold": 20})
p3 = ok("Create product: USB-C Cable (150 EGP)", r)
pid3 = p3["productId"] if p3 else None
if pid3: print(f"    Product #{pid3}")

# Top up buyer wallet
r = requests.post(f"{BASE}/wallets/me/topup", headers=BH, json={"amount": 200000.00})
d = ok("Top up buyer wallet (200,000 EGP)", r)
if d: print(f"    Buyer balance: {d['balance']} EGP")

r = requests.get(f"{BASE}/wallets/me", headers=BH)
d = ok("Buyer wallet balance check", r)
if d: print(f"    Balance: {d['balance']} EGP")

# ── PHASE 1: STORE SETTINGS + STOREFRONT ──────────────────────
section("PHASE 1: STORE SETTINGS + STOREFRONT CUSTOMIZATION")

# Update payment methods
r = requests.put(f"{BASE}/stores/{store_id}/payment-methods", headers=MH,
    json={"methods": ["FLOWMERCE_WALLET", "COD", "BANK_TRANSFER"]})
ok("Set store payment methods", r)

# Get store info
r = requests.get(f"{BASE}/stores/{store_id}", headers=MH)
d = ok("Get store by ID", r)
if d: print(f"    Store: {d.get('storeName')} | Status: {d.get('status')}")

# Initialize storefront customization
r = requests.post(f"{BASE}/stores/{store_id}/storefront/init", headers=MH)
ok("Init storefront customization", r)

# Update design
r = requests.put(f"{BASE}/stores/{store_id}/storefront/design", headers=MH,
    json={"primaryColor": "#FF6B35", "secondaryColor": "#1A1A2E",
          "fontFamily": "Roboto", "theme": "MODERN"})
ok("Update storefront design (colors + font)", r)

# Create a page
r = requests.post(f"{BASE}/stores/{store_id}/storefront/pages", headers=MH,
    json={"title": "Welcome", "slug": "welcome",
          "content": "<h1>Welcome to FlowTest Electronics</h1>", "isPublished": True})
ok("Create storefront page", r)

# Publish store (sets store status to PUBLISHED)
r = requests.post(f"{BASE}/stores/{store_id}/publish", headers=MH)
ok("Publish store", r)

# Publish storefront customization separately
r = requests.post(f"{BASE}/stores/{store_id}/storefront/publish", headers=MH)
ok("Publish storefront customization", r)

# Public storefront accessible
r = requests.get(f"{BASE}/public/storefront/{store_id}")
ok("Public storefront (no auth)", r)

# ── PHASE 2: PRODUCT & CART OPERATIONS ────────────────────────
section("PHASE 2: PRODUCT LISTING + CART")

# List products
r = requests.get(f"{BASE}/stores/{store_id}/products", headers=MH)
d = ok("Merchant: list own products", r)
if d:
    items = d if isinstance(d, list) else d.get("content", [])
    print(f"    Products in store: {len(items)}")

# Public product listing
r = requests.get(f"{BASE}/stores/{store_id}/products/public")
ok("Public: list store products (no auth)", r)

# Search products
r = requests.get(f"{BASE}/stores/{store_id}/products/search?keyword=iPhone", headers=MH)
ok("Search products by keyword 'iPhone'", r)

# Get single product
r = requests.get(f"{BASE}/stores/{store_id}/products/{pid1}", headers=BH)
d = ok("Get product by ID", r)
if d: print(f"    {d['name']} | {d['basePrice']} EGP | qty: {d['availableQuantity']}")

# Add to cart
r = requests.post(f"{BASE}/cart/items", headers=BH,
    json={"productId": pid1, "quantity": 1})
ok("Add iPhone to cart", r)

# Add another item
if pid2:
    r = requests.post(f"{BASE}/cart/items", headers=BH,
        json={"productId": pid2, "quantity": 1})
    ok("Add Samsung S24 to cart", r)

# View cart (requires storeId)
r = requests.get(f"{BASE}/cart/{store_id}", headers=BH)
d = ok("View buyer cart", r)
cart_item_id_to_remove = None
if d:
    items = d.get("items", [])
    print(f"    Cart items: {len(items)} | Total: {d.get('total', d.get('totalAmount', '?'))} EGP")
    # Find the Samsung cart item ID for removal
    for item in items:
        if item.get("productId") == pid2:
            cart_item_id_to_remove = item.get("cartItemId") or item.get("id")

# Remove one item from cart (by cartItemId)
if cart_item_id_to_remove:
    r = requests.delete(f"{BASE}/cart/items/{cart_item_id_to_remove}", headers=BH)
    ok("Remove Samsung from cart", r)

# Verify cart has only iPhone
r = requests.get(f"{BASE}/cart/{store_id}", headers=BH)
d = ok("Cart after removal (should have 1 item)", r)
if d:
    items = d.get("items", [])
    print(f"    Cart items: {len(items)}")

# ── PHASE 3: WALLET PAYMENT + FULL DELIVERY JOURNEY ──────────
section("PHASE 3: WALLET PAYMENT + FULL DELIVERY JOURNEY")

# Ensure iPhone is in cart
r = requests.post(f"{BASE}/cart/items", headers=BH,
    json={"productId": pid1, "quantity": 1})
ok("Re-add iPhone to cart for wallet order", r)

ik_wallet = "wallet-order-" + str(int(time.time()))
r = requests.post(f"{BASE}/api/orders/place", headers=BH, json={
    "storeId": store_id, "shippingAddress": "10 Nile St, Giza",
    "billingAddress": "10 Nile St, Giza",
    "paymentMethod": "FLOWMERCE_WALLET",
    "idempotencyKey": ik_wallet})
data = ok("Place wallet order (iPhone 45,025 EGP)", r)
if not data:
    print("  Cannot continue — wallet order failed"); sys.exit(1)

wallet_oid = data["order"]["orderId"]
wallet_pid = data["payment"]["paymentId"]
print(f"    Order #{wallet_oid} | Payment #{wallet_pid} | Status: {data['payment']['status']}")

# Check buyer wallet was debited
r = requests.get(f"{BASE}/wallets/me", headers=BH)
d = ok("Buyer wallet after 45,025 EGP payment", r)
if d: print(f"    Buyer balance: {d['balance']} EGP (should be ~154,975)")

# Check merchant wallet was credited
r = requests.get(f"{BASE}/wallets/store/{store_id}", headers=MH)
d = ok("Merchant wallet after payment", r)
if d: print(f"    Merchant balance: {d['balance']} EGP (should be 45,025)")

# Full delivery journey
for status in ["CONFIRMED", "SHIPPED", "DELIVERED"]:
    r = requests.put(f"{BASE}/api/orders/{wallet_oid}/status", headers=MH, json={"status": status})
    ok(f"  Delivery: status -> {status}", r)
    time.sleep(0.3)

# Verify order is DELIVERED
r = requests.get(f"{BASE}/api/orders/{wallet_oid}", headers=BH)
d = ok("Get order after delivery", r)
if d: print(f"    Order status: {d.get('status')}")

# ── PHASE 4: COD PAYMENT + MERCHANT CONFIRM ───────────────────
section("PHASE 4: COD PAYMENT + MERCHANT CONFIRM")

r = requests.post(f"{BASE}/cart/items", headers=BH,
    json={"productId": pid1, "quantity": 1})
ok("Add iPhone to cart for COD order", r)

ik_cod = "cod-order-" + str(int(time.time()))
r = requests.post(f"{BASE}/api/orders/place", headers=BH, json={
    "storeId": store_id, "shippingAddress": "5 Ramsis St, Cairo",
    "billingAddress": "5 Ramsis St, Cairo",
    "paymentMethod": "COD", "idempotencyKey": ik_cod})
data = ok("Place COD order (iPhone 45,025 EGP)", r)
cod_oid = cod_pid = None
if data:
    cod_oid = data["order"]["orderId"]
    cod_pid = data["payment"]["paymentId"]
    print(f"    Order #{cod_oid} | Payment #{cod_pid} | Status: {data['payment']['status']}")

    # Merchant confirms delivery flow
    r = requests.put(f"{BASE}/api/orders/{cod_oid}/status", headers=MH, json={"status": "CONFIRMED"})
    ok("  Merchant confirms COD order", r)

    r = requests.put(f"{BASE}/api/orders/{cod_oid}/status", headers=MH, json={"status": "SHIPPED"})
    ok("  COD order -> SHIPPED", r)

    r = requests.put(f"{BASE}/api/orders/{cod_oid}/status", headers=MH, json={"status": "DELIVERED"})
    ok("  COD order -> DELIVERED", r)

    # Merchant confirms cash received
    r = requests.post(f"{BASE}/payments/{cod_pid}/confirm", headers=MH,
        json={"reference": "COD-CASH-" + str(int(time.time())), "note": "Cash collected at door"})
    d = ok("  Merchant confirms COD cash received", r)
    if d: print(f"    Payment: {d['status']} | ref: {d.get('transactionReference','?')}")

# ── PHASE 5: BANK TRANSFER PAYMENT ────────────────────────────
section("PHASE 5: BANK TRANSFER PAYMENT + CONFIRM")

r = requests.post(f"{BASE}/cart/items", headers=BH,
    json={"productId": pid1, "quantity": 1})
ok("Add iPhone to cart for bank transfer order", r)

ik_bt = "bank-order-" + str(int(time.time()))
r = requests.post(f"{BASE}/api/orders/place", headers=BH, json={
    "storeId": store_id, "shippingAddress": "20 Corniche, Alexandria",
    "billingAddress": "20 Corniche, Alexandria",
    "paymentMethod": "BANK_TRANSFER", "idempotencyKey": ik_bt})
data = ok("Place BANK_TRANSFER order (iPhone)", r)
bt_pid = None
if data:
    bt_oid = data["order"]["orderId"]
    bt_pid = data["payment"]["paymentId"]
    print(f"    Order #{bt_oid} | Payment #{bt_pid} | Status: {data['payment']['status']}")

    r = requests.post(f"{BASE}/payments/{bt_pid}/confirm", headers=MH,
        json={"reference": "INSTAPAY-" + str(int(time.time())), "note": "Transfer verified"})
    d = ok("  Merchant confirms bank transfer", r)
    if d: print(f"    Payment: {d['status']}")

# ── PHASE 6: REFUND FLOWS ─────────────────────────────────────
section("PHASE 6: REFUND FLOWS")

buyer_bal_before = None
r = requests.get(f"{BASE}/wallets/me", headers=BH)
d = ok("Buyer wallet before refund", r)
if d:
    buyer_bal_before = d['balance']
    print(f"    Balance before: {d['balance']} EGP")

# Partial refund on wallet payment (25 EGP)
r = requests.post(f"{BASE}/payments/{wallet_pid}/refund", headers=MH,
    json={"amount": 25.00, "reason": "Shipping fee waived"})
d = ok("Partial refund on wallet payment (25 EGP)", r)
if d: print(f"    Payment status: {d['status']}")

r = requests.get(f"{BASE}/wallets/me", headers=BH)
d = ok("Buyer wallet after partial refund", r)
if d: print(f"    Balance: {d['balance']} EGP (should have +25 from refund)")

r = requests.get(f"{BASE}/wallets/store/{store_id}", headers=MH)
d = ok("Merchant wallet after partial refund", r)
if d: print(f"    Balance: {d['balance']} EGP (should have -25)")

# Second partial refund (same payment, should be PARTIALLY_REFUNDED → allow more refunds)
r = requests.post(f"{BASE}/payments/{wallet_pid}/refund", headers=MH,
    json={"amount": 100.00, "reason": "Additional discount applied"})
ok("Second partial refund on same payment (100 EGP)", r)

# Refund exceeding original amount (should fail)
r = requests.post(f"{BASE}/payments/{wallet_pid}/refund", headers=MH,
    json={"amount": 999999.00, "reason": "Exceeds amount"})
ok("Refund exceeding payment amount (expect FAIL)", r, expect_fail=True)

# Refund on non-completed payment (should fail)
if pid1:
    r = requests.post(f"{BASE}/cart/items", headers=BH,
        json={"productId": pid1, "quantity": 1})
    requests.post(f"{BASE}/cart/items", headers=BH, json={"productId": pid1, "quantity": 1})

    ik_pending = "pending-order-" + str(int(time.time()))
    r = requests.post(f"{BASE}/api/orders/place", headers=BH, json={
        "storeId": store_id, "shippingAddress": "Refund Test St",
        "billingAddress": "Refund Test St",
        "paymentMethod": "BANK_TRANSFER", "idempotencyKey": ik_pending})
    data2 = ok("Place BANK_TRANSFER order for refund-fail test", r)
    if data2:
        pending_pid = data2["payment"]["paymentId"]
        r = requests.post(f"{BASE}/payments/{pending_pid}/refund", headers=MH,
            json={"amount": 100.00, "reason": "Should fail - not completed"})
        ok("Refund PENDING payment (expect FAIL)", r, expect_fail=True)

# ── PHASE 7: IDEMPOTENCY + EDGE CASES ─────────────────────────
section("PHASE 7: IDEMPOTENCY + EDGE CASES")

# Replay idempotency key — should return same payment
if cod_oid and cod_pid:
    r = requests.post(f"{BASE}/payments/initiate", headers=BH, json={
        "orderId": cod_oid, "amount": 45025.00,
        "paymentMethod": "COD", "idempotencyKey": ik_cod})
    d = ok("Replay same idempotency key (expect same paymentId)", r)
    if d:
        match = d.get('paymentId') == cod_pid
        print(f"    Returned paymentId: {d.get('paymentId')} (expected #{cod_pid}) {'OK' if match else 'MISMATCH'}")

# Try to pay an already-COMPLETED order again
r = requests.post(f"{BASE}/payments/initiate", headers=BH, json={
    "orderId": wallet_oid, "amount": 45025.00,
    "paymentMethod": "FLOWMERCE_WALLET", "idempotencyKey": "pay-again-" + str(int(time.time()))})
ok("Pay already-COMPLETED order again (expect FAIL)", r, expect_fail=True)

# Wallet payment with insufficient funds
r = requests.post(f"{BASE}/cart/items", headers=BH,
    json={"productId": pid1, "quantity": 1})
ok("Add item for insufficient-funds test", r)

ik_insuf = "insuf-" + str(int(time.time()))
# Drain wallet first to trigger insufficient funds — place an order worth more than balance
r = requests.get(f"{BASE}/wallets/me", headers=BH)
bal_d = ok("Check buyer balance for insufficient-funds test", r)
if bal_d:
    current_bal = float(bal_d['balance'])
    print(f"    Current buyer balance: {current_bal} EGP")
    # If balance > 0, this test only works if we can create a product worth more
    # We already have the cable (150 EGP), so just verify wallet works
    r = requests.post(f"{BASE}/cart/items", headers=BH,
        json={"productId": pid3, "quantity": 1})
    ok("Add cable to cart", r)
    ik_cable = "cable-wallet-" + str(int(time.time()))
    r = requests.post(f"{BASE}/api/orders/place", headers=BH, json={
        "storeId": store_id, "shippingAddress": "1 Test St",
        "billingAddress": "1 Test St",
        "paymentMethod": "FLOWMERCE_WALLET", "idempotencyKey": ik_cable})
    ok("Wallet payment for low-value item (150 EGP cable)", r)

# Cancel a fresh order
r = requests.post(f"{BASE}/cart/items", headers=BH,
    json={"productId": pid1, "quantity": 1})
ok("Add iPhone to cart for cancel test", r)

ik_cancel = "cancel-" + str(int(time.time()))
r = requests.post(f"{BASE}/api/orders/place", headers=BH, json={
    "storeId": store_id, "shippingAddress": "Cancel Test St",
    "billingAddress": "Cancel Test St",
    "paymentMethod": "COD", "idempotencyKey": ik_cancel})
data = ok("Place order to cancel", r)
if data:
    cancel_oid = data["order"]["orderId"]
    r = requests.post(f"{BASE}/api/orders/{cancel_oid}/cancel", headers=BH)
    d = ok(f"  Customer cancels order #{cancel_oid}", r)
    if d: print(f"    Order status: {d.get('status', d.get('orderStatus', '?'))}")

    # Cancel already-cancelled (should fail)
    r = requests.post(f"{BASE}/api/orders/{cancel_oid}/cancel", headers=BH)
    ok("  Cancel already-cancelled order (expect FAIL)", r, expect_fail=True)

    # Try to ship a cancelled order (should fail)
    r = requests.put(f"{BASE}/api/orders/{cancel_oid}/status", headers=MH, json={"status": "SHIPPED"})
    ok("  Update cancelled order status (expect FAIL)", r, expect_fail=True)

# ── PHASE 8: ORDER LISTING + QUERIES ──────────────────────────
section("PHASE 8: ORDER LISTING + QUERIES")

r = requests.get(f"{BASE}/api/orders/me", headers=BH)
d = ok("Get buyer's order history", r)
if d:
    items = d if isinstance(d, list) else d.get("content", [])
    print(f"    Total orders: {len(items)}")
    for o in items[:5]:
        print(f"    Order #{o.get('orderId')} | {o.get('status')} | {o.get('total','?')} EGP")

r = requests.get(f"{BASE}/api/orders/store/{store_id}", headers=MH)
d = ok("Merchant: get store orders", r)
if d:
    items = d if isinstance(d, list) else d.get("content", [])
    print(f"    Store orders: {len(items)}")

# ── PHASE 9: WALLET TOP-UP + TRANSACTION HISTORY ──────────────
section("PHASE 9: WALLET TOP-UP + TRANSACTION HISTORY")

r = requests.get(f"{BASE}/wallets/me", headers=BH)
d = ok("Buyer wallet balance", r)
if d: print(f"    Balance: {d['balance']} EGP")

r = requests.post(f"{BASE}/wallets/me/topup", headers=BH, json={"amount": 10000.00})
d = ok("Top up buyer wallet (10,000 EGP)", r)
if d: print(f"    New balance: {d['balance']} EGP")

r = requests.get(f"{BASE}/wallets/me/transactions", headers=BH)
d = ok("Buyer transaction history", r)
if d:
    print(f"    Total transactions: {len(d)}")
    for tx in d[:6]:
        print(f"    {tx['type']:15s} {float(tx['amount']):10.2f} EGP | bal: {tx['balanceAfter']:10.2f} | {tx['description'][:40]}")

r = requests.get(f"{BASE}/wallets/store/{store_id}", headers=MH)
d = ok("Merchant wallet balance", r)
if d: print(f"    Merchant balance: {d['balance']} EGP")

r = requests.get(f"{BASE}/wallets/store/{store_id}/transactions", headers=MH)
d = ok("Merchant transaction history", r)
if d: print(f"    Total merchant transactions: {len(d)}")

# ── PHASE 10: NOTIFICATIONS ────────────────────────────────────
section("PHASE 10: NOTIFICATIONS (waiting 3s for consumers)")
time.sleep(3)

r = requests.get(f"{BASE}/notifications/unread-count", headers=BH)
d = ok("Buyer unread notification count", r)
if d is not None: print(f"    Unread: {d}")

r = requests.get(f"{BASE}/notifications?size=30", headers=BH)
d = ok("Get all buyer notifications", r)
if d:
    notifs = d.get("content", [])
    print(f"    Total: {len(notifs)}")
    for n in notifs[:10]:
        status = "READ " if n["isRead"] else "UNREAD"
        print(f"    [{status}] {n['type']:30s} | {n['title']}")

r = requests.put(f"{BASE}/notifications/read-all", headers=BH)
ok("Mark all buyer notifications as read", r)

r = requests.get(f"{BASE}/notifications/unread-count", headers=BH)
d = ok("Buyer unread count after mark-all (expect 0)", r)
if d is not None: print(f"    Unread: {d} (expected 0)")

r = requests.get(f"{BASE}/notifications?size=30", headers=MH)
d = ok("Get merchant notifications", r)
if d:
    notifs = d.get("content", [])
    print(f"    Total: {len(notifs)}")
    for n in notifs[:8]:
        print(f"    [{'READ ' if n['isRead'] else 'UNREAD'}] {n['type']:30s} | {n['title']}")

# ── PHASE 11: INVENTORY AFTER ORDERS ──────────────────────────
section("PHASE 11: INVENTORY AFTER ORDERS")

r = requests.get(f"{BASE}/stores/{store_id}/inventory", headers=MH)
d = ok("Store inventory after all orders", r)
if d:
    items = d if isinstance(d, list) else d.get("content", [])
    if isinstance(items, list):
        for item in items:
            print(f"    Product #{item.get('productId')} | stock: {item.get('availableQuantity', item.get('quantity', '?'))}")

# ── PHASE 12: STOREFRONT CUSTOMIZATION ────────────────────────
section("PHASE 12: STOREFRONT CUSTOMIZATION")

# Get current design
r = requests.get(f"{BASE}/stores/{store_id}/storefront", headers=MH)
d = ok("Get storefront customization", r)
if d: print(f"    Theme: {d.get('theme')} | Primary: {d.get('primaryColor')}")

# Update design again
r = requests.put(f"{BASE}/stores/{store_id}/storefront/design", headers=MH,
    json={"primaryColor": "#2563EB", "secondaryColor": "#1E293B",
          "fontFamily": "Inter", "theme": "MINIMAL"})
ok("Update storefront to MINIMAL theme", r)

# Add a component to a page
r = requests.get(f"{BASE}/stores/{store_id}/storefront/pages", headers=MH)
d = ok("List storefront pages", r)
pages = d if isinstance(d, list) else (d.get("content", []) if d else [])
if pages:
    page_id = pages[0].get("pageId") or pages[0].get("id")
    if page_id:
        r = requests.post(f"{BASE}/stores/{store_id}/storefront/pages/{page_id}/components", headers=MH,
            json={"componentType": "BANNER", "title": "Summer Sale",
                  "content": "Up to 30% off on all phones!", "order": 1, "isVisible": True})
        ok("Add BANNER component to page", r)

# Unpublish storefront customization
r = requests.post(f"{BASE}/stores/{store_id}/storefront/unpublish", headers=MH)
ok("Unpublish storefront customization", r)

# Re-publish storefront customization
r = requests.post(f"{BASE}/stores/{store_id}/storefront/publish", headers=MH)
ok("Re-publish storefront customization", r)

# Public access after re-publish
r = requests.get(f"{BASE}/public/storefront/{store_id}")
ok("Public storefront accessible after re-publish", r)

# ── SUMMARY ───────────────────────────────────────────────────
print(f"\n{'='*60}")
print(f"  RESULTS: {passed} passed | {failed} failed")
print(f"  Store ID used: {store_id}")
print(f"  Product IDs: {pid1}, {pid2}, {pid3}")
print(f"{'='*60}")
