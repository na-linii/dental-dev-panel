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
            return r.json()
    except Exception as e:
        raise HTTPException(502, f"Clinic unreachable: {e}")


@app.get("/api/clinics/{clinic_id}/graph")
async def proxy_graph(clinic_id: str, user=Depends(verify_github_token)):
    """Proxy graph structure from clinic agent."""
    clinic = await get_clinic(clinic_id)
    if not clinic:
        raise HTTPException(404)
    url = f"http://{clinic['server_host']}:{clinic['server_port']}/graph"
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(url)
            return r.json()
    except Exception as e:
        return {"nodes": [], "links": [], "error": str(e)}


# --- Langfuse redirect ---

@app.get("/langfuse")
async def langfuse_redirect():
    host = os.environ.get("LANGFUSE_EXTERNAL_URL", "http://localhost:3000")
    return RedirectResponse(host)


# --- Frontend ---

frontend_dir = os.path.join(os.path.dirname(__file__), "..", "frontend")
if os.path.isdir(frontend_dir):
    app.mount("/", StaticFiles(directory=frontend_dir, html=True), name="frontend")
