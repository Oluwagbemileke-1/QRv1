import { authorizedFetch } from "./auth";

const BASE_URL = import.meta.env.VITE_API_URL || "https://qr-attendance-api-smj1.onrender.com/api";

export type AttendanceStatus = "attended" | "missed";

export interface AttendanceRecord {
  id: string;
  event_id: string;
  event_name: string;
  event_date: string;        // ISO date string
  event_location?: string;
  status: AttendanceStatus;
  marked_at?: string;        // ISO datetime when scanned
}

export interface AttendanceSummary {
  total: number;
  attended: number;
  missed: number;
  records: AttendanceRecord[];
}

function coerceCount(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return 0;
}

function normalizeAttendanceRecord(record: unknown, index: number): AttendanceRecord | null {
  if (!record || typeof record !== "object") {
    return null;
  }

  const item = record as Record<string, unknown>;
  const event = item.event && typeof item.event === "object" ? item.event as Record<string, unknown> : null;
  const rawStatus = String(item.status || "").toLowerCase();
  const status: AttendanceStatus =
    rawStatus === "attended" || rawStatus === "present" || rawStatus === "success"
      ? "attended"
      : "missed";

  return {
    id: String(item.id || `${index}`),
    event_id: String(item.event_id || event?.id || ""),
    event_name: String(item.event_name || event?.title || item.title || "Untitled event"),
    event_date: String(item.event_date || event?.date || item.date || ""),
    event_location: String(item.event_location || event?.location_name || item.location || ""),
    status,
    marked_at: typeof item.marked_at === "string"
      ? item.marked_at
      : typeof item.scan_time === "string"
        ? item.scan_time
        : typeof item.checked_in_at === "string"
          ? item.checked_in_at
          : undefined,
  };
}

function normalizeAttendanceSummary(payload: unknown): AttendanceSummary {
  const root = payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
  const data = root.data && typeof root.data === "object" ? root.data as Record<string, unknown> : root;
  const recordsSource =
    (Array.isArray(data.records) && data.records) ||
    (Array.isArray(data.results) && data.results) ||
    (Array.isArray(data.attendance) && data.attendance) ||
    (Array.isArray(root.records) && root.records) ||
    [];
  const records = recordsSource
    .map((record, index) => normalizeAttendanceRecord(record, index))
    .filter((record): record is AttendanceRecord => Boolean(record));
  const attendedFromRecords = records.filter((record) => record.status === "attended").length;
  const missedFromRecords = records.filter((record) => record.status === "missed").length;

  return {
    total: coerceCount(data.total ?? root.total) || records.length,
    attended: coerceCount(data.attended ?? root.attended) || attendedFromRecords,
    missed: coerceCount(data.missed ?? root.missed) || missedFromRecords,
    records,
  };
}

async function handleResponse<T>(res: Response): Promise<T> {
  const data = await res.json();
  if (!res.ok) {
    const message =
      typeof data === "object"
        ? Object.values(data).flat().join(" ")
        : "Something went wrong.";
    throw new Error(message);
  }
  return data as T;
}

/**
 * GET api/attendance/my-attendance/
 * Returns all attendance records for the logged-in user.
 */
export async function getMyAttendance(): Promise<AttendanceSummary> {
  const res = await authorizedFetch(`${BASE_URL}/attendance/my-attendance/`);
  const payload = await handleResponse<unknown>(res);
  return normalizeAttendanceSummary(payload);
}

/**
 * GET api/attendance/<event_id>/my-event-attendance/
 * Returns attendance record for a specific event.
 */
export async function getMyEventAttendance(eventId: string): Promise<AttendanceRecord> {
  const res = await authorizedFetch(`${BASE_URL}/attendance/${eventId}/my-event-attendance/`);
  return handleResponse<AttendanceRecord>(res);
}
