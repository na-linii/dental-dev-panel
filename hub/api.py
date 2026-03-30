"""Dental Hub API — clinic management and proxying."""
import os
import logging
from contextlib import asynccontextmanager

import secrets
import httpx
from fastapi import FastAPI, HTTPException, Request, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import RedirectResponse

from hub.auth import verify_github_token
from hub.db import init_db, get_clinics, get_clinic, add_clinic, remove_clinic

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    # Create default admin from env vars (if set)
    admin_user = os.environ.get("HUB_ADMIN_USER")
    admin_pass = os.environ.get("HUB_ADMIN_PASS")
    if admin_user and admin_pass:
        from hub.db import create_admin_user
        await create_admin_user(admin_user, admin_pass, "Администратор", "admin")
    yield


app = FastAPI(title="Dental Hub", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- Health ---

@app.get("/health")
async def health():
    return {"status": "ok", "service": "dental-hub"}


# --- Clinics ---

@app.get("/api/clinics")
async def list_clinics(user=Depends(verify_github_token)):
    clinics = await get_clinics()
    return {"clinics": clinics}


@app.post("/api/clinics")
async def create_clinic(request: Request, user=Depends(verify_github_token)):
    data = await request.json()
    clinic = await add_clinic(data)
    return {"ok": True, "clinic": clinic}


@app.get("/api/clinics/{clinic_id}")
async def get_clinic_detail(clinic_id: str, user=Depends(verify_github_token)):
    clinic = await get_clinic(clinic_id)
    if not clinic:
        raise HTTPException(404, f"Clinic {clinic_id} not found")
    return clinic


@app.delete("/api/clinics/{clinic_id}")
async def delete_clinic(clinic_id: str, user=Depends(verify_github_token)):
    await remove_clinic(clinic_id)
    return {"ok": True}


# --- Proxy ---

@app.get("/api/clinics/{clinic_id}/health")
async def proxy_health(clinic_id: str, user=Depends(verify_github_token)):
    clinic = await get_clinic(clinic_id)
    if not clinic:
        raise HTTPException(404)
    url = f"http://{clinic['server_host']}:{clinic['server_port']}/health"
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            r = await client.get(url)
            return r.json()
    except Exception as e:
        return {"status": "unreachable", "error": str(e)}


@app.get("/api/clinics/{clinic_id}/config")
async def proxy_config(clinic_id: str, user=Depends(verify_github_token)):
    """Proxy clinic config from agent."""
    clinic = await get_clinic(clinic_id)
    if not clinic:
        raise HTTPException(404)
    url = f"http://{clinic['server_host']}:{clinic['server_port']}/config"
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(url)
            return r.json()
    except Exception as e:
        return {"config": {}, "error": str(e)}


@app.post("/api/clinics/{clinic_id}/chat")
async def proxy_chat(clinic_id: str, request: Request, user=Depends(verify_github_token)):
    clinic = await get_clinic(clinic_id)
    if not clinic:
        raise HTTPException(404)
    url = f"http://{clinic['server_host']}:{clinic['server_port']}/chat"
    body = await request.json()
    body["clinic_id"] = clinic.get("clinic_id", clinic_id)
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.post(url, json=body)
            if r.status_code >= 400:
                return {"response": "Сервис временно недоступен. Попробуйте позже.", "error": True}
            return r.json()
    except Exception as e:
        raise HTTPException(502, f"Clinic unreachable: {e}")


# --- Traces (Langfuse-powered) ---

@app.get("/api/clinics/{clinic_id}/traces")
async def get_clinic_traces(clinic_id: str, limit: int = 30, since: str = "", user=Depends(verify_github_token)):
    """Fetch recent traces for a clinic from Langfuse."""
    lf_pk = os.environ.get("LANGFUSE_PUBLIC_KEY", "")
    lf_sk = os.environ.get("LANGFUSE_SECRET_KEY", "")
    lf_host = os.environ.get("LANGFUSE_HOST", "http://localhost:3000")
    if not lf_pk or not lf_sk:
        return {"traces": [], "error": "Langfuse keys not configured"}

    try:
        params = {"limit": min(limit, 100), "tags": clinic_id}
        if since:
            params["fromTimestamp"] = since

        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(
                f"{lf_host}/api/public/traces",
                params=params,
                auth=(lf_pk, lf_sk),
            )
            data = r.json()

        traces = []
        for t in data.get("data", []):
            traces.append({
                "id": t.get("id"),
                "name": t.get("name"),
                "startTime": t.get("timestamp"),
                "latency": t.get("latency"),
                "tags": t.get("tags", []),
                "userId": t.get("userId"),
                "sessionId": t.get("sessionId"),
                "input": t.get("input"),
                "output": t.get("output"),
                "metadata": t.get("metadata"),
                "scores": t.get("scores", []),
            })
        return {"traces": traces}
    except Exception as e:
        return {"traces": [], "error": str(e)}


@app.get("/api/clinics/{clinic_id}/traces/{trace_id}")
async def get_clinic_trace_detail(clinic_id: str, trace_id: str, user=Depends(verify_github_token)):
    """Fetch single trace with observations for animation."""
    lf_pk = os.environ.get("LANGFUSE_PUBLIC_KEY", "")
    lf_sk = os.environ.get("LANGFUSE_SECRET_KEY", "")
    lf_host = os.environ.get("LANGFUSE_HOST", "http://localhost:3000")
    if not lf_pk or not lf_sk:
        return {"flow": [], "error": "Langfuse keys not configured"}

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(
                f"{lf_host}/api/public/traces/{trace_id}",
                auth=(lf_pk, lf_sk),
            )
            trace = r.json()

        flow = []
        for obs in trace.get("observations", []):
            name = obs.get("name", "")
            if not name or name in ("RunnableSequence", "Prompt", "should_continue", "call_model", "RunnableLambda"):
                continue
            inp = obs.get("input")
            out = obs.get("output")
            if isinstance(inp, str) and len(inp) > 500: inp = inp[:500] + "..."
            if isinstance(out, str) and len(out) > 500: out = out[:500] + "..."
            flow.append({
                "name": name,
                "type": obs.get("type", ""),
                "model": obs.get("model"),
                "startTime": obs.get("startTime"),
                "endTime": obs.get("endTime"),
                "input": inp,
                "output": out,
                "id": obs.get("id", ""),
                "parentId": obs.get("parentObservationId"),
            })
        return {"trace_id": trace_id, "flow": flow}
    except Exception as e:
        return {"trace_id": trace_id, "flow": [], "error": str(e)}


@app.get("/api/trace/{trace_id}")
async def get_trace(trace_id: str, user=Depends(verify_github_token)):
    """Fetch trace from Langfuse — returns observation chain for flow visualization."""
    lf_pk = os.environ.get("LANGFUSE_PUBLIC_KEY", "")
    lf_sk = os.environ.get("LANGFUSE_SECRET_KEY", "")
    lf_host = os.environ.get("LANGFUSE_HOST", "http://localhost:3000")

    if not lf_pk or not lf_sk:
        return {"observations": [], "error": "Langfuse keys not configured"}

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(
                f"{lf_host}/api/public/traces/{trace_id}",
                auth=(lf_pk, lf_sk),
            )
            trace = r.json()

        # Extract flow with full data
        flow = []
        for obs in trace.get("observations", []):
            name = obs.get("name", "")
            if not name or name in ("RunnableSequence", "Prompt", "should_continue", "call_model", "RunnableLambda"):
                continue
            inp = obs.get("input")
            out = obs.get("output")
            # Truncate large values
            if isinstance(inp, str) and len(inp) > 500: inp = inp[:500] + "..."
            if isinstance(out, str) and len(out) > 500: out = out[:500] + "..."
            flow.append({
                "name": name,
                "type": obs.get("type", ""),
                "model": obs.get("model"),
                "startTime": obs.get("startTime"),
                "endTime": obs.get("endTime"),
                "input": inp,
                "output": out,
                "metadata": obs.get("metadata"),
                "id": obs.get("id", ""),
                "parentId": obs.get("parentObservationId"),
            })

        return {"trace_id": trace_id, "flow": flow}
    except Exception as e:
        return {"trace_id": trace_id, "flow": [], "error": str(e)}


@app.get("/api/clinics/{clinic_id}/graph")
async def proxy_graph(clinic_id: str, request: Request, user=Depends(verify_github_token)):
    """Proxy graph structure from clinic agent."""
    clinic = await get_clinic(clinic_id)
    if not clinic:
        raise HTTPException(404)
    url = f"http://{clinic['server_host']}:{clinic['server_port']}/graph"
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(url, params=dict(request.query_params))
            return r.json()
    except Exception as e:
        return {"nodes": [], "links": [], "error": str(e)}


# --- Architecture (source of truth = GitHub repo) ---

GRAPH_JSON_URL = "https://api.github.com/repos/na-linii/dental-core/contents/agent/graph.json"

@app.get("/api/architecture/graph")
async def architecture_graph(authorization: str = Header(default=""), user=Depends(verify_github_token)):
    """Module architecture graph — reads from GitHub repo (single source of truth).

    Unlike /clinics/{id}/graph which proxies to a running agent,
    this always reflects the latest code in the repo.
    """
    gh_token = authorization.replace("Bearer ", "").strip()
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            headers = {
                "Accept": "application/vnd.github.raw+json",
                "Authorization": f"Bearer {gh_token}",
            }
            r = await client.get(GRAPH_JSON_URL, headers=headers, params={"ref": "main"})
            if r.status_code == 200:
                return r.json()
            return {"nodes": [], "links": [], "error": f"GitHub API: {r.status_code}"}
    except Exception as e:
        return {"nodes": [], "links": [], "error": str(e)}


# --- Edge Cases (from Langfuse dataset) ---

@app.get("/api/edge-cases")
async def get_edge_cases(user=Depends(verify_github_token)):
    """Fetch edge case items from Langfuse dataset — single source of truth."""
    lf_pk = os.environ.get("LANGFUSE_PUBLIC_KEY", "")
    lf_sk = os.environ.get("LANGFUSE_SECRET_KEY", "")
    lf_host = os.environ.get("LANGFUSE_HOST", "http://localhost:3000")

    if not lf_pk or not lf_sk:
        return {"items": [], "error": "Langfuse keys not configured"}

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(
                f"{lf_host}/api/public/v2/datasets/dental-edge-cases",
                auth=(lf_pk, lf_sk),
            )
            if r.status_code == 404:
                return {"items": [], "error": "Dataset 'dental-edge-cases' not found. Run: python scripts/run_eval.py --seed-only"}
            dataset = r.json()

            r2 = await client.get(
                f"{lf_host}/api/public/dataset-items?datasetName=dental-edge-cases&limit=100",
                auth=(lf_pk, lf_sk),
            )
            items_data = r2.json()

        items = []
        for item in items_data.get("data", []):
            inp = item.get("input") or {}
            exp = item.get("expectedOutput") or {}
            meta = item.get("metadata") or {}
            items.append({
                "id": meta.get("id", item.get("id", "")),
                "category": meta.get("category", "other"),
                "message": inp.get("message", ""),
                "expected": exp.get("behavior", ""),
                "patient_name": meta.get("patient_name"),
                "patient_phone": meta.get("patient_phone"),
                "is_identified": meta.get("is_identified", False),
                "history": meta.get("history", []),
            })

        return {"items": items, "dataset": dataset.get("name", "dental-edge-cases")}
    except Exception as e:
        return {"items": [], "error": str(e)}


@app.get("/api/langfuse-url")
async def langfuse_url(user=Depends(verify_github_token)):
    """Return Langfuse external URL for trace links."""
    return {"url": os.environ.get("LANGFUSE_EXTERNAL_URL", "http://localhost:3000")}


# --- Langfuse redirect ---

@app.get("/langfuse")
async def langfuse_redirect():
    host = os.environ.get("LANGFUSE_EXTERNAL_URL", "http://localhost:3000")
    return RedirectResponse(host)


# --- Admin Panel API ---

@app.post("/admin/api/login")
async def admin_login(request: Request):
    data = await request.json()
    username = data.get("username", "")
    password = data.get("password", "")
    if not username or not password:
        raise HTTPException(400, "Username and password required")

    from hub.db import authenticate_admin
    user = await authenticate_admin(username, password)
    if not user:
        raise HTTPException(401, "Invalid credentials")

    token = secrets.token_urlsafe(32)
    # Simple token storage (in-memory for now, will be replaced with proper sessions)
    if not hasattr(app, '_admin_tokens'):
        app._admin_tokens = {}
    app._admin_tokens[token] = {
        "user_id": user["id"],
        "username": user["username"],
        "full_name": user["full_name"],
        "role": user["role"],
        "clinic_id": user["clinic_id"],
    }
    return {"token": token, "user": app._admin_tokens[token]}


@app.get("/admin/api/me")
async def admin_me(authorization: str = Header(default="")):
    token = authorization.replace("Bearer ", "").strip()
    if not hasattr(app, '_admin_tokens') or token not in app._admin_tokens:
        raise HTTPException(401, "Not authenticated")
    return app._admin_tokens[token]


# --- Clinic Admin Users API (used by Hub frontend) ---

@app.get("/api/clinics/{clinic_id}/admins")
async def list_clinic_admins(clinic_id: str, user=Depends(verify_github_token)):
    from hub.db import get_clinic_admins
    admins = await get_clinic_admins(clinic_id)
    return {"admins": admins}


@app.post("/api/clinics/{clinic_id}/admins")
async def add_clinic_admin(clinic_id: str, request: Request, user=Depends(verify_github_token)):
    data = await request.json()
    username = data.get("username", "").strip()
    password = data.get("password", "").strip()
    full_name = data.get("full_name", "").strip()
    role = data.get("role", "operator")

    if not username or not password:
        raise HTTPException(400, "username and password required")
    if role not in ("operator", "admin", "superadmin"):
        raise HTTPException(400, "role must be operator, admin, or superadmin")

    from hub.db import create_clinic_admin
    admin = await create_clinic_admin(username, password, full_name, role, clinic_id)
    if not admin:
        raise HTTPException(409, f"Username '{username}' already exists")
    return {"admin": admin}


@app.delete("/api/clinics/{clinic_id}/admins/{admin_id}")
async def remove_clinic_admin(clinic_id: str, admin_id: int, user=Depends(verify_github_token)):
    from hub.db import delete_admin_user
    await delete_admin_user(admin_id)
    return {"ok": True}


# --- Jira integration (roadmap tasks) ---

JIRA_CLOUD = "na-linii.atlassian.net"
JIRA_PROJECT = "PD"
JIRA_EMAIL = os.getenv("JIRA_USER_EMAIL", "")
JIRA_TOKEN = os.getenv("JIRA_API_TOKEN", "")


@app.get("/api/roadmap/tasks")
async def get_roadmap_tasks(user=Depends(verify_github_token)):
    """Fetch 🔵 Dental Core/Hub tasks from Jira for roadmap timeline."""
    if not JIRA_EMAIL or not JIRA_TOKEN:
        raise HTTPException(503, "Jira credentials not configured")

    jql = 'project = PD AND key >= PD-136 AND (summary ~ "Dental Core" OR summary ~ "Dental Hub") ORDER BY created ASC'
    url = f"https://{JIRA_CLOUD}/rest/api/3/search/jql"
    params = {
        "jql": jql,
        "maxResults": 50,
        "fields": "summary,status,assignee,created,updated,description",
    }

    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(
            url,
            params=params,
            auth=(JIRA_EMAIL, JIRA_TOKEN),
        )

    if resp.status_code != 200:
        logger.error("Jira API error %s: %s", resp.status_code, resp.text[:200])
        raise HTTPException(502, "Jira API error")

    data = resp.json()
    tasks = []
    for issue in data.get("issues", []):
        f = issue["fields"]
        assignee = f.get("assignee")
        tasks.append({
            "key": issue["key"],
            "summary": f.get("summary", ""),
            "status": f["status"]["name"] if f.get("status") else "Unknown",
            "statusCategory": f["status"]["statusCategory"]["key"] if f.get("status") else "new",
            "assignee": assignee["displayName"] if assignee else None,
            "assigneeAvatar": assignee["avatarUrls"]["32x32"] if assignee else None,
            "url": f"https://{JIRA_CLOUD}/browse/{issue['key']}",
            "created": f.get("created"),
            "updated": f.get("updated"),
        })

    return {"tasks": tasks, "total": data.get("total", 0)}


@app.get("/api/roadmap/epics")
async def get_roadmap_epics(user=Depends(verify_github_token)):
    """Fetch epics with child tasks and progress from Jira."""
    if not JIRA_EMAIL or not JIRA_TOKEN:
        raise HTTPException(503, "Jira credentials not configured")

    base_url = f"https://{JIRA_CLOUD}/rest/api/3/search/jql"

    # 1. Fetch all epics in project
    epics_jql = f'project = {JIRA_PROJECT} AND issuetype = Epic ORDER BY created ASC'
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(
            base_url,
            params={
                "jql": epics_jql,
                "maxResults": 50,
                "fields": "summary,status",
            },
            auth=(JIRA_EMAIL, JIRA_TOKEN),
        )

    if resp.status_code != 200:
        logger.error("Jira API error (epics) %s: %s", resp.status_code, resp.text[:200])
        raise HTTPException(502, "Jira API error")

    epics_data = resp.json()
    epics = []

    # 2. For each epic, fetch child tasks
    async with httpx.AsyncClient(timeout=30) as client:
        for epic_issue in epics_data.get("issues", []):
            ef = epic_issue["fields"]
            epic_key = epic_issue["key"]

            children_jql = f"parent = {epic_key} ORDER BY created ASC"
            children_resp = await client.get(
                base_url,
                params={
                    "jql": children_jql,
                    "maxResults": 100,
                    "fields": "summary,status,assignee",
                },
                auth=(JIRA_EMAIL, JIRA_TOKEN),
            )

            tasks = []
            done = 0
            in_progress = 0
            if children_resp.status_code == 200:
                for child in children_resp.json().get("issues", []):
                    cf = child["fields"]
                    assignee = cf.get("assignee")
                    status_cat = cf["status"]["statusCategory"]["key"] if cf.get("status") else "new"

                    if status_cat == "done":
                        done += 1
                    elif status_cat == "indeterminate":
                        in_progress += 1

                    tasks.append({
                        "key": child["key"],
                        "summary": cf.get("summary", ""),
                        "status": cf["status"]["name"] if cf.get("status") else "Unknown",
                        "statusCategory": status_cat,
                        "assignee": assignee["displayName"] if assignee else None,
                        "assigneeAvatar": assignee["avatarUrls"]["32x32"] if assignee else None,
                        "url": f"https://{JIRA_CLOUD}/browse/{child['key']}",
                    })

            total = len(tasks)
            todo = total - done - in_progress
            percent = round(done / total * 100) if total > 0 else 0

            epics.append({
                "key": epic_key,
                "summary": ef.get("summary", ""),
                "status": ef["status"]["name"] if ef.get("status") else "Unknown",
                "progress": {
                    "total": total,
                    "done": done,
                    "in_progress": in_progress,
                    "todo": todo,
                    "percent": percent,
                },
                "tasks": tasks,
            })

    return {"epics": epics}


# --- Frontend (React SPA with fallback) ---

frontend_dir = os.path.join(os.path.dirname(__file__), "..", "frontend")
if os.path.isdir(frontend_dir):
    from fastapi.responses import FileResponse

    app.mount("/assets", StaticFiles(directory=os.path.join(frontend_dir, "assets")), name="assets")

    @app.get("/{path:path}")
    async def spa_fallback(path: str):
        """Serve React SPA — all non-API, non-admin routes return index.html."""
        if path.startswith("admin") or path.startswith("langfuse"):
            raise HTTPException(404)
        file_path = os.path.join(frontend_dir, path)
        if os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(frontend_dir, "index.html"))
