# Mandi price APIs — verified behaviour

Everything below was **tested against the live services on 2026-09-27**. It is
not copied from the providers' older documentation. The code lives in
`backend/app/integrations/market_prices/`. The trimmed real responses used by the tests
live in `backend/tests/fixtures/market_prices/`.

| Provider | Role | Auth | Coverage | Status (2026-09-27) |
|---|---|---|---|---|
| **Agmarknet 2.0** `api.agmarknet.gov.in/v1/` | **Primary**: current prices and history | none (public endpoints) | Jan 2021 → today, every state | ✅ working |
| **CEDA Agri Market API** `api.ceda.ashoka.edu.in/v1` | Fallback / archive | Bearer key (`CEDA_API_KEY`) | ≤ 2025-10-30 (archive of the old Agmarknet portal) | ✅ working, rate-limited |
| **data.gov.in** OGD resource `9ef84268-…` | Optional | `api-key` (`DATA_GOV_IN_API_KEY`) | Latest day only | ❌ 502/504 on every request during development |

---

## 1. Agmarknet 2.0

`https://api.agmarknet.gov.in/v1/` is a base URL, not an endpoint. Requesting the root returns 404.
The endpoint list below comes from the Agmarknet 2.0 web app's own JavaScript bundle
(`agmarknet.gov.in/static/js/main.*.js`), and each endpoint was then called directly.

### Required headers

| Header | Value | Why |
|---|---|---|
| `User-Agent` | `FasalSetu/0.1 (agricultural decision-support app)` | nginx answers **403** to generic library agents (`python-httpx/…`, `python-requests/…`). curl's default and any descriptive app agent are accepted. We identify ourselves honestly and **do not impersonate a browser**. |
| `Accept` | `application/json` | — |

No cookies, tokens or CAPTCHA are needed for the endpoints below.

### 1.1 `GET daily-price-arrival/filters` — the whole catalogue ✅

One request (~525 KB) returns everything needed to resolve names to ids.

```jsonc
{
  "status": true,
  "message": "Filters fetched successfully",
  "data": {
    "state_data":    [{"state_id": 36, "state_name": "West Bengal"}, ...],             // 36 + "All States/UTs"
    "district_data": [{"id": 674, "state_id": 36, "district_name": "Alipurduar"}, ...], // 751
    "market_data":   [{"id": 676, "mkt_name": "Alipurduar APMC", "state_id": 36, "district_id": 674}, ...], // 4,171
    "cmdt_data":     [{"cmdt_id": 24, "cmdt_name": "Potato", "cmdt_group_id": 4}, ...], // 605
    "cmdt_group_data": [{"id": 4, "cmdt_grp_name": "Vegetables"}, ...],                 // 16
    "variety_data":  [{"id": 3, "cmdt_id": [45], "variety_name": "(Whole)"}, ...],      // 2,154
    "grade_data":    [{"grade_id": 4, "grade_name": "FAQ", "cmdt_id": [1, 2, ...]}, ...], // 18
    "type_data":     [{"id": 100004, "type": "Price"}, {"id": 100005, "type": "Arrival"}, ...],
    "range_data":    [{"price": {"from_date": "2021-01-01", "to_date": "2026-09-27", "allowed_year_range": 1}, ...}]
  }
}
```

* Every list is padded with an "All …" pseudo-entry whose id is **≥ 100000**. The parser drops these.
* Markets carry `state_id` and `district_id`, so market → district → state is fully resolved.
* **Market coordinates are not published** in any public endpoint.
* Ids are **discovered at runtime**, never hard-coded. Example values seen on 2026-09-27:
  West Bengal = 36, Maharashtra = 20, Potato = 24, Tomato = 65, Wheat = 1, Rice = 3,
  Paddy(Common) = 2, Onion = 23. The West Bengal catalogue lists 24 districts and 76 markets.

### 1.2 `GET prices-and-arrivals/date-wise/specific-commodity` — prices ✅

| Param | Example | Notes |
|---|---|---|
| `year` | `2026` | |
| `month` | `9` | 1–12 |
| `stateId` | `36` | from `state_data` |
| `commodityId` | `24` | from `cmdt_data` |
| `includeExcel` | `false` | `true` returns an .xlsx blob |

One request covers **one state × one commodity × one calendar month**. The response lists every
market that reported, each with its days and one row per variety:

```jsonc
{
  "success": true,
  "message": "Data fetched successfully.",
  "title": "Date Wise Prices for Specified Commodity on September, 2026 for Commodity : Potato, State/UT : West Bengal",
  "columns": [
    {"key": "arrivalDate",  "title": "Arrival Date"},
    {"key": "arrivals",     "title": "Arrivals (Metric Tonnes)"},
    {"key": "variety",      "title": "Variety"},
    {"key": "minimumPrice", "title": "Minimum Price (Rs./Quintal)"},
    {"key": "maximumPrice", "title": "Maximum Price (Rs./Quintal)"},
    {"key": "modalPrice",   "title": "Modal Price (Rs./Quintal)"}
  ],
  "markets": [
    {"marketName": "Alipurduar APMC",
     "dates": [{"arrivalDate": "01/09/2026", "total_arrivals": 7.0,
                "data": [{"arrivals": 7.0, "variety": "Jyoti",
                          "minimumPrice": 590.0, "maximumPrice": 640.0, "modalPrice": 620.0}]}]}
  ]
}
```

Verified results for West Bengal, September 2026:

| Commodity | Markets | Price rows |
|---|---|---|
| Potato | 71 | 1,493 |
| Rice | 53 | 1,479 |
| Tomato | 43 | 862 |
| Wheat | 12 | 238 |
| Paddy(Common) | 10 | 222 |

The same report for Potato also works for Jan 2021 (61 markets / 1,504 rows), Jun 2023 and Jan 2025.

Observations:

* Units are stated in the column titles: prices in **Rs./Quintal**, arrivals in **Metric Tonnes**.
  The parser reads the titles and does not assume units. If a title ever changes, the record carries
  the new unit and the validator rejects it.
* Dates are `dd/mm/yyyy`. Numbers are JSON numbers.
* This report has **no grade** and **no market id**. Markets are matched to the catalogue by
  name within the state. All 71 September potato markets matched.
* In the West Bengal September potato data: no duplicate (market, variety, date) rows, no
  min > modal > max violations and no zero prices. The validator still checks for all three.
* A month nobody has reported yet returns `success: true` with `markets: []`.
* A missing or invalid `commodityId` returns an **HTML 500**, not JSON.
* Most requests answered in under 4 s.

### 1.3 Other endpoints tried

| Endpoint | Result | Used? |
|---|---|---|
| `GET location/state?page_size=50` | 200. States with nested districts and LGD codes (~425 KB) | No, the filters endpoint is enough |
| `GET commodities?page_size=…` | 200, paginated (605), includes varieties | No |
| `GET agmarknet-live-date` | 200 `{"live_date": "11-07-2025"}` | No |
| `GET commodity/unit` | 200, unit list | No |
| `GET prices-and-arrivals/commodity-price/lastweek?marketId=&stateId=&commodityId=` | 200, 7-day table, "NR" for no report | No |
| `POST dashboard-data/` (`dashboard: marketwise_price_arrival`) | 200, but only the 28 MSP commodities | No |
| `GET dashboard-filters/?dashboard_name=marketwise_price_arrival` | 200 | No |
| `POST daily-price-arrival/report` | **400 `TOKEN_OR_CAPTCHA_REQUIRED`** | **No: needs a CAPTCHA or login. Not bypassed.** |
| `GET location-master`, `variety`, `grade` | **403 "Authorization header missing"** | **No: needs login** |
| `GET prices-and-arrivals/commodity-market/daily-report-state-marketwise` | HTML 500 | No |
| `GET price-trend/wholesale-prices-monthly` | HTML 500 with the parameters tried | No |
| `GET prices-and-arrivals/market-report/specific` | 404 "No data found." | No |

---

## 2. CEDA Agri Market API

Documentation: <https://api.ceda.ashoka.edu.in/documentation/> (Swagger). The OpenAPI spec is
embedded in `swagger-ui-init.js`.

* Base URL `https://api.ceda.ashoka.edu.in/v1`, header `Authorization: Bearer <CEDA_API_KEY>`.
* **Rate limit: 40 requests per hour**. The response headers
  `ratelimit-policy: 40;w=3600`, `ratelimit-remaining`, `ratelimit-reset` say so.
  The provider tracks the remaining count and stops on 429 instead of retrying.
* Responses are wrapped as `{"output": {"type": "success", "message": "Data exists" | "No data exists", "data": [...]}}`.

| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/agmarknet/commodities` | — | `commodity_id`, `commodity_name` (453) |
| GET | `/agmarknet/geographies` | — | `census_state_id/name`, `census_district_id/name` |
| POST | `/agmarknet/markets` | `commodity_id`, `state_id`, `district_id` (int), `indicator: "price"` | `market_id`, `market_name` |
| POST | `/agmarknet/prices` | `commodity_id`, `state_id`, `from_date`, `to_date`, optional `district_id[]`, `market_id[]` | `date`, ids, `min_price`, `max_price`, `modal_price` |
| POST | `/agmarknet/quantities` | same as prices | `quantity` |

Verified behaviour:

* **The data ends on 2025-10-30.** Every 2026 query returns "No data exists", so CEDA can't serve
  current prices.
* Without `district_id`, `/prices` returns one **state-average** row per day with fractional prices.
  We never store these as a market price.
* With all of a state's district ids in one request, `/prices` returns **one row per market per day**.
  West Bengal has 19 census districts. `/markets` is still needed, once per district, to get market names.
* Rows have **no variety**, and one market and day can repeat with different prices (unlabelled
  varieties). They are kept apart by their order within the day.
* **Ids are CEDA's own**: census state ids (West Bengal = 19), its own market ids, and commodity ids
  that match Agmarknet 2.0 for only 22 of 453 commodities (e.g. Tomato = 78 vs 65). Everything is
  therefore matched by **name**, never by id. Market names differ by an "APMC" suffix
  ("Bara Bazar (Posta Bazar)" vs "Bara Bazar (Posta Bazar) APMC"); `market_key()` handles that.
* District names differ from Agmarknet 2.0's ("Barddhaman" vs "Purba/Paschim Bardhaman").

---

## 3. data.gov.in (optional)

`GET https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070`
with `api-key`, `format=json`, `limit`, `offset`, `filters[state.keyword]` and `filters[commodity]`.
It returns `{status, total, records: [{state, district, market, commodity, variety, grade,
arrival_date (dd/mm/yyyy), min_price, max_price, modal_price (strings, Rs/quintal)}]}`.

This resource holds the **latest day only**. Its gateway returned 502/504 on every request during
development, so it is optional and never required.

---

## 4. How the providers are used

* `AgmarknetProvider.fetch_prices(PriceQuery(state, commodity, from_date, to_date))` makes one
  request per calendar month and returns `NormalizedMarketPrice` records.
* The ingestion pipeline (parse → normalise → validate → dedupe → upsert) and the backfill are
  described in `EXPLAIN.md` §5.15.
* Configuration (`.env`):

| Variable | Default | Purpose |
|---|---|---|
| `MARKET_PRICE_PROVIDERS` | `agmarknet,ceda,data_gov_in` | Fallback order. A provider without its key is skipped. |
| `CEDA_API_KEY` | — | CEDA bearer key. Backend only, never sent to the frontend. |
| `DATA_GOV_IN_API_KEY` | — | data.gov.in key |
