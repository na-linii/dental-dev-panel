"""Seed Langfuse with dental prompts. Run after fresh Langfuse setup.

Usage:
    LANGFUSE_PUBLIC_KEY=pk-... LANGFUSE_SECRET_KEY=sk-... python scripts/seed_langfuse.py
"""
import os
import sys
from pathlib import Path

from langfuse import Langfuse

PROMPTS_DIR = Path(__file__).parent.parent / "prompts"

PROMPTS = [
    {"name": "dental-router", "file": "dental-router.txt", "type": "text"},
    {"name": "dental-faq", "file": "dental-faq.txt", "type": "text"},
    {"name": "dental-booking", "file": "dental-booking.txt", "type": "text"},
]


def main():
    lf = Langfuse(
        public_key=os.environ.get("LANGFUSE_PUBLIC_KEY"),
        secret_key=os.environ.get("LANGFUSE_SECRET_KEY"),
        host=os.environ.get("LANGFUSE_HOST", "http://localhost:3000"),
    )

    for p in PROMPTS:
        text = (PROMPTS_DIR / p["file"]).read_text()
        try:
            lf.create_prompt(
                name=p["name"],
                prompt=text,
            )
            print(f"  Created: {p['name']}")
        except Exception as e:
            if "already exists" in str(e).lower():
                print(f"  Exists: {p['name']} (skipped)")
            else:
                print(f"  Error: {p['name']} — {e}")

    print("\nDone! Prompts available in Langfuse UI.")


if __name__ == "__main__":
    main()
