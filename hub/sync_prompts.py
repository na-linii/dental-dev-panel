"""Sync prompt files from prompts/ directory to Langfuse.

Two modes:

1. **Branch-based mode** (PD-472, recommended).
   Set env `PROMPT_SYNC_ENV=prod` or `=dev`. Reads from `prompts/text/` and
   `prompts/voice/` (one folder per channel). Labels are derived from the env,
   not from frontmatter:

       env=prod  -> text/*.md  -> labels=[production]
                    voice/*.md -> labels=[voice_prod]
       env=dev   -> text/*.md  -> labels=[dev]
                    voice/*.md -> labels=[voice_dev]

   This makes git branch = environment. Push to `main` -> prod labels,
   push to `dev` -> dev labels. Drift between dev/prod folders becomes
   structurally impossible.

2. **Legacy mode** (default when PROMPT_SYNC_ENV is unset).
   Reads from `prompts/{text,voice}/{dev,prod}/*.md` and trusts the
   `labels:` field in each file's frontmatter. Kept for backwards
   compatibility during the PD-472 rollout.

Usage: python hub/sync_prompts.py
Requires LANGFUSE_PUBLIC_KEY, LANGFUSE_SECRET_KEY, LANGFUSE_HOST env vars.
"""
import os
import re
from pathlib import Path

import yaml
from langfuse import Langfuse

PROMPTS_DIR = Path(__file__).parent.parent / "prompts"

# PD-472: branch-based labels. Channel × environment → label set.
BRANCH_LABELS = {
    ("text", "prod"): ["production"],
    ("text", "dev"): ["dev"],
    ("voice", "prod"): ["voice_prod"],
    ("voice", "dev"): ["voice_dev"],
}


def parse_prompt_file(path: Path) -> dict:
    """Parse prompt .md file with YAML frontmatter."""
    text = path.read_text()
    match = re.match(r"^---\n(.+?)\n---\n(.+)", text, re.DOTALL)
    if not match:
        raise ValueError(f"No frontmatter in {path}")
    meta = yaml.safe_load(match.group(1))
    body = match.group(2).strip()
    return {**meta, "body": body}


def _push(lf: Langfuse, prompt: dict, labels: list[str], source: str) -> None:
    name = prompt["name"]
    prompt_type = prompt.get("type", "text")
    config = prompt.get("config") or None
    kwargs = dict(
        name=name,
        prompt=prompt["body"],
        type=prompt_type,
        labels=labels,
        commit_message=f"Sync from {source}",
    )
    if config:
        kwargs["config"] = config
    lf.create_prompt(**kwargs)
    cfg_marker = f" config={list(config.keys())}" if config else ""
    print(f"  {name} ({prompt_type}) labels={labels} [{source}]{cfg_marker}")


def sync_branch_mode(lf: Langfuse, env: str) -> None:
    """PD-472: read prompts/{text,voice}/*.md, assign labels from env."""
    print(f"Branch-based sync mode (PROMPT_SYNC_ENV={env})")
    for channel in ("text", "voice"):
        channel_dir = PROMPTS_DIR / channel
        if not channel_dir.exists():
            print(f"  (skipping {channel}/ — folder not present)")
            continue
        labels = BRANCH_LABELS[(channel, env)]
        for path in sorted(channel_dir.glob("*.md")):
            prompt = parse_prompt_file(path)
            _push(lf, prompt, labels, f"{channel}/{path.name}")


def sync_legacy_mode(lf: Langfuse) -> None:
    """Pre-PD-472: read prompts/{text,voice}/{dev,prod}/*.md, labels from frontmatter."""
    print("Legacy sync mode (PROMPT_SYNC_ENV not set)")
    for sub in ("text/dev", "text/prod", "voice/dev", "voice/prod"):
        env_path = PROMPTS_DIR / sub
        if not env_path.exists():
            continue
        for path in sorted(env_path.glob("*.md")):
            prompt = parse_prompt_file(path)
            labels = prompt.get("labels", ["production"])
            _push(lf, prompt, labels, f"{sub}/{path.name}")


def sync_all():
    """Upload all prompts to Langfuse. Dispatches to branch or legacy mode."""
    lf = Langfuse()
    env = os.environ.get("PROMPT_SYNC_ENV", "").strip().lower()
    if env in ("prod", "dev"):
        sync_branch_mode(lf, env)
    elif env:
        raise ValueError(
            f"PROMPT_SYNC_ENV must be 'prod', 'dev', or unset; got {env!r}"
        )
    else:
        sync_legacy_mode(lf)
    lf.flush()
    print("Done.")


if __name__ == "__main__":
    sync_all()
