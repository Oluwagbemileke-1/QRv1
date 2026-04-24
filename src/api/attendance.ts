import { authorizedFetch, getStoredUser } from "./auth";
import { submitScan } from "./dotnet";

const BASE_URL = import.meta.env.VITE_API_URL || "https://qr-attendance-api-smj1.onrender.com/api";

export type AttendanceStatus = "attended" | "missed";

export interface AttendanceRecord {
  id: string;
  event_id: string;
  event_name: string;
  event_date: string;        // ISO date string
  event_code?: string;
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

export interface MyEventAttendanceStatus {
  event: string;
  attended: boolean;
  scan_time: string | null;
  location: string;
  created_by: string;
}

export interface AttendanceCheckInResponse {
  message: string;
  event?: string;
  event_id?: string;
  ip?: string;
  device?: string;
  source?: "django" | "dotnet";
}

const RECENT_ATTENDANCE_STORAGE_KEY = "recentAttendanceRecords";

function extractErrorMessage(payload: unknown): string {
  if (payload == null) {
    return "";
  }

  if (typeof payload === "string" || typeof payload === "number" || typeof payload === "boolean") {
    return String(payload);
  }

  if (Array.isArray(payload)) {
    return payload.map((item) => extractErrorMessage(item)).filter(Boolean).join(" ");
  }

  if (typeof payload === "object") {
    return Object.values(payload as Record<string, unknown>)
      .map((value) => extractErrorMessage(value))
      .filter(Boolean)
      .join(" ");
  }

  return "";
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
    (statusFlag == null && !explicitStatus) ||
    ["attended", "present", "success", "successful", "checked_in", "checked-in", "confirmed"].includes(explicitStatus)
      ? "attended"
      : "missed";

  return {
    id: String(item.id || item.attendance_id || item.record_id || `${index}`),
    event_id: String(item.event_id || item.event_uuid || event?.id || ""),
    event_code: readString(
      item.event_code,
      item.code,
      event?.event_code,
      event?.code
    ) || undefined,
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
  const attendedCount =
    coerceCount(
      data.attended ??
      data.present ??
      data.total_attended ??
      summary.attended ??
      summary.present ??
      summary.attended_count ??
      root.attended ??
      root.total_attended
    ) || attendedFromRecords;
  const missedCount =
    coerceCount(
      data.missed ?? data.absent ?? summary.missed ?? summary.absent ?? summary.missed_count ?? root.missed
    ) || missedFromRecords;
  const totalCount =
    coerceCount(
      data.total ??
      data.total_attended ??
      summary.total ??
      summary.count ??
      summary.total_events ??
      root.total ??
      root.total_attended
    ) || records.length || attendedCount + missedCount;

  return {
    total: totalCount,
    attended: attendedCount,
    missed: missedCount,
    records,
  };
}

function getRecentAttendanceRecords(): AttendanceRecord[] {
  try {
    const raw = localStorage.getItem(RECENT_ATTENDANCE_STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is AttendanceRecord => Boolean(item && typeof item === "object"))
      : [];
  } catch {
    return [];
  }
}

function saveRecentAttendanceRecord(record: AttendanceRecord): void {
  const existing = getRecentAttendanceRecords();
  const identity = `${record.event_id || ""}:${record.event_code || ""}:${record.event_name}`;
  const deduped = existing.filter((item) => {
    const itemIdentity = `${item.event_id || ""}:${item.event_code || ""}:${item.event_name}`;
    return itemIdentity !== identity;
  });

  localStorage.setItem(
    RECENT_ATTENDANCE_STORAGE_KEY,
    JSON.stringify([record, ...deduped].slice(0, 20))
  );
}

function mergeRecentAttendanceRecords(summary: AttendanceSummary): AttendanceSummary {
  const recent = getRecentAttendanceRecords();
  if (!recent.length) {
    return summary;
  }

  const mergedRecords = [...summary.records];

  for (const record of recent) {
    const alreadyPresent = mergedRecords.some((item) => {
      if (record.event_id && item.event_id && record.event_id === item.event_id) {
        return true;
      }

      if (record.event_code && item.event_code && record.event_code === item.event_code) {
        return true;
      }

      return item.event_name === record.event_name && item.status === record.status;
    });

    if (!alreadyPresent) {
      mergedRecords.unshift(record);
    }
  }

  const attended = mergedRecords.filter((record) => record.status === "attended").length;
  const missed = mergedRecords.filter((record) => record.status === "missed").length;

  return {
    total: Math.max(summary.total, mergedRecords.length, attended + missed),
    attended: Math.max(summary.attended, attended),
    missed: Math.max(summary.missed, missed),
    records: mergedRecords,
  };
}

async function handleResponse<T>(res: Response): Promise<T> {
  const data = await res.json();
  if (!res.ok) {
    const message = extractErrorMessage(data) || "Something went wrong.";
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
  return mergeRecentAttendanceRecords(normalizeAttendanceSummary(payload));
}

/**
 * GET api/attendance/<event_id>/my-event-attendance/
 * Returns attendance record for a specific event.
 */
export async function getMyEventAttendance(eventId: string): Promise<MyEventAttendanceStatus> {
  const res = await authorizedFetch(`${BASE_URL}/attendance/${eventId}/my-event-attendance/`);
  return handleResponse<MyEventAttendanceStatus>(res);
}

/**
 * POST api/attendance/check-in/
 * Creates an attendance record for the signed-in user after Django validates the QR via .NET.
 */
export async function submitAttendanceCheckIn(
  eventCode: string,
  payload: string,
  latitude: number,
  longitude: number,
  location?: string
): Promise<AttendanceCheckInResponse> {
  let result: AttendanceCheckInResponse;

  try {
    const res = await authorizedFetch(`${BASE_URL}/attendance/check-in/`, {
      method: "POST",
      body: JSON.stringify({
        event_code: eventCode,
        payload,
        latitude,
        longitude,
        location,
      }),
    });

    result = {
      ...(await handleResponse<AttendanceCheckInResponse>(res)),
      source: "django",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message.trim() : "";
    const shouldRetryWithDotnet =
      !message ||
      message === "API error" ||
      message === "Something went wrong." ||
      message.toLowerCase().includes("server error");

    if (!shouldRetryWithDotnet) {
      throw error;
    }

    const user = getStoredUser();
    if (!user?.username) {
      throw error;
    }

    const scanResult = await submitScan(
      payload,
      user.username,
      eventCode,
      location,
      latitude,
      longitude
    );

    result = {
      message: scanResult.message || "Attendance recorded successfully.",
      event: `Event ${eventCode}`,
      event_id: "",
      source: "dotnet",
    };
  }
  const now = new Date().toISOString();

  saveRecentAttendanceRecord({
    id: `local-${eventCode}-${Date.now()}`,
    event_id: result.event_id || "",
    event_code: eventCode,
    event_name: result.event || `Event ${eventCode}`,
    event_date: now,
    event_location: location || "",
    status: "attended",
    marked_at: now,
  });

  return result;
}
