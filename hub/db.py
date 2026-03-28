"""Hub database — clinic registry."""
import os
import json
import aiosqlite

DB_PATH = os.environ.get("HUB_DB_PATH", "/data/hub.db")


async def init_db():
    """Create tables if not exist."""
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("""
            CREATE TABLE IF NOT EXISTS clinics (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                server_host TEXT NOT NULL,
                server_port INTEGER DEFAULT 8080,
                server_ssh_user TEXT DEFAULT '',
                clinic_id TEXT NOT NULL,
                status TEXT DEFAULT 'active',
                config TEXT DEFAULT '{}',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        await db.commit()


async def get_clinics():
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute("SELECT * FROM clinics ORDER BY created_at")
        rows = await cursor.fetchall()
        return [dict(r) for r in rows]


async def get_clinic(clinic_id: str):
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute("SELECT * FROM clinics WHERE id = ?", (clinic_id,))
        row = await cursor.fetchone()
        return dict(row) if row else None


async def add_clinic(data: dict):
    clinic = {
        "id": data["id"],
        "name": data["name"],
        "server_host": data["server_host"],
        "server_port": data.get("server_port", 8080),
        "server_ssh_user": data.get("server_ssh_user", ""),
        "clinic_id": data.get("clinic_id", data["id"]),
        "status": "active",
        "config": json.dumps(data.get("config", {})),
    }
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "INSERT OR REPLACE INTO clinics (id, name, server_host, server_port, server_ssh_user, clinic_id, status, config) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (clinic["id"], clinic["name"], clinic["server_host"], clinic["server_port"],
             clinic["server_ssh_user"], clinic["clinic_id"], clinic["status"], clinic["config"]),
        )
        await db.commit()
    return clinic


async def remove_clinic(clinic_id: str):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("DELETE FROM clinics WHERE id = ?", (clinic_id,))
        await db.commit()
