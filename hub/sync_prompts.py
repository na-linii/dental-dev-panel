"""Sync prompt files from prompts/ directory to Langfuse.

Layout (PD-472):

    prompts/
      text/dental-*.md   -> labels [production] (PROMPT_SYNC_ENV=prod)
                            or [dev]            (PROMPT_SYNC_ENV=dev)
      voice/dental-*.md  -> labels [voice_prod] (PROMPT_SYNC_ENV=prod)
                            or [voice_dev]      (PROMPT_SYNC_ENV=dev)

`git branch = environment`: pushing to `main` deploys hub-api with
PROMPT_SYNC_ENV=prod (default in docker-compose.yml); a dev-branch
deploy would override to PROMPT_SYNC_ENV=dev.

Usage: python hub/sync_prompts.py
Requires LANGFUSE_PUBLIC_KEY, LANGFUSE_SECRET_KEY, LANGFUSE_HOST env vars.
"""
import os
import re
from pathlib import Path

import yaml
from langfuse import Langfuse

PROMPTS_DIR = Path(__file__).parent.parent / "prompts"

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


def sync_all():
    """Upload all prompts to Langfuse from prompts/{text,voice}/*.md.

    Labels are derived from PROMPT_SYNC_ENV (prod | dev), not from
    frontmatter — single file per prompt, no dev/prod drift.

    Frontmatter fields used: name, type, variables, config.
    `config` (PD-467) is an optional dict carrying runtime hints
    (streaming_ready, recommended_tts, recommended_llm,
    filler_bank_required, notes). dental-core warns to logs if env
    disagrees with the declared contract.
    """
    env = os.environ.get("PROMPT_SYNC_ENV", "prod").strip().lower()
    if env not in ("prod", "dev"):
        raise ValueError(
            f"PROMPT_SYNC_ENV must be 'prod' or 'dev'; got {env!r}"
        )
    print(f"Sync mode: PROMPT_SYNC_ENV={env}")

    lf = Langfuse()
    for channel in ("text", "voice"):
        channel_dir = PROMPTS_DIR / channel
        if not channel_dir.exists():
            print(f"  (skipping {channel}/ — folder not present)")
            continue
        labels = BRANCH_LABELS[(channel, env)]
        for path in sorted(channel_dir.glob("*.md")):
            prompt = parse_prompt_file(path)
            name = prompt["name"]
            prompt_type = prompt.get("type", "text")
            config = prompt.get("config") or None
            kwargs = dict(
                name=name,
                prompt=prompt["body"],
                type=prompt_type,
                labels=labels,
                commit_message=f"Sync from {channel}/{path.name}",
            )
            if config:
                kwargs["config"] = config
            lf.create_prompt(**kwargs)
            cfg_marker = f" config={list(config.keys())}" if config else ""
            print(
                f"  {name} ({prompt_type}) labels={labels} "
                f"[{channel}/{path.name}]{cfg_marker}"
            )

    lf.flush()
    print("Done.")


if __name__ == "__main__":
    sync_all()
