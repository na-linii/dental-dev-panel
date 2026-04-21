"""Sync PR lifecycle events to Jira issues referenced in branch/title/body.

Triggered by GitHub Actions on `pull_request` events. Looks for `PD-XXX` keys
in branch name, PR title, and PR body, then transitions matching Jira issues
and posts a comment with the PR URL.

Transitions:
    PR opened/reopened/ready_for_review (feature)  → "В работе"  (id 21)
    PR opened/reopened/ready_for_review (release: dev → main) → comment only
    PR merged into `dev` or `main`                  → "ON REVIEW" (id 2)
    PR closed without merge                          → comment only

DONE — выставляется руками после прогона эвалов / финальной валидации в проде.
Авто-перевод в DONE на merge в main был убран чтобы не было казусов с регрессией
оценки (eval ещё не прошёл, а задача уже DONE).

Required env: JIRA_EMAIL, JIRA_TOKEN, JIRA_API
"""
from __future__ import annotations

import os
import re
import sys

import requests


REQUIRED = ["JIRA_EMAIL", "JIRA_TOKEN", "JIRA_API"]
KEY_RE = re.compile(r"\b(PD-\d+)\b")

TRANSITIONS = {
    "in_progress": ("21", "В работе"),
    "review": ("2", "ON REVIEW"),
}


def main() -> int:
    missing = [k for k in REQUIRED if not os.environ.get(k)]
    if missing:
        print(f"Skipping: missing secrets {missing}. Add them to repo secrets and re-run.")
        return 0

    jira_email = os.environ["JIRA_EMAIL"]
    jira_token = os.environ["JIRA_TOKEN"]
    jira_api = os.environ["JIRA_API"].rstrip("/")

    pr_number = os.environ.get("PR_NUMBER", "?")
    pr_title = os.environ.get("PR_TITLE", "") or ""
    pr_body = os.environ.get("PR_BODY", "") or ""
    pr_url = os.environ.get("PR_URL", "")
    pr_branch = os.environ.get("PR_BRANCH", "") or ""
    pr_action = os.environ.get("PR_ACTION", "")
    pr_merged = (os.environ.get("PR_MERGED", "false") or "false").lower() == "true"
    pr_base = os.environ.get("PR_BASE", "") or ""

    keys = sorted(set(KEY_RE.findall(pr_branch) + KEY_RE.findall(pr_title) + KEY_RE.findall(pr_body)))
    if not keys:
        print(
            f"No PD-XXX in branch={pr_branch!r}, title={pr_title!r}, body[0:80]={pr_body[:80]!r}. "
            "Skipping."
        )
        return 0

    transition_id: str | None = None
    transition_name = ""
    if pr_action == "closed" and pr_merged:
        if pr_base in ("dev", "main"):
            kind = "review"
            transition_id, transition_name = TRANSITIONS[kind]
        else:
            print(f"Merged into unexpected base={pr_base!r}; comment only, no transition.")
        comment_text = f"PR #{pr_number} merged into `{pr_base}`: {pr_url}"
    elif pr_action == "closed":
        comment_text = f"PR #{pr_number} closed without merge: {pr_url}"
    elif pr_action in ("opened", "reopened", "ready_for_review"):
        # Release PR (dev → main) аккумулирует уже review-нутые задачи —
        # transition на "В работе" регрессировал бы их статус. Только коммент.
        if pr_branch == "dev" and pr_base == "main":
            print("Release PR (dev → main); skip transition on opened, comment only.")
            comment_text = f"Release PR #{pr_number} opened: {pr_url}"
        else:
            kind = "in_progress"
            transition_id, transition_name = TRANSITIONS[kind]
            comment_text = f"PR #{pr_number} opened (target `{pr_base}`): {pr_url}"
    else:
        print(f"Unhandled action {pr_action!r}; nothing to do.")
        return 0

    auth = (jira_email, jira_token)
    if transition_id:
        print(f"Action={pr_action} merged={pr_merged} base={pr_base!r} → '{transition_name}' for {keys}")
    else:
        print(f"Action={pr_action} merged={pr_merged} base={pr_base!r} → comment only for {keys}")

    failures = 0
    rate_limited: list[tuple[str, str]] = []  # (key, "transition"|"comment")
    for key in keys:
        print(f"--- {key} ---")
        if transition_id:
            try:
                r = requests.post(
                    f"{jira_api}/rest/api/3/issue/{key}/transitions",
                    auth=auth,
                    json={"transition": {"id": transition_id}},
                    timeout=30,
                )
                print(f"  transition → HTTP {r.status_code}")
                if r.status_code == 429:
                    print(f"  body: {r.text[:300]}")
                    rate_limited.append((key, "transition"))
                elif r.status_code != 204:
                    print(f"  body: {r.text[:300]}")
                    failures += 1
            except requests.RequestException as exc:
                print(f"  transition request failed: {exc}")
                failures += 1
                continue

        try:
            r = requests.post(
                f"{jira_api}/rest/api/3/issue/{key}/comment",
                auth=auth,
                json={
                    "body": {
                        "type": "doc",
                        "version": 1,
                        "content": [
                            {
                                "type": "paragraph",
                                "content": [{"type": "text", "text": comment_text}],
                            }
                        ],
                    }
                },
                timeout=30,
            )
            print(f"  comment → HTTP {r.status_code}")
            if r.status_code == 429:
                print(f"  body: {r.text[:300]}")
                rate_limited.append((key, "comment"))
            elif r.status_code not in (200, 201):
                print(f"  body: {r.text[:300]}")
        except requests.RequestException as exc:
            print(f"  comment request failed: {exc}")

    if rate_limited:
        _emit_rate_limit_notice(jira_api, rate_limited, transition_name)

    return 0 if failures == 0 else 1


def _emit_rate_limit_notice(
    jira_api: str,
    rate_limited: list[tuple[str, str]],
    transition_name: str,
) -> None:
    """Print a warning and write to GitHub Actions step summary.

    Rate limits are transient and user-visible: don't fail the job, surface
    exactly what was skipped so the human can transition / comment manually.
    """
    lines = [
        "⚠️  Jira rate-limited (HTTP 429) — перетяните руками:",
    ]
    for key, what in rate_limited:
        url = f"{jira_api}/browse/{key}"
        if what == "transition" and transition_name:
            lines.append(f"  - {key} ({url}): transition → «{transition_name}»")
        else:
            lines.append(f"  - {key} ({url}): {what} not delivered")

    print("\n".join(lines))

    summary_path = os.environ.get("GITHUB_STEP_SUMMARY")
    if not summary_path:
        return

    md_lines = ["## ⚠️ Jira rate-limited (HTTP 429)", "", "Перетяните руками:", ""]
    for key, what in rate_limited:
        url = f"{jira_api}/browse/{key}"
        if what == "transition" and transition_name:
            md_lines.append(f"- [{key}]({url}) — transition → **{transition_name}**")
        else:
            md_lines.append(f"- [{key}]({url}) — {what} not delivered")
    md_lines.append("")

    try:
        with open(summary_path, "a", encoding="utf-8") as f:
            f.write("\n".join(md_lines) + "\n")
    except OSError as exc:
        print(f"  failed to write step summary: {exc}")


if __name__ == "__main__":
    sys.exit(main())
