import os
import shutil
import subprocess
import sys
from datetime import datetime, timedelta
from pathlib import Path

def run(cmd, cwd):
    res = subprocess.run(cmd, shell=True, cwd=cwd, capture_output=True, text=True)
    if res.returncode != 0:
        print(f"Command failed: {cmd}\nStdout: {res.stdout}\nStderr: {res.stderr}")
        sys.exit(res.returncode)
    return res.stdout.strip()

def build_repo(target_dir: Path):
    target_dir.mkdir(parents=True, exist_ok=True)
    
    # Remove existing .git if present to ensure clean 5 commits
    git_dir = target_dir / ".git"
    if git_dir.exists():
        shutil.rmtree(git_dir)

    run("git init -b main", cwd=target_dir)
    run("git config user.name 'Vishnu Nandan'", cwd=target_dir)
    run("git config user.email 'vishnunandan555@gmail.com'", cwd=target_dir)

    now = datetime.now()
    t1 = (now - timedelta(minutes=90)).strftime("%Y-%m-%d %H:%M:%S")
    t2 = (now - timedelta(minutes=65)).strftime("%Y-%m-%d %H:%M:%S")
    t3 = (now - timedelta(minutes=45)).strftime("%Y-%m-%d %H:%M:%S")
    t4 = (now - timedelta(minutes=30)).strftime("%Y-%m-%d %H:%M:%S")
    t5 = (now - timedelta(minutes=15)).strftime("%Y-%m-%d %H:%M:%S")

    # .gitignore
    (target_dir / ".gitignore").write_text("__pycache__/\n*.pyc\nservice.log\n.pytest_cache/\n")
    # requirements.txt
    (target_dir / "requirements.txt").write_text("fastapi>=0.100.0\nuvicorn>=0.20.0\npytest>=7.0.0\nrequests>=2.28.0\n")
    
    # Commit 1: init order api
    commit1_app = """import os, sys, logging
from typing import Dict, Any, List
from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.responses import JSONResponse
import uvicorn

# Configure service logging
LOG_FILE = os.environ.get("SERVICE_LOG_FILE", "service.log")
logger = logging.getLogger("demo-prod")
logger.setLevel(logging.INFO)

file_handler = logging.FileHandler(LOG_FILE)
file_handler.setFormatter(logging.Formatter("%(asctime)s [%(levelname)s] %(message)s"))
console_handler = logging.StreamHandler(sys.stdout)
console_handler.setFormatter(logging.Formatter("%(asctime)s [%(levelname)s] %(message)s"))
logger.addHandler(file_handler)
logger.addHandler(console_handler)

app = FastAPI(title="Order Total Service")

IS_HEALTHY = True
ORDERS_DB: List[Dict[str, Any]] = []


def calculate_order(order: Dict[str, Any]) -> Dict[str, Any]:
    items = order.get("items", [])
    total = sum(item.get("price", 10.0) * item.get("qty", 1) for item in items)
    return {"items": items, "total": total}


@app.get("/health")
def health_check():
    global IS_HEALTHY
    if not IS_HEALTHY:
        return Response(
            content='{"status": "unhealthy"}',
            status_code=500,
            media_type="application/json",
        )
    return {"status": "healthy", "service": "demo-prod", "version": "1.0.1"}


@app.post("/orders")
async def create_order(request: Request):
    global IS_HEALTHY
    data = await request.json()
    result = calculate_order(data)
    ORDERS_DB.append(result)
    return JSONResponse(status_code=200, content=result)


@app.get("/orders/history")
def get_order_history():
    return {"orders": ORDERS_DB, "count": len(ORDERS_DB)}


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("app:app", host="0.0.0.0", port=port, log_level="warning")
"""
    (target_dir / "app.py").write_text(commit1_app)
    (target_dir / "tests").mkdir(exist_ok=True)
    (target_dir / "tests" / "__init__.py").write_text("")
    (target_dir / "tests" / "test_orders.py").write_text("""from fastapi.testclient import TestClient
from app import app

client = TestClient(app)

def test_health():
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json()["status"] == "healthy"
""")
    run("git add .", cwd=target_dir)
    run(f'GIT_AUTHOR_DATE="{t1}" GIT_COMMITTER_DATE="{t1}" git commit -m "init order api"', cwd=target_dir)

    # Commit 2: add item pricing
    commit2_app = """import os, sys, logging
from typing import Dict, Any, List
from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.responses import JSONResponse
import uvicorn

# Configure service logging
LOG_FILE = os.environ.get("SERVICE_LOG_FILE", "service.log")
logger = logging.getLogger("demo-prod")
logger.setLevel(logging.INFO)

file_handler = logging.FileHandler(LOG_FILE)
file_handler.setFormatter(logging.Formatter("%(asctime)s [%(levelname)s] %(message)s"))
console_handler = logging.StreamHandler(sys.stdout)
console_handler.setFormatter(logging.Formatter("%(asctime)s [%(levelname)s] %(message)s"))
logger.addHandler(file_handler)
logger.addHandler(console_handler)

app = FastAPI(title="Order Total Service")

IS_HEALTHY = True
ORDERS_DB: List[Dict[str, Any]] = []

PRICING_TABLE = {
    "p1": 25.0,
    "p2": 40.0,
    "p3": 15.0,
}


def calculate_order(order: Dict[str, Any]) -> Dict[str, Any]:
    # Calculate order subtotal with catalog pricing
    items = order.get("items", [])
    subtotal = 0.0
    for item in items:
        item_id = item.get("id")
        qty = item.get("qty", 1)
        unit_price = item.get("price", PRICING_TABLE.get(item_id, 10.0))
        subtotal += unit_price * qty

    return {"items": items, "subtotal": subtotal, "total": subtotal}


@app.get("/health")
def health_check():
    global IS_HEALTHY
    if not IS_HEALTHY:
        return Response(
            content='{"status": "unhealthy"}',
            status_code=500,
            media_type="application/json",
        )
    return {"status": "healthy", "service": "demo-prod", "version": "1.0.2"}


@app.post("/orders")
async def create_order(request: Request):
    global IS_HEALTHY
    data = await request.json()
    result = calculate_order(data)
    ORDERS_DB.append(result)
    return JSONResponse(status_code=200, content=result)


@app.get("/orders/history")
def get_order_history():
    return {"orders": ORDERS_DB, "count": len(ORDERS_DB)}


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("app:app", host="0.0.0.0", port=port, log_level="warning")
"""
    (target_dir / "app.py").write_text(commit2_app)
    run("git add app.py", cwd=target_dir)
    run(f'GIT_AUTHOR_DATE="{t2}" GIT_COMMITTER_DATE="{t2}" git commit -m "add item pricing"', cwd=target_dir)

    # Commit 3: add tax calculation
    commit3_app = """import os, sys, logging
from typing import Dict, Any, List
from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.responses import JSONResponse
import uvicorn

# Configure service logging
LOG_FILE = os.environ.get("SERVICE_LOG_FILE", "service.log")
logger = logging.getLogger("demo-prod")
logger.setLevel(logging.INFO)

file_handler = logging.FileHandler(LOG_FILE)
file_handler.setFormatter(logging.Formatter("%(asctime)s [%(levelname)s] %(message)s"))
console_handler = logging.StreamHandler(sys.stdout)
console_handler.setFormatter(logging.Formatter("%(asctime)s [%(levelname)s] %(message)s"))
logger.addHandler(file_handler)
logger.addHandler(console_handler)

app = FastAPI(title="Order Total Service")

IS_HEALTHY = True
ORDERS_DB: List[Dict[str, Any]] = []

TAX_RATE = 0.08
PRICING_TABLE = {
    "p1": 25.0,
    "p2": 40.0,
    "p3": 15.0,
}


def calculate_order(order: Dict[str, Any]) -> Dict[str, Any]:
    # Calculate order subtotal and apply tax
    items = order.get("items", [])
    subtotal = 0.0
    for item in items:
        item_id = item.get("id")
        qty = item.get("qty", 1)
        unit_price = item.get("price", PRICING_TABLE.get(item_id, 10.0))
        subtotal += unit_price * qty

    tax = round(subtotal * TAX_RATE, 2)
    total = round(subtotal + tax, 2)
    return {"items": items, "subtotal": subtotal, "tax": tax, "total": total}


@app.get("/health")
def health_check():
    global IS_HEALTHY
    if not IS_HEALTHY:
        return Response(
            content='{"status": "unhealthy"}',
            status_code=500,
            media_type="application/json",
        )
    return {"status": "healthy", "service": "demo-prod", "version": "1.0.3"}


@app.post("/orders")
async def create_order(request: Request):
    global IS_HEALTHY
    data = await request.json()
    result = calculate_order(data)
    ORDERS_DB.append(result)
    return JSONResponse(status_code=200, content=result)


@app.get("/orders/history")
def get_order_history():
    return {"orders": ORDERS_DB, "count": len(ORDERS_DB)}


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("app:app", host="0.0.0.0", port=port, log_level="warning")
"""
    (target_dir / "app.py").write_text(commit3_app)
    run("git add app.py", cwd=target_dir)
    run(f'GIT_AUTHOR_DATE="{t3}" GIT_COMMITTER_DATE="{t3}" git commit -m "add tax calculation"', cwd=target_dir)

    # Commit 4: add authentication middleware
    commit4_app = """import os, sys, logging
from typing import Dict, Any, List
from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.responses import JSONResponse
import uvicorn

# Configure service logging
LOG_FILE = os.environ.get("SERVICE_LOG_FILE", "service.log")
logger = logging.getLogger("demo-prod")
logger.setLevel(logging.INFO)

file_handler = logging.FileHandler(LOG_FILE)
file_handler.setFormatter(logging.Formatter("%(asctime)s [%(levelname)s] %(message)s"))
console_handler = logging.StreamHandler(sys.stdout)
console_handler.setFormatter(logging.Formatter("%(asctime)s [%(levelname)s] %(message)s"))
logger.addHandler(file_handler)
logger.addHandler(console_handler)

app = FastAPI(title="Order Total Service")

IS_HEALTHY = True
ORDERS_DB: List[Dict[str, Any]] = []

TAX_RATE = 0.08
PRICING_TABLE = {
    "p1": 25.0,
    "p2": 40.0,
    "p3": 15.0,
}


def calculate_order(order: Dict[str, Any]) -> Dict[str, Any]:
    # Calculate order subtotal and apply tax and discounts
    items = order.get("items", [])
    subtotal = 0.0
    for item in items:
        item_id = item.get("id")
        qty = item.get("qty", 1)
        unit_price = item.get("price", PRICING_TABLE.get(item_id, 10.0))
        subtotal += unit_price * qty

    tax = round(subtotal * TAX_RATE, 2)
    total = round(subtotal + tax, 2)
    return {"items": items, "subtotal": subtotal, "tax": tax, "total": total}


@app.get("/health")
def health_check():
    global IS_HEALTHY
    if not IS_HEALTHY:
        return Response(
            content='{"status": "unhealthy", "error": "service degraded after unhandled 500"}',
            status_code=500,
            media_type="application/json",
        )
    return {"status": "healthy", "service": "demo-prod", "version": "1.0.4"}


@app.post("/orders")
async def create_order(request: Request):
    global IS_HEALTHY
    # Middleware verification for incoming request headers
    auth_header = request.headers.get("Authorization", "")
    logger.info(f"Auth check passed: {bool(auth_header)}")
    try:
        data = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")

    logger.info(f"Incoming POST /orders payload={data}")
    try:
        result = calculate_order(data)
        ORDERS_DB.append(result)
        logger.info(f"Order created successfully: total={result['total']}")
        return JSONResponse(status_code=200, content=result)
    except Exception as e:
        IS_HEALTHY = False
        logger.error(f"{type(e).__name__}: {e} in /orders", exc_info=True)
        return JSONResponse(
            status_code=500,
            content={"error": f"Internal Server Error: {type(e).__name__}: {e}"},
        )


@app.get("/orders/history")
def get_order_history():
    return {"orders": ORDERS_DB, "count": len(ORDERS_DB)}


@app.post("/reset")
def reset_service():
    global IS_HEALTHY, ORDERS_DB
    IS_HEALTHY = True
    ORDERS_DB.clear()
    logger.info("Service state reset to healthy")
    return {"status": "reset", "healthy": True}


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("app:app", host="0.0.0.0", port=port, log_level="warning")
"""
    (target_dir / "app.py").write_text(commit4_app)
    run("git add app.py", cwd=target_dir)
    run(f'GIT_AUTHOR_DATE="{t4}" GIT_COMMITTER_DATE="{t4}" git commit -m "add authentication middleware"', cwd=target_dir)

    # Commit 5: feat: add discount support to order checkout (PLANTED BUG: accessing order['discount'] directly)
    # Target: line 45 is discount = order["discount"]
    commit5_app = """import os, sys, logging
from typing import Dict, Any, List
from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.responses import JSONResponse
import uvicorn

# Configure service logging
LOG_FILE = os.environ.get("SERVICE_LOG_FILE", "service.log")
logger = logging.getLogger("demo-prod")
logger.setLevel(logging.INFO)

file_handler = logging.FileHandler(LOG_FILE)
file_handler.setFormatter(logging.Formatter("%(asctime)s [%(levelname)s] %(message)s"))
console_handler = logging.StreamHandler(sys.stdout)
console_handler.setFormatter(logging.Formatter("%(asctime)s [%(levelname)s] %(message)s"))
logger.addHandler(file_handler)
logger.addHandler(console_handler)

app = FastAPI(title="Order Total Service")

IS_HEALTHY = True
ORDERS_DB: List[Dict[str, Any]] = []

TAX_RATE = 0.08
PRICING_TABLE = {
    "p1": 25.0,
    "p2": 40.0,
    "p3": 15.0,
}


def calculate_order(order: Dict[str, Any]) -> Dict[str, Any]:
    # Calculate order subtotal and apply tax and discounts
    items = order.get("items", [])
    subtotal = 0.0
    for item in items:
        item_id = item.get("id")
        qty = item.get("qty", 1)
        unit_price = item.get("price", PRICING_TABLE.get(item_id, 10.0))
        subtotal += unit_price * qty

    tax = round(subtotal * TAX_RATE, 2)

    # Apply discount
    discount = order["discount"]
    total = max(0.0, round(subtotal + tax - discount, 2))
    return {
        "items": items,
        "subtotal": subtotal,
        "tax": tax,
        "discount": discount,
        "total": total,
    }


@app.get("/health")
def health_check():
    global IS_HEALTHY
    if not IS_HEALTHY:
        return Response(
            content='{"status": "unhealthy", "error": "service degraded after unhandled 500"}',
            status_code=500,
            media_type="application/json",
        )
    return {"status": "healthy", "service": "demo-prod", "version": "1.0.5"}


@app.post("/orders")
async def create_order(request: Request):
    global IS_HEALTHY
    # Middleware verification for incoming request headers
    auth_header = request.headers.get("Authorization", "")
    logger.info(f"Auth check passed: {bool(auth_header)}")
    try:
        data = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")

    logger.info(f"Incoming POST /orders payload={data}")
    try:
        result = calculate_order(data)
        ORDERS_DB.append(result)
        logger.info(f"Order created successfully: total={result['total']}")
        return JSONResponse(status_code=200, content=result)
    except Exception as e:
        IS_HEALTHY = False
        logger.error(f"{type(e).__name__}: {e} in /orders", exc_info=True)
        return JSONResponse(
            status_code=500,
            content={"error": f"Internal Server Error: {type(e).__name__}: {e}"},
        )


@app.get("/orders/history")
def get_order_history():
    return {"orders": ORDERS_DB, "count": len(ORDERS_DB)}


@app.post("/reset")
def reset_service():
    global IS_HEALTHY, ORDERS_DB
    IS_HEALTHY = True
    ORDERS_DB.clear()
    logger.info("Service state reset to healthy")
    return {"status": "reset", "healthy": True}


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("app:app", host="0.0.0.0", port=port, log_level="warning")
"""
    (target_dir / "app.py").write_text(commit5_app)
    
    # Write full pytest suite (covering standard orders with discount)
    test_content = """from fastapi.testclient import TestClient
from app import app, calculate_order

client = TestClient(app)

def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"

def test_order_calculation():
    order_data = {
        "items": [
            {"id": "p1", "qty": 2, "price": 25.0},
            {"id": "p2", "qty": 1, "price": 40.0}
        ],
        "discount": 5.0
    }
    result = calculate_order(order_data)
    assert result["subtotal"] == 90.0
    assert result["tax"] == 7.20
    assert result["discount"] == 5.0
    assert result["total"] == 92.20

def test_post_order_endpoint():
    response = client.post(
        "/orders",
        json={"items": [{"id": "p1", "qty": 1, "price": 25.0}], "discount": 0.0}
    )
    assert response.status_code == 200
    assert response.json()["total"] == 27.0

def test_order_history():
    response = client.get("/orders/history")
    assert response.status_code == 200
    assert "orders" in response.json()
"""
    (target_dir / "tests" / "test_orders.py").write_text(test_content)

    run("git add app.py tests/test_orders.py", cwd=target_dir)
    run(f'GIT_AUTHOR_DATE="{t5}" GIT_COMMITTER_DATE="{t5}" git commit -m "feat: add discount support to order checkout"', cwd=target_dir)

    print("Successfully initialized demo-prod git repository with 5 realistic commits!")

if __name__ == "__main__":
    path = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parent.parent / "demo-prod"
    build_repo(path)
