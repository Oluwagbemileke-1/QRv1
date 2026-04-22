import { authHeaders } from "./auth";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000/api";

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
  const res = await fetch(`${BASE_URL}/attendance/my-attendance/`, {
    headers: authHeaders(),
  });
  return handleResponse<AttendanceSummary>(res);
}

/**
 * GET api/attendance/<event_id>/my-event-attendance/
 * Returns attendance record for a specific event.
 */
export async function getMyEventAttendance(eventId: string): Promise<AttendanceRecord> {
  const res = await fetch(`${BASE_URL}/attendance/${eventId}/my-event-attendance/`, {
    headers: authHeaders(),
  });
  return handleResponse<AttendanceRecord>(res);
}
