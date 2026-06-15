import requests, json, time, sys

BASE = "http://localhost:8080/api/v1"
BT = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ0ZXN0YnV5ZXIyMDI2QGdtYWlsLmNvbSIsInJvbGUiOiJCVVlFUiIsImlhdCI6MTc3OTczOTQyOCwiZXhwIjoxNzc5ODI1ODI4fQ.JWs8A8ZXrPL8ISw0RHHK09RQoGBHAABCaKPOeljHrds"
MT = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ0ZXN0bWVyY2hhbnQyMDI2QGdtYWlsLmNvbSIsInJvbGUiOiJNRVJDSEFOVCIsImlhdCI6MTc3OTczOTQyOSwiZXhwIjoxNzc5ODI1ODI5fQ.dhlj_rCN3KxmOYhFYM0-7mBNrjgpTU3b2U_7oU44frQ"
BH = {"Authorization": f"Bearer {BT}", "Content-Type": "application/json"}
MH = {"Authorization": f"Bearer {MT}", "Content-Type": "application/json"}

passed = 0
failed = 0

def ok(label, r, expect_fail=False):
    global passed, failed
    d = r.json()
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
        print(f"  [FAIL] {label} => {d.get('message', d.get('code','?'))[:80]}")
        failed += 1
        return None

def section(title):
    print(f"\n{'='*60}")
    print(f"  {title}")
    print(f"{'='*60}")

# ── PHASE 3: WALLET PAYMENT + FULL DELIVERY ──────────────────────
section("PHASE 3: WALLET PAYMENT + FULL DELIVERY JOURNEY")

ok("Add iPhone 15 Pro to cart",
   requests.post(f"{BASE}/cart/items", headers=BH, json={"productId":4,"quantity":1}))

r = requests.post(f"{BASE}/api/orders/place", headers=BH, json={
    "storeId":3, "shippingAddress":"10 Nile St, Giza",
    "billingAddress":"10 Nile St, Giza",
    "paymentMethod":"FLOWMERCE_WALLET",
    "idempotencyKey":"delivery-journey-002"})
data = ok("Place wallet order (iPhone 45,025 EGP)", r)
if not data:
    print("  Cannot continue - order failed"); sys.exit(1)

oid = data["order"]["orderId"]
pid = data["payment"]["paymentId"]
print(f"    Order #{oid} | Payment #{pid} | Payment: {data['payment']['status']}")

for status in ["CONFIRMED", "SHIPPED", "DELIVERED"]:
    r = requests.put(f"{BASE}/api/orders/{oid}/status", headers=MH, json={"status": status})
    d = ok(f"  Status -> {status}", r)
    time.sleep(0.3)

r = requests.get(f"{BASE}/wallets/me", headers=BH)
d = ok("Buyer wallet after 85,025 EGP payment", r)
if d: print(f"    Balance: {d['balance']} EGP")

r = requests.get(f"{BASE}/wallets/store/3", headers=MH)
d = ok("Merchant wallet after payment", r)
if d: print(f"    Balance: {d['balance']} EGP")

# ── PHASE 4: COD ─────────────────────────────────────────────────
section("PHASE 4: COD PAYMENT + MERCHANT CONFIRM")

ok("Add iPhone to cart",
   requests.post(f"{BASE}/cart/items", headers=BH, json={"productId":4,"quantity":1}))

r = requests.post(f"{BASE}/api/orders/place", headers=BH, json={
    "storeId":3, "shippingAddress":"5 Ramsis St, Cairo",
    "billingAddress":"5 Ramsis St, Cairo",
    "paymentMethod":"COD", "idempotencyKey":"cod-order-002"})
data = ok("Place COD order (iPhone 45,025 EGP)", r)
cod_oid, cod_pid = (None, None)
if data:
    cod_oid = data["order"]["orderId"]
    cod_pid = data["payment"]["paymentId"]
    print(f"    Order #{cod_oid} | Payment #{cod_pid} | Status: {data['payment']['status']}")
    r = requests.put(f"{BASE}/api/orders/{cod_oid}/status", headers=MH, json={"status":"CONFIRMED"})
    ok("  Merchant confirms order", r)
    r = requests.post(f"{BASE}/payments/{cod_pid}/confirm", headers=MH,
        json={"reference":"COD-CASH-001","note":"Cash collected at door"})
    d = ok("  Merchant confirms COD payment received", r)
    if d: print(f"    Payment: {d['status']} | ref: {d['transactionReference']}")

# ── PHASE 5: BANK TRANSFER ────────────────────────────────────────
section("PHASE 5: BANK TRANSFER PAYMENT")

ok("Add iPhone to cart",
   requests.post(f"{BASE}/cart/items", headers=BH, json={"productId":4,"quantity":1}))

r = requests.post(f"{BASE}/api/orders/place", headers=BH, json={
    "storeId":3, "shippingAddress":"20 Corniche, Alexandria",
    "billingAddress":"20 Corniche, Alexandria",
    "paymentMethod":"BANK_TRANSFER", "idempotencyKey":"bank-order-001"})
data = ok("Place BANK_TRANSFER order", r)
bt_pid = None
if data:
    bt_pid = data["payment"]["paymentId"]
    print(f"    Status: {data['payment']['status']} | ref: {data['payment']['transactionReference']}")
    r = requests.post(f"{BASE}/payments/{bt_pid}/confirm", headers=MH,
        json={"reference":"INSTAPAY-99887766","note":"Transfer verified"})
    d = ok("  Merchant confirms bank transfer", r)
    if d: print(f"    Payment: {d['status']}")

# ── PHASE 6: REFUND FLOWS ─────────────────────────────────────────
section("PHASE 6: REFUND FLOWS")

# Partial refund on delivery order
r = requests.post(f"{BASE}/payments/{pid}/refund", headers=MH,
    json={"amount":25.00,"reason":"Shipping fee waived"})
d = ok("Partial refund on wallet payment (25 EGP)", r)
if d: print(f"    Payment status: {d['status']}")

r = requests.get(f"{BASE}/wallets/me", headers=BH)
d = ok("Buyer wallet after partial refund", r)
if d: print(f"    Balance: {d['balance']} EGP (should have +25 from refund)")

r = requests.get(f"{BASE}/wallets/store/3", headers=MH)
d = ok("Merchant wallet after partial refund", r)
if d: print(f"    Balance: {d['balance']} EGP (should have -25)")

# Try to refund more than payment amount (should fail)
r = requests.post(f"{BASE}/payments/{pid}/refund", headers=MH,
    json={"amount":999999.00,"reason":"Exceeds amount"})
ok("Refund exceeding payment amount (expect FAIL)", r, expect_fail=True)

# Try to refund a COD payment that is still PENDING (should fail)
if cod_pid:
    r = requests.post(f"{BASE}/payments/{cod_pid}/refund", headers=MH,
        json={"amount":100.00,"reason":"Test"})
    d = ok("Full refund on COD confirmed payment", r)
    if d: print(f"    Payment status: {d['status']}")

# ── PHASE 7: IDEMPOTENCY + EDGE CASES ────────────────────────────
section("PHASE 7: IDEMPOTENCY + EDGE CASES")

# Replay idempotency key - should return same payment, not create new one
if cod_oid and cod_pid:
    r = requests.post(f"{BASE}/payments/initiate", headers=BH, json={
        "orderId": cod_oid, "amount": 45025.00,
        "paymentMethod": "COD", "idempotencyKey": "cod-order-002"})
    d = ok("Replay same idempotency key (expect same paymentId)", r)
    if d: print(f"    Returned paymentId: {d['paymentId']} (expected #{cod_pid})")

# Try to pay an already-paid order again
r = requests.post(f"{BASE}/payments/initiate", headers=BH, json={
    "orderId": oid, "amount": 85025.00,
    "paymentMethod": "FLOWMERCE_WALLET", "idempotencyKey": "pay-again-001"})
ok("Pay already-COMPLETED order again (expect FAIL)", r, expect_fail=True)

# Customer cancels a fresh COD order
ok("Add iPhone to cart for cancel test",
   requests.post(f"{BASE}/cart/items", headers=BH, json={"productId":4,"quantity":1}))
r = requests.post(f"{BASE}/api/orders/place", headers=BH, json={
    "storeId":3, "shippingAddress":"Cancel Test St",
    "billingAddress":"Cancel Test St",
    "paymentMethod":"COD", "idempotencyKey":"cancel-test-001"})
data = ok("Place order to cancel", r)
if data:
    cancel_oid = data["order"]["orderId"]
    r = requests.post(f"{BASE}/api/orders/{cancel_oid}/cancel", headers=BH)
    d = ok(f"  Customer cancels order #{cancel_oid}", r)
    if d: print(f"    Order status: {d['status']}")
    # Try cancelling again (should fail)
    r = requests.post(f"{BASE}/api/orders/{cancel_oid}/cancel", headers=BH)
    ok("  Cancel already-cancelled order (expect FAIL)", r, expect_fail=True)

# ── PHASE 8: WALLET TOP-UP + HISTORY ─────────────────────────────
section("PHASE 8: WALLET TOP-UP + TRANSACTION HISTORY")

r = requests.get(f"{BASE}/wallets/me", headers=BH)
d = ok("Buyer wallet before top-up", r)
if d: print(f"    Balance: {d['balance']} EGP")

r = requests.post(f"{BASE}/wallets/me/topup", headers=BH, json={"amount": 50000.00})
d = ok("Top up 50,000 EGP", r)
if d: print(f"    New balance: {d['balance']} EGP")

r = requests.get(f"{BASE}/wallets/me/transactions", headers=BH)
d = ok("Buyer transaction history", r)
if d:
    print(f"    Total transactions: {len(d)}")
    for tx in d[:5]:
        print(f"    {tx['type']:6s} {tx['amount']:10.2f} EGP | bal after: {tx['balanceAfter']:10.2f} | {tx['description'][:40]}")

r = requests.get(f"{BASE}/wallets/store/3/transactions", headers=MH)
d = ok("Merchant transaction history", r)
if d: print(f"    Total transactions: {len(d)}")

# ── PHASE 9: NOTIFICATIONS ────────────────────────────────────────
section("PHASE 9: NOTIFICATIONS (waiting 3s for consumers)")
time.sleep(3)

r = requests.get(f"{BASE}/notifications/unread-count", headers=BH)
d = ok("Buyer unread notification count", r)
if d is not None: print(f"    Unread: {d}")

r = requests.get(f"{BASE}/notifications?size=30", headers=BH)
d = ok("Get all buyer notifications", r)
if d:
    notifs = d["content"]
    print(f"    Total: {len(notifs)}")
    for n in notifs[:12]:
        status = "READ " if n["isRead"] else "UNREAD"
        print(f"    [{status}] {n['type']:30s} | {n['title']}")

r = requests.put(f"{BASE}/notifications/read-all", headers=BH)
ok("Mark all buyer notifications as read", r)

r = requests.get(f"{BASE}/notifications/unread-count", headers=BH)
d = ok("Buyer unread count after mark-all (expect 0)", r)
if d is not None: print(f"    Unread: {d}")

r = requests.get(f"{BASE}/notifications?size=30", headers=MH)
d = ok("Get merchant notifications", r)
if d:
    notifs = d["content"]
    print(f"    Total: {len(notifs)}")
    for n in notifs[:8]:
        print(f"    [{'READ ' if n['isRead'] else 'UNREAD'}] {n['type']:30s} | {n['title']}")

# ── PHASE 10: INVENTORY CHECKS ────────────────────────────────────
section("PHASE 10: INVENTORY AFTER ORDERS")

r = requests.get(f"{BASE}/stores/3/inventory", headers=MH)
d = ok("Store inventory after all orders", r)
if d:
    items = d if isinstance(d, list) else d.get("content", d)
    if isinstance(items, list):
        for item in items:
            print(f"    Product #{item.get('productId')} | stock: {item.get('availableQuantity', item.get('quantity','?'))}")

# ── SUMMARY ───────────────────────────────────────────────────────
print(f"\n{'='*60}")
print(f"  RESULTS: {passed} passed | {failed} failed")
print(f"{'='*60}")
