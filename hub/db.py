"""Hub database — clinic registry (PostgreSQL)."""
import os
import json
import asyncpg
import bcrypt

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
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS hub.admin_users (
                id SERIAL PRIMARY KEY,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                full_name TEXT DEFAULT '',
                role TEXT DEFAULT 'operator',
                clinic_id TEXT REFERENCES hub.clinics(id),
                created_at TIMESTAMPTZ DEFAULT NOW()
            )
        """)


def _hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def _verify_password(password: str, password_hash: str) -> bool:
    # Support legacy SHA256 hashes (pre-bcrypt migration)
    if len(password_hash) == 64 and not password_hash.startswith("$2"):
        import hashlib
        return hashlib.sha256(password.encode()).hexdigest() == password_hash
    return bcrypt.checkpw(password.encode(), password_hash.encode())


async def authenticate_admin(username: str, password: str):
    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT * FROM hub.admin_users WHERE username = $1",
            username)
        if row and _verify_password(password, row["password_hash"]):
            return dict(row)
        return None


async def create_admin_user(username: str, password: str, full_name: str = '', role: str = 'operator', clinic_id: str = None):
    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            "INSERT INTO hub.admin_users (username, password_hash, full_name, role, clinic_id) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (username) DO NOTHING",
            username, _hash_password(password), full_name, role, clinic_id)


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


async def get_clinic_admins(clinic_id: str):
    """Get admin users for a clinic (+ admins with no clinic = global)."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT id, username, full_name, role, clinic_id, created_at FROM hub.admin_users WHERE clinic_id = $1 OR clinic_id IS NULL ORDER BY created_at",
            clinic_id)
        return [dict(r) for r in rows]


async def create_clinic_admin(username: str, password: str, full_name: str, role: str, clinic_id: str):
    pool = await get_pool()
    async with pool.acquire() as conn:
        try:
            row = await conn.fetchrow(
                "INSERT INTO hub.admin_users (username, password_hash, full_name, role, clinic_id) VALUES ($1, $2, $3, $4, $5) RETURNING id, username, full_name, role, clinic_id, created_at",
                username, _hash_password(password), full_name, role, clinic_id)
            return dict(row) if row else None
        except asyncpg.UniqueViolationError:
            return None


async def delete_admin_user(admin_id: int):
    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.execute("DELETE FROM hub.admin_users WHERE id = $1", admin_id)
