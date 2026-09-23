/**
 * Unified API client entry point.
 * Set NEXT_PUBLIC_USE_MOCKS=true in .env.local to use the mock client.
 * All components import from here — swapping to real API requires no component changes.
 */

import { mockClient } from "./mock-client";
import { realClient } from "./real-client";

const useMocks = process.env.NEXT_PUBLIC_USE_MOCKS === "true";

export const apiClient = useMocks ? mockClient : realClient;

export type { ApiResponse, Provenance, Farm, Field, SatelliteData, WeatherData, IrrigationData, YieldData, ChatMessage, ChatContext } from "./types";
