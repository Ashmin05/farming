"""AgmarknetClient against respx-mocked data.gov.in responses."""

from datetime import date

import httpx
import pytest
import respx
from tenacity import wait_none

from app.integrations.agmarknet_client import (
    DATA_GOV_IN_BASE_URL,
    MANDI_PRICES_RESOURCE_ID,
    AgmarknetClient,
    AgmarknetNotConfiguredError,
    AgmarknetRequestError,
    normalise_record,
)

RESOURCE_URL = f"{DATA_GOV_IN_BASE_URL}/{MANDI_PRICES_RESOURCE_ID}"


def raw_row(**overrides) -> dict:
    """One row in data.gov.in's shape for this resource (prices as strings)."""
    row = {
        "state": "Maharashtra",
        "district": "Nashik",
        "market": "Lasalgaon",
        "commodity": "Onion",
        "variety": "Red",
        "grade": "FAQ",
        "arrival_date": "25/09/2026",
        "min_price": "2000",
        "max_price": "2600",
        "modal_price": "2400",
    }
    row.update(overrides)
    return row


def page(records: list[dict], total: int) -> dict:
    return {"status": "ok", "total": total, "count": len(records), "records": records}


def client(**overrides) -> AgmarknetClient:
    return AgmarknetClient("test-key", wait=wait_none(), **overrides)


class TestNormaliseRecord:
    def test_parses_types_and_units(self) -> None:
        record = normalise_record(raw_row(min_price="1,950", modal_price=" 2400 "))

        assert record is not None
        assert record.arrival_date == date(2026, 9, 25)
        assert record.min_price == 1950.0
        assert record.max_price == 2600.0
        assert record.modal_price == 2400.0
        assert (record.state, record.district, record.market) == ("Maharashtra", "Nashik", "Lasalgaon")
        assert (record.commodity, record.variety, record.grade) == ("Onion", "Red", "FAQ")

    def test_blank_min_max_fall_back_to_modal(self) -> None:
        record = normalise_record(raw_row(min_price="", max_price=None))

        assert record is not None
        assert record.min_price == record.max_price == 2400.0

    def test_collapses_whitespace_and_defaults_blank_variety(self) -> None:
        record = normalise_record(raw_row(market="  Lasalgaon   (Vinchur) ", variety=""))

        assert record is not None
        assert record.market == "Lasalgaon (Vinchur)"
        assert record.variety == "Other"

    def test_accepts_iso_dates(self) -> None:
        record = normalise_record(raw_row(arrival_date="2026-09-25"))

        assert record is not None
        assert record.arrival_date == date(2026, 9, 25)

    @pytest.mark.parametrize(
        "overrides",
        [{"arrival_date": "not a date"}, {"modal_price": "NR"}, {"modal_price": None}, {"market": ""}, {"commodity": " "}],
    )
    def test_drops_unusable_rows(self, overrides) -> None:
        assert normalise_record(raw_row(**overrides)) is None


class TestFetchAll:
    async def test_raises_when_not_configured(self) -> None:
        with pytest.raises(AgmarknetNotConfiguredError):
            await AgmarknetClient(None).fetch_all()

    @respx.mock
    async def test_pages_with_limit_offset_and_sends_filters(self) -> None:
        rows = [raw_row(market=f"Market {i}") for i in range(5)]
        seen_params: list[httpx.QueryParams] = []

        def respond(request: httpx.Request) -> httpx.Response:
            params = request.url.params
            seen_params.append(params)
            offset, limit = int(params["offset"]), int(params["limit"])
            return httpx.Response(200, json=page(rows[offset : offset + limit], total=len(rows)))

        respx.get(RESOURCE_URL).mock(side_effect=respond)

        records = await client(page_size=2).fetch_all(state="Maharashtra", commodity="Onion")

        assert [r.market for r in records] == [f"Market {i}" for i in range(5)]
        assert [(p["offset"], p["limit"]) for p in seen_params] == [("0", "2"), ("2", "2"), ("4", "2")]
        first = seen_params[0]
        assert first["api-key"] == "test-key"
        assert first["format"] == "json"
        assert first["filters[state.keyword]"] == "Maharashtra"
        assert first["filters[commodity]"] == "Onion"

    @respx.mock
    async def test_omits_filters_when_not_given(self) -> None:
        route = respx.get(RESOURCE_URL).mock(return_value=httpx.Response(200, json=page([raw_row()], total=1)))

        await client().fetch_all()

        params = route.calls.last.request.url.params
        assert "filters[state.keyword]" not in params
        assert "filters[commodity]" not in params

    @respx.mock
    async def test_stops_at_max_records(self) -> None:
        route = respx.get(RESOURCE_URL).mock(
            side_effect=lambda request: httpx.Response(
                200, json=page([raw_row(market="M")] * int(request.url.params["limit"]), total=1000)
            )
        )

        records = await client(page_size=3).fetch_all(max_records=5)

        assert len(records) == 5
        assert [c.request.url.params["limit"] for c in route.calls] == ["3", "2"]

    @respx.mock
    async def test_stops_on_an_empty_page(self) -> None:
        route = respx.get(RESOURCE_URL).mock(return_value=httpx.Response(200, json=page([], total=1000)))

        assert await client().fetch_all() == []
        assert route.call_count == 1


class TestRetries:
    @respx.mock
    async def test_retries_gateway_errors_then_succeeds(self) -> None:
        route = respx.get(RESOURCE_URL).mock(
            side_effect=[
                httpx.Response(502, text="Bad Gateway"),
                httpx.Response(504, text="Gateway Time-out"),
                httpx.Response(200, json=page([raw_row()], total=1)),
            ]
        )

        records = await client().fetch_all()

        assert len(records) == 1
        assert route.call_count == 3

    @respx.mock
    async def test_retries_timeouts_and_429(self) -> None:
        route = respx.get(RESOURCE_URL).mock(
            side_effect=[
                httpx.ReadTimeout("slow gateway"),
                httpx.Response(429, text="Too Many Requests"),
                httpx.Response(200, json=page([raw_row()], total=1)),
            ]
        )

        assert len(await client().fetch_all()) == 1
        assert route.call_count == 3

    @respx.mock
    async def test_gives_up_after_max_attempts(self) -> None:
        route = respx.get(RESOURCE_URL).mock(return_value=httpx.Response(504, text="Gateway Time-out"))

        with pytest.raises(AgmarknetRequestError, match="after 3 attempts"):
            await client(max_attempts=3).fetch_all()
        assert route.call_count == 3

    @respx.mock
    async def test_does_not_retry_a_rejected_key(self) -> None:
        route = respx.get(RESOURCE_URL).mock(
            return_value=httpx.Response(403, json={"error": "Key not authorised"})
        )

        with pytest.raises(AgmarknetRequestError, match="403"):
            await client().fetch_all()
        assert route.call_count == 1

    @respx.mock
    async def test_error_status_in_a_200_body_is_an_error(self) -> None:
        respx.get(RESOURCE_URL).mock(
            return_value=httpx.Response(200, json={"status": "error", "message": "Invalid resource"})
        )

        with pytest.raises(AgmarknetRequestError, match="Invalid resource"):
            await client().fetch_all()

    @respx.mock
    async def test_non_json_body_is_an_error(self) -> None:
        respx.get(RESOURCE_URL).mock(return_value=httpx.Response(200, text="<html>maintenance</html>"))

        with pytest.raises(AgmarknetRequestError, match="non-JSON"):
            await client().fetch_all()
