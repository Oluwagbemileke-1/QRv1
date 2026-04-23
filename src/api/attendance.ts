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

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? value as Record<string, unknown> : null;
}

function readString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }
  return "";
}

function readBoolean(value: unknown): boolean | undefined {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    if (value === 1) return true;
    if (value === 0) return false;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "y"].includes(normalized)) return true;
    if (["false", "0", "no", "n"].includes(normalized)) return false;
  }

  return undefined;
}

function readArray(source: Record<string, unknown>, keys: string[]): unknown[] {
  for (const key of keys) {
    const value = source[key];
    if (Array.isArray(value)) {
      return value;
    }

    const nested = asObject(value);
    if (!nested) {
      continue;
    }

    for (const nestedKey of ["records", "results", "attendance", "attendances", "history", "items", "data"]) {
      if (Array.isArray(nested[nestedKey])) {
        return nested[nestedKey] as unknown[];
      }
    }
  }

  return [];
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
  const item = asObject(record);
  if (!item) {
    return null;
  }
  const event = asObject(item.event);

  const explicitStatus = readString(
    item.status,
    item.attendance_status,
    item.result,
    item.outcome,
    item.scan_result
  ).toLowerCase();
  const statusFlag =
    readBoolean(item.attended) ??
    readBoolean(item.present) ??
    readBoolean(item.is_present) ??
    readBoolean(item.is_attended) ??
    readBoolean(item.success) ??
    readBoolean(item.is_successful);
  const status: AttendanceStatus =
    statusFlag === true ||
    ["attended", "present", "success", "successful", "checked_in", "checked-in", "confirmed"].includes(explicitStatus)
      ? "attended"
      : "missed";

  return {
    id: String(item.id || item.attendance_id || item.record_id || `${index}`),
    event_id: String(item.event_id || item.event_uuid || event?.id || ""),
    event_name: readString(
      item.event_name,
      item.event_title,
      item.title,
      item.name,
      event?.title,
      event?.name
    ) || "Untitled event",
    event_date: readString(
      item.event_date,
      item.date,
      item.event_day,
      event?.date,
      event?.event_date
    ),
    event_location: readString(
      item.event_location,
      item.location_name,
      item.location,
      event?.location_name,
      event?.location,
      event?.venue
    ),
    status,
    marked_at: readString(
      item.marked_at,
      item.scan_time,
      item.checked_in_at,
      item.scanned_at,
      item.timestamp,
      item.created_at,
      item.updated_at
    ) || undefined,
  };
}

function normalizeAttendanceSummary(payload: unknown): AttendanceSummary {
  const root = asObject(payload) || {};
  const data = asObject(root.data) || root;
  const summary = asObject(data.summary) || asObject(root.summary) || {};
  const recordsSource = [
    ...readArray(data, ["records", "results", "attendance", "attendances", "history", "attendance_history", "my_attendance"]),
    ...readArray(root, ["records", "results", "attendance", "attendances", "history", "attendance_history", "my_attendance"]),
  ];
  const records = recordsSource
    .map((record, index) => normalizeAttendanceRecord(record, index))
    .filter((record): record is AttendanceRecord => Boolean(record));
  const attendedFromRecords = records.filter((record) => record.status === "attended").length;
  const missedFromRecords = records.filter((record) => record.status === "missed").length;

  return {
    total: coerceCount(data.total ?? summary.total ?? summary.count ?? summary.total_events ?? root.total) || records.length,
    attended: coerceCount(
      data.attended ?? data.present ?? summary.attended ?? summary.present ?? summary.attended_count ?? root.attended
    ) || attendedFromRecords,
    missed: coerceCount(
      data.missed ?? data.absent ?? summary.missed ?? summary.absent ?? summary.missed_count ?? root.missed
    ) || missedFromRecords,
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
