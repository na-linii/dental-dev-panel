# Prompt Research Manifest

## Что это

Здесь мы проектировали **V3** — агентскую архитектуру с нуля.

| Версия | Репозиторий | Статус |
|--------|-------------|--------|
| **V1** | `na-linii/ai_agent` | Архив. Изучен как референс. |
| **V2** | `dental-core` | Работает в проде. Не трогаем без причины. |
| **V3** | этот каталог | ✅ **Реализовано и задеплоено** (10.04.2026) |

---

## Принципы V3

- Промпт = только инструкция для LLM. Ноль бизнес-логики.
- Все переменные — через Langfuse `PROMPT_VARS` + `configurable` в `graph.py`.
- Каждый агент = одна зона ответственности.
- **Живые формулировки** — промпт задаёт правило и примеры духа, не шаблоны для копипаста. Агент формулирует ответ сам, под контекст разговора.

---

## Чем V3 отличается от V2

| Аспект | V2 | V3 |
|--------|----|----|
| Social | Нет агента | ✅ Выделенный `dental-social` — приветствия, благодарности, жалобы, handoff |
| Персонализация бота | Нет | ✅ `agent_identity` из YAML клиники (`agent.name/gender/tone`) |
| Fallback-поведение | Захардкожен handoff | ✅ Гибко через `{{no_data_behavior}}` в YAML |
| Service catalog | В промпте hardcode | ✅ `{{service_catalog}}` в YAML клиники — per-clinic, с синонимами и Decision Rules |
| Router intents | faq / booking / confirm | ✅ + social |
| handoff_to_human | Возвращал статичную строку | ✅ Возвращает `""` — агент сам формулирует реплику |

---

## Статус агентов

### ✅ Реализовано и задеплоено в dental-core + Langfuse

#### `dental-router`
- 4 интента: social / faq / booking / confirm
- `social` — всё эмоциональное: приветствия, благодарности, жалобы, просьба оператора
- sticky-логика: если предыдущий ответ — незакрытый вопрос, продолжаем в том же агенте
- hard shortcut: ≤5 слов + `confirmation_expected` → сразу `confirm` без LLM
- **Файл промпта:** `prompts/prod/dental-router.md` (v3, без Langfuse-переменных)
- **Реализация:** `graph.py:router_node`, `IntentResult`, `graph_factory.py`

#### `dental-faq`
- `{{agent_identity}}` + `{{no_data_behavior}}`
- pre_model_hook: `_pre_search()` → pgvector → `[РЕЗУЛЬТАТЫ ПОИСКА]`
- MAX_FAQ_MESSAGES = 16
- Мягкий CTA на запись после ответа об услуге
- handoff_to_human только на явный запрос или жалобу
- **Файл промпта:** `prompts/prod/dental-faq.md`
- **Реализация:** `agents/faq.py`, `agents/faq_tools.py`

#### `dental-social`
- `{{agent_identity}}`
- Без RAG, без pre_model_hook (только trim)
- MAX_SOCIAL_MESSAGES = 8
- Жалоба/агрессия → `handoff_to_human(reason="complaint")`
- Просьба оператора → `handoff_to_human(reason="explicit_request")`
- Приветствие/благодарность → короткий ответ, без "хотите записаться?"
- Opt-in: `modules: {social:agent: {enabled: true}}` в YAML клиники
- **Файл промпта:** `prompts/prod/dental-social.md`
- **Реализация:** `agents/social.py`, `modules/social_agent.py`

#### `dental-booking`
- `{{agent_identity}}` + `{{booking_rules}}` + `{{service_catalog}}`
- pre_model_hook: `_set_crm_context()` → `[КОНТЕКСТ ПАЦИЕНТА]`
- MAX_AGENT_MESSAGES = 20
- Алгоритм 7 шагов: услуга → дата → слоты → варианты → выбор → resolve → book
- Отмена: confirm в следующем сообщении (не в одном ответе с вопросом)
- Перенос: явный выбор "отменить старую или оставить обе"
- 9 инструментов: get_availability, book_appointment, cancel_appointment, get_existing_bookings, resolve_booking_patient, list_known_patients, select_known_patient, collect_patient_phone, handoff_to_human
- **Файл промпта:** `prompts/prod/dental-booking.md`
- **Реализация:** `agents/booking.py`

#### `dental-confirmation`
- `{{agent_identity}}` + `{{appointment_date}}` + `{{appointment_time}}` + `{{doctor_name}}` + `{{clinic_name}}`
- pre_model_hook: `_set_crm_context()` → обрезает до `recent[-4:]`
- 4 ветки: подтверждение, отказ, перенос, вопрос/неясный ответ
- reschedule_visit() сбрасывает `confirmation_status` → `is_confirmation_reply_expected = False`
- 4 инструмента: confirm_visit, decline_visit, reschedule_visit, handoff_to_human
- **Файл промпта:** `prompts/prod/dental-confirmation.md`
- **Реализация:** `agents/confirmation_node.py`, `tools/confirmation.py`

#### `handoff_to_human`
- Сигнатура: `handoff_to_human(reason: str = "", steps_attempted: str = "") -> str`
- Возвращает `""` — агент сам формулирует реплику перед вызовом
- **Реализация:** `tools/chat.py`

---

## Реализованные изменения в dental-core (V2 → V3)

| Что | Файл | Дата |
|-----|------|------|
| `social` интент в `IntentResult` + `IntentResultNoConfirm` | `graph.py` | 10.04.2026 |
| `social` нода в `graph_factory.py` (opt-in через `enabled_modules`) | `graph_factory.py` | 10.04.2026 |
| `router_node` type hint: + "social" | `graph.py:88` | 10.04.2026 |
| `social_enabled` fallback в `router_node` | `graph.py:170` | 10.04.2026 |
| `social_enabled` в `_build_agent_config()` | `graph.py:246` | 10.04.2026 |
| `agents/social.py` — создан | `agents/social.py` | 10.04.2026 |
| `modules/social_agent.py` — зарегистрирован | `modules/social_agent.py` | 10.04.2026 |
| `agent_identity`, `no_data_behavior`, `service_catalog` в `PROMPT_VARS` | `config.py` | 10.04.2026 |
| `agent_identity`, `no_data_behavior`, `service_catalog` в `configurable` | `graph.py` | 10.04.2026 |
| `agent_identity` property + поля `agent_name/gender/tone` | `models.py` | 10.04.2026 |
| `no_data_behavior`, `service_catalog` в `ClinicConfig` | `models.py` | 10.04.2026 |
| `clinic_loader.py` — загрузка новых полей из YAML | `clinic_loader.py` | 10.04.2026 |
| `handoff_to_human` возвращает `""` | `tools/chat.py` | 10.04.2026 |
| `confirm_visit/decline_visit/reschedule_visit` возвращают `""` | `tools/confirmation.py` | 10.04.2026 |
| `starsmile_demo.yml` — agent, no_data_behavior, service_catalog, modules | `clinics/starsmile_demo.yml` | 10.04.2026 |
| MAX_SOCIAL_MESSAGES = 8 | `agents/social.py` | 10.04.2026 |

---

## Переменные (PROMPT_VARS)

| Переменная | Источник | Агенты |
|------------|----------|--------|
| `clinic_name` | `clinic.name` | все |
| `clinic_id` | `clinic.clinic_id` | все |
| `agent_identity` | `clinic.agent_identity` (property) | router, faq, social, booking, confirmation |
| `booking_rules` | `clinic.booking_rules` (YAML) | booking |
| `service_catalog` | `clinic.service_catalog` (YAML) | booking |
| `no_data_behavior` | `clinic.no_data_behavior` (YAML) | faq |
| `knowledge_context` | `clinic.knowledge.format_full_context()` | faq (через pre_model_hook) |
| `patient_name` | `user.display_name` | booking |
| `patient_phone` | `user.phone` | booking |
| `is_identified` | `user.is_identified` | booking |
| `appointment_date` | `session.confirmation_appointment_date` | confirmation |
| `appointment_time` | `session.confirmation_appointment_time` | confirmation |
| `doctor_name` | `session.confirmation_doctor_name` | confirmation |

---

## Файлы

```
prompt-research/
├── MANIFEST.md                    ← этот файл (актуальный статус V3)
├── index.html                     ← рабочая страница планирования
├── prompts/
│   ├── dental-router-v3.md        ← router V3 (задеплоен)
│   ├── dental-faq-v3.md           ← faq V3 (задеплоен)
│   ├── dental-social-v3.md        ← social V3 (задеплоен)
│   ├── dental-booking-v3.md       ← booking V3 (задеплоен)
│   ├── dental-confirmation-v3.md  ← confirmation V3 (задеплоен)
│   ├── handoff-tool.md            ← handoff tool (реализован)
│   ├── booking-tools.md           ← booking tools
│   ├── confirmation-tools.md      ← confirmation tools
│   └── v1/, v2/                   ← архив
└── prompts-compare.html           ← архив v1
```
