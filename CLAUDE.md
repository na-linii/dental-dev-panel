# Dental Hub — Platform for Managing Dental Core Clinics

## Project

Центральная платформа: Langfuse (shared), API управления клиниками, мониторинг, визуализация.
Dental-core инстансы подключаются к hub для tracing и prompt management.

## Stack

- Python 3.12, FastAPI, aiosqlite
- Langfuse v3 (self-hosted)
- Docker Compose
- Ngrok (tunnel for remote clinics)

## Repos

- **dental-hub** (этот) — платформа управления
- **dental-core** — инстанс клиники (agent + CRM + gateway)

## Development Rules

- Ветки + PR, не в main
- Тесты вместе с кодом
- Язык: русский
