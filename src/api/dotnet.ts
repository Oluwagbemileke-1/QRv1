// ── .NET API base URL ─────────────────────────────────────────────────────
// Replace with your actual deployed .NET API URL
const NET_BASE_URL = (
  import.meta.env.DEV
    ? "/net-api"
    : (import.meta.env.VITE_NET_API_URL || "https://qr-attendance-project-2yh5.onrender.com/api")
).replace(/\/+$/, "");
 
// ── Types ──────────────────────────────────────────────────────────────────
 
export interface QrCodeData {
  id: string;
  eventId: string;
  imageUrl: string;       // base64 "data:image/png;base64,..."
  generatedAt: string;    // WAT datetime string
  expiresAt: string;      // WAT datetime string — QR expires 1 min after gen
  payload?: string;
}
 
export interface ScanAttempt {
  username: string;
  ipAddress: string;
  result: string;         // "Success" | "Fraud" | "Expired" | "InvalidPayload" | "NotFound"
  location: string | null;
  scannedAt: string;      // WAT datetime string
}
 
export interface EventStats {
  eventId: string;
  totalScans: number;
  successfulScans: number;
  fraudAttempts: number;
  uniqueIps: number;
}
 
export interface FraudLog {
  username: string;
  ipAddress: string;
  reason: string;
  details: string | null;
  detectedAt: string;     // WAT datetime string
}

export interface ScanResponse {
  result: string;
  message: string;
  scannedAt: string;
}
 
interface NetResponse<T> {
  success?: boolean;
  message?: string;
  isSuccessful?: boolean;
  responseMessage?: string;
  responseCode?: string;
  data: T;
}

function normalizeNetError(error: unknown, fallback: string): Error {
  if (error instanceof Error) {
    if (error.name === "AbortError") {
      return new Error("The check-in request took too long. Please try again.");
    }

    if (error.message === "Failed to fetch") {
      return new Error(fallback);
    }

    return error;
  }

  return new Error(fallback);
}

async function performNetFetch<T>(path: string, init: RequestInit, fallback: string): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 45000);

  try {
    const res = await fetch(buildNetUrl(path), {
      ...init,
      signal: controller.signal,
    });
    return await handleNetResponse<T>(res);
  } catch (error) {
    throw normalizeNetError(error, fallback);
  } finally {
    clearTimeout(timeoutId);
  }
}

function buildNetUrl(path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  if (NET_BASE_URL.startsWith("/")) {
    return `${NET_BASE_URL}${normalizedPath}`;
  }

  if (NET_BASE_URL.endsWith("/api")) {
    return `${NET_BASE_URL}${normalizedPath}`;
  }

  return `${NET_BASE_URL}/api${normalizedPath}`;
}
 
// ── Helper ─────────────────────────────────────────────────────────────────
 
async function handleNetResponse<T>(res: Response): Promise<T> {
  const json: NetResponse<T> = await res.json();
  const ok = json.success ?? json.isSuccessful ?? false;
  const message = json.message || json.responseMessage || "Request failed.";

  if (!res.ok || !ok) {
    throw new Error(message);
  }

  return json.data;
}
 
// ── QR endpoints ───────────────────────────────────────────────────────────
 
/**
 * POST api/qr/generate/<eventId>
 * Called directly from admin frontend to generate/rotate QR.
 * QR expires in 1 minute; if scanned it deactivates immediately.
 */
export async function generateQr(eventId: string, eventCode: string): Promise<QrCodeData> {
  return performNetFetch<QrCodeData>(
    "/qr/generate",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventId,
        eventCode,
      }),
    },
    "The QR service is currently unreachable."
  );
}
 
// ── Scan / Analytics endpoints ─────────────────────────────────────────────
 
/**
 * GET api/scan/event/<eventId>
 * All scan attempts (success + fraud + expired etc.)
 */
export async function getAllScans(eventId: string): Promise<ScanAttempt[]> {
  return performNetFetch<ScanAttempt[]>(
    `/scan/event/${eventId}`,
    {},
    "The scan analytics service is currently unreachable."
  );
}
 
/**
 * GET api/scan/event/<eventId>/successful
 * Only users who successfully attended
 */
export async function getSuccessfulScans(eventId: string): Promise<ScanAttempt[]> {
  return performNetFetch<ScanAttempt[]>(
    `/scan/event/${eventId}/successful`,
    {},
    "The successful check-in service is currently unreachable."
  );
}
 
/**
 * GET api/scan/event/<eventId>/count
 * Attendance count for dashboard stat card
 */
export async function getAttendanceCount(eventId: string): Promise<{ eventId: string; attendanceCount: number }> {
  return performNetFetch<{ eventId: string; attendanceCount: number }>(
    `/scan/event/${eventId}/count`,
    {},
    "The attendance count service is currently unreachable."
  );
}
 
/**
 * GET api/scan/event/<eventId>/stats
 * Full analytics: totalScans, successfulScans, fraudAttempts, uniqueIps
 */
export async function getEventStats(eventId: string): Promise<EventStats> {
  return performNetFetch<EventStats>(
    `/scan/event/${eventId}/stats`,
    {},
    "The scan analytics service is currently unreachable."
  );
}
 
// ── Fraud endpoints ────────────────────────────────────────────────────────
 
/**
 * GET api/fraud/event/<eventId>
 * All fraud logs for an event with reason + details
 */
export async function getFraudLogs(eventId: string): Promise<FraudLog[]> {
  return performNetFetch<FraudLog[]>(
    `/fraud/event/${eventId}`,
    {},
    "The fraud logs service is currently unreachable."
  );
}
 
/**
 * GET api/fraud/event/<eventId>/count
 * Total fraud count — used in dashboard stat card
 */
export async function getFraudCount(eventId: string): Promise<{ eventId: string; fraudCount: number }> {
  return performNetFetch<{ eventId: string; fraudCount: number }>(
    `/fraud/event/${eventId}/count`,
    {},
    "The fraud count service is currently unreachable."
  );
}

export async function submitScan(
  payload: string,
  username: string,
  eventCode?: string,
  location?: string,
  latitude?: number,
  longitude?: number
): Promise<ScanResponse> {
  return performNetFetch<ScanResponse>(
    "/scan",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        payload,
        username,
        eventCode: eventCode || "",
        location: location || null,
        latitude: latitude ?? null,
        longitude: longitude ?? null,
      }),
    },
    "The check-in service is currently unreachable from this browser right now."
  );
}
