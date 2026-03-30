"""Judge Agent — evaluate Langfuse traces with LLM-as-Judge.

Fetches a conversation trace from Langfuse and runs all 4 evaluators
(security, handoff, dialog, routing) on each user-assistant turn.

Usage:
    python scripts/judge_agent.py --trace-id <trace_id>
    python scripts/judge_agent.py --session-id <session_id>
    python scripts/judge_agent.py --trace-id <id> --json          # JSON output
    python scripts/judge_agent.py --trace-id <id> --evaluators security,routing
"""
import argparse
import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from langfuse import get_client

from run_eval import (
    security_evaluator,
    handoff_evaluator,
    dialog_evaluator,
    routing_evaluator,
)

ALL_EVALUATORS = {
    "security": security_evaluator,
    "handoff": handoff_evaluator,
    "dialog": dialog_evaluator,
    "routing": routing_evaluator,
}


def fetch_trace_messages(langfuse, trace_id: str) -> list[dict]:
    """Extract user-assistant turn pairs from a Langfuse trace."""
    trace = langfuse.get_trace(trace_id)

    # Try to extract from trace input/output directly
    messages = []

    # Walk through generations in the trace to find conversation turns
    observations = langfuse.get_observations(trace_id=trace_id)

    # Collect input/output pairs from the trace
    if hasattr(trace, "input") and hasattr(trace, "output"):
        if trace.input and trace.output:
            user_msg = trace.input.get("message", "") if isinstance(trace.input, dict) else str(trace.input)
            assistant_msg = trace.output.get("response", "") if isinstance(trace.output, dict) else str(trace.output)
            if user_msg and assistant_msg:
                messages.append({"user": user_msg, "assistant": assistant_msg})

    # Also check observations for multi-turn data
    if hasattr(observations, "data"):
        obs_list = observations.data
    elif isinstance(observations, list):
        obs_list = observations
    else:
        obs_list = []

    for obs in obs_list:
        if hasattr(obs, "input") and hasattr(obs, "output") and obs.input and obs.output:
            user_msg = obs.input.get("message", "") if isinstance(obs.input, dict) else ""
            assistant_msg = obs.output.get("response", "") if isinstance(obs.output, dict) else ""
            if not user_msg and isinstance(obs.input, dict):
                # Try messages format
                msgs = obs.input.get("messages", [])
                for m in msgs:
                    if m.get("role") == "user":
                        user_msg = m.get("content", "")
                        break
            if not assistant_msg and isinstance(obs.output, dict):
                choices = obs.output.get("choices", [])
                if choices:
                    assistant_msg = choices[0].get("message", {}).get("content", "")
            if user_msg and assistant_msg:
                # Avoid duplicates
                pair = {"user": user_msg, "assistant": assistant_msg}
                if pair not in messages:
                    messages.append(pair)

    return messages


def fetch_session_traces(langfuse, session_id: str) -> list[str]:
    """Fetch all trace IDs for a given session."""
    traces = langfuse.get_traces(session_id=session_id)
    if hasattr(traces, "data"):
        return [t.id for t in traces.data]
    elif isinstance(traces, list):
        return [t.id for t in traces]
    return []


def evaluate_turn(turn: dict, evaluators: dict) -> list[dict]:
    """Run all evaluators on a single user-assistant turn."""
    results = []
    for name, evaluator_fn in evaluators.items():
        try:
            evaluation = evaluator_fn(
                input=turn["user"],
                output=turn["assistant"],
                expected_output="",
            )
            results.append({
                "evaluator": name,
                "verdict": evaluation.value,
                "comment": evaluation.comment or "",
            })
        except Exception as e:
            results.append({
                "evaluator": name,
                "verdict": "error",
                "comment": str(e),
            })
    return results


def judge_trace(langfuse, trace_id: str, evaluators: dict) -> dict:
    """Run all evaluators on all turns in a trace. Returns structured report."""
    messages = fetch_trace_messages(langfuse, trace_id)

    if not messages:
        return {
            "trace_id": trace_id,
            "turns": 0,
            "error": "No user-assistant turns found in trace",
            "results": [],
        }

    all_results = []
    summary = {name: {"pass": 0, "fail": 0, "error": 0} for name in evaluators}

    for i, turn in enumerate(messages):
        turn_evals = evaluate_turn(turn, evaluators)
        for ev in turn_evals:
            summary[ev["evaluator"]][ev["verdict"]] += 1
        all_results.append({
            "turn": i + 1,
            "user": turn["user"][:200],
            "assistant": turn["assistant"][:200],
            "evaluations": turn_evals,
        })

    total_checks = sum(
        summary[name]["pass"] + summary[name]["fail"] + summary[name]["error"]
        for name in evaluators
    )
    total_pass = sum(summary[name]["pass"] for name in evaluators)

    return {
        "trace_id": trace_id,
        "turns": len(messages),
        "total_checks": total_checks,
        "total_pass": total_pass,
        "pass_rate": round(total_pass / total_checks, 2) if total_checks > 0 else 0,
        "summary": summary,
        "results": all_results,
    }


def print_report(report: dict):
    """Print human-readable report to stdout."""
    print(f"\n{'=' * 60}")
    print(f"  Judge Agent Report")
    print(f"  Trace: {report['trace_id']}")
    print(f"  Turns: {report['turns']}")
    if report.get("error"):
        print(f"  Error: {report['error']}")
        print(f"{'=' * 60}\n")
        return

    print(f"  Pass rate: {report['total_pass']}/{report['total_checks']} ({report['pass_rate']:.0%})")
    print(f"{'=' * 60}")

    # Summary per evaluator
    print("\n  Summary by evaluator:")
    for name, counts in report["summary"].items():
        total = counts["pass"] + counts["fail"] + counts["error"]
        status = "OK" if counts["fail"] == 0 and counts["error"] == 0 else "ISSUES"
        print(f"    {name}: {counts['pass']}/{total} pass  [{status}]")

    # Detailed results
    print(f"\n  Detailed results:")
    for turn_result in report["results"]:
        print(f"\n  Turn {turn_result['turn']}:")
        print(f"    User: {turn_result['user']}")
        print(f"    Assistant: {turn_result['assistant']}")
        for ev in turn_result["evaluations"]:
            icon = "PASS" if ev["verdict"] == "pass" else "FAIL" if ev["verdict"] == "fail" else "ERR"
            print(f"    [{icon}] {ev['evaluator']}: {ev['comment']}")
    print()


def main():
    parser = argparse.ArgumentParser(description="Judge Agent — evaluate Langfuse traces")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--trace-id", help="Langfuse trace ID to evaluate")
    group.add_argument("--session-id", help="Langfuse session ID (evaluates all traces)")
    parser.add_argument("--json", action="store_true", help="Output as JSON")
    parser.add_argument("--evaluators", default=None,
                        help="Comma-separated evaluator names (default: all)")
    args = parser.parse_args()

    # Select evaluators
    if args.evaluators:
        names = [n.strip() for n in args.evaluators.split(",")]
        evaluators = {}
        for n in names:
            if n not in ALL_EVALUATORS:
                print(f"Unknown evaluator: {n}. Available: {', '.join(ALL_EVALUATORS)}")
                sys.exit(1)
            evaluators[n] = ALL_EVALUATORS[n]
    else:
        evaluators = ALL_EVALUATORS

    langfuse = get_client()

    # Collect trace IDs
    if args.trace_id:
        trace_ids = [args.trace_id]
    else:
        trace_ids = fetch_session_traces(langfuse, args.session_id)
        if not trace_ids:
            print(f"No traces found for session {args.session_id}")
            sys.exit(1)
        print(f"Found {len(trace_ids)} traces for session {args.session_id}")

    # Evaluate each trace
    reports = []
    for tid in trace_ids:
        report = judge_trace(langfuse, tid, evaluators)
        reports.append(report)

    # Output
    if args.json:
        output = reports if len(reports) > 1 else reports[0]
        print(json.dumps(output, ensure_ascii=False, indent=2))
    else:
        for report in reports:
            print_report(report)

        # Final summary if multiple traces
        if len(reports) > 1:
            total_pass = sum(r["total_pass"] for r in reports)
            total_checks = sum(r["total_checks"] for r in reports)
            rate = round(total_pass / total_checks, 2) if total_checks > 0 else 0
            print(f"\n  Overall: {total_pass}/{total_checks} ({rate:.0%}) across {len(reports)} traces\n")


if __name__ == "__main__":
    main()
