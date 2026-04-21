"""Sync PR lifecycle events to Jira issues referenced in branch/title/body.

Triggered by GitHub Actions on `pull_request` events. Looks for `PD-XXX` keys
in the branch name, PR title, and PR body, then transitions matching Jira
issues and posts a comment with the PR URL.

Transitions (project PD workflow):
    PR opened/reopened/ready_for_review → "ON REVIEW"  (transition id 2)
    PR closed without merge             → "В работе"   (transition id 21)
    PR merged                            → "Готово"    (transition id 31)

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
    "review": ("2", "ON REVIEW"),
    "merged": ("31", "Готово"),
    "closed": ("21", "В работе"),
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

    keys = sorted(set(KEY_RE.findall(pr_branch) + KEY_RE.findall(pr_title) + KEY_RE.findall(pr_body)))
    if not keys:
        print(
            f"No PD-XXX in branch={pr_branch!r}, title={pr_title!r}, body[0:80]={pr_body[:80]!r}. "
            "Skipping."
        )
        return 0

    if pr_action == "closed" and pr_merged:
        kind = "merged"
        comment_text = f"PR #{pr_number} merged: {pr_url}"
    elif pr_action == "closed":
        kind = "closed"
        comment_text = f"PR #{pr_number} closed without merge: {pr_url}"
    elif pr_action in ("opened", "reopened", "ready_for_review"):
        kind = "review"
        comment_text = f"PR #{pr_number} opened: {pr_url}"
    else:
        print(f"Unhandled action {pr_action!r}; nothing to do.")
        return 0

    transition_id, transition_name = TRANSITIONS[kind]
    auth = (jira_email, jira_token)
    print(f"Action={pr_action} merged={pr_merged} → transition '{transition_name}' for {keys}")

    failures = 0
    for key in keys:
        print(f"--- {key} ---")
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
