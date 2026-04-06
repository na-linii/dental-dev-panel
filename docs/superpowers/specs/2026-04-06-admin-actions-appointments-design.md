# Admin Panel: Actions Enrichment + Appointments Tab

**Date:** 2026-04-06
**Status:** Approved

## Summary

Two changes to the admin panel:
1. **Actions page** — enrich with patient/booking data, remove "Failed" button, add click-to-chat navigation
2. **Appointments tab** — create missing AppointmentsTab in chat detail, showing patient's bookings as a compact table

Plus bug fixes found during audit: `any` types, missing cache invalidation, duplicate useState.

## Scope

### 1. Actions Page Enrichment

**Backend (dental-core: `agent/admin/actions.py`)**

Modify `list_actions` GET endpoint to LEFT JOIN `users` and `cached_bookings`:

```sql
SELECT aq.*, u.name AS patient_name, u.phone AS patient_phone,
       cb.appointment_date, cb.appointment_time, cb.doctor_name
FROM action_queue aq
LEFT JOIN users u ON u.clinic_id = aq.clinic_id AND u.ident_patient_id = aq.patient_id
LEFT JOIN cached_bookings cb ON cb.clinic_id = aq.clinic_id AND cb.crm_booking_id = (aq.data->>'booking_id')
WHERE aq.clinic_id = %s AND aq.status = %s
ORDER BY aq.created_at DESC
LIMIT %s OFFSET %s
```

Response adds fields: `patient_name`, `patient_phone`, `appointment_date`, `appointment_time`, `doctor_name`, `session_id`.

Safety: read-only change to GET endpoint. No writes, no business logic affected. `update_action` PATCH untouched.

**Frontend (AdminActionsPage.tsx)**

- Table columns: **Тип | Пациент | Запись | Создано | Действия**
  - "Пациент": name + phone below in smaller text
  - "Запись": appointment date, time → doctor_name
- Remove "Ошибка" button — only "Готово" remains
- Entire row clickable → `navigate(/admin/chats/${action.session_id})` when session_id exists
- Remove useState duplication — use React Query data directly
- Add `queryClient.invalidateQueries(['admin', 'actions'])` after mutation

**Types (adminClient.ts)**

Extend `AdminAction`:
```ts
patient_name: string | null
patient_phone: string | null
appointment_date: string | null
appointment_time: string | null
doctor_name: string | null
session_id: string | null
```

### 2. Appointments Tab in Chat Detail

**Backend (dental-core: `agent/admin/bookings.py`)**

Add `patient_id` query parameter to `list_bookings`:
```python
@router.get("")
async def list_bookings(
    patient_id: str | None = None,  # NEW
    date_from: str | None = None,
    ...
)
```

In `get_cached_bookings()` — add condition `AND patient_id = %s` when provided.

Safety: read-only filter addition. No writes.

**Frontend (AdminChatDetailPage.tsx)**

Create `AppointmentsTab` component (inline, same pattern as `MessageBubble`):
- Props: `{ session: AdminSessionDetail }`
- Fetches `GET /admin/api/bookings?patient_id={session.patient.ident_patient_id}`
- Compact table: **Дата | Время | Врач | Услуга | Статус**
- Mobile: horizontal scroll on table
- Edge cases:
  - No `ident_patient_id` → "Пациент не привязан к CRM"
  - No bookings → "Записей не найдено"
  - Loading → spinner

**API Client (adminClient.ts)**

Add:
```ts
export const getAdminBookings = async (params?: { patient_id?: string; date_from?: string; date_to?: string }) =>
  (await adminApi.get('/bookings', { params })).data.items ?? []
```

### 3. Bug Fixes (from audit)

1. **`any` types** in `AdminChatDetailPage.tsx` lines 110, 242 → `AdminSessionDetail | undefined`
2. **Cache invalidation** — add `invalidateQueries` after mutations in AdminActionsPage
3. **Duplicate useState** in AdminActionsPage — remove local `actions` state, use query data directly

## Files Changed

| File | Change |
|------|--------|
| `dental-core/agent/admin/actions.py` | LEFT JOIN users + cached_bookings in list_actions |
| `dental-core/agent/admin/bookings.py` | Add patient_id query param |
| `dental-core/agent/db/cached_bookings.py` | Add patient_id filter to get_cached_bookings |
| `dental-hub/frontend-react/src/api/adminClient.ts` | Extend AdminAction type, add getAdminBookings |
| `dental-hub/frontend-react/src/pages/admin/AdminActionsPage.tsx` | Enriched UI, remove Failed btn, add navigation, fix state |
| `dental-hub/frontend-react/src/pages/admin/AdminChatDetailPage.tsx` | Create AppointmentsTab, fix any types |

## Out of Scope

- Security improvements (rate limiting, token storage, RBAC) — separate task
- UX consistency fixes (button styles, table headers) — separate task
- Accessibility improvements — separate task
