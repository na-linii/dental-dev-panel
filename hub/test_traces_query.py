from datetime import datetime, timezone

from traces_query import build_traces_params, DEFAULT_TRACE_WINDOW_DAYS

NOW = datetime(2026, 6, 1, 12, 0, 0, tzinfo=timezone.utc)


def test_window_constant_is_seven_days():
    assert DEFAULT_TRACE_WINDOW_DAYS == 7


def test_filters_by_given_tag():
    params = build_traces_params("trent", since="", limit=10, now=NOW)
    assert params["tags"] == "trent"


def test_defaults_fromtimestamp_to_window_before_now():
    params = build_traces_params("trent", since="", limit=10, now=NOW)
    assert params["fromTimestamp"] == "2026-05-25T12:00:00+00:00"


def test_explicit_since_overrides_default_window():
    params = build_traces_params("trent", since="2026-01-02T03:04:05Z", limit=10, now=NOW)
    assert params["fromTimestamp"] == "2026-01-02T03:04:05Z"


def test_limit_is_capped_at_100():
    assert build_traces_params("t", since="", limit=500, now=NOW)["limit"] == 100
    assert build_traces_params("t", since="", limit=10, now=NOW)["limit"] == 10
