"""Sync PR lifecycle events to Jira issues referenced in branch/title/body.

Triggered by GitHub Actions on `pull_request` events. Looks for `PD-XXX` keys
in branch name, PR title, and PR body, then transitions matching Jira issues
based on the workflow stage and posts a comment with the PR URL.

Workflow stages (target-branch driven):
    PR opened/reopened/ready_for_review     → "В работе"  (transition id 21)
    PR merged into `dev`                     → "ON REVIEW" (transition id 2)
    PR merged into `main`                    → "Готово"    (transition id 31)
    PR closed without merge                  → comment only, no transition

For repos without a `dev` branch (currently dental-hub) all merges go to `main`,
so issues land directly in "Готово". Add a `dev` branch + PR target to use the
ON REVIEW stage.

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
    "done": ("31", "Готово"),
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
        if pr_base == "dev":
            kind = "review"
        elif pr_base == "main":
            kind = "done"
        else:
            print(f"Merged into unexpected base={pr_base!r}; comment only, no transition.")
            kind = None
        if kind:
            transition_id, transition_name = TRANSITIONS[kind]
        comment_text = f"PR #{pr_number} merged into `{pr_base}`: {pr_url}"
    elif pr_action == "closed":
        comment_text = f"PR #{pr_number} closed without merge: {pr_url}"
    elif pr_action in ("opened", "reopened", "ready_for_review"):
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
                if r.status_code != 204:
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
            if r.status_code not in (200, 201):
                print(f"  body: {r.text[:300]}")
        except requests.RequestException as exc:
            print(f"  comment request failed: {exc}")

    return 0 if failures == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
