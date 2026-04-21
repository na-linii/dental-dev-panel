# Jira ↔ GitHub integration

Авто-синк PR-событий из GitHub в Jira issues через GitHub Actions.

## Workflow стадий PD-задач

| Status | Когда |
|--------|-------|
| **TO DO** | Задача создана, ещё не взята в работу |
| **IN PROGRESS** | Взяли в работу, пилим до мержа в `dev` (или в `main` для hub) |
| **ON REVIEW** | Замёрджено в `dev`, идёт проверка → готовим мерж в прод |
| **DONE** | Замёрджено в прод (`main`) + (для core) пройден eval-порог |

Применимо к **обоим репам** — `dental-core` (есть `dev` + `main`) и `dental-hub` (пока только `main`, рекомендуется добавить `dev`).

## Конвенция

PD-XXX должен присутствовать **хотя бы в одном** из трёх мест:

| Артефакт | Формат | Пример |
|----------|--------|--------|
| Branch | `{type}/PD-XXX-slug` | `feat/PD-347-elainer-prices` |
| PR title | `{type}: summary (PD-XXX)` | `feat: prices fix (PD-347)` |
| PR body / commit message | свободно, главное PD-XXX как слово | `Closes PD-347, related PD-348` |

`{type}`: `feat` / `fix` / `refactor` / `chore` / `docs` / `ci` / `test`.

Несколько задач в одном PR — все обновятся: `feat: refactor (PD-1, PD-2)` затронет обе.

## Авто-транзишены

| GitHub event | Jira transition | Status |
|--------------|-----------------|--------|
| PR opened / reopened / ready_for_review | id `21` | **В работе** |
| PR closed без merge | (без transition, только коммент) | — |
| PR merged + `base=dev` | id `2` | **ON REVIEW** |
| PR merged + `base=main` | id `31` | **Готово** |
| PR merged + `base=other` | (без transition, только коммент) | — |

Перевод **TO DO → IN PROGRESS** делается **вручную** (или через будущий `/pd start PD-XXX` slash command). Это сигнал «беру в работу» — выставляется ДО открытия PR.

При каждом event'е добавляется коммент в issue со ссылкой на PR.

## Особенности репов

**dental-core** — полный flow:
1. `feat/PD-XXX` → PR в `dev` → merge → ON REVIEW
2. PR из `dev` в `main` → merge → DONE

**dental-hub** — упрощённый (нет `dev`):
1. `feat/PD-XXX` → PR в `main` → merge → DONE напрямую
2. ON REVIEW стадия пропускается. Если нужна — завести `dev` ветку и мёрджить через неё.

## Реализация

- Workflow: [.github/workflows/jira-sync.yml](../.github/workflows/jira-sync.yml)
- Скрипт: [.github/scripts/jira_sync.py](../.github/scripts/jira_sync.py)

Скрипт извлекает PD-XXX по регексу `\bPD-\d+\b` из branch / title / body, ходит в Jira REST API через `api.atlassian.com/ex/jira/{cloudId}` (scoped token поддерживает только этот endpoint, не `na-linii.atlassian.net/rest/...`).

## Required repo secrets

GitHub → Settings → Secrets and variables → Actions:

- `JIRA_EMAIL` — `mk@na-linii.com`
- `JIRA_TOKEN` — scoped API token с правами `read:jira-user`, `read:jira-work`, `write:jira-work`. Создаётся на https://id.atlassian.com/manage-profile/security/api-tokens (выбрать «Create API token with scopes»).
- `JIRA_API` — `https://api.atlassian.com/ex/jira/890f3b14-2713-4840-9048-15251a46a04c`

Без секретов workflow логирует «Skipping: missing secrets» и завершается успехом — fail-safe.

## Edge cases

- **PD-XXX не найден** → workflow no-ops, logs «No PD-XXX found, skipping».
- **issue в статусе из которого недоступен target transition** → 400 от Jira, логируется, остальные ключи продолжают обрабатываться.
- **Synchronize event** (push в существующий PR) — НЕ обрабатывается (не нужно двигать статусы при каждом коммите).
- **Merge в нестандартный base** (не `dev`, не `main`) — только коммент, без transition.

## Что осталось сделать

- [ ] Замёрджить [PR #59](https://github.com/na-linii/dental-hub/pull/59) (после добавления секретов)
- [ ] Скопировать оба файла в `dental-core` + добавить те же 3 секрета
- [ ] (опц.) Завести `dev` ветку в `dental-hub` для полного flow с ON REVIEW стадией
- [ ] (опц.) Установить marketplace-app **GitHub for Jira** (Atlassian) для богатого Dev panel в Jira
- [ ] (опц.) Написать `/pd` slash command для Claude Code: `/pd start PD-XXX` создаёт ветку и переводит задачу в «В работе»

## Что НЕ делает (нужно отдельно если понадобится)

- Не делает TO DO → IN PROGRESS автоматически на пуш ветки. Только при PR opened.
- Не проверяет eval-порог при мерже в prod. DONE выставляется по факту мержа в `main`. Если eval не прошёл — задачу надо вручную вернуть в IN PROGRESS.
- Не создаёт issues — только обновляет существующие.
- Не парсит smart-commits (`#close`, `#time`).
- Не реагирует на push в main без PR.
