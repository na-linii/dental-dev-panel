"""Sync prompt files from prompts/ directory to Langfuse.

Usage: python hub/sync_prompts.py
Requires LANGFUSE_PUBLIC_KEY, LANGFUSE_SECRET_KEY, LANGFUSE_HOST env vars.
"""
import re
from pathlib import Path

import yaml
from langfuse import Langfuse

PROMPTS_DIR = Path(__file__).parent.parent / "prompts"


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
    """Upload all prompts to Langfuse from prompts/{text,voice}/{dev,prod}/."""
    lf = Langfuse()
    for sub in ["text/dev", "text/prod", "voice/dev", "voice/prod"]:
        env_path = PROMPTS_DIR / sub
        if not env_path.exists():
            continue
        for path in sorted(env_path.glob("*.md")):
            prompt = parse_prompt_file(path)
            name = prompt["name"]
            labels = prompt.get("labels", ["production"])
            prompt_type = prompt.get("type", "text")

            lf.create_prompt(
                name=name,
                prompt=prompt["body"],
                type=prompt_type,
                labels=labels,
                commit_message=f"Sync from {sub}/{path.name}",
            )
            print(f"  {name} ({prompt_type}) labels={labels} [{sub}]")

    lf.flush()
    print("Done.")


if __name__ == "__main__":
    sync_all()
