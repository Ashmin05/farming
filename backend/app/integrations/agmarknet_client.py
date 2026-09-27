"""Client for Agmarknet's daily mandi prices, published on data.gov.in's Open
Government Data API as the resource "Current Daily Price of Various
Commodities from Various Markets (Mandi)".

The resource holds the most recent day's reports from every APMC mandi that
reported (a few thousand rows nationally). Each row is one
(market, commodity, variety, grade) with min/max/modal prices in Rs/quintal.
data.gov.in's gateway is slow and intermittently returns 502/504, so every
request has a timeout and is retried with exponential backoff.
"""

import logging
from dataclasses import dataclass
from datetime import date, datetime

import httpx
from tenacity import (
    AsyncRetrying,
    RetryError,
    retry_if_exception,
    stop_after_attempt,
    wait_exponential,
)
from tenacity.wait import wait_base

from app.core.config import settings

logger = logging.getLogger(__name__)

DATA_GOV_IN_BASE_URL = "https://api.data.gov.in/resource"
# "Current Daily Price of Various Commodities from Various Markets (Mandi)"
# -- https://data.gov.in/resource/current-daily-price-various-commodities-various-markets-mandi
MANDI_PRICES_RESOURCE_ID = "9ef84268-d588-465a-a308-a864a43d0070"

DEFAULT_PAGE_SIZE = 500
# The gateway often takes 30-60 s to answer a large page.
REQUEST_TIMEOUT = httpx.Timeout(90.0, connect=15.0)
MAX_ATTEMPTS = 4
# Safety cap on one sync: the whole national resource is a few thousand rows.
MAX_RECORDS_PER_SYNC = 50_000


class AgmarknetNotConfiguredError(Exception):
    """DATA_GOV_IN_API_KEY isn't set."""


class AgmarknetRequestError(Exception):
    """data.gov.in failed or rejected the request, after any retries."""


@dataclass(frozen=True)
class MandiPriceRecord:
    state: str
    district: str
    market: str
    commodity: str
    variety: str
    grade: str | None
    arrival_date: date
    min_price: float  # Rs/quintal
    max_price: float  # Rs/quintal
    modal_price: float  # Rs/quintal


def _clean_text(value: object) -> str:
    return " ".join(str(value).split()) if value is not None else ""


def _parse_price(value: object) -> float | None:
    if value is None:
        return None
    try:
        price = float(str(value).replace(",", "").strip())
    except ValueError:
        return None
    return price if price >= 0 else None


def _parse_date(value: object) -> date | None:
    text = _clean_text(value)
    for fmt in ("%d/%m/%Y", "%Y-%m-%d", "%d-%m-%Y"):
        try:
            return datetime.strptime(text, fmt).date()
        except ValueError:
            continue
    return None


def normalise_record(raw: dict) -> MandiPriceRecord | None:
    """One data.gov.in row -> MandiPriceRecord, or None if it's unusable
    (missing market/commodity, unparseable date, or no modal price). Prices
    arrive as strings in Rs/quintal; min/max fall back to the modal price
    when blank, as some mandis only report a modal price."""
    market = _clean_text(raw.get("market"))
    commodity = _clean_text(raw.get("commodity"))
    arrival_date = _parse_date(raw.get("arrival_date"))
    modal = _parse_price(raw.get("modal_price"))
    if not market or not commodity or arrival_date is None or modal is None:
        return None
    min_price = _parse_price(raw.get("min_price"))
    max_price = _parse_price(raw.get("max_price"))
    grade = _clean_text(raw.get("grade")) or None
    return MandiPriceRecord(
        state=_clean_text(raw.get("state")),
        district=_clean_text(raw.get("district")),
        market=market,
        commodity=commodity,
        variety=_clean_text(raw.get("variety")) or "Other",
        grade=grade,
        arrival_date=arrival_date,
        min_price=min_price if min_price is not None else modal,
        max_price=max_price if max_price is not None else modal,
        modal_price=modal,
    )


def _is_retryable(exc: BaseException) -> bool:
    if isinstance(exc, httpx.TransportError):  # timeouts, connection errors
        return True
    if isinstance(exc, httpx.HTTPStatusError):
        status = exc.response.status_code
        return status == 429 or status >= 500
    return False


class AgmarknetClient:
    def __init__(
        self,
        api_key: str | None,
        *,
        base_url: str = DATA_GOV_IN_BASE_URL,
        resource_id: str = MANDI_PRICES_RESOURCE_ID,
        page_size: int = DEFAULT_PAGE_SIZE,
        timeout: httpx.Timeout = REQUEST_TIMEOUT,
        max_attempts: int = MAX_ATTEMPTS,
        wait: wait_base | None = None,
    ) -> None:
        self.api_key = api_key
        self.url = f"{base_url}/{resource_id}"
        self.page_size = page_size
        self.timeout = timeout
        self.max_attempts = max_attempts
        self.wait = wait or wait_exponential(multiplier=2, min=2, max=30)

    @property
    def configured(self) -> bool:
        return bool(self.api_key)

    async def fetch_page(
        self,
        http: httpx.AsyncClient,
        *,
        offset: int,
        limit: int,
        state: str | None = None,
        commodity: str | None = None,
    ) -> tuple[list[MandiPriceRecord], int]:
        """One page of normalised records plus the resource's total row
        count for these filters. Unusable rows are dropped (and logged)."""
        params: dict[str, str | int] = {
            "api-key": self.api_key or "",
            "format": "json",
            "offset": offset,
            "limit": limit,
        }
        if state:
            params["filters[state.keyword]"] = state
        if commodity:
            params["filters[commodity]"] = commodity

        payload = await self._get_json(http, params)
        if not isinstance(payload, dict) or payload.get("status") == "error":
            message = payload.get("message") if isinstance(payload, dict) else payload
            raise AgmarknetRequestError(f"data.gov.in returned an error: {message}")
        raw_records = payload.get("records") or []
        records = [r for r in (normalise_record(raw) for raw in raw_records) if r is not None]
        if len(records) < len(raw_records):
            logger.info("Dropped %d unusable mandi price row(s).", len(raw_records) - len(records))
        try:
            total = int(payload.get("total", len(raw_records)))
        except (TypeError, ValueError):
            total = len(raw_records)
        return records, total

    async def fetch_all(
        self,
        *,
        state: str | None = None,
        commodity: str | None = None,
        max_records: int = MAX_RECORDS_PER_SYNC,
    ) -> list[MandiPriceRecord]:
        """Every row for the given filters, paging with limit/offset until
        the reported total is reached (or a page comes back empty)."""
        if not self.configured:
            raise AgmarknetNotConfiguredError("DATA_GOV_IN_API_KEY is not set.")

        records: list[MandiPriceRecord] = []
        offset = 0
        async with httpx.AsyncClient(timeout=self.timeout) as http:
            while offset < max_records:
                limit = min(self.page_size, max_records - offset)
                page, total = await self.fetch_page(
                    http, offset=offset, limit=limit, state=state, commodity=commodity
                )
                records.extend(page)
                offset += limit
                if offset >= total or not page:
                    break
        return records

    async def _get_json(self, http: httpx.AsyncClient, params: dict) -> dict:
        try:
            async for attempt in AsyncRetrying(
                retry=retry_if_exception(_is_retryable),
                stop=stop_after_attempt(self.max_attempts),
                wait=self.wait,
                reraise=False,
            ):
                with attempt:
                    response = await http.get(self.url, params=params)
                    response.raise_for_status()
                    return response.json()
        except RetryError as exc:
            last = exc.last_attempt.exception()
            raise AgmarknetRequestError(
                f"data.gov.in request failed after {self.max_attempts} attempts: {last!r}"
            ) from last
        except httpx.HTTPStatusError as exc:  # non-retryable, e.g. 403 for a bad key
            raise AgmarknetRequestError(
                f"data.gov.in rejected the request ({exc.response.status_code}): "
                f"{exc.response.text[:200]}"
            ) from exc
        except ValueError as exc:  # body wasn't JSON
            raise AgmarknetRequestError(f"data.gov.in returned a non-JSON response: {exc}") from exc
        raise AgmarknetRequestError("data.gov.in request produced no response.")  # unreachable


agmarknet_client = AgmarknetClient(settings.DATA_GOV_IN_API_KEY)
