"""Dental Hub API — clinic management and proxying."""
import os
import json
import logging
import asyncio
import ipaddress
from contextlib import asynccontextmanager
from datetime import datetime, timezone

import secrets
import time as _time
import httpx
from fastapi import FastAPI, HTTPException, Request, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse, StreamingResponse

from hub.auth import verify_github_token
from hub.db import init_db, get_clinics, get_clinic, add_clinic, remove_clinic, update_clinic_deploy, update_confirmation_schedule

logger = logging.getLogger(__name__)

_http_client: httpx.AsyncClient | None = None

ADMIN_TOKEN_TTL_HOURS = 24

_BLOCKED_HOSTS = frozenset([
    "169.254.169.254", "metadata.google.internal",
    "localhost", "127.0.0.1", "0.0.0.0",
])


def _validate_server_host(host: str) -> bool:
    """Reject private IPs, localhost, and cloud metadata endpoints."""
    if host in _BLOCKED_HOSTS:
        return False
    try:
        ip = ipaddress.ip_address(host)
        if ip.is_private or ip.is_loopback or ip.is_link_local:
            return False
    except ValueError:
        pass  # hostname, not IP — allow
    return True


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _http_client
    _http_client = httpx.AsyncClient(
        timeout=15,
        limits=httpx.Limits(max_connections=100, max_keepalive_connections=20),
    )

    await init_db()
    # Create default admin from env vars (if set)
    admin_user = os.environ.get("HUB_ADMIN_USER")
    admin_pass = os.environ.get("HUB_ADMIN_PASS")
    if admin_user and admin_pass:
        from hub.db import create_admin_user
        await create_admin_user(admin_user, admin_pass, "Администратор", "admin")

    # Sync prompts to Langfuse on startup (single source of truth: prompts/*.md)
    try:
        from hub.sync_prompts import sync_all
        sync_all()
        logger.info("Prompts synced to Langfuse")
    except Exception as e:
        logger.warning("Failed to sync prompts to Langfuse: %s", e)

    yield
    await _http_client.aclose()


app = FastAPI(title="Dental Hub", lifespan=lifespan)
_cors_origins = os.environ.get("CORS_ORIGINS", "")
_allowed_origins = [o.strip() for o in _cors_origins.split(",") if o.strip()] if _cors_origins else [
    "http://localhost:5173",
    "http://localhost:3000",
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
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
    server_host = data.get("server_host", "")
    if not server_host or not _validate_server_host(server_host):
        raise HTTPException(400, "Invalid server_host: private IPs, localhost, and metadata endpoints are not allowed")
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


# --- Deploy ---

@app.post("/api/clinics/{clinic_id}/deploy")
async def deploy_clinic(clinic_id: str, user=Depends(verify_github_token)):
    """Deploy clinic to target server via SSH. Streams progress as SSE."""
    clinic = await get_clinic(clinic_id)
    if not clinic:
        raise HTTPException(404, "Clinic not found")

    async def deploy_stream():
        try:
            import re as _re
            ssh_host = clinic["server_host"]
            ssh_user = clinic.get("ssh_user", "")
            port = clinic.get("server_port", 8080)

            # Sanitize inputs against shell injection
            cid_raw = clinic["clinic_id"]
            if not _re.match(r'^[a-zA-Z0-9_-]+$', cid_raw):
                yield f"data: {json.dumps({'step': 'validation', 'status': 'error', 'output': 'Invalid clinic_id format'})}\n\n"
                return
            if ssh_user and not _re.match(r'^[a-zA-Z0-9_.-]+$', ssh_user):
                yield f"data: {json.dumps({'step': 'validation', 'status': 'error', 'output': 'Invalid ssh_user format'})}\n\n"
                return
            _raw_config = clinic.get("config", {})
            clinic_config = json.loads(_raw_config) if isinstance(_raw_config, str) else (_raw_config or {})
            hub_url = clinic.get("hub_url", "")

            # Build the .env content for the clinic
            env_lines = [
                f"CLINIC_ID={clinic['clinic_id']}",
                # TODO(PD-295): generate a random password instead of default 'agent'
                # Default credentials for Docker-internal network; matches docker-compose template below
                f"DATABASE_URL=postgresql://agent:agent@agent-postgres:5432/agent",
            ]
            # Add config values as env vars
            if clinic_config.get("openai_api_key"):
                env_lines.append(f"OPENAI_API_KEY={clinic_config['openai_api_key']}")
            if clinic_config.get("openai_api_base"):
                env_lines.append(f"OPENAI_API_BASE={clinic_config['openai_api_base']}")
            if clinic_config.get("openai_proxy_secret"):
                env_lines.append(f"OPENAI_PROXY_SECRET={clinic_config['openai_proxy_secret']}")
            if clinic_config.get("telegram_bot_token"):
                env_lines.append(f"TELEGRAM_BOT_TOKEN={clinic_config['telegram_bot_token']}")
            if clinic_config.get("google_sheets_id"):
                env_lines.append(f"CRM_SPREADSHEET_ID={clinic_config['google_sheets_id']}")
            if clinic_config.get("google_sa_key_path"):
                env_lines.append(f"GOOGLE_SA_KEY_PATH={clinic_config['google_sa_key_path']}")
            if hub_url:
                env_lines.append(f"LANGFUSE_HOST={hub_url}/langfuse")
                env_lines.append(f"LANGFUSE_PUBLIC_KEY={os.environ.get('LANGFUSE_PUBLIC_KEY', '')}")
                env_lines.append(f"LANGFUSE_SECRET_KEY={os.environ.get('LANGFUSE_SECRET_KEY', '')}")

            env_content = "\n".join(env_lines)

            # Each clinic gets its own directory: /opt/dental-clinics/{clinic_id}/
            cid = clinic["clinic_id"]
            clinic_dir = f"/opt/dental-clinics/{cid}"

            # Generate docker-compose.prod.yml with unique project name and port
            compose_content = f"""version: '3.8'
services:
  agent-postgres:
    image: pgvector/pgvector:pg17
    environment:
      POSTGRES_USER: agent
      POSTGRES_PASSWORD: agent  # TODO(PD-295): use generated password, sync with DATABASE_URL
      POSTGRES_DB: agent
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U agent"]
      interval: 5s
      retries: 5

  agent:
    build: ./agent
    ports:
      - "{port}:8080"
    depends_on:
      agent-postgres:
        condition: service_healthy
    env_file: .env
    extra_hosts:
      - "host.docker.internal:host-gateway"

volumes:
  pgdata:
"""

            # SSH commands to execute sequentially
            steps = [
                ("connecting", f"echo 'Connected to {ssh_host}'"),
                ("preparing", f"mkdir -p {clinic_dir}"),
                ("cloning", f"test -d {clinic_dir}/agent/.git && (cd {clinic_dir}/agent && git fetch origin main && git reset --hard FETCH_HEAD) || git clone https://github.com/na-linii/dental-core.git {clinic_dir}/agent"),
                ("configuring_env", f"cat > {clinic_dir}/.env << 'ENVEOF'\n{env_content}\nENVEOF"),
                ("configuring_compose", f"cat > {clinic_dir}/docker-compose.yml << 'COMPEOF'\n{compose_content}\nCOMPEOF"),
                ("building", f"cd {clinic_dir} && docker compose -p {cid} build agent 2>&1 | tail -5"),
                ("starting", f"cd {clinic_dir} && docker compose -p {cid} up -d 2>&1"),
                ("health_check", f"sleep 15 && curl -sf http://localhost:{port}/health && echo ' OK' || echo 'FAIL'"),
            ]

            deploy_log = []

            for step_name, command in steps:
                yield f"data: {json.dumps({'step': step_name, 'status': 'running'})}\n\n"

                try:
                    ssh_key_opt = "-i /app/ssh-keys/deploy_key" if os.path.exists("/app/ssh-keys/deploy_key") else ""
                    full_cmd = f"ssh {ssh_key_opt} -o StrictHostKeyChecking=no -o ConnectTimeout=10 {ssh_user}@{ssh_host} '{command}'"

                    proc = await asyncio.create_subprocess_shell(
                        full_cmd,
                        stdout=asyncio.subprocess.PIPE,
                        stderr=asyncio.subprocess.STDOUT,
                    )
                    stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=300)
                    output = stdout.decode() if stdout else ""

                    success = proc.returncode == 0
                    deploy_log.append(f"[{step_name}] {'OK' if success else 'FAIL'}: {output[:500]}")

                    yield f"data: {json.dumps({'step': step_name, 'status': 'done' if success else 'failed', 'output': output[:200]})}\n\n"

                    if not success:
                        yield f"data: {json.dumps({'step': 'error', 'status': 'failed', 'output': f'Step {step_name} failed'})}\n\n"
                        await update_clinic_deploy(clinic_id, "failed", "\n".join(deploy_log))
                        return

                except asyncio.TimeoutError:
                    deploy_log.append(f"[{step_name}] TIMEOUT")
                    yield f"data: {json.dumps({'step': step_name, 'status': 'failed', 'output': 'Timeout'})}\n\n"
                    await update_clinic_deploy(clinic_id, "failed", "\n".join(deploy_log))
                    return

            await update_clinic_deploy(clinic_id, "deployed", "\n".join(deploy_log))
            yield f"data: {json.dumps({'step': 'done', 'status': 'deployed'})}\n\n"

        except Exception as e:
            logger.error("Deploy error for %s: %s", clinic_id, e)
            yield f"data: {json.dumps({'step': 'error', 'status': 'failed', 'output': 'Internal error'})}\n\n"

    return StreamingResponse(deploy_stream(), media_type="text/event-stream")


@app.get("/api/clinics/{clinic_id}/deploy-status")
async def get_deploy_status(clinic_id: str, user=Depends(verify_github_token)):
    """Get current deploy status and log for a clinic."""
    clinic = await get_clinic(clinic_id)
    if not clinic:
        raise HTTPException(404, "Clinic not found")
    return {
        "deploy_status": clinic.get("deploy_status", "not_deployed"),
        "deploy_log": clinic.get("deploy_log", ""),
    }


# --- Proxy ---

@app.get("/api/clinics/{clinic_id}/health")
async def proxy_health(clinic_id: str, user=Depends(verify_github_token)):
    clinic = await get_clinic(clinic_id)
    if not clinic:
        raise HTTPException(404)
    if not _validate_server_host(clinic['server_host']):
        raise HTTPException(400, "Invalid server_host: private IPs, localhost, and metadata endpoints are not allowed")
    url = f"http://{clinic['server_host']}:{clinic['server_port']}/health"
    try:
        r = await _http_client.get(url, timeout=5)
        return r.json()
    except Exception as e:
        logger.error("proxy_health failed for %s: %s", clinic_id, e)
        return {"status": "unreachable", "error": "Failed to connect to clinic agent"}


@app.get("/api/clinics/{clinic_id}/config")
async def proxy_config(clinic_id: str, user=Depends(verify_github_token)):
    """Proxy clinic config from agent."""
    clinic = await get_clinic(clinic_id)
    if not clinic:
        raise HTTPException(404)
    if not _validate_server_host(clinic['server_host']):
        raise HTTPException(400, "Invalid server_host: private IPs, localhost, and metadata endpoints are not allowed")
    url = f"http://{clinic['server_host']}:{clinic['server_port']}/config"
    try:
        r = await _http_client.get(url, timeout=10)
        return r.json()
    except Exception as e:
        logger.error("proxy_config failed for %s: %s", clinic_id, e)
        return {"config": {}, "error": "Failed to connect to clinic agent"}


@app.post("/api/clinics/{clinic_id}/chat")
async def proxy_chat(clinic_id: str, request: Request, user=Depends(verify_github_token)):
    clinic = await get_clinic(clinic_id)
    if not clinic:
        raise HTTPException(404)
    if not _validate_server_host(clinic['server_host']):
        raise HTTPException(400, "Invalid server_host: private IPs, localhost, and metadata endpoints are not allowed")
    url = f"http://{clinic['server_host']}:{clinic['server_port']}/chat"
    body = await request.json()
    body["clinic_id"] = clinic.get("clinic_id", clinic_id)
    try:
        r = await _http_client.post(url, json=body, timeout=30)
        if r.status_code >= 400:
            return {"response": "Сервис временно недоступен. Попробуйте позже.", "error": True}
        return r.json()
    except Exception as e:
        logger.error("proxy_chat failed for %s: %s", clinic_id, e)
        raise HTTPException(502, "Failed to connect to clinic agent")


@app.put("/api/clinics/{clinic_id}/confirmation-schedule")
async def update_confirmation_schedule_endpoint(clinic_id: str, body: dict, user=Depends(verify_github_token)):
    """Update confirmation reminder schedule for a clinic."""
    clinic = await get_clinic(clinic_id)
    if not clinic:
        raise HTTPException(404, "Clinic not found")

    schedule_hours = body.get("schedule_hours")
    if not isinstance(schedule_hours, list) or not all(isinstance(h, int) for h in schedule_hours):
        raise HTTPException(400, "schedule_hours must be a list of integers")
    if len(schedule_hours) == 0:
        raise HTTPException(400, "schedule_hours must have at least one hour")
    if any(h < 0 or h > 23 for h in schedule_hours):
        raise HTTPException(400, "All hours must be between 0 and 23")

    try:
        # Save to hub database
        await update_confirmation_schedule(clinic_id, schedule_hours)

        # Also notify the running agent to update its runtime config.
        # Uses the new PD-468 admin endpoint that mutates app.state.confirmation_config
        # so the running scheduler sees the change on its next tick.
        agent_synced = False
        if not _validate_server_host(clinic['server_host']):
            logger.warning("Cannot notify agent %s: invalid server_host", clinic_id)
        else:
            url = f"http://{clinic['server_host']}:{clinic['server_port']}/admin/api/settings/confirmation-schedule"
            try:
                resp = await _http_client.put(
                    url,
                    json={"schedule_hours": schedule_hours},
                    headers={"X-Hub-Secret": HUB_SERVICE_SECRET},
                    timeout=5,
                )
            except Exception as e:
                # httpx raises only on network/timeout — agent 4xx/5xx checked below.
                logger.warning("Failed to reach agent %s for schedule update: %s", clinic_id, e)
            else:
                # Variant A: hub DB is source of truth, agent sync is best-effort.
                # Only 409 (scheduler disabled in YAML) is surfaced to the operator;
                # any other non-2xx leaves agent_synced=False and returns 200 — the
                # schedule is saved and will apply on the next agent restart/tick.
                if resp.status_code == 409:
                    raise HTTPException(409, "Confirmation scheduler disabled for this clinic")
                agent_synced = resp.is_success
                if not agent_synced:
                    logger.warning(
                        "Agent %s rejected schedule update: HTTP %s",
                        clinic_id, resp.status_code,
                    )

        return {"ok": True, "agent_synced": agent_synced}
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to update confirmation schedule for %s: %s", clinic_id, e)
        raise HTTPException(500, "Failed to update confirmation schedule")


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

        r = await _http_client.get(
            f"{lf_host}/api/public/traces",
            params=params,
            auth=(lf_pk, lf_sk),
            timeout=10,
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
        logger.error("get_clinic_traces failed for %s: %s", clinic_id, e)
        return {"traces": [], "error": "Failed to fetch traces"}


@app.get("/api/clinics/{clinic_id}/traces/{trace_id}")
async def get_clinic_trace_detail(clinic_id: str, trace_id: str, user=Depends(verify_github_token)):
    """Fetch single trace with observations for animation."""
    lf_pk = os.environ.get("LANGFUSE_PUBLIC_KEY", "")
    lf_sk = os.environ.get("LANGFUSE_SECRET_KEY", "")
    lf_host = os.environ.get("LANGFUSE_HOST", "http://localhost:3000")
    if not lf_pk or not lf_sk:
        return {"flow": [], "error": "Langfuse keys not configured"}

    try:
        r = await _http_client.get(
            f"{lf_host}/api/public/traces/{trace_id}",
            auth=(lf_pk, lf_sk),
            timeout=10,
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
        logger.error("get_clinic_trace_detail failed for %s/%s: %s", clinic_id, trace_id, e)
        return {"trace_id": trace_id, "flow": [], "error": "Failed to fetch trace details"}


@app.get("/api/trace/{trace_id}")
async def get_trace(trace_id: str, user=Depends(verify_github_token)):
    """Fetch trace from Langfuse — returns observation chain for flow visualization."""
    lf_pk = os.environ.get("LANGFUSE_PUBLIC_KEY", "")
    lf_sk = os.environ.get("LANGFUSE_SECRET_KEY", "")
    lf_host = os.environ.get("LANGFUSE_HOST", "http://localhost:3000")

    if not lf_pk or not lf_sk:
        return {"observations": [], "error": "Langfuse keys not configured"}

    try:
        r = await _http_client.get(
            f"{lf_host}/api/public/traces/{trace_id}",
            auth=(lf_pk, lf_sk),
            timeout=10,
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
        logger.error("get_trace failed for %s: %s", trace_id, e)
        return {"trace_id": trace_id, "flow": [], "error": "Failed to fetch trace details"}


@app.get("/api/clinics/{clinic_id}/graph")
async def proxy_graph(clinic_id: str, request: Request, user=Depends(verify_github_token)):
    """Proxy graph structure from clinic agent."""
    clinic = await get_clinic(clinic_id)
    if not clinic:
        raise HTTPException(404)
    if not _validate_server_host(clinic['server_host']):
        raise HTTPException(400, "Invalid server_host: private IPs, localhost, and metadata endpoints are not allowed")
    url = f"http://{clinic['server_host']}:{clinic['server_port']}/graph"
    try:
        r = await _http_client.get(url, params=dict(request.query_params), timeout=10)
        return r.json()
    except Exception as e:
        logger.error("proxy_graph failed for %s: %s", clinic_id, e)
        return {"nodes": [], "links": [], "error": "Failed to connect to clinic agent"}


# --- Settings (viz config — stored in Hub DB for instant updates) ---

@app.get("/api/settings/viz-config")
async def get_viz_config_api(user=Depends(verify_github_token)):
    """Get viz config from Hub DB. Falls back to dental-core graph.json viz_config."""
    from hub.db import get_viz_config
    config = await get_viz_config()
    return {"config": config}


@app.put("/api/settings/viz-config")
async def save_viz_config_api(request: Request, user=Depends(verify_github_token)):
    """Save viz config to Hub DB (instant, no GitHub commit)."""
    from hub.db import save_viz_config
    new_config = await request.json()
    await save_viz_config(new_config)
    return {"ok": True}


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
        "id": user["id"],
        "username": user["username"],
        "full_name": user["full_name"],
        "role": user["role"],
        "clinic_id": user["clinic_id"],
        "clinic_name": user.get("clinic_name", ""),
        "created_at": datetime.now(timezone.utc),
    }
    user_data = {k: v for k, v in app._admin_tokens[token].items() if k != "created_at"}
    return {"access_token": token, "token_type": "bearer", "user": user_data}


@app.get("/admin/api/me")
async def admin_me(authorization: str = Header(default="")):
    token = authorization.replace("Bearer ", "").strip()
    if not hasattr(app, '_admin_tokens') or token not in app._admin_tokens:
        raise HTTPException(401, "Not authenticated")
    token_data = app._admin_tokens[token]
    created_at = token_data.get("created_at")
    if created_at:
        age_hours = (datetime.now(timezone.utc) - created_at).total_seconds() / 3600
        if age_hours > ADMIN_TOKEN_TTL_HOURS:
            del app._admin_tokens[token]
            raise HTTPException(401, "Token expired")
    return {k: v for k, v in token_data.items() if k != "created_at"}


# --- Admin Panel Proxy (routes admin API calls to clinic agent) ---

async def _get_admin_user(authorization: str = Header(default="")):
    """Verify admin token and return user data including clinic_id."""
    token = authorization.replace("Bearer ", "").strip()
    if not hasattr(app, '_admin_tokens') or token not in app._admin_tokens:
        raise HTTPException(401, "Not authenticated")
    token_data = app._admin_tokens[token]
    created_at = token_data.get("created_at")
    if created_at:
        age_hours = (datetime.now(timezone.utc) - created_at).total_seconds() / 3600
        if age_hours > ADMIN_TOKEN_TTL_HOURS:
            del app._admin_tokens[token]
            raise HTTPException(401, "Token expired")
    return token_data


_clinic_cache: dict[str, tuple[dict, float]] = {}
_CLINIC_CACHE_TTL = 300  # 5 minutes


async def _get_clinic_for_admin(admin_user: dict):
    """Resolve clinic connection details for an admin user."""
    clinic_id = admin_user.get("clinic_id")
    if not clinic_id:
        raise HTTPException(400, "Admin user has no clinic assigned")

    # Check cache
    cached = _clinic_cache.get(clinic_id)
    if cached and (_time.time() - cached[1]) < _CLINIC_CACHE_TTL:
        return cached[0]

    clinic = await get_clinic(clinic_id)
    if not clinic:
        raise HTTPException(404, f"Clinic {clinic_id} not found")
    if not _validate_server_host(clinic['server_host']):
        raise HTTPException(400, "Invalid clinic server_host")

    _clinic_cache[clinic_id] = (clinic, _time.time())
    return clinic


HUB_SERVICE_SECRET = os.getenv("HUB_SERVICE_SECRET")
if not HUB_SERVICE_SECRET:
    import secrets as _secrets
    HUB_SERVICE_SECRET = _secrets.token_urlsafe(32)
    logging.warning("HUB_SERVICE_SECRET not set — generated random. Set env var for stable hub↔agent auth.")


async def _proxy_to_clinic(clinic: dict, method: str, path: str, body: dict | None = None, params: dict | None = None):
    """Proxy a request to the clinic agent API with service-level auth."""
    base_url = f"http://{clinic['server_host']}:{clinic['server_port']}"
    url = f"{base_url}{path}"

    headers = {"X-Hub-Secret": HUB_SERVICE_SECRET}

    try:
        if method == "GET":
            r = await _http_client.get(url, params=params, headers=headers)
        elif method == "POST":
            r = await _http_client.post(url, json=body, headers=headers)
        elif method == "PATCH":
            r = await _http_client.patch(url, json=body, headers=headers)
        elif method == "DELETE":
            r = await _http_client.delete(url, params=params, headers=headers)
        elif method == "PUT":
            r = await _http_client.put(url, json=body, headers=headers)
        else:
            raise HTTPException(405, f"Method {method} not supported")

        if r.status_code >= 400:
            logger.error("Clinic proxy error %s %s: %s %s", method, url, r.status_code, r.text[:200])
            raise HTTPException(r.status_code, r.text[:500])
        return r.json()
    except httpx.ConnectError:
        raise HTTPException(502, "Failed to connect to clinic agent")
    except httpx.TimeoutException:
        raise HTTPException(504, "Clinic agent timed out")
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Clinic proxy unexpected error %s %s: %s", method, url, e)
        raise HTTPException(502, "Proxy error")


# --- Dashboard ---

@app.get("/admin/api/dashboard/stats")
async def admin_dashboard_stats(admin_user=Depends(_get_admin_user)):
    clinic = await _get_clinic_for_admin(admin_user)
    return await _proxy_to_clinic(clinic, "GET", "/admin/api/dashboard/stats")


# --- Sessions (proxy to dental-core /admin/api/sessions) ---

@app.get("/admin/api/sessions")
async def admin_sessions(request: Request, admin_user=Depends(_get_admin_user)):
    clinic = await _get_clinic_for_admin(admin_user)
    params = dict(request.query_params)
    return await _proxy_to_clinic(clinic, "GET", "/admin/api/sessions", params=params)


@app.get("/admin/api/sessions/{session_id}")
async def admin_session_detail(session_id: str, request: Request, admin_user=Depends(_get_admin_user)):
    clinic = await _get_clinic_for_admin(admin_user)
    return await _proxy_to_clinic(clinic, "GET", f"/admin/api/sessions/{session_id}", params=dict(request.query_params))


@app.post("/admin/api/sessions/{session_id}/messages")
async def admin_send_message(session_id: str, request: Request, admin_user=Depends(_get_admin_user)):
    clinic = await _get_clinic_for_admin(admin_user)
    body = await request.json()
    body["admin_username"] = admin_user.get("username", "admin")
    return await _proxy_to_clinic(clinic, "POST", f"/admin/api/sessions/{session_id}/messages", body=body)


@app.patch("/admin/api/sessions/{session_id}/controller")
async def admin_update_controller(session_id: str, request: Request, admin_user=Depends(_get_admin_user)):
    clinic = await _get_clinic_for_admin(admin_user)
    body = await request.json()
    return await _proxy_to_clinic(clinic, "PATCH", f"/admin/api/sessions/{session_id}/controller", body=body)


@app.patch("/admin/api/sessions/{session_id}/confirmation")
async def admin_update_confirmation(session_id: str, request: Request, admin_user=Depends(_get_admin_user)):
    clinic = await _get_clinic_for_admin(admin_user)
    body = await request.json()
    return await _proxy_to_clinic(clinic, "PATCH", f"/admin/api/sessions/{session_id}/confirmation", body=body)


@app.patch("/admin/api/sessions/{session_id}/phone")
async def admin_update_phone(session_id: str, request: Request, admin_user=Depends(_get_admin_user)):
    clinic = await _get_clinic_for_admin(admin_user)
    body = await request.json()
    return await _proxy_to_clinic(clinic, "PATCH", f"/admin/api/sessions/{session_id}/phone", body=body)


# --- Calls (PD-399, visible to admin + superadmin) ---
#
# Voice calls are sourced from chat_sessions+voice_calls in dental-core. The
# clinic is resolved from the authenticated admin's record (clinic-scoped),
# and dental-core filters by CLINIC_ID env in SQL — cross-clinic leak is
# impossible regardless of role. See docs/specs/2026-05-13-voice-admin-contract.md.


@app.get("/admin/api/calls")
async def admin_calls(request: Request, admin_user=Depends(_get_admin_user)):
    clinic = await _get_clinic_for_admin(admin_user)
    params = dict(request.query_params)
    return await _proxy_to_clinic(clinic, "GET", "/admin/api/calls", params=params)


@app.get("/admin/api/calls/{session_id}")
async def admin_call_detail(session_id: str, admin_user=Depends(_get_admin_user)):
    clinic = await _get_clinic_for_admin(admin_user)
    return await _proxy_to_clinic(clinic, "GET", f"/admin/api/calls/{session_id}")


@app.get("/admin/api/calls/{session_id}/recording-url")
async def admin_call_recording_url(session_id: str, admin_user=Depends(_get_admin_user)):
    clinic = await _get_clinic_for_admin(admin_user)
    return await _proxy_to_clinic(clinic, "GET", f"/admin/api/calls/{session_id}/recording-url")


# --- Voice Rooms (demo cabinet, in-browser WebRTC call to dental-core agent) ---
#
# Creates a LiveKit room + JWT for the admin user. The voice-agent worker on
# voice-vm picks up the room (prefix `voicedemo-`) and bridges it to the demo
# dental-core backend (port 8084, clinic_id=starsmile_demo). Patient identity
# is conveyed via `caller_phone` so the demo unified-history works (text and
# voice merge by phone via identity.py _find_by_phone).

LIVEKIT_URL = os.environ.get("LIVEKIT_URL", "")
LIVEKIT_API_KEY = os.environ.get("LIVEKIT_API_KEY", "")
LIVEKIT_API_SECRET = os.environ.get("LIVEKIT_API_SECRET", "")

DEMO_VOICE_ALLOWED_CLINIC = "starsmile_demo"


def _demo_voice_enabled() -> bool:
    """Kill switch — set DEMO_VOICE_ENABLED=false on hub-api to disable the
    button + endpoint instantly (no redeploy)."""
    return os.environ.get("DEMO_VOICE_ENABLED", "true").strip().lower() in {"1", "true", "yes", "on"}


def _require_demo_voice(admin_user: dict) -> None:
    """Open to every role inside the demo clinic, but only the demo clinic."""
    if not _demo_voice_enabled():
        raise HTTPException(503, "Demo voice cabinet is temporarily disabled")
    if admin_user.get("clinic_id") != DEMO_VOICE_ALLOWED_CLINIC:
        raise HTTPException(403, "Demo voice cabinet is only available for the demo clinic")


def _mint_livekit_token(identity: str, room: str, ttl_seconds: int = 900) -> str:
    """Mint a LiveKit access token (HS256). Mirrors livekit-server-sdk format."""
    import jwt as _jwt
    if not LIVEKIT_API_KEY or not LIVEKIT_API_SECRET:
        raise HTTPException(503, "Voice service is not configured (LiveKit keys missing)")
    now = int(_time.time())
    payload = {
        "iss": LIVEKIT_API_KEY,
        "sub": identity,
        "nbf": now,
        "iat": now,
        "exp": now + ttl_seconds,
        "name": identity,
        "video": {
            "room": room,
            "roomJoin": True,
            "canPublish": True,
            "canSubscribe": True,
            "canPublishData": True,
        },
    }
    return _jwt.encode(payload, LIVEKIT_API_SECRET, algorithm="HS256")


# Demo patients live in dental-core fixture crm/fixtures/starsmile_eval.yaml.
# Phone numbers MUST match — identity.py resolves caller_phone -> mock CRM
# patient -> user_id, which makes text+voice history merge.
DEMO_PATIENTS = {
    "ivan":          {"phone": "79001111111", "name": "Тестов Иван Иванович",       "note": "взрослый, с историей"},
    "maria":         {"phone": "79002222222", "name": "Тестова Мария Петровна",     "note": "взрослая, постоянная"},
    "novikova":      {"phone": "79003333333", "name": "Новикова Елена Сергеевна",    "note": "новая запись недавно"},
    "petr":          {"phone": "79005550000", "name": "Третьелицов Пётр Олегович",   "note": "записывает третье лицо"},
    "maxim_minor":   {"phone": "79998887768", "name": "Тестов Максим (несовершеннолетний)", "note": "age-policy сценарий"},
    "maxim_primary": {"phone": "79998887767", "name": "Тестов Максим (родитель)",    "note": "первичный профиль"},
}


@app.get("/admin/api/voice-rooms/demo-patients")
async def admin_voice_rooms_demo_patients(admin_user=Depends(_get_admin_user)):
    """List demo patients shown in the call modal. Single source of truth — UI
    renders whatever this endpoint returns, so adding a patient only needs
    DEMO_PATIENTS change."""
    _require_demo_voice(admin_user)
    return {
        "patients": [
            {"key": k, "name": v["name"], "phone": v["phone"], "note": v.get("note", "")}
            for k, v in DEMO_PATIENTS.items()
        ]
    }


@app.post("/admin/api/voice-rooms/clear")
async def admin_voice_rooms_clear(admin_user=Depends(_get_admin_user)):
    """Wipe all demo conversational state (voice + text) so the next call
    starts from a clean slate. Hits dental-core demo backend which truncates
    chat_messages, chat_sessions, voice_calls, voice_turn_meta for the demo
    clinic (and only the demo clinic — guarded by clinic_id=starsmile_demo)."""
    _require_demo_voice(admin_user)
    clinic = await _get_clinic_for_admin(admin_user)
    return await _proxy_to_clinic(clinic, "POST", "/admin/api/demo/clear")


@app.post("/admin/api/voice-rooms/create")
async def admin_voice_rooms_create(request: Request, admin_user=Depends(_get_admin_user)):
    _require_demo_voice(admin_user)
    body = await request.json()
    patient_choice = body.get("patient_choice", "new")
    patient_key = body.get("patient_key", "")

    caller_phone = None
    if patient_choice == "existing":
        patient = DEMO_PATIENTS.get(patient_key)
        if not patient:
            raise HTTPException(400, f"Unknown demo patient: {patient_key}")
        caller_phone = patient["phone"]

    # Room name encodes caller phone AND the TTS stack/voice so the voice-agent
    # worker can extract them without participant metadata plumbing. Format:
    #   voicedemo-{phone-or-new}-elevenlabs-kate-sid_{token}
    #
    # PD-449: stack+voice slugs let detect_stack_voice_speed pick Kate over the
    # Cartesia DEFAULT_STACK. The `sid_` sentinel marks end of override-section
    # (consistent with prodsip/demov3 room formats). Filler bank stays OFF in
    # voicedemo by design (per Konstantin/Aleksey decision 2026-05-25 daily) —
    # only preroll greeting + Kate voice ship to the demo cabinet for now.
    phone_segment = caller_phone if caller_phone else "new"
    room = f"voicedemo-{phone_segment}-elevenlabs-kate-sid_{secrets.token_hex(4)}"
    identity = f"admin-{admin_user.get('username', 'demo')}-{secrets.token_hex(3)}"
    token = _mint_livekit_token(identity=identity, room=room)

    return {
        "room": room,
        "token": token,
        "livekit_url": LIVEKIT_URL,
        "caller_phone": caller_phone,
        "patient_choice": patient_choice,
    }


# --- Actions ---

@app.get("/admin/api/actions")
async def admin_actions(request: Request, admin_user=Depends(_get_admin_user)):
    clinic = await _get_clinic_for_admin(admin_user)
    params = dict(request.query_params)
    return await _proxy_to_clinic(clinic, "GET", "/admin/api/actions", params=params)


@app.patch("/admin/api/actions/{action_id}")
async def admin_update_action(action_id: str, request: Request, admin_user=Depends(_get_admin_user)):
    clinic = await _get_clinic_for_admin(admin_user)
    body = await request.json()
    return await _proxy_to_clinic(clinic, "PATCH", f"/admin/api/actions/{action_id}", body=body)


# --- Cached bookings ---

@app.get("/admin/api/bookings")
async def admin_bookings(request: Request, admin_user=Depends(_get_admin_user)):
    clinic = await _get_clinic_for_admin(admin_user)
    params = dict(request.query_params)
    return await _proxy_to_clinic(clinic, "GET", "/admin/api/bookings", params=params)


# --- Bot settings ---

@app.get("/admin/api/bot/status")
async def admin_bot_status(admin_user=Depends(_get_admin_user)):
    clinic = await _get_clinic_for_admin(admin_user)
    return await _proxy_to_clinic(clinic, "GET", "/admin/api/settings/bot")


@app.post("/admin/api/bot/toggle")
async def admin_bot_toggle(request: Request, admin_user=Depends(_get_admin_user)):
    clinic = await _get_clinic_for_admin(admin_user)
    body = await request.json()
    return await _proxy_to_clinic(clinic, "POST", "/admin/api/settings/bot/toggle", body=body)


@app.get("/admin/api/settings/clinic")
async def admin_clinic_settings(admin_user=Depends(_get_admin_user)):
    clinic = await _get_clinic_for_admin(admin_user)
    return await _proxy_to_clinic(clinic, "GET", "/admin/api/settings/clinic")


# --- Confirmation schedule ---

@app.get("/admin/api/confirmation-schedule")
async def admin_get_confirmation_schedule(admin_user=Depends(_get_admin_user)):
    """Get confirmation reminder schedule (hours only) for admin's clinic."""
    clinic = await _get_clinic_for_admin(admin_user)
    clinic_id = clinic["id"]

    fresh_clinic = await get_clinic(clinic_id)
    config = fresh_clinic.get("config") or {} if fresh_clinic else {}
    if isinstance(config, str):
        config = json.loads(config)

    confirmation = config.get("confirmation") or {}
    schedule_hours = confirmation.get("schedule_hours") or []
    return {"schedule_hours": schedule_hours}


@app.put("/admin/api/confirmation-schedule")
async def admin_update_confirmation_schedule(request: Request, admin_user=Depends(_get_admin_user)):
    """Update confirmation reminder schedule (hours only) for admin's clinic."""
    clinic = await _get_clinic_for_admin(admin_user)
    body = await request.json()

    schedule_hours = body.get("schedule_hours")
    if not isinstance(schedule_hours, list) or not all(isinstance(h, int) for h in schedule_hours):
        raise HTTPException(400, "schedule_hours must be a list of integers")
    if len(schedule_hours) == 0:
        raise HTTPException(400, "schedule_hours must have at least one hour")
    if any(h < 0 or h > 23 for h in schedule_hours):
        raise HTTPException(400, "All hours must be between 0 and 23")

    sorted_hours = sorted(set(schedule_hours))

    clinic_id = clinic["id"]
    try:
        from hub.db import get_pool
        pool = await get_pool()
        async with pool.acquire() as conn:
            row = await conn.fetchrow("SELECT config FROM hub.clinics WHERE id = $1", clinic_id)
            current_config = {}
            if row and row["config"]:
                c = row["config"]
                current_config = json.loads(c) if isinstance(c, str) else c
            if "confirmation" not in current_config:
                current_config["confirmation"] = {}
            current_config["confirmation"]["schedule_hours"] = sorted_hours
            # Drop legacy field if present
            current_config["confirmation"].pop("schedule_times", None)
            await conn.execute(
                "UPDATE hub.clinics SET config = $1::jsonb, updated_at = NOW() WHERE id = $2",
                json.dumps(current_config), clinic_id)

        agent_synced = False
        if _validate_server_host(clinic['server_host']):
            url = f"http://{clinic['server_host']}:{clinic['server_port']}/admin/api/settings/confirmation-schedule"
            try:
                resp = await _http_client.put(
                    url,
                    json={"schedule_hours": sorted_hours},
                    headers={"X-Hub-Secret": HUB_SERVICE_SECRET},
                    timeout=5,
                )
            except Exception as e:
                # httpx raises only on network/timeout — agent 4xx/5xx checked below.
                logger.warning("Failed to reach agent %s for schedule update: %s", clinic_id, e)
            else:
                # Variant A: hub DB is source of truth, agent sync is best-effort.
                # Only 409 (scheduler disabled in YAML) is surfaced to the operator;
                # any other non-2xx leaves agent_synced=False and returns 200 — the
                # schedule is saved and will apply on the next agent restart/tick.
                if resp.status_code == 409:
                    raise HTTPException(409, "Confirmation scheduler disabled for this clinic")
                agent_synced = resp.is_success
                if not agent_synced:
                    logger.warning(
                        "Agent %s rejected schedule update: HTTP %s",
                        clinic_id, resp.status_code,
                    )
        else:
            logger.warning("Cannot notify agent %s: invalid server_host", clinic_id)

        return {"ok": True, "schedule_hours": sorted_hours, "agent_synced": agent_synced}
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to update confirmation schedule for %s: %s", clinic_id, e)
        raise HTTPException(500, "Failed to update confirmation schedule")


# --- Blocklist ---

@app.get("/admin/api/blocklist")
async def admin_blocklist(request: Request, admin_user=Depends(_get_admin_user)):
    clinic = await _get_clinic_for_admin(admin_user)
    params = dict(request.query_params)
    return await _proxy_to_clinic(clinic, "GET", "/admin/api/settings/blocklist", params=params)


@app.post("/admin/api/blocklist")
async def admin_blocklist_add(request: Request, admin_user=Depends(_get_admin_user)):
    clinic = await _get_clinic_for_admin(admin_user)
    body = await request.json()
    return await _proxy_to_clinic(clinic, "POST", "/admin/api/settings/blocklist", body=body)


@app.delete("/admin/api/blocklist/{entry_id}")
async def admin_blocklist_remove(entry_id: str, admin_user=Depends(_get_admin_user)):
    clinic = await _get_clinic_for_admin(admin_user)
    return await _proxy_to_clinic(clinic, "DELETE", f"/admin/api/settings/blocklist/{entry_id}")


# ── Telegram import ──────────────────────────────────────────────────────

@app.post("/admin/api/telegram/import")
async def admin_telegram_import_start(request: Request, admin_user=Depends(_get_admin_user)):
    clinic = await _get_clinic_for_admin(admin_user)
    body = await request.json()
    return await _proxy_to_clinic(clinic, "POST", "/admin/api/telegram/import", body=body)


@app.post("/admin/api/telegram/import/cancel")
async def admin_telegram_import_cancel(admin_user=Depends(_get_admin_user)):
    clinic = await _get_clinic_for_admin(admin_user)
    return await _proxy_to_clinic(clinic, "POST", "/admin/api/telegram/import/cancel")


@app.get("/admin/api/telegram/import/status")
async def admin_telegram_import_status(admin_user=Depends(_get_admin_user)):
    clinic = await _get_clinic_for_admin(admin_user)
    return await _proxy_to_clinic(clinic, "GET", "/admin/api/telegram/import/status")


@app.get("/admin/api/telegram/import/history")
async def admin_telegram_import_history(admin_user=Depends(_get_admin_user)):
    clinic = await _get_clinic_for_admin(admin_user)
    return await _proxy_to_clinic(clinic, "GET", "/admin/api/telegram/import/history")


# ── MAX userbot import ──────────────────────────────────────────────────

@app.post("/admin/api/max_userbot/import")
async def admin_max_userbot_import_start(request: Request, admin_user=Depends(_get_admin_user)):
    clinic = await _get_clinic_for_admin(admin_user)
    body = await request.json()
    return await _proxy_to_clinic(clinic, "POST", "/admin/api/max_userbot/import", body=body)


@app.post("/admin/api/max_userbot/import/cancel")
async def admin_max_userbot_import_cancel(admin_user=Depends(_get_admin_user)):
    clinic = await _get_clinic_for_admin(admin_user)
    return await _proxy_to_clinic(clinic, "POST", "/admin/api/max_userbot/import/cancel")


@app.get("/admin/api/max_userbot/import/status")
async def admin_max_userbot_import_status(admin_user=Depends(_get_admin_user)):
    clinic = await _get_clinic_for_admin(admin_user)
    return await _proxy_to_clinic(clinic, "GET", "/admin/api/max_userbot/import/status")


@app.get("/admin/api/max_userbot/import/history")
async def admin_max_userbot_import_history(admin_user=Depends(_get_admin_user)):
    clinic = await _get_clinic_for_admin(admin_user)
    return await _proxy_to_clinic(clinic, "GET", "/admin/api/max_userbot/import/history")


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
    result = await delete_admin_user(admin_id, clinic_id=clinic_id)
    if result and result == "DELETE 0":
        raise HTTPException(404, "Admin not found in this clinic")
    return {"ok": True}
