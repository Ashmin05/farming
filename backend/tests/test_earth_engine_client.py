"""Tests for EarthEngineClient. The real `ee` module is always mocked here —
these tests never need real Earth Engine credentials or network access."""

from unittest.mock import MagicMock

import pytest

from app.integrations import earth_engine_client as eec
from app.integrations.earth_engine_client import EarthEngineClient, EarthEngineNotConfiguredError


def _unconfigured_client() -> EarthEngineClient:
    return EarthEngineClient(project_id=None, service_account_email=None, key_path=None)


def _configured_client() -> EarthEngineClient:
    client = EarthEngineClient(
        project_id="fasalsetu-509718",
        service_account_email="ee-service@fasalsetu-509718.iam.gserviceaccount.com",
        key_path="secrets/ee-service-account.json",
    )
    client.configured = True
    return client


class TestInitialize:
    def test_stays_unconfigured_when_project_id_is_missing(self) -> None:
        client = _unconfigured_client()

        client.initialize()

        assert client.configured is False
        assert client.auth_mode is None
        assert "GEE_PROJECT_ID" in client.init_error

    def test_does_not_raise_when_settings_missing(self) -> None:
        # The whole point: a missing/blank EE key must never crash startup.
        _unconfigured_client().initialize()

    def test_uses_service_account_when_email_and_key_path_are_set(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        fake_ee = MagicMock()
        monkeypatch.setattr(eec, "ee", fake_ee)
        client = EarthEngineClient(
            project_id="fasalsetu-509718",
            service_account_email="ee-service@fasalsetu-509718.iam.gserviceaccount.com",
            key_path="secrets/ee-service-account.json",
        )

        client.initialize()

        assert client.configured is True
        assert client.auth_mode == "service_account"
        assert client.init_error is None
        fake_ee.ServiceAccountCredentials.assert_called_once_with(
            "ee-service@fasalsetu-509718.iam.gserviceaccount.com",
            "secrets/ee-service-account.json",
        )
        fake_ee.Initialize.assert_called_once()

    def test_stays_unconfigured_when_ee_rejects_service_account_credentials(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        fake_ee = MagicMock()
        fake_ee.Initialize.side_effect = Exception("invalid_grant: bad key")
        monkeypatch.setattr(eec, "ee", fake_ee)
        client = EarthEngineClient(
            project_id="fasalsetu-509718",
            service_account_email="ee-service@fasalsetu-509718.iam.gserviceaccount.com",
            key_path="secrets/ee-service-account.json",
        )

        client.initialize()  # must not raise

        assert client.configured is False
        assert client.auth_mode is None
        assert "invalid_grant" in client.init_error

    def test_uses_application_default_credentials_when_no_service_account_set(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        # This is the path used for local dev when an org policy blocks
        # service-account key creation (iam.disableServiceAccountKeyCreation).
        fake_ee = MagicMock()
        monkeypatch.setattr(eec, "ee", fake_ee)
        fake_credentials = MagicMock()
        fake_default = MagicMock(return_value=(fake_credentials, "fasalsetu-509718"))
        monkeypatch.setattr(eec, "google_auth_default", fake_default)

        client = EarthEngineClient(project_id="fasalsetu-509718")

        client.initialize()

        assert client.configured is True
        assert client.auth_mode == "application_default"
        assert client.init_error is None
        fake_default.assert_called_once_with(scopes=eec.ADC_SCOPES)
        fake_ee.Initialize.assert_called_once_with(fake_credentials, project="fasalsetu-509718")
        fake_ee.ServiceAccountCredentials.assert_not_called()

    def test_stays_unconfigured_when_adc_unavailable(self, monkeypatch: pytest.MonkeyPatch) -> None:
        fake_ee = MagicMock()
        monkeypatch.setattr(eec, "ee", fake_ee)
        fake_default = MagicMock(side_effect=Exception("Could not automatically determine credentials"))
        monkeypatch.setattr(eec, "google_auth_default", fake_default)

        client = EarthEngineClient(project_id="fasalsetu-509718")

        client.initialize()  # must not raise

        assert client.configured is False
        assert client.auth_mode is None
        assert "gcloud auth application-default login" in client.init_error


class TestCountRecentSentinel2Images:
    async def test_raises_not_configured_without_touching_ee(self, monkeypatch: pytest.MonkeyPatch) -> None:
        fake_ee = MagicMock()
        monkeypatch.setattr(eec, "ee", fake_ee)
        client = _unconfigured_client()

        with pytest.raises(EarthEngineNotConfiguredError):
            await client.count_recent_sentinel2_images()

        fake_ee.ImageCollection.assert_not_called()

    async def test_returns_image_count_from_ee(self, monkeypatch: pytest.MonkeyPatch) -> None:
        fake_collection = MagicMock()
        fake_collection.filterBounds.return_value = fake_collection
        fake_collection.filterDate.return_value = fake_collection
        fake_size = MagicMock()
        fake_size.getInfo.return_value = 7
        fake_collection.size.return_value = fake_size

        fake_ee = MagicMock()
        fake_ee.ImageCollection.return_value = fake_collection
        monkeypatch.setattr(eec, "ee", fake_ee)

        client = _configured_client()
        count = await client.count_recent_sentinel2_images(lon=78.96, lat=20.59, days=30)

        assert count == 7
        fake_ee.ImageCollection.assert_called_once_with("COPERNICUS/S2_SR_HARMONIZED")
        fake_ee.Geometry.Point.assert_called_once_with([78.96, 20.59])

    async def test_wraps_a_timeout_as_earth_engine_timeout_error(self, monkeypatch: pytest.MonkeyPatch) -> None:
        import asyncio

        async def _never_finishes(coro, *args, **kwargs):
            coro.close()  # avoid a "coroutine was never awaited" warning
            raise asyncio.TimeoutError()

        monkeypatch.setattr(eec.asyncio, "wait_for", _never_finishes)

        fake_collection = MagicMock()
        fake_collection.filterBounds.return_value = fake_collection
        fake_collection.filterDate.return_value = fake_collection
        fake_ee = MagicMock()
        fake_ee.ImageCollection.return_value = fake_collection
        monkeypatch.setattr(eec, "ee", fake_ee)

        client = _configured_client()

        with pytest.raises(eec.EarthEngineTimeoutError):
            await client.count_recent_sentinel2_images()
