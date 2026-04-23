# PD-362 — Короткие числовые chat ID (design)

## Контекст

Начальник видит в адресной строке админки ссылки вида `http://app.na-linii.com/chats/b07895fd-d144-415e-ad92-49a887723b07` — длинные UUID-ы мозолят глаз. Часть записей на клинике **starsmile** уже отдаётся с короткими числовыми id (например `/chats/15180`) — dental-core начал их выдавать для новых пациентов независимо от канала (Telegram, MaxBot, WhatsApp, и т.д.). Остальные старые записи на starsmile всё ещё имеют UUID — backfill не доехал.

## Цель

У всех пациентов на starsmile (новых и уже существующих) chat id в URL — короткое число. Per-clinic уникальность (внутри одной клиники не повторяется, между клиниками пересечение ок — у них разные БД).

## Не-цели

- Показ id где-либо в UI (в списке, хедере чата, карточках) — id скрыт, видно только в URL.
- Миграция не-starsmile клиник в рамках PD-362.
- Переписывание Langfuse `session_id` под новые id.
- Изменение типов id на backend-side в hub (остаётся `string` — прозрачный passthrough).

## Ключевая особенность

Id не рендерится **нигде** в UI, кроме URL. Весь user-visible эффект — только формат адресной строки и ссылок-переходов.

## Аудит dental-hub: где используется chat id

Поиск по `frontend-admin/`, `frontend-hub/`, `hub/` выявил полный список точек касания. Формат id нигде не парсится и не валидируется — везде `string`. **В dental-hub менять код не надо** (кроме одного комментария); аудит нужен, чтобы это зафиксировать.

### Переходы `navigate('/chats/${id}')`

| Файл | Строка | Источник id |
|---|---|---|
| `frontend-admin/src/pages/admin/AdminChatsPage.tsx` | 115, 166 | `s.id` из `AdminPatientSummary` |
| `frontend-admin/src/pages/admin/AdminConfirmationsPage.tsx` | 93 | `s.id` |
| `frontend-admin/src/pages/admin/AdminActionsPage.tsx` | 100 | `a.patient_id` (action) или `s.id` (operator-waiting) |

### Роутер
- `frontend-admin/src/App.tsx:45` — `<Route path="chats/:sessionId" />` — React Router принимает любую строку; менять не нужно.

### Чтение деталей
- `frontend-admin/src/pages/admin/AdminChatDetailPage.tsx:28` — `useParams() → sessionId`, далее через `useAdminSessionDetail` (`hooks/useAdminQueries.ts:92`) в `getAdminSession` (`api/client.ts:263`) → `GET /sessions/${id}`.

### Мутации (все прозрачные)
- `frontend-admin/src/api/client.ts:266-276` — `sendAdminMessage`, `updateSessionController`, `updateSessionConfirmation`, `updatePatientPhone` — `POST/PATCH /sessions/${id}/...`.

### Типы
- `frontend-admin/src/api/client.ts:37` — комментарий обновлён с `// users.id (patient UUID)` на `// patient id (short numeric per clinic after PD-362; legacy UUIDs still accepted)`. Тип остаётся `string`.

### Hub backend
- `hub/api.py:666-705` — `_proxy_to_clinic()` пересылает `session_id` в dental-core как есть, ничего не валидирует.

**Итого код-чендж в dental-hub: 1 строка комментария в `api/client.ts`.** Весь остальной deliverable — ТЗ для dental-core (отдельный репо) и тест-план.

## ТЗ для dental-core (вне этого репо)

1. **Backfill starsmile.** Для всех `patients`/`users` на starsmile, у которых `display_id IS NULL`, присвоить `display_id` из `BIGSERIAL`-последовательности в порядке `created_at`. Выполнить в окне минимального трафика, в одной транзакции.

2. **API возвращает `id = display_id`** во всех admin endpoints (`GET /admin/api/sessions`, `GET /admin/api/sessions/{id}`, и во всех связанных объектах `AdminAction.patient_id`, `AdminBooking.patient_id`). Поле `id` в ответе становится короткой числовой строкой.

3. **Legacy UUID lookup.** `GET /admin/api/sessions/<old-uuid>` должен продолжать работать (резолвит по `users.id` → `display_id` → отдаёт запись с новым `id` в теле). Опционально: отдавать 301 на `/sessions/<numeric>`. Нужно минимум для закладок операторов и входящих ссылок из Langfuse / CRM.

4. **Уникальность per-clinic.** `display_id` уникален в пределах одного dental-core instance. Между клиниками пересечение допустимо (разные БД).

5. **Langfuse trace continuity (nice-to-have).** При создании трейса после миграции — добавить `metadata.legacy_uuid = <old_uuid>` если он есть. Иначе старые трейсы не связываются с новыми сессиями. Не блокер для PD-362.

## Верификация

### До (baseline) на starsmile prod

```sql
-- в БД dental-core.starsmile
SELECT COUNT(*) FILTER (WHERE display_id IS NULL)   AS legacy_count,
       COUNT(*) FILTER (WHERE display_id IS NOT NULL) AS migrated_count
FROM patients;
```

### После миграции dental-core

```sql
SELECT COUNT(*) FROM patients WHERE display_id IS NULL;  -- ожидание: 0
SELECT MIN(display_id), MAX(display_id), COUNT(*), COUNT(DISTINCT display_id) FROM patients;
-- MIN=1, COUNT == COUNT(DISTINCT), нет дыр/дублей
```

### API smoke (через hub)

```bash
TOKEN=<admin jwt для starsmile>
HUB=https://hub.na-linii.com

# Список — у всех id числовые
curl -s -H "Authorization: Bearer $TOKEN" $HUB/admin/api/sessions?limit=10 \
  | jq -r '.items[].id' | grep -vE '^[0-9]+$' && echo "FAIL: non-numeric id found" || echo "OK"

# Новый numeric id открывается
curl -s -H "Authorization: Bearer $TOKEN" $HUB/admin/api/sessions/15180 | jq '.id, .name'

# Legacy UUID всё ещё резолвится
curl -s -H "Authorization: Bearer $TOKEN" $HUB/admin/api/sessions/b07895fd-d144-415e-ad92-49a887723b07 | jq '.id, .name'
```

### End-to-end UI

```bash
cd frontend-admin && npm run dev   # app.na-linii.com через /etc/hosts
```

Сценарии:
1. Логин оператором starsmile → `/chats` → клик по любой записи → URL = `/chats/<numeric>`.
2. `/chats/<старый-uuid>` (подставить из baseline запроса) → открывается, чат рендерится.
3. Экран «Действия» → клик по строке с `patient_id` → URL = `/chats/<numeric>`.
4. Экран «Подтверждения» → клик → URL = `/chats/<numeric>`.
5. В чате: отправка сообщения, смена контроллера (bot → operator), правка телефона → всё успешно (мутации работают под новым id).

### Пост-релиз (через неделю)

В Langfuse traces-фильтр по starsmile:
```
session_id ~ ^[0-9a-f]{8}-[0-9a-f]{4}-...  (UUID-regex)
```
Новых трейсов с UUID-session_id быть не должно.

## Риски и митигации

| Риск | Митигация |
|---|---|
| Закладки операторов на `/chats/<uuid>` сломаются | dental-core сохраняет legacy UUID lookup (пункт 3 ТЗ) |
| React Query кэширует по id — одна и та же сессия в разных ключах `['admin','session','<uuid>']` и `[...,'<numeric>']` | Self-heal на F5; не блокер. Можно дополнительно инвалидировать `['admin','session']` при mount деталей |
| Race: во время backfill создаётся новый пациент — получает не тот display_id | Backfill в окне низкого трафика, в одной транзакции с `FOR UPDATE` |
| Потеря связи trace ↔ session в Langfuse | Опциональный `metadata.legacy_uuid` в новых трейсах; не блокер |
| Другие клиники (не starsmile) получают backfill одновременно | Scope PD-362 — только starsmile; миграция параметризована `WHERE clinic_id = 'starsmile'` или запускается per-instance |

## Out of scope

- Изменение формата id для не-starsmile клиник (отдельные тикеты при необходимости).
- Показ `#1234` где-либо в UI (не требуется).
- Переписывание Langfuse session_id под новые id (дорого, без выгоды — UUID в трейсах ок).
- Rewrite hub-api proxy под новые типы (остаётся `string`).
