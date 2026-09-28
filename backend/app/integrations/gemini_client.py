"""Thin wrapper around Google's Gen AI SDK (`google-genai`) for the AI
Advisor / KrishiBot. Tries every configured GEMINI_API_KEYS entry in turn --
several free-tier keys quota-exhaust independently, so a 429/auth/other
failure on one key falls through to the next rather than failing the whole
request; a transient 5xx gets one short in-place retry first since it's the
model that's overloaded, not the key. See app/services/advisor_service.py
for the caller, which falls back to a scripted (non-LLM) reply whenever
every key ultimately fails -- not just when no key is configured at all.
"""

import logging
import time
from typing import TypeVar

from google import genai
from google.genai import errors, types
from pydantic import BaseModel

from app.core.config import settings

logger = logging.getLogger(__name__)

T = TypeVar("T", bound=BaseModel)

# Retried in place on the same key before moving on to the next one: these
# are momentary overload on Google's side (the model itself, not this key),
# so a short backoff on the SAME key can clear it. A real farming answer
# takes longer to generate than a one-word greeting, so it has more time to
# get caught by one of these -- that's why short replies ("hi") were
# succeeding while longer ones consistently failed.
#
# 429 is deliberately NOT retried here: it means THIS key/project is
# rate-limited or has exhausted its free-tier quota (seen in practice:
# "GenerateRequestsPerDayPerProjectPerModel-FreeTier", limit 20/day), which a
# couple of seconds of backoff can't fix. Moving straight to the next key
# (a separate Google project/quota pool) is the only thing that helps.
_RETRYABLE_CODES = {500, 502, 503, 504}
_MAX_ATTEMPTS_PER_KEY = 2
_RETRY_BACKOFF_SECONDS = 1.5


def _is_retryable(exc: Exception) -> bool:
    return isinstance(exc, errors.APIError) and exc.code in _RETRYABLE_CODES


class GeminiNotConfiguredError(Exception):
    """No GEMINI_API_KEYS are set. Callers should use a non-LLM fallback
    instead of treating this as a transient failure."""


class GeminiRequestError(Exception):
    """Every configured key failed, after retries (quota, overload, auth, or
    a genuine API error). AdvisorService.ask() catches this and falls back
    to a scripted (non-LLM) reply rather than erroring out to the client."""


def generate_structured(
    *,
    system_instruction: str,
    contents: str,
    response_model: type[T],
) -> T:
    """Runs one generateContent call asking for JSON matching
    `response_model`, retrying with each configured key in order until one
    succeeds. Raises GeminiNotConfiguredError if GEMINI_API_KEYS is empty,
    GeminiRequestError if every configured key failed."""
    api_keys = settings.gemini_api_keys
    if not api_keys:
        raise GeminiNotConfiguredError("No GEMINI_API_KEYS configured.")

    config = types.GenerateContentConfig(
        system_instruction=system_instruction,
        response_mime_type="application/json",
        response_schema=response_model,
    )

    last_error: Exception | None = None
    for index, api_key in enumerate(api_keys):
        client = genai.Client(api_key=api_key)

        for attempt in range(1, _MAX_ATTEMPTS_PER_KEY + 1):
            try:
                response = client.models.generate_content(
                    model=settings.GEMINI_MODEL,
                    contents=contents,
                    config=config,
                )
            except Exception as exc:  # noqa: BLE001 -- any SDK/auth/quota error on this key means "try the next one"
                last_error = exc
                retryable = _is_retryable(exc)
                logger.warning(
                    "Gemini key #%d/%d attempt %d/%d failed (%s: %s)%s.",
                    index + 1, len(api_keys), attempt, _MAX_ATTEMPTS_PER_KEY,
                    type(exc).__name__, exc,
                    " -- retrying" if retryable and attempt < _MAX_ATTEMPTS_PER_KEY else " -- trying next key",
                )
                if retryable and attempt < _MAX_ATTEMPTS_PER_KEY:
                    time.sleep(_RETRY_BACKOFF_SECONDS * attempt)
                    continue
                break

            parsed = response.parsed
            if parsed is None:
                last_error = ValueError("Gemini response didn't match the requested schema.")
                logger.warning(
                    "Gemini key #%d/%d attempt %d/%d returned an unparsable response -- trying next key.",
                    index + 1, len(api_keys), attempt, _MAX_ATTEMPTS_PER_KEY,
                )
                break
            return parsed

    raise GeminiRequestError(f"All {len(api_keys)} configured Gemini key(s) failed.") from last_error
