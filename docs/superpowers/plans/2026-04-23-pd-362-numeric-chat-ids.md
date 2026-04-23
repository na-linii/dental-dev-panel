# PD-362 — Короткие числовые chat ID (план)

Design: [2026-04-23-pd-362-numeric-chat-ids-design.md](../specs/2026-04-23-pd-362-numeric-chat-ids-design.md)

## Краткое содержание

Добавляем `users.public_id BIGSERIAL UNIQUE` в dental-core. API отдаёт его отдельным полем рядом с UUID-`id`. Фронт админки навигирует через `public_id` с fallback на UUID (старые закладки живые). Починка бага из `/admin/actions`: раньше navigate шёл по CRM `ident_patient_id`, теперь — по `patient_public_id`.

## Порядок работ

### 1. dental-core ([PR #160](https://github.com/na-linii/dental-core/pull/160)) → `dev`

- [x] Миграция `users.public_id BIGSERIAL` + `UNIQUE INDEX`
- [x] `GET /admin/api/sessions/{id}` — dual-lookup (digit → public_id, UUID → users.id/chat_sessions.id)
- [x] `list_sessions` / детальная ручка — `public_id` в ответе
- [x] `list_actions` — `COALESCE(u.public_id, u_sess.public_id) AS patient_public_id`

### 2. dental-hub (этот PR) → `dev`

- [x] Типы в `frontend-admin/src/api/client.ts`: `AdminPatientSummary.public_id`, `AdminPatientDetail.public_id`, `AdminAction.patient_public_id`
- [x] `AdminChatsPage.tsx` — `navigate(/chats/${s.public_id ?? s.id})` (table + mobile card)
- [x] `AdminConfirmationsPage.tsx` — то же
- [x] `AdminActionsPage.tsx` — `toView` использует `patient_public_id` для action-рядов, `s.public_id ?? s.id` для operator-рядов
- [x] Spec + план — актуализированы под реальный подход (`public_id` колонка, не `display_id` substitution)

### 3. Dev-smoke после merge обоих в `dev`

- [ ] dental-core на дев-инстансе применил миграцию (lifespan-hook на старте)
- [ ] `/chats` → клик по любому пациенту → URL короткий числовой
- [ ] `/admin/actions` → клик по confirmation-ряду → открывается правильный чат (regression fix)
- [ ] `/admin/confirmations` → клик → короткий URL
- [ ] Старая UUID-ссылка `/chats/<uuid>` продолжает работать
- [ ] Отправка сообщения, смена controller, правка телефона — мутации ок (идут через `last_session_id`, не `public_id`)

### 4. Release PR `dev → main` в обоих репо

- [ ] `dental-core`: `dev → main`
- [ ] `dental-hub`: `dev → main`

### 5. Пост-релиз

- [ ] Проверка на starsmile prod: `SELECT COUNT(*) FROM users WHERE public_id IS NULL` → 0
- [ ] Никаких регрессий в `/admin/*` по метрикам/алертам за сутки

## Deliverable в этом репо

| Файл | Изменение |
|---|---|
| `frontend-admin/src/api/client.ts` | +3 поля в типы (`public_id`, `patient_public_id`) |
| `frontend-admin/src/pages/admin/AdminChatsPage.tsx` | navigate по `public_id ?? id` (2 места) |
| `frontend-admin/src/pages/admin/AdminConfirmationsPage.tsx` | то же (1 место) |
| `frontend-admin/src/pages/admin/AdminActionsPage.tsx` | `toView` — `patient_public_id` для action, `public_id ?? id` для operator |
| `docs/superpowers/specs/2026-04-23-pd-362-numeric-chat-ids-design.md` | переписан под актуальную схему |
| `docs/superpowers/plans/2026-04-23-pd-362-numeric-chat-ids.md` | этот файл |
