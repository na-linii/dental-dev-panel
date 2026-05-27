# PD-468 — Backend dental-core для live-обновления расписания подтверждений

**Ссылка на тикет:** https://na-linii.atlassian.net/browse/PD-468
**Дата:** 2026-05-27
**Статус:** Design
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
```

### Эндпоинт dental-hub (proxy)

```
PUT /admin/api/settings/confirmation-schedule
Auth: admin-panel cookie/JWT (через _get_admin_user), клиника определяется из admin_user.clinic_id
Content-Type: application/json

Request:  { "schedule_hours": [9, 17] }
Response: 1-в-1 от dental-core (200 / 4xx / 5xx).
```

Имя проксирующей функции: `admin_update_confirmation_schedule` в `hub/api.py`, секция «Bot settings» — рядом с `/admin/api/settings/clinic`.

### Auth и permissions

- **dental-core:** `Depends(require_role("admin", "superadmin"))`. Это закрывает endpoint от operator-ов. Совпадает с pattern `toggle_bot` в `agent/admin/settings.py:62`.
- **dental-hub:** `Depends(_get_admin_user)` — стандартный admin auth для `/admin/api/*` namespace. Hub сам не проверяет роль (доверяет dental-core).
- **Hub UI** (frontend-hub, GitHub PAT) — отдельная история. PR #161 содержит `ReminderScheduleEditor` в Hub UI, но он шлёт уже **через какой именно эндпоинт** — см. Open Questions ниже.

## Данные / схема БД

**Изменений в БД нет.**

- Расписание хранится только в `app.state.confirmation_config.schedule_hours` (in-memory, per process).
- При рестарте контейнера значение берётся из YAML `cfg.confirmation_schedule_hours` (см. `agent/api.py:253`).
- Сознательно не пишем в БД и не пишем в YAML — это первая итерация (см. Out of scope).

## Интеграции

| Компонент | Роль |
|---|---|
| `frontend-admin` (Admin-панель, `app.na-linii.com`) | Источник запроса — `ConfirmationScheduleSection` (PR #161). Шлёт `PUT /api/admin/api/settings/confirmation-schedule` на hub-api. |
| `frontend-hub` (Hub UI, `hub.na-linii.com`) | Альтернативный источник — `ReminderScheduleEditor` (PR #161). См. Open Questions: куда он шлёт. |
| `dental-hub/hub/api.py` | Proxy слой. Резолвит clinic по admin_user, проксирует в `{server_host}:{server_port}/admin/api/settings/confirmation-schedule`. |
| `dental-core/agent/admin/settings.py` | Новый PUT-handler. Обновляет `app.state.confirmation_config`. |
| `dental-core/agent/api.py` | Lifespan — сохранить ссылку: `app.state.confirmation_config = confirm_config` после строки 261. |
| `dental-core/agent/agents/confirmation_scheduler.py` | Consumer. Должен читать `schedule_hours` из текущего `ConfirmationConfig` instance **каждую итерацию проверки**, а не закэшировать копию на старте. См. Open Questions. |

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
   │  require_role(admin/superadmin)
   │  validate schedule_hours
   │  app.state.confirmation_config.schedule_hours = sorted(set(hours))
   │  → return {success: true, schedule_hours: [...]}
   ▼
[следующий tick confirmation_scheduler] читает confirmation_config.schedule_hours,
   видит новые часы, шлёт reminders по новому расписанию.
```

Pattern «proxy через hub» соответствует существующим `/admin/api/settings/clinic`, `/admin/api/bot/*`, `/admin/api/blocklist/*` в `hub/api.py:888-928`.

## Edge cases и ошибки

| Случай | Поведение |
|---|---|
| Пустой `schedule_hours` | 422 `"schedule_hours не может быть пустым"` |
| Час вне `[0..23]` | 422 `"Каждый час должен быть от 0 до 23"` |
| Дубликаты в списке (`[9, 9, 17]`) | Дедуплицируются (`sorted(set(...))`), сохраняется `[9, 17]`. |
| Не отсортированный список | Сортируется на сервере. |
| Не-int в списке | Pydantic 422 (через тип `list[int]`). |
| Operator-роль шлёт запрос | 403 (require_role гейтит). |
| Hub не нашёл клинику по admin_user | 404 от hub-api (стандартное поведение `_get_clinic_for_admin`). |
| dental-core недоступен (network) | 502/504 от hub-api `_proxy_to_clinic`. |
| Запрос пришёл во время рестарта (race) | После рестарта `app.state.confirmation_config.schedule_hours` = YAML default. Это сознательное поведение — для устойчивости нужна персистентность (см. Out of scope). |
| Confirmation scheduler закэшировал старые часы | См. Open Questions — consumer должен читать конфиг динамически. |
| `confirmation_enabled = False` в YAML | `app.state.confirmation_config` не создан (см. `agent/api.py:252` — конфиг создаётся только если `cfg.confirmation_enabled`). PUT-эндпоинт должен вернуть `409 Conflict` с понятным сообщением (`"Confirmation scheduler disabled for this clinic"`). |

## Что НЕ делаем (out of scope)

- **Не персистим** расписание в БД и не пишем в YAML. После рестарта контейнера расписание возвращается к YAML-дефолту. Это первая итерация — отдельный тикет (см. Open Questions).
- **Не удаляем** старый `PUT /confirmation-schedule` на корневом уровне `agent/api.py:417` в этом таске — он не используется в продакшене (нет consumer), но удаление вынесем в отдельный cleanup-PR.
- **Не трогаем фронт** — он уже сделан в PR #161.
- **Не трогаем** другие поля `ConfirmationConfig` (`advance_days`, `interval_minutes`, `message_template`, `quiet_hours_*`) — изменение только `schedule_hours`. Live-обновление остальных полей — отдельные тикеты по мере необходимости.
- **Не делаем broadcast** на несколько процессов агента — у нас 1 клиника = 1 контейнер (см. CLAUDE.md), процесс единственный.

## Открытые вопросы

1. **Куда шлёт `ReminderScheduleEditor` из Hub UI** (PR #161)? В Hub UI auth — GitHub PAT, а не admin-panel JWT. Варианты:
   - Шлёт на dental-core напрямую через hub-api proxy с GitHub-PAT-авторизацией (новый эндпоинт `PUT /api/clinics/{id}/confirmation-schedule` в `hub/api.py`).
   - Шлёт через `/admin/api/*` namespace — но тогда нужен admin-panel-логин, что не подходит для Hub UI.
   - Нужно посмотреть PR #161 и согласовать.
2. **Confirmation scheduler сейчас читает конфиг закэшированно**: в `agent/agents/confirmation_scheduler.py` функция `start_confirmation_scheduler(config)` принимает `ConfirmationConfig` как аргумент при старте. Нужно проверить — итерируется ли scheduler по `config.schedule_hours` **каждый tick** (т.е. mutation работает), или конфиг копируется. Если копируется — нужен рефакторинг: scheduler должен брать `app.state.confirmation_config` каждую итерацию (либо использовать mutable view).
3. **Персистентность между рестартами** — нужен ли follow-up тикет? Варианты: новая таблица `hub.clinic_runtime_overrides` или новая колонка в `clinic_runtime_settings` (dental-core), или запись в YAML клиники через hub-api (но YAML — source of truth для деплоя, опасно).
4. **Логирование/аудит** — нужно ли писать в `audit_log` кто и когда поменял расписание (по аналогии с `bot_toggled_by`)? В тикете не упомянуто.
5. **Уведомление пациентов о смене времени** — если первое напоминание уже улетело в 10:00, а потом часы поменяли на `[14, 19]`, второе пойдёт по новому расписанию. Считать ли это корректным или нужно «не отправлять reminder если он уже был отправлен по старому правилу»? Скорее всего корректно — scheduler идемпотентен по `(visit_id, hour_slot)`, но нужно подтвердить.
6. **Удаление кустарного `PUT /confirmation-schedule`** (`agent/api.py:417`) — оставляем в этом таске или отдельным PR cleanup?

## План реализации

### dental-core (PR в репо `dental-core`)

1. **`agent/api.py`** — в `lifespan` после `confirm_config = ConfirmationConfig(...)` (≈ строка 261) добавить `app.state.confirmation_config = confirm_config`.
2. **`agent/admin/settings.py`** — новый handler:
   - Импорты: `from fastapi import Request`, `from pydantic import BaseModel` (если ещё нет).
   - Модель `ConfirmationScheduleUpdate(BaseModel): schedule_hours: list[int]`.
   - `@router.put("/confirmation-schedule")` с `Depends(require_role("admin","superadmin"))`.
   - Валидация: непустой, `0..23`, dedup + sort.
   - Если `app.state.confirmation_config is None` → 409 `"Confirmation scheduler disabled"`.
   - Мутация `request.app.state.confirmation_config.schedule_hours = hours`.
   - Возврат `{"success": True, "schedule_hours": hours}`.
3. **`agent/agents/confirmation_scheduler.py`** — проверить (и при необходимости поправить) что scheduler читает `schedule_hours` из текущего инстанса конфига при каждой проверке, не из локальной копии.
4. **`agent/tests/test_settings.py`** (создать если нет) — async-тесты на:
   - 200 + dedup/sort (`[17,9,9]` → `[9,17]`).
   - 422 пустой список.
   - 422 час > 23.
   - 422 неверный тип.
   - 403 для operator-роли.
   - 409 если `confirmation_enabled=False` в YAML.
   - Side effect: после PUT значение в `app.state.confirmation_config.schedule_hours` обновилось.

### dental-hub (PR в репо `dental-hub`)

5. **`hub/api.py`** — новый proxy-handler `admin_update_confirmation_schedule` в секции «Bot settings» (после `admin_clinic_settings`, ≈ строка 906):
   ```
   @app.put("/admin/api/settings/confirmation-schedule")
   async def admin_update_confirmation_schedule(request: Request, admin_user=Depends(_get_admin_user)):
       clinic = await _get_clinic_for_admin(admin_user)
       body = await request.json()
       return await _proxy_to_clinic(clinic, "PUT", "/admin/api/settings/confirmation-schedule", body=body)
   ```
6. **Тесты hub** (`hub/tests/...` — если каталог тестов уже есть): мок dental-core, проверить что запрос проксируется 1-в-1.
7. **(Если применимо после ответа на Open Question #1)** — отдельный handler для Hub UI с GitHub-PAT-авторизацией (под `/api/clinics/{id}/confirmation-schedule`). Решается после уточнения с автором PR #161.

### Smoke / acceptance

8. Локально: запустить агент (`uvicorn` + clinic config с `confirmation_enabled=true`), вызвать `curl PUT /admin/api/settings/confirmation-schedule` с валидным JWT → 200.
9. Запустить hub-api локально на dev-инстансе, открыть Admin Panel, поменять расписание в UI → 200, в логах агента **нет** 404, в логах scheduler следующий tick использует новые часы.
10. Деплой `dev → main` в обоих репо (после ревью), smoke на StarSmile-dev (8085).

### Acceptance criteria

- [ ] `PUT /admin/api/settings/confirmation-schedule` существует в dental-core, авторизован, валидирует, мутирует `app.state.confirmation_config`.
- [ ] Hub-api проксирует этот PUT 1-в-1.
- [ ] Confirmation scheduler через `≤ 1 tick` (`confirmation_interval_minutes`) использует новые часы — без рестарта.
- [ ] Operator-роль получает 403.
- [ ] Сохранение из Admin UI не даёт 404, в логах агента видно «schedule updated».
- [ ] Тесты `agent/tests/test_settings.py` зелёные.
