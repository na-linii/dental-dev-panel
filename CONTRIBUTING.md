# Contributing

Главное правило: **каждый коммит привязан к Jira-задаче PD-XXX**.

Если задачи нет — **сначала создай её** в [Jira PD](https://na-linii.atlassian.net/jira/software/projects/PD/boards/2). Только потом код. Иначе работа теряется, статусы не двигаются, ревью в слепую.

---

## Flow одной задачи

```
TO DO  ──(вручную, «беру в работу»)──▶  В работе
                                            │
                                       feat/PD-XXX-slug
                                            │
                                       PR в dev  ──(auto)──▶ подтверждает «В работе»
                                            │
                                       merge в dev  ──(auto)──▶ ON REVIEW
                                            │
                                       release PR dev → main
                                            │
                                       merge в main  ──(auto)──▶ ON REVIEW (idempotent)
                                            │
                                       визуальная проверка + эвалы
                                            │
                              ──(вручную, «подтверждаю»)──▶ Готово
```

---

## Naming convention

### Branch
```
{type}/PD-XXX-kratkiy-slug
```
`{type}` ∈ `feat` / `fix` / `refactor` / `chore` / `docs` / `ci` / `test`

Пример: `fix/PD-347-elainer-prices`

### Commit message
```
{type}(scope): короткое summary

[опционально] подробности

PD-XXX  ← обязательно где-то в title или теле
```

Пример:
```
fix(faq): корректно парсить price description "в месяц"

Элайнеры вытягивали `price_from: 10970` + description "в месяц" игнорировался →
агент называл месячную стоимость как общую.

PD-347
```

### PR title
```
{type}: человекочитаемое summary (PD-XXX)
```

Пример: `fix: elainer prices parse "в месяц" (PD-347)`

Несколько задач в PR: `feat: multi-patient auth (PD-271, PD-275)` — все обновятся.

---

## Release PR (dev → main)

- Title: `chore: release dev → main` (+ опц. тема релиза). **PD-XXX в title не обязательны.**
- Body: можно перечислить PD-XXX — auto-sync на opened **пропускает transition** для release PR (защита от регрессии ON REVIEW), на merge переведёт в ON REVIEW.

---

## Что происходит автоматически (jira-sync workflow)

| Событие GitHub | Jira transition |
|----------------|-----------------|
| PR opened (feature) | → **В работе** (id 21) |
| PR opened release (head=dev base=main) | только коммент |
| PR merged в dev | → **ON REVIEW** (id 2) |
| PR merged в main | → **ON REVIEW** (id 2, idempotent) |
| PR closed без merge | только коммент |

## Что делается руками

- **TO DO → В работе** — когда берёшь задачу. Лучше через слэш-команду `/pd start PD-XXX` (будет скоро), пока — руками в Jira.
- **ON REVIEW → Готово** — после ручной проверки + эвалов. Авто-DONE убран, чтобы не было казусов (eval не прошёл → DONE снимать вручную).

---

## Если коммит уже сделан без PD-XXX

- Амменди `git commit --amend` пока не запушил — добавь PD-XXX в тело.
- После push — добавь через `git commit --allow-empty -m "chore: link PD-XXX"` в той же ветке перед мержем PR.
- В PR title/body точно укажи PD-XXX — workflow поднимет по PR, не по отдельным коммитам.

---

## Полная спека

[`docs/jira-integration.md`](docs/jira-integration.md) — расшифровка workflow, транзишены, edge cases, setup.

## Вопросы

Если flow не работает или что-то не транзишится — проверь:
1. PD-XXX действительно присутствует где-то (branch / title / body)
2. Repo Actions tab → последний `Jira sync` run — там подробные логи
3. Jira scoped token не протух (был создан 2026-04-21, проверить срок у Maxim)
