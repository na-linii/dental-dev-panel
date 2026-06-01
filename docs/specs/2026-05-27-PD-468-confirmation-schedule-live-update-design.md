# PD-468 — Backend dental-core для live-обновления расписания подтверждений

**Ссылка на тикет:** https://na-linii.atlassian.net/browse/PD-468
**Дата:** 2026-05-27
**Статус:** Implemented
**Связанный фронт:** PR #161 (`ReminderScheduleEditor` в Hub UI + `ConfirmationScheduleSection` в Admin-панели)
**Целевые репо:** dental-core (новый эндпоинт + хранилище), dental-hub (proxy + триггер из Hub UI)

## Контекст и проблема

Confirmation Scheduler в dental-core (`agent/agents/confirmation_scheduler.py`) запускается при старте контейнера и читает `schedule_hours` из `ConfirmationConfig`, который создаётся один раз в `lifespan` (`agent/api.py:253`). Список часов берётся из YAML клиники (`cfg.confirmation_schedule_hours`).

Фронт PR #161 даёт пользователю редактор расписания напоминаний. После сохранения расписания Hub должен уведомить агент клиники, чтобы новые часы применились **без перезапуска контейнера**. Сейчас:

- В Hub нет ручки `PUT /admin/api/settings/confirmation-schedule` — фронт `ReminderScheduleEditor` упирается в 404 на hub-api.
- В dental-core есть кустарный `PUT /confirmation-schedule` (`agent/api.py:417`) на корневом уровне, без auth, который пишет в локальный модульный dict `_confirmation_schedules` — ConfirmationConfig сам не апдейтится, а consumer этого dict в actual scheduler **не подключен** (см. `get_confirmation_schedule()` в `api.py:435` — не вызывается из `confirmation_scheduler.py`). То есть фактически расписание не обновляется в рантайме никак.

Без этого таска изменение расписания требует `docker compose restart` агента — неприемлемо для prod (StarSmile, Zubatka).

## Требования

Из тикета:

- Добавить в **dental-core** `PUT /admin/api/settings/confirmation-schedule` с auth (роли `admin`, `superadmin`).
- Принимает `{"schedule_hours": list[int]}`, валидирует `0 ≤ h ≤ 23`, непустой список.
- Применяет новое расписание **в памяти** (in-process), сразу — без перезапуска. Источник истины для scheduler — `app.state.confirmation_config.schedule_hours`.
- Ответ: `{"success": true, "schedule_hours": [..]}` (отсортированно, дедуплицировано).

Дополнительно (вытекает из контекста):

- **В dental-hub** добавить proxy `PUT /admin/api/settings/confirmation-schedule` → агенту клиники (по аналогии с `/admin/api/settings/bot` etc., через `_proxy_to_clinic`).
- Не записываем в YAML и не пишем в БД — изменение действует только в рамках текущего процесса агента. Перезапуск возвращает расписание из YAML (это сознательное ограничение первой итерации, см. Out of scope).
- Не трогаем устаревший `PUT /confirmation-schedule` на корневом уровне `api.py` в этом таске (см. Open Questions — пометить как deprecated/удалить отдельно).

## API дизайн

### Эндпоинт dental-core

```
PUT /admin/api/settings/confirmation-schedule
Auth: Bearer JWT (admin/operator login → admin-panel JWT), требуется роль admin или superadmin
Content-Type: application/json

Request:
{
  "schedule_hours": [9, 17]    // list[int], 0..23, len ≥ 1
}

Response 200:
{
  "success": true,
  "schedule_hours": [9, 17]    // sorted(set(input))
}

Response 401:
{ "detail": "Not authenticated" }

Response 403:
{ "detail": "Forbidden: requires admin or superadmin role" }

Response 422:
{ "detail": "schedule_hours не может быть пустым" }
  | { "detail": "Каждый час должен быть от 0 до 23" }
  | { "detail": "schedule_hours must be a list of integers" }   // pydantic

Response 409:
{ "detail": "Confirmation scheduler disabled for this clinic" }   // confirmation_enabled=false in YAML
```

Доп. `GET /admin/api/settings/confirmation-schedule` — чтение текущего значения для UI (любая роль).

### Эндпоинт dental-hub (proxy для Admin-панели)

```
PUT /admin/api/settings/confirmation-schedule
Auth: admin-panel cookie/JWT (через _get_admin_user), клиника определяется из admin_user.clinic_id
Content-Type: application/json

Request:  { "schedule_hours": [9, 17] }
Response: 1-в-1 от dental-core (200 / 4xx / 5xx).
```

Имя проксирующей функции: `admin_update_confirmation_schedule` в `hub/api.py`, секция «Bot settings» — рядом с `/admin/api/settings/clinic`.

### Эндпоинт dental-hub (Hub UI, GitHub PAT)

```
PUT /api/clinics/{clinic_id}/confirmation-schedule
Auth: GitHub PAT через verify_github_token

Persists в hub.clinics.config JSONB (для survive restart) И вызывает PUT /admin/api/settings/confirmation-schedule
на агенте с X-Hub-Secret header (auth как superadmin).
```

Уже существует на main (был частично мержнут как часть PR #161). PD-468 правит URL на `/admin/api/settings/confirmation-schedule` (был старый `/confirmation-schedule` на корневом уровне).

### Auth и permissions

- **dental-core:** `Depends(require_role("admin", "superadmin"))`. Это закрывает endpoint от operator-ов. Совпадает с pattern `toggle_bot` в `agent/admin/settings.py:62`. Hub proxy шлёт `X-Hub-Secret` header → `get_current_user` распознаёт его и возвращает `role="superadmin"` (см. `agent/admin/auth.py:69`), что проходит role check.
- **dental-hub admin endpoint:** `Depends(_get_admin_user)` — стандартный admin auth для `/admin/api/*` namespace.
- **dental-hub Hub UI endpoint:** `Depends(verify_github_token)` для namespace `/api/clinics/*`.

## Данные / схема БД

**Изменений в БД от dental-core нет.**

- Расписание в памяти агента хранится только в `app.state.confirmation_config.schedule_hours` (per process).
- При рестарте контейнера значение берётся из YAML `cfg.confirmation_schedule_hours` (см. `agent/api.py:253`).
- Hub-сторона уже персистит в `hub.clinics.config` JSONB (существующий код `update_confirmation_schedule` в `hub/db.py:208`).

## Интеграции

| Компонент | Роль |
|---|---|
| `frontend-admin` (Admin-панель, `app.na-linii.com`) | Источник запроса — `ConfirmationScheduleSection`. Шлёт `PUT /api/admin/api/settings/confirmation-schedule` на hub-api. |
| `frontend-hub` (Hub UI, `hub.na-linii.com`) | Альтернативный источник — `ReminderScheduleEditor` в `ClinicConfigTab`. Шлёт `PUT /api/clinics/{id}/confirmation-schedule` через GitHub PAT. |
| `dental-hub/hub/api.py` | Proxy слой. Резолвит clinic по admin_user/clinic_id, проксирует в `{server_host}:{server_port}/admin/api/settings/confirmation-schedule`. |
| `dental-core/agent/admin/settings.py` | Новый GET и PUT-handler. Обновляет `app.state.confirmation_config`. |
| `dental-core/agent/api.py` | Lifespan — сохраняет ссылку: `app.state.confirmation_config = confirm_config` (если enabled) или `None`. |
| `dental-core/agent/agents/confirmation_scheduler.py` | Consumer. Читает `schedule_hours` из текущего `ConfirmationConfig` instance **каждую итерацию** (line 257). Список mutable, изменения видны без рефакторинга. |

## Архитектура / поток

```
Admin Panel UI (ConfirmationScheduleSection)
   │  PUT /api/admin/api/settings/confirmation-schedule  { schedule_hours: [9,17] }
   ▼
hub-api (dental-hub: hub/api.py)
   │  _get_admin_user → clinic_id → _get_clinic_for_admin → clinic.server_host/port
   │  _proxy_to_clinic(clinic, "PUT", "/admin/api/settings/confirmation-schedule", body)
   ▼
dental-core (agent/admin/settings.py)
   │  require_role(admin/superadmin)  ← X-Hub-Secret → superadmin
   │  validate schedule_hours
   │  app.state.confirmation_config.schedule_hours = sorted(set(hours))
   │  → return {success: true, schedule_hours: [...]}
   ▼
[следующий tick confirmation_scheduler] читает confirmation_config.schedule_hours,
   видит новые часы, шлёт reminders по новому расписанию.
```

## Edge cases и ошибки

| Случай | Поведение |
|---|---|
| Пустой `schedule_hours` | 422 `"schedule_hours не может быть пустым"` |
| Час вне `[0..23]` | 422 `"Каждый час должен быть от 0 до 23"` |
| Дубликаты в списке (`[9, 9, 17]`) | Дедуплицируются (`sorted(set(...))`), сохраняется `[9, 17]`. |
| Не отсортированный список | Сортируется на сервере. |
| Не-int в списке | Pydantic 422 (через тип `list[int]`). |
| Operator-роль шлёт запрос | 403 (require_role гейтит). |
| `confirmation_enabled = False` в YAML | 409 `"Confirmation scheduler disabled for this clinic"`. |
| Запрос пришёл во время рестарта (race) | После рестарта `app.state.confirmation_config.schedule_hours` = YAML default (если hub-DB-persist выключен) или сохранённое hub-значение (если включен). |

## Что НЕ делаем (out of scope)

- **Не удаляем** старый `PUT /confirmation-schedule` на корневом уровне `agent/api.py:417` в этом таске — он не используется в продакшене (нет consumer), но удаление вынесем в отдельный cleanup-PR.
- **Не добавляем audit_log** изменений расписания (по аналогии с `bot_toggled_by`) — отдельный тикет.
- **Не делаем broadcast** на несколько процессов агента — у нас 1 клиника = 1 контейнер, процесс единственный.
- **Не трогаем** другие поля `ConfirmationConfig` (`advance_days`, `interval_minutes`, `message_template`, `quiet_hours_*`) — изменение только `schedule_hours`. Live-обновление остальных полей — отдельные тикеты по мере необходимости.
