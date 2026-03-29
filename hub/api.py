"""Dental Hub API — clinic management and proxying."""
import os
import logging
from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI, HTTPException, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import RedirectResponse

from hub.auth import verify_github_token
from hub.db import init_db, get_clinics, get_clinic, add_clinic, remove_clinic

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
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
                f"{lf_host}/api/public/v2/dataset-items?datasetName=dental-edge-cases&limit=100",
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


# --- Frontend ---

frontend_dir = os.path.join(os.path.dirname(__file__), "..", "frontend")
if os.path.isdir(frontend_dir):
    app.mount("/", StaticFiles(directory=frontend_dir, html=True), name="frontend")
