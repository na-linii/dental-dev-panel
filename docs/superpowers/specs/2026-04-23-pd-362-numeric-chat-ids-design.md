# PD-362 — Короткие числовые chat ID (design)

## Контекст

URL чата в админке сейчас: `http://app.na-linii.com/chats/7a9dca4d-7bb9-42ec-a70f-cf0a24f48322` — UUID пациента. Надо короткий числовой ID: `/chats/1234`.

Исходная постановка эпика PD-338, пункт 1 (low): «поменять url'ы, убрать колбасу».

## Текущее состояние (по исследованию)

`users.id`, `chat_sessions.id`, `action_queue.id` — все UUID v4 ([dental-core/agent/db/migrate.py](https://github.com/na-linii/dental-core/blob/main/agent/db/migrate.py)).

Флоу навигации:

- Route `/chats/:sessionId` — на самом деле `patient_id = users.id` (см. комментарий в [AdminChatDetailPage.tsx:28](../../../frontend-admin/src/pages/admin/AdminChatDetailPage.tsx#L28) — «actually patient_id, name kept for router compat»).
- `AdminChatsPage` → `navigate(/chats/${s.id})`, где `s.id = users.id` UUID — **работает**.
- `AdminActionsPage` → `navigate(/chats/${action.patient_id})`, где `patient_id = ident_patient_id` (CRM id, короткий строковый) — **НЕ работает**: `GET /admin/api/sessions/{id}` ищет по `users.id`, а не по `ident_patient_id`. Это наблюдение пользователя про starsmile.
- API lookup: [dental-core/agent/admin/sessions.py:159](https://github.com/na-linii/dental-core/blob/main/agent/admin/sessions.py#L159) — по `users.id`, fallback на `chat_sessions.id`.

Короткий числовой ID на уровне пациентов **отсутствует**. `action_queue.patient_id` хранит CRM `ident_patient_id` — короткий строковый CRM-код, но не все пациенты имеют CRM-привязку (анонимы).

## Решение

**Добавить `users.public_id BIGSERIAL UNIQUE`** — автоинкрементный числовой ID (1, 2, 3…). Postgres `BIGSERIAL` сам создаст sequence и backfill-ит существующие строки.

API возвращает `public_id` как **отдельное поле** рядом с `id` (UUID), не подменяет `id`. Это позволяет фронту навигировать по `public_id`, а старые UUID-ссылки продолжают резолвиться через `users.id` lookup.

### Почему не `ident_patient_id`

- Не все пациенты имеют CRM-привязку (анонимы, новые).
- Не гарантирована уникальность между клиниками.
- Завязка на CRM — не наша ответственность.

### Почему не hashid (`aB9x2K`)

- User прямо просит «числовой id» — читабельнее и короче.
- Количество пациентов не секрет.

## Реализация

### dental-core ([PR #160](https://github.com/na-linii/dental-core/pull/160))

**Миграция** в `SCHEMA` блоке [migrate.py](https://github.com/na-linii/dental-core/blob/main/agent/db/migrate.py):

```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS public_id BIGSERIAL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_public_id ON users(public_id);
```

Идемпотентно (`IF NOT EXISTS`). `BIGSERIAL` в `ALTER TABLE ADD COLUMN` атомарно создаёт sequence и backfill-ит существующие строки уникальными значениями.

**API (`agent/admin/sessions.py`)**:

- `GET /admin/api/sessions/{id}` — dual-lookup:
  - `id.isdigit()` → `SELECT ... FROM users WHERE public_id = $1`
  - иначе → UUID-логика как была (`users.id`, fallback на `chat_sessions.id` для анонимов)
  - если числовой id не нашёлся как `public_id` — 404 (не пробрасывать в UUID-fallback, иначе type cast error).
- `list_sessions` и детальная ручка возвращают `public_id` в каждом элементе / ответе.
- `update_patient_phone`, `send_operator_message`, `update_controller`, `update_confirmation` — **не трогаем**: принимают `session_id` (UUID `chat_sessions`), не `patient_id`.

**API (`agent/admin/actions.py`)**:

- `list_actions` — добавить `LEFT JOIN chat_sessions` + `LEFT JOIN users u_sess` + `COALESCE(u.public_id, u_sess.public_id) AS patient_public_id` в SELECT. Итого в ответе новое поле `patient_public_id: number | null`.

### dental-hub ([PR этой ветки](https://github.com/na-linii/dental-hub/pulls))

**`frontend-admin/src/api/client.ts`**:

- `AdminPatientSummary.public_id: number | null`
- `AdminPatientDetail.public_id?: number | null`
- `AdminAction.patient_public_id: number | null`

**Навигация** — `navigate(/chats/${public_id ?? id})` (fallback на UUID если `public_id` ещё не подъехал):

- [`AdminChatsPage.tsx`](../../../frontend-admin/src/pages/admin/AdminChatsPage.tsx) — table + mobile card.
- [`AdminConfirmationsPage.tsx`](../../../frontend-admin/src/pages/admin/AdminConfirmationsPage.tsx).
- [`AdminActionsPage.tsx`](../../../frontend-admin/src/pages/admin/AdminActionsPage.tsx) — в `toView`: для action-рядов навигация по `patient_public_id` (не `patient_id` = CRM), для operator-рядов — `s.public_id ?? s.id`.

Роут `/chats/:sessionId` **не меняем** — API принимает оба формата.

### hub-api proxy

`hub/api.py` пересылает ответ dental-core один-к-одному, новые поля проходят без whitelist — изменений не требуется.

## Backward-compat

| Источник | Ссылка | После PD-362 |
|---|---|---|
| Старые закладки операторов | `/chats/<uuid>` | ✅ работают через UUID-lookup по `users.id` |
| Новые переходы из UI | `/chats/<numeric>` | ✅ public_id lookup |
| Анонимы без users-записи | `/chats/<chat_sessions.id uuid>` | ✅ UUID-fallback на `chat_sessions.id` |
| Клики из `/admin/actions` (раньше 404) | `/chats/<numeric>` | ✅ фикс — navigate по `patient_public_id` |

У пациентов в переписках URL не шлются (это админка), миграция старых ссылок на клиентской стороне не нужна.

## Что может сломаться

| Риск | Митигация |
|---|---|
| `ALTER TABLE ADD COLUMN BIGSERIAL` блокирует таблицу | На текущих объёмах (тысячи строк) — OK. Если вырастем — разделим: `ADD COLUMN BIGINT` + ручной backfill через sequence + `UNIQUE INDEX CONCURRENTLY`. |
| Race INSERT во время деплоя | `BIGSERIAL` атомарный, sequence уникален — race невозможен. |
| CRM `ident_patient_id` случайно цифровой совпадёт с чьим-то `public_id` | Не проблема: в API мы смотрим на формат переданной строки (`isdigit()`) и лукапим разные колонки. CRM id строковый и приходит в других полях. |
| Langfuse trace_id | Отдельная система — не затрагивается. |
| React Query кэширует по id | Self-heal на F5; не блокер — детали получаются по тому id, который в URL. |

## Порядок раскатки

1. `dental-core` `feat/PD-362-numeric-chat-ids` → `dev` → ✅ PR #160.
2. `dental-hub` `feat/PD-362-numeric-chat-ids` → `dev` → ✅ этот PR.
3. Merge обоих в `dev`, дев-инстанс сам применит миграцию на старте (lifespan hook).
4. Smoke на dev: список → клик по любой карточке в `/chats`, клик из `/actions`, клик из `/confirmations`, старая UUID-ссылка.
5. Release PR `dev → main` в обоих репо.

## Acceptance criteria

- [ ] URL чата в браузере — короткое число (`/chats/1234`), не UUID.
- [ ] Клик по карточке на `/admin/actions` открывает правильный чат (регрессия фикса стары баг со starsmile).
- [ ] Старые UUID-ссылки продолжают открывать те же чаты.
- [ ] Миграция на starsmile не теряет пациентов (`count(*)` до/после совпадает).
- [ ] Все клинические потоки (отправка сообщения, смена controller'а, смена статуса confirmation) работают под новым id.
