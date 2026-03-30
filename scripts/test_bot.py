"""Telethon test script — send messages to test bot and analyze responses.

Usage:
    python scripts/test_bot.py                    # run all scenarios
    python scripts/test_bot.py --scenario greeting # run specific scenario
    python scripts/test_bot.py --message "Привет" # send custom message

Requires env vars: TELETHON_API_ID, TELETHON_API_HASH, TELETHON_SESSION, TEST_BOT_USERNAME
"""
from __future__ import annotations

import argparse
import asyncio
import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from telethon import TelegramClient
from telethon.sessions import StringSession

# Load .env from hub root
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

BOT_USERNAME = os.environ.get("TEST_BOT_USERNAME", "@shmali_robot")
TIMEOUT = 30  # seconds to wait for bot response


async def send_and_wait(client: TelegramClient, text: str, timeout: int = TIMEOUT) -> str | None:
    """Send message to bot, wait for response."""
    entity = await client.get_entity(BOT_USERNAME)

    # Remember last message ID before sending
    msgs = await client.get_messages(entity, limit=1)
    last_id = msgs[0].id if msgs else 0

    await client.send_message(entity, text)
    print(f"  -> Sent: {text}")

    for _ in range(timeout):
        await asyncio.sleep(1)
        msgs = await client.get_messages(entity, limit=3)
        for m in msgs:
            if m.id > last_id and not m.out:
                return m.text
    return None


def check(response: str | None, name: str, *conditions: tuple[str, str]) -> bool:
    """Check response against conditions. Returns True if all pass."""
    if response is None:
        print(f"  FAIL [{name}]: no response within {TIMEOUT}s")
        return False

    print(f"  <- Got: {response[:200]}")
    ok = True
    for check_type, value in conditions:
        if check_type == "contains" and value.lower() not in response.lower():
            print(f"  FAIL [{name}]: expected '{value}' in response")
            ok = False
        elif check_type == "not_contains" and value.lower() in response.lower():
            print(f"  FAIL [{name}]: unexpected '{value}' in response")
            ok = False
        elif check_type == "min_len" and len(response) < int(value):
            print(f"  FAIL [{name}]: response too short ({len(response)} < {value})")
            ok = False
    if ok:
        print(f"  PASS [{name}]")
    return ok


# --- Scenarios ---

SCENARIOS = {}


def scenario(name: str):
    def decorator(fn):
        SCENARIOS[name] = fn
        return fn
    return decorator


@scenario("greeting")
async def test_greeting(client):
    """Basic greeting — agent responds."""
    r = await send_and_wait(client, "Добрый день!")
    return check(r, "greeting",
                 ("not_contains", "ошибка"),
                 ("min_len", "5"))


@scenario("faq_address")
async def test_faq_address(client):
    """FAQ: clinic address."""
    r = await send_and_wait(client, "Какой у вас адрес?")
    return check(r, "faq_address",
                 ("not_contains", "ошибка"),
                 ("min_len", "10"))


@scenario("faq_hours")
async def test_faq_hours(client):
    """FAQ: working hours."""
    r = await send_and_wait(client, "Какой режим работы?")
    return check(r, "faq_hours",
                 ("not_contains", "ошибка"),
                 ("min_len", "10"))


@scenario("faq_prices")
async def test_faq_prices(client):
    """FAQ: prices."""
    r = await send_and_wait(client, "Сколько стоит лечение кариеса?")
    return check(r, "faq_prices",
                 ("not_contains", "ошибка"),
                 ("min_len", "10"))


@scenario("booking_full")
async def test_booking_full(client):
    """Full booking: search → confirm → verify."""
    r1 = await send_and_wait(client, "Хочу записаться на чистку зубов")
    ok1 = check(r1, "booking_search",
                ("not_contains", "ошибка"),
                ("min_len", "10"))
    if not ok1:
        return False

    r2 = await send_and_wait(client, "Да, записывайте")
    ok2 = check(r2, "booking_confirm",
                ("not_contains", "ошибка"),
                ("min_len", "10"))
    return ok1 and ok2


@scenario("show_bookings")
async def test_show_bookings(client):
    """Show my bookings after creating one."""
    r = await send_and_wait(client, "Покажите мои записи")
    return check(r, "show_bookings",
                 ("not_contains", "ошибка"),
                 ("min_len", "10"))


@scenario("cancel_booking")
async def test_cancel_booking(client):
    """Cancel existing booking."""
    r = await send_and_wait(client, "Хочу отменить запись")
    return check(r, "cancel_booking",
                 ("not_contains", "ошибка"),
                 ("min_len", "10"))


@scenario("reschedule")
async def test_reschedule(client):
    """Reschedule: book again after cancellation."""
    r = await send_and_wait(client, "Хочу записаться на профгигиену")
    ok1 = check(r, "reschedule_search",
                ("not_contains", "ошибка"),
                ("min_len", "10"))
    if not ok1:
        return False

    r2 = await send_and_wait(client, "Да, подходит")
    ok2 = check(r2, "reschedule_confirm",
                ("not_contains", "ошибка"),
                ("min_len", "10"))
    return ok1 and ok2


@scenario("handoff")
async def test_handoff(client):
    """Handoff: request human operator."""
    r = await send_and_wait(client, "Позовите администратора, мне нужен живой человек")
    return check(r, "handoff",
                 ("not_contains", "ошибка"),
                 ("min_len", "10"))


@scenario("edge_rude")
async def test_edge_rude(client):
    """Edge case: rude message."""
    r = await send_and_wait(client, "Вы тупые, ваша клиника ужасная")
    return check(r, "edge_rude",
                 ("not_contains", "ошибка"),
                 ("min_len", "10"))


@scenario("edge_english")
async def test_edge_english(client):
    """Edge case: English message."""
    r = await send_and_wait(client, "Hi, do you speak English?")
    return check(r, "edge_english",
                 ("not_contains", "ошибка"),
                 ("min_len", "5"))


@scenario("multi_turn")
async def test_multi_turn(client):
    """Multi-turn: agent remembers context."""
    r1 = await send_and_wait(client, "Сколько стоит консультация ортодонта?")
    ok1 = check(r1, "multi_turn_1",
                ("not_contains", "ошибка"),
                ("min_len", "10"))

    r2 = await send_and_wait(client, "А можно записаться на неё?")
    ok2 = check(r2, "multi_turn_2",
                ("not_contains", "ошибка"),
                ("min_len", "10"))
    return ok1 and ok2


async def main():
    parser = argparse.ArgumentParser(description="Test bot via Telethon")
    parser.add_argument("--scenario", "-s", help="Run specific scenario")
    parser.add_argument("--message", "-m", help="Send custom message")
    parser.add_argument("--list", "-l", action="store_true", help="List scenarios")
    args = parser.parse_args()

    if args.list:
        for name, fn in SCENARIOS.items():
            print(f"  {name}: {fn.__doc__}")
        return

    # Connect
    api_id = int(os.environ["TELETHON_API_ID"])
    api_hash = os.environ["TELETHON_API_HASH"]
    session = os.environ["TELETHON_SESSION"]

    client = TelegramClient(StringSession(session), api_id, api_hash)
    await client.connect()
    await client.get_dialogs(limit=50)

    print(f"Bot: {BOT_USERNAME}\n")

    if args.message:
        r = await send_and_wait(client, args.message)
        if r:
            print(f"\nResponse:\n{r}")
        else:
            print("\nNo response.")
        await client.disconnect()
        return

    # Run scenarios
    to_run = {args.scenario: SCENARIOS[args.scenario]} if args.scenario else SCENARIOS
    passed = 0
    failed = 0

    for name, fn in to_run.items():
        print(f"\n--- {name} ---")
        try:
            ok = await fn(client)
            if ok:
                passed += 1
            else:
                failed += 1
        except Exception as e:
            print(f"  ERROR [{name}]: {e}")
            failed += 1

    await client.disconnect()

    print(f"\n{'='*40}")
    print(f"Results: {passed} passed, {failed} failed out of {passed + failed}")
    if failed:
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
