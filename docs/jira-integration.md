# Jira ↔ GitHub integration

Авто-синк PR-событий из GitHub в Jira issues через GitHub Actions.

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

| GitHub event | Jira transition | Status name |
|--------------|-----------------|-------------|
| PR opened / reopened / ready_for_review | id `2` | **ON REVIEW** |
| PR closed без merge | id `21` | **В работе** |
| PR merged | id `31` | **Готово** |

При каждом событии добавляется коммент в issue со ссылкой на PR.

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
- **Synchronize event** (push в существующий PR) — НЕ обрабатывается (нет смысла двигать статусы при каждом коммите).

## Что осталось сделать

- [ ] Замёрджить [PR #59](https://github.com/na-linii/dental-hub/pull/59) (после добавления секретов)
- [ ] Скопировать оба файла в `dental-core` + добавить те же 3 секрета
- [ ] Опционально: установить marketplace-app **GitHub for Jira** (Atlassian) для богатого Dev panel в Jira (commits/branches/PRs/deployments visualization). Не мешает Action'у — работают параллельно.
- [ ] Опционально: написать `/pd` slash command для Claude Code (`~/.claude/commands/pd.md` + `pd.py`) для быстрого `/pd start PD-XXX` (создание ветки + transition в работу).

## Что НЕ делает (нужно отдельно если понадобится)

- Не создаёт issues — только обновляет существующие.
- Не парсит smart-commits синтаксис (`#close`, `#time`). Если понадобится — добавить.
- Не реагирует на push в main без PR (если коммит идёт мимо PR).
- Не обрабатывает draft PR (статус `ready_for_review` ловит момент перевода draft → ready).
