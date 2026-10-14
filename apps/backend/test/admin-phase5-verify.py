#!/usr/bin/env python3
"""Phase 5 admin API smoke verification (run while `node dist/main` serves :3000).
Covers: products CRUD/soft-delete, categories 409 guard, order transitions +
stock restore on cancel, user disable/enable + login block, stats, 403/401.
Note: mutates seed data (one order -> DELIVERED, one -> CANCELLED, one category
renamed back afterwards).
"""
import json, sys, urllib.request, urllib.error

BASE = "http://localhost:3000"
passed, failed = 0, 0

def req(method, path, token=None, body=None, query=""):
    r = urllib.request.Request(BASE + path + query,
        data=json.dumps(body).encode() if body is not None else None, method=method)
    r.add_header("Content-Type", "application/json")
    if token:
        r.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(r) as resp:
            return resp.status, json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        return e.code, None

def check(name, cond, detail=""):
    global passed, failed
    passed, failed = passed + (1 if cond else 0), failed + (0 if cond else 1)
    print(("PASS " if cond else "FAIL ") + name + (f" | {detail}" if detail else ""))

def login(email, pw):
    st, b = req("POST", "/auth/login", body={"email": email, "password": pw})
    return st, (b.get("data") or {}).get("accessToken") if b else None

st, AT = login("admin@example.com", "Admin@123")
check("admin login", st == 200 and AT, f"status={st}")
st, CT = login("aarav.sharma@example.com", "Customer@123")
check("customer login", st == 200 and CT, f"status={st}")

for m, p, b in [("GET", "/admin/stats", None), ("POST", "/admin/products", {}),
                ("GET", "/admin/users", None), ("GET", "/admin/orders", None)]:
    st, _ = req(m, p, token=CT, body=b)
    check(f"customer {m} {p} -> 403", st == 403, f"status={st}")
st, _ = req("GET", "/admin/stats")
check("unauthenticated -> 401", st == 401, f"status={st}")

st, cats = req("GET", "/categories")
cat_id = cats["data"][0]["id"]

st, prod = req("POST", "/admin/products", AT, {"name": "Smoke Widget", "slug": "smoke-widget",
    "description": "smoke test", "price": 49.99, "comparePrice": 69.99, "stock": 42,
    "imageUrl": "https://example.com/w.jpg", "categoryId": cat_id})
pid = (prod.get("data") or {}).get("id")
check("create product", st in (200, 201) and pid, f"status={st}")
st, _ = req("POST", "/admin/products", AT, {"name": "Dup", "slug": "smoke-widget",
    "description": "x", "price": 10, "stock": 1, "imageUrl": "https://example.com/d.jpg",
    "categoryId": cat_id})
check("duplicate slug -> 409", st == 409, f"status={st}")
st, u = req("PATCH", f"/admin/products/{pid}", AT, {"price": 59.99})
check("update product", st == 200 and u["data"]["price"] == 59.99, f"status={st}")
st, s = req("PATCH", f"/admin/products/{pid}/stock", AT, {"stock": 7})
check("set stock", st == 200 and s["data"]["stock"] == 7, f"status={st}")
st, d = req("DELETE", f"/admin/products/{pid}", AT)
check("soft delete", st == 200 and d["data"]["isActive"] is False, f"status={st}")
st, listing = req("GET", "/products", query="?search=smoke-widget")
check("hidden from public listing", st == 200 and not listing["data"]["items"], f"status={st}")

st, cat = req("POST", "/admin/categories", AT, {"name": "Smoke Cat", "slug": "smoke-cat"})
ncid = (cat.get("data") or {}).get("id")
check("create category", st in (200, 201) and ncid, f"status={st}")
st, _ = req("DELETE", f"/admin/categories/{cat_id}", AT)
check("delete category with products -> 409", st == 409, f"status={st}")
st, _ = req("DELETE", f"/admin/categories/{ncid}", AT)
check("delete empty category -> 200", st == 200, f"status={st}")

st, orders = req("GET", "/admin/orders", AT)
ords = orders["data"]
check("list orders w/ items+user", st == 200 and ords and "items" in ords[0]
      and ords[0].get("user", {}).get("email"), f"status={st} n={len(ords)}")
pend = next((o for o in ords if o["status"] == "PENDING"), None)
if pend:
    st, _ = req("PATCH", f"/admin/orders/{pend['id']}/status", AT, {"status": "DELIVERED"})
    check("PENDING->DELIVERED -> 400", st == 400, f"status={st}")
    for tgt in ("PAID", "SHIPPED", "DELIVERED"):
        st, o = req("PATCH", f"/admin/orders/{pend['id']}/status", AT, {"status": tgt})
        if not (st == 200 and o["data"]["status"] == tgt):
            check(f"transition -> {tgt}", False, f"status={st}")
            break
    else:
        check("PENDING->PAID->SHIPPED->DELIVERED", True)
    st, _ = req("PATCH", f"/admin/orders/{pend['id']}/status", AT, {"status": "CANCELLED"})
    check("terminal DELIVERED -> 400", st == 400, f"status={st}")

st, orders = req("GET", "/admin/orders", AT, query="?status=PAID")
paid = orders["data"]
if paid:
    oid, item = paid[0]["id"], paid[0]["items"][0]
    st, pb = req("GET", f"/products/{item['product']['slug']}")
    sb = pb["data"]["stock"] if st == 200 else None
    st, oc = req("PATCH", f"/admin/orders/{oid}/status", AT, {"status": "CANCELLED"})
    st, pa = req("GET", f"/products/{item['product']['slug']}")
    sa = pa["data"]["stock"] if st == 200 else None
    check("PAID->CANCELLED restores stock", st == 200 and sa == sb + item["quantity"],
          f"stock {sb}->{sa}")
else:
    check("PAID order available for cancel test", False, "none left")

st, users = req("GET", "/admin/users", AT)
ulist = users["data"]
check("list users, no hashes", st == 200 and all("passwordHash" not in x for x in ulist), f"status={st}")
tgt = next(x for x in ulist if x["role"] == "CUSTOMER")
adm = next(x for x in ulist if x["role"] == "ADMIN")
st, _ = req("PATCH", f"/admin/users/{adm['id']}/disable", AT)
check("disable self -> 400", st == 400, f"status={st}")
st, _ = req("PATCH", f"/admin/users/{tgt['id']}/disable", AT)
check("disable customer -> 200", st == 200, f"status={st}")
st, _ = login(tgt["email"], "Customer@123")
check("disabled login -> 401", st == 401, f"status={st}")
st, _ = req("PATCH", f"/admin/users/{tgt['id']}/enable", AT)
check("re-enable -> 200", st == 200, f"status={st}")
st, _ = login(tgt["email"], "Customer@123")
check("login works after re-enable", st == 200, f"status={st}")

st, stats = req("GET", "/admin/stats", AT)
sd = (stats.get("data") or {}) if stats else {}
check("stats shape sane", st == 200 and isinstance(sd.get("totalRevenue"), (int, float))
      and set(sd.get("ordersByStatus", {})) == {"PENDING", "PAID", "SHIPPED", "DELIVERED", "CANCELLED"},
      f"status={st} rev={sd.get('totalRevenue')}")

print(f"\n{passed}/{passed + failed} passed")
sys.exit(1 if failed else 0)
