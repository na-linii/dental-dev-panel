# Редизайн админ-панели НаЛинии

**Дата:** 2026-04-02
**Автор:** Claude Code + Max Amorson
**Статус:** Draft

## Контекст

Текущая админ-панель в dental-hub была создана с нуля и потеряла ряд функций из предыдущего проекта (admin-panel-frontend). По итогам визуального сравнения и ревью выявлено 28 задач: 8 backend, 23 frontend. Цель — привести панель к уровню предыдущей реализации и добавить новые возможности.

## Выбранные дизайн-решения

### Dashboard
- 4 квадратных карточки сверху: Всего диалогов, Подтверждено, Перенесено, Отменено
- На карточках Подтверждено/Перенесено/Отменено — amber текст "+N ожидает" (awaiting_confirm, awaiting_cancel, awaiting_reschedule counts)
- Второй ряд: 2 квадрата (Ожидает оператора + Всего переписок) + прямоугольник "Прошлый месяц" (2x ширина)
- Ширины рядов совпадают: grid 1fr 1fr 1fr 1fr сверху → 1fr 1fr 2fr снизу

### Чаты — Стиль 2 (карточки с превью)
- Карточки: аватар (первая буква имени) + имя + канал badge рядом с именем (TG Bot / TG Biz pill) + превью последнего сообщения
- Время отображается рядом с превью сообщения (справа), не в отдельной колонке
- Нет отдельной колонки "Канал" и "Время"
- Фильтры — теги (Все / С агентом / С оператором / Завершён)
- Красная подсветка для operator-чатов
- Приоритет имени: TG display_name → phone → "Без имени"

### Подтверждения — Стиль 1 (вертикальный таймлайн)
- Карточки с датой (крупно день + месяц), временем, врачом, услугой, статусом badge
- Вертикальный скролл, группировка по дате
- Tag-фильтры: Все / Отправлено / Ожидает подтв. / Ожидает отмены / Ожидает переноса / Подтверждено / Отменено / Перенесено / Нет ответа
- Клик по карточке → открытие чата

### Детальный чат
- Dark theme: текущий дизайн OK
- Light theme: сообщения агента и администратора должны быть такими же яркими/контрастными, как пациента. Фон bubbles оставить, но текст и автор — яркие, не тусклые
- Tabs "Чат" / "Записи" (с count badge)
- Phone inline edit (добавить/редактировать)
- Visit info в шапке (дата, время, врач)
- Confirmation status badge рядом с controller
- Scroll indicator "↓ N новых"
- Иконки: User (пациент), Bot (агент), ShieldCheck (администратор)

### Настройки и Действия
- Без визуальных изменений
- Действия: видны для admin + superadmin, скрыты для operator

### Роли

| Страница | operator | admin | superadmin |
|----------|:--------:|:-----:|:----------:|
| Дашборд | + | + | + |
| Чаты | + | + | + |
| Подтверждения | + | + | + |
| Действия | — | + | + |
| Настройки (blocklist) | + | + | + |
| Настройки (bot toggle) | — | + | + |
| Инструкция | + | + | + |

superadmin = разработчик. operator и admin — одинаковые права кроме Действий и bot toggle.

### Light/Dark Theme
- Toggle в sidebar (Sun/Moon)
- CSS variables: `--accent` (#51ff97 dark, #059669 light)
- ThemeContext + localStorage persistence
- Все компоненты адаптируются

### Системное
- Шрифт Mulish (Google Fonts)
- Логотип НаЛинии (SVG) в sidebar
- Страница "Инструкция" — портирование из admin-panel-frontend (flow-карты, справочник статусов)

## Backend изменения (dental-core)

### B1: Role check на actions
**Файл:** `agent/admin/actions.py`
- Добавить `Depends(require_role("admin", "superadmin"))` на оба endpoint (list_actions, update_action)
- Сейчас: `Depends(get_current_user)` без role check
- Аналогично bot toggle в settings.py

### B2: Dashboard prev_month
**Файл:** `agent/admin/dashboard.py`
- Добавить SQL агрегат с `WHERE created_at >= date_trunc('month', now()) - interval '1 month' AND created_at < date_trunc('month', now())`
- Возвращать `prev_month: { confirmed, cancelled, rescheduled, total }`

### B4: Sessions list — реальный last_message
**Файл:** `agent/admin/sessions.py` (list endpoint)
- Добавить subquery: `(SELECT content FROM chat_messages WHERE session_id = s.id ORDER BY created_at DESC LIMIT 1)`
- Добавить subquery для last_message_at (реальный timestamp последнего сообщения)

### B5: Sessions list — confirmation fields
**Файл:** `agent/admin/sessions.py` (list endpoint)
- Добавить в SELECT: `s.confirmation_appointment_date, s.confirmation_appointment_time, s.confirmation_doctor_name`
- Добавить в response dict

### B6: Hub proxy — query params на session detail
**Файл:** `hub/api.py:822-825`
- Добавить `params=dict(request.query_params)` в вызов `_proxy_to_clinic`

### B7: Hub proxy — PATCH phone
**Файл:** `hub/api.py`
- Добавить endpoint: `@app.patch("/admin/api/sessions/{session_id}/phone")`
- Проксировать к Core

### B8: Hub proxy — GET settings/clinic
**Файл:** `hub/api.py`
- Добавить endpoint: `@app.get("/admin/api/settings/clinic")`
- Проксировать к Core `/admin/api/settings/clinic`

## Frontend изменения (dental-hub)

### Фаза 1: Критичное + инфраструктура

**F1: React Query миграция** — все 5 admin-страниц
- Заменить setInterval на useQuery с refetchInterval
- Интервалы: Dashboard 60с, Chats 10с, Chat detail 5с, Confirmations 30с, Actions 30с
- refetchIntervalInBackground: false, refetchOnWindowFocus: true
- Создать hooks: useAdminSessions, useAdminDashboard, useAdminActions

**F2: Role-based nav** — AdminLayout.tsx
- Фильтровать navItems: Actions скрыт если `user.role === "operator"`
- user.role уже доступен в localStorage

**F3: Все 8 статусов в Confirmations** — AdminConfirmationsPage.tsx
- Добавить: awaiting_confirm, awaiting_cancel, awaiting_reschedule, no_response в фильтры, labels, colors, icons

**F4: no_response в Chats** — AdminChatsPage.tsx
- Добавить в STATUS_CONFIG

**F5: Action type labels** — AdminActionsPage.tsx
- Добавить: `book_appointment: "Новая запись"`, `register_patient: "Регистрация пациента"`

**F6: confirmation_appointment_time** — types/index.ts
- Добавить поле в AdminSessionDetail

**F21: Mulish** — index.html + tailwind config
- Google Fonts link: `Mulish:wght@400;500;600;700;800`
- fontFamily.sans: ['Mulish', ...systemFonts]

**F22: Логотип** — AdminLayout.tsx
- SVG компонент НаЛинии в sidebar header

### Фаза 2: Dashboard + Чаты

**F7-F9: Dashboard redesign** — AdminDashboardPage.tsx
- Grid: `grid-cols-2 lg:grid-cols-4` (верхний ряд) + `grid-cols-2 lg:grid-template-columns: 1fr 1fr 2fr` (нижний)
- Amber "+N ожидает" из confirmations dict (awaiting_confirm → Подтверждено, awaiting_cancel → Отменено, awaiting_reschedule → Перенесено)
- Блок "Прошлый месяц" (из B2 endpoint)

**F10-F12: Chats redesign** — AdminChatsPage.tsx
- Карточки вместо таблицы (Стиль 2)
- Аватар (cc-av) с первой буквой имени
- Имя + канал pill (TG Bot / TG Biz) рядом
- Превью последнего сообщения (из B4 last_message)
- Время справа рядом с превью
- Tag-фильтры вместо `<select>` dropdown
- Приоритет имени: patient.name (TG display_name) → patient.phone → "Без имени"

### Фаза 3: Подтверждения + Чат детали

**F13-F14: Confirmations redesign** — AdminConfirmationsPage.tsx
- Таймлайн карточки: день (крупно) + месяц, время → врач, услуга, статус badge
- Tag-фильтры (все 8 статусов + "Все")
- Данные: confirmation_appointment_date, time, doctor_name из sessions list (B5)

**F15: Tabs Чат/Записи** — AdminChatDetailPage.tsx
- Tab компонент: "Чат" (default) / "Записи" (count badge)
- Appointments tab: таблица дата/время, врач, статус

**F16: Phone inline edit** — AdminChatDetailPage.tsx
- Кнопка ✏ рядом с телефоном → input + save/cancel
- API: updatePatientPhone (новый метод в adminClient.ts) → B7 прокси

**F17: Visit info** — AdminChatDetailPage.tsx
- Показать: confirmation_appointment_date, time, doctor_name в шапке

**F18: Scroll indicator** — AdminChatDetailPage.tsx
- Scroll listener: если пользователь не внизу + новые сообщения → badge "↓ N новых"
- Клик → smooth scroll вниз

**F19: Confirmation badge** — AdminChatDetailPage.tsx
- Второй badge рядом с controller dropdown

**F24: Пагинация сообщений** — AdminChatDetailPage.tsx + adminClient.ts
- Кнопка "Загрузить ранее" если has_more_messages
- before_id параметр в getAdminSession

### Фаза 4: Theme + Guide

**F20: Light/Dark theme**
- ThemeContext (React context + localStorage)
- CSS variables: `--accent`, `--bg`, `--sidebar`, `--card`, `--border`, `--text-*`
- Toggle в sidebar (Sun/Moon icons)
- Light accent: #059669 (emerald-600, accessible на белом)
- Dark accent: #51ff97 (neon green)
- **Важно для Light mode:** сообщения агента и администратора в чате должны быть яркими, не тусклыми. Текст и автор — контрастные. Фон bubbles оставить полупрозрачный, но текст яркий.

**F23: Страница "Инструкция"**
- Портирование из admin-panel-frontend/frontend/src/pages/Guide.tsx
- Flow-карты: 6 входящих сценариев + 2 исходящих
- Справочник статусов с цветами
- Адаптация к новой системе статусов (controller + confirmation_status)
- Route: /admin/guide

## Polling стратегия (React Query)

| Страница | Интервал | Endpoint | Обоснование |
|----------|:--------:|---------|-------------|
| Dashboard | 60с | /dashboard/stats | Некритично, лёгкий запрос |
| Чаты (список) | 10с | /sessions | Оператор активно работает |
| Чат (детали) | 5с | /sessions/{id} | Реальное время общения |
| Подтверждения | 30с | /sessions?confirmation_status=... | Не требует мгновенной реакции |
| Действия | 30с | /actions | Редко меняется |

Все endpoints бьют только локальную PostgreSQL. 0 запросов к IDENT/Google Sheets.
React Query dedup + staleTime + refetchOnWindowFocus + exponential backoff при ошибках.

## Данные из локальной БД (без внешних сервисов)

Все отображаемые данные хранятся в PostgreSQL:
- `chat_sessions`: controller, confirmation_status, appointment_date/time/doctor_name
- `chat_messages`: content, role, created_at
- `users`: name (TG display_name), phone
- `user_channels`: channel, channel_username, display_name
- `action_queue`: action_type, status, data JSONB
- `blocklist`: phone, telegram_user_id
- `clinic_runtime_settings`: bot_enabled, reason

## Порядок реализации

**Фаза 1** (~1 день): B1, B4, B5, B6, B7, B8 + F1, F2, F3, F4, F5, F6, F21, F22
**Фаза 2** (~2 дня): F7-F9 (dashboard), F10-F12 (chats)
**Фаза 3** (~2 дня): B2 + F13-F14 (confirmations), F15-F19 (chat detail), F24
**Фаза 4** (~3 дня): F20 (theme), F23 (guide)

## Верификация

- E2E тесты через Telethon (12 сценариев из e2e-testing-guide.md)
- curl проверки новых backend endpoints
- Визуальная проверка Light/Dark mode на всех страницах
- Проверка ролей: login как operator → Actions скрыт, bot toggle скрыт
- Mobile: проверка на iPhone viewport (375px)
