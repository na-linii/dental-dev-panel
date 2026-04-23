# PD-362 — Короткие числовые chat ID (план)

Design: [2026-04-23-pd-362-numeric-chat-ids-design.md](../specs/2026-04-23-pd-362-numeric-chat-ids-design.md)

## Краткое содержание

Мигрировать все старые записи пациентов на starsmile с UUID-id на короткие числовые (часть уже мигрирована). Id нигде не показываем, кроме URL. В dental-hub — 1 комментарий и документация. Основная работа — в dental-core.

## Порядок работ

### 1. dental-core (другой репо)
- [ ] Миграция backfill `display_id` для всех `patients` на starsmile в порядке `created_at`
- [ ] Unit-тест: `display_id` уникален per-clinic, не-null после миграции
- [ ] API: `id = display_id` во всех admin-ответах (`/admin/api/sessions*`, `AdminAction.patient_id`, `AdminBooking.patient_id`)
- [ ] Legacy UUID lookup в `GET /admin/api/sessions/{id}` — резолвит по `users.id` → `display_id`

### 2. dental-core staging (starsmile_test)
- [ ] Прогнать миграцию, выполнить SQL-чеки (см. спеку, раздел «После миграции dental-core»)
- [ ] API-smoke через hub-api (curl-команды из спеки)
- [ ] UI-smoke: сценарии 1–5 из спеки

### 3. dental-hub (этот репо)
- [x] Правка комментария `frontend-admin/src/api/client.ts:37`
- [x] Spec в `docs/superpowers/specs/2026-04-23-pd-362-numeric-chat-ids-design.md`
- [x] Plan в `docs/superpowers/plans/2026-04-23-pd-362-numeric-chat-ids.md`
- [ ] PR → `dev` → merge → release PR → `main`

### 4. dental-core prod starsmile
- [ ] Снять бэкап БД
- [ ] Прогнать миграцию в окне низкого трафика
- [ ] SQL-чеки, UI smoke

### 5. Пост-релиз
- [ ] Langfuse-чек через 7 дней: новых трейсов с UUID-session_id не должно быть

## Deliverable в этом репо

Чистая документация + 1 правка комментария. Продакшн-код не меняется.

| Файл | Изменение |
|---|---|
| `frontend-admin/src/api/client.ts:37` | Обновлён комментарий типа `AdminPatientSummary.id` |
| `docs/superpowers/specs/2026-04-23-pd-362-numeric-chat-ids-design.md` | Новый design-документ |
| `docs/superpowers/plans/2026-04-23-pd-362-numeric-chat-ids.md` | Этот файл |
