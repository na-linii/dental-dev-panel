# Admin Confirmations Display — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix empty status on admin "Записи" screen, add doctor name and appointment date columns, show human-readable channel labels, and auto-update confirmation_status when patient replies via tools.

**Architecture:** Two repos changed — dental-core (backend: SQL query + tools) and dental-hub (frontend: types + UI). The existing `set_confirmation_result()` function in dental-core is already implemented but never called from confirmation tools — we wire it up. Frontend gets new columns and channel label mapping.

**Tech Stack:** Python/FastAPI (dental-core), React/TypeScript (dental-hub)

---

## Task 1: dental-core — Add doctor/date to sessions list endpoint

**Files:**
- Modify: `/home/amorson/dental-core/agent/admin/sessions.py:66-99`

- [ ] **Step 1: Add fields to SQL SELECT in list_sessions**

In `sessions.py:66-76`, add `s.confirmation_appointment_date` and `s.confirmation_doctor_name` to the SELECT:

```python
        row = await conn.execute(
            f"""SELECT s.id, s.channel, s.thread_id, s.controller,
                       s.confirmation_status, s.crm_sync_status,
                       s.updated_at, s.created_at,
                       u.id as user_id, u.name, u.phone,
                       s.confirmation_appointment_date, s.confirmation_doctor_name
                FROM chat_sessions s
                LEFT JOIN users u ON s.user_id = u.id
                WHERE {where}
                ORDER BY s.updated_at DESC
                LIMIT %s OFFSET %s""",
            tuple(params),
        )
```

- [ ] **Step 2: Add fields to response dict**

In `sessions.py:80-99`, add the new fields to items dict (indices 11 and 12):

```python
    items = [
        {
            "id": str(r[0]),
            "channel": r[1],
            "thread_id": r[2],
            "controller": r[3],
            "confirmation_status": r[4],
            "crm_sync_status": r[5],
            "updated_at": r[6].isoformat() if r[6] else None,
            "created_at": r[7].isoformat() if r[7] else None,
            "patient": {
                "id": str(r[8]) if r[8] else None,
                "name": r[9],
                "phone": r[10],
            } if r[8] else None,
            "last_message": None,
            "last_message_at": r[6].isoformat() if r[6] else None,
            "confirmation_appointment_date": r[11],
            "confirmation_doctor_name": r[12],
        }
        for r in rows
    ]
```

- [ ] **Step 3: Commit**

```bash
cd /home/amorson/dental-core
git add agent/admin/sessions.py
git commit -m "feat(admin): add doctor_name and appointment_date to sessions list"
```

---

## Task 2: dental-core — Add has_confirmation filter

**Files:**
- Modify: `/home/amorson/dental-core/agent/admin/sessions.py:29-52`

- [ ] **Step 1: Add has_confirmation parameter**

Add `has_confirmation: bool = False` parameter and filter logic:

```python
@router.get("")
async def list_sessions(
    controller: str | None = None,
    confirmation_status: str | None = None,
    has_confirmation: bool = False,
    search: str | None = None,
    limit: int = Query(default=50, le=200),
    offset: int = 0,
    user: UserInfo = Depends(get_current_user),
):
    clinic_id = os.environ.get("CLINIC_ID", user.clinic_id)
    conditions = ["s.clinic_id = %s"]
    params: list = [clinic_id]

    if controller:
        conditions.append("s.controller = %s")
        params.append(controller)
    if confirmation_status:
        conditions.append("s.confirmation_status = %s")
        params.append(confirmation_status)
    elif has_confirmation:
        conditions.append("s.confirmation_status IS NOT NULL")
    if search:
        conditions.append("(u.name ILIKE %s OR u.phone ILIKE %s)")
        params.extend([f"%{search}%", f"%{search}%"])
```

- [ ] **Step 2: Commit**

```bash
cd /home/amorson/dental-core
git add agent/admin/sessions.py
git commit -m "feat(admin): add has_confirmation filter to sessions list"
```

---

## Task 3: dental-core — Wire set_confirmation_result into confirmation tools

**Files:**
- Modify: `/home/amorson/dental-core/agent/tools/confirmation.py`
- Modify: `/home/amorson/dental-core/agent/agents/confirmation_node.py`

- [ ] **Step 1: Add _session_id var and pass session_id to tools context**

In `confirmation_node.py`, add session_id to configurable propagation:

```python
async def _set_crm_context(state, config):
    """Pre-model hook: propagate clinic_id + booking_id + session_id for tool execution."""
    from tools.crm import _clinic_id_var
    import tools.confirmation as conf_tools

    configurable = config.get("configurable", {}) if isinstance(config, dict) else {}
    clinic_id = configurable.get("clinic_id", "")
    if clinic_id:
        _clinic_id_var.set(clinic_id)

    booking_id = configurable.get("confirmation_appointment_id", "")
    if booking_id:
        conf_tools._confirmation_booking_id = booking_id

    session_id = configurable.get("session_id", "")
    if session_id:
        conf_tools._confirmation_session_id = session_id

    return state
```

- [ ] **Step 2: Add session_id to graph.py configurable**

In `graph.py:181-199`, add `"session_id"`:

```python
    return {
        "configurable": {
            "thread_id": thread_id,
            ...
            "confirmation_appointment_id": (session.confirmation_appointment_id if session and hasattr(session, "confirmation_appointment_id") else "") or "",
            "session_id": (str(session.id) if session else ""),
            ...
        },
    }
```

- [ ] **Step 3: Update confirmation tools to call set_confirmation_result**

In `tools/confirmation.py`:

```python
"""Confirmation Tools — confirm, decline, or reschedule a visit."""
from __future__ import annotations

import logging

from langchain_core.tools import tool

from tools.crm import _clinic_id_var
from agents.confirmation import mark_confirmed, mark_cancelled, request_reschedule
from db.chat_session import set_confirmation_result

logger = logging.getLogger(__name__)

_confirmation_booking_id: str = ""
_confirmation_session_id: str = ""


def _get_booking_id() -> str:
    return _confirmation_booking_id


def _get_session_id() -> str:
    return _confirmation_session_id


@tool
async def confirm_visit() -> str:
    """Пациент подтвердил визит. Вызови когда пациент говорит 'да', 'приду', 'подтверждаю'."""
    clinic_id = _clinic_id_var.get()
    booking_id = _get_booking_id()
    session_id = _get_session_id()
    if not booking_id:
        return "Ошибка: нет данных о записи для подтверждения."

    await mark_confirmed(clinic_id, booking_id)
    if session_id:
        await set_confirmation_result(session_id, "confirmed")
    logger.info("[confirm_visit] booking=%s confirmed", booking_id)
    return "Визит подтверждён. Информация передана администратору."


@tool
async def decline_visit() -> str:
    """Пациент отказался от визита. Вызови когда пациент говорит 'нет', 'не приду', 'отмена'."""
    clinic_id = _clinic_id_var.get()
    booking_id = _get_booking_id()
    session_id = _get_session_id()
    if not booking_id:
        return "Ошибка: нет данных о записи."

    await mark_cancelled(clinic_id, booking_id)
    if session_id:
        await set_confirmation_result(session_id, "cancelled")
    logger.info("[decline_visit] booking=%s cancelled", booking_id)
    return "Отказ от визита передан администратору."


@tool
async def reschedule_visit() -> str:
    """Пациент хочет перенести визит. Вызови когда пациент говорит 'перенести', 'другое время'."""
    clinic_id = _clinic_id_var.get()
    booking_id = _get_booking_id()
    session_id = _get_session_id()
    if not booking_id:
        return "Ошибка: нет данных о записи."

    await request_reschedule(clinic_id, booking_id)
    if session_id:
        await set_confirmation_result(session_id, "rescheduled")
    logger.info("[reschedule_visit] booking=%s reschedule requested", booking_id)
    return "Запрос на перенос передан администратору."
```

- [ ] **Step 4: Commit**

```bash
cd /home/amorson/dental-core
git add agent/tools/confirmation.py agent/agents/confirmation_node.py agent/graph.py
git commit -m "fix: auto-update confirmation_status when patient replies via tools"
```

---

## Task 4: dental-hub — Update frontend types and API

**Files:**
- Modify: `/home/amorson/dental-hub/frontend-react/src/api/adminClient.ts:36-48`

- [ ] **Step 1: Extend AdminSessionSummary type**

```typescript
export interface AdminSessionSummary {
  id: string
  channel: string
  thread_id: string
  controller: string
  confirmation_status: string | null
  crm_sync_status: string | null
  updated_at: string | null
  created_at: string | null
  patient: { id: string | null; name: string | null; phone: string | null } | null
  last_message: string | null
  last_message_at: string | null
  confirmation_appointment_date: string | null
  confirmation_doctor_name: string | null
}
```

- [ ] **Step 2: Update getAdminSessions to support has_confirmation**

Add `has_confirmation?: boolean` to params type.

- [ ] **Step 3: Commit**

```bash
cd /home/amorson/dental-hub
git add frontend-react/src/api/adminClient.ts
git commit -m "feat: extend AdminSessionSummary with doctor and appointment date"
```

---

## Task 5: dental-hub — Update AdminConfirmationsPage UI

**Files:**
- Modify: `/home/amorson/dental-hub/frontend-react/src/pages/admin/AdminConfirmationsPage.tsx`

- [ ] **Step 1: Add channel labels mapping**

After STATUS_ICONS (line 35), add:

```typescript
const CHANNEL_LABELS: Record<string, string> = {
  tg_bot: 'Telegram Bot',
  tg_business: 'Telegram Business',
  telegram: 'Telegram',
  whatsapp: 'WhatsApp',
  voice: 'Голос',
  max: 'MAX',
}
```

- [ ] **Step 2: Pass has_confirmation=true in data loading**

In `loadSessions` (line 50), change params:

```typescript
const params: Record<string, unknown> = { limit: 200, has_confirmation: true }
```

And for counts (line 59):

```typescript
const allData = await getAdminSessions({ limit: 200, has_confirmation: true } as Parameters<typeof getAdminSessions>[0])
```

- [ ] **Step 3: Add Врач and Дата приёма columns + use channel labels**

Update table header (lines 167-173):

```tsx
<tr className="border-b border-white/[0.06]">
  <th className="text-left px-4 py-3.5 text-xs font-semibold text-[#64748b] uppercase tracking-wider">Пациент</th>
  <th className="text-left px-4 py-3.5 text-xs font-semibold text-[#64748b] uppercase tracking-wider hidden md:table-cell">Врач</th>
  <th className="text-left px-4 py-3.5 text-xs font-semibold text-[#64748b] uppercase tracking-wider hidden lg:table-cell">Дата приёма</th>
  <th className="text-left px-4 py-3.5 text-xs font-semibold text-[#64748b] uppercase tracking-wider">Статус</th>
  <th className="text-left px-4 py-3.5 text-xs font-semibold text-[#64748b] uppercase tracking-wider hidden md:table-cell">Канал</th>
</tr>
```

Update table body row (lines 202-228):

```tsx
<td className="px-4 py-3">
  <p className="text-sm text-white truncate max-w-[180px]">{s.patient?.name || 'Без имени'}</p>
  <p className="text-xs text-[#64748b]">{s.patient?.phone || ''}</p>
</td>
<td className="px-4 py-3 hidden md:table-cell">
  <p className="text-sm text-[#94a3b8]">{s.confirmation_doctor_name || '—'}</p>
</td>
<td className="px-4 py-3 hidden lg:table-cell">
  {s.confirmation_appointment_date ? (
    <p className="text-sm text-white">{format(new Date(s.confirmation_appointment_date + 'T00:00:00'), 'dd.MM.yyyy')}</p>
  ) : (
    <p className="text-sm text-[#475569]">—</p>
  )}
</td>
<td className="px-4 py-3">
  {s.confirmation_status ? (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium ${STATUS_COLORS[s.confirmation_status] || 'bg-gray-500/15 text-gray-300 border-gray-500/25'}`}>
      <StatusIcon className="w-3 h-3" />
      {STATUS_LABELS[s.confirmation_status] || s.confirmation_status}
    </span>
  ) : (
    <span className="text-sm text-[#475569]">—</span>
  )}
</td>
<td className="px-4 py-3 hidden md:table-cell">
  <span className="text-sm text-[#94a3b8]">{CHANNEL_LABELS[s.channel] || s.channel || '—'}</span>
</td>
```

Update colSpan from 5 to 5 (same count — we removed "Обновлено", added "Врач" and "Дата приёма"):

No colSpan change needed.

- [ ] **Step 4: Commit**

```bash
cd /home/amorson/dental-hub
git add frontend-react/src/pages/admin/AdminConfirmationsPage.tsx
git commit -m "feat(admin): add doctor, date columns + channel labels on confirmations page"
```

---

## Task 6: Merge and push

- [ ] **Step 1: Push dental-core branch**

```bash
cd /home/amorson/dental-core
git push -u origin fix/admin-confirmations-display
```

- [ ] **Step 2: Push dental-hub branch**

```bash
cd /home/amorson/dental-hub
git push -u origin fix/admin-confirmations-display
```

- [ ] **Step 3: Create PRs**

Create PRs in both repos via `gh pr create`.
