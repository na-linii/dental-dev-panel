"""Hub database — clinic registry (PostgreSQL)."""
import os
import json
import asyncpg

DATABASE_URL = os.environ.get("HUB_DATABASE_URL",
    "postgresql://langfuse:langfuse@langfuse-postgres:5432/langfuse")

_pool = None


async def get_pool():
    global _pool
    if _pool is None:
        _pool = await asyncpg.create_pool(DATABASE_URL, min_size=2, max_size=10)
    return _pool


async def init_db():
    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.execute("CREATE SCHEMA IF NOT EXISTS hub")
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS hub.clinics (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                server_host TEXT NOT NULL,
                server_port INTEGER DEFAULT 8080,
                clinic_id TEXT NOT NULL,
                status TEXT DEFAULT 'active',
                config JSONB DEFAULT '{}',
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            )
        """)


async def get_clinics():
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch("SELECT * FROM hub.clinics ORDER BY created_at")
        return [dict(r) for r in rows]


async def get_clinic(clinic_id: str):
    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow("SELECT * FROM hub.clinics WHERE id = $1", clinic_id)
        return dict(row) if row else None


async def add_clinic(data: dict):
    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.execute("""
            INSERT INTO hub.clinics (id, name, server_host, server_port, clinic_id, status, config)
            VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
            ON CONFLICT (id) DO UPDATE SET
                name = EXCLUDED.name,
                server_host = EXCLUDED.server_host,
                server_port = EXCLUDED.server_port,
                clinic_id = EXCLUDED.clinic_id,
                config = EXCLUDED.config,
                updated_at = NOW()
        """, data["id"], data["name"], data["server_host"],
            data.get("server_port", 8080),
            data.get("clinic_id", data["id"]),
            "active",
            json.dumps(data.get("config", {})))
    return data


async def remove_clinic(clinic_id: str):
    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.execute("DELETE FROM hub.clinics WHERE id = $1", clinic_id)
