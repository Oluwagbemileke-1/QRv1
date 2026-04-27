import { authorizedFetch, getStoredUser } from "./auth";

const BASE_URL = import.meta.env.VITE_API_URL || "https://qr-attendance-api-smj1.onrender.com/api";
 
// ── Types ──────────────────────────────────────────────────────────────────
 
export interface EventCreatedBy {
  id: number;
  username: string;
  fullname: string;
}
 
export interface Event {
  id: string;
  title: string;
  description: string;
  date: string;           // "DD-MM-YYYY" from Django serializer
  start_time: string;     // "HH:MM AM/PM"
  end_time: string;
  location_name: string;
  event_code: string;
  status: string;         // "Upcoming" | "Active" | "Past" | "Deleted"
  created_by: EventCreatedBy;
  created_at: string;
  is_active?: boolean;    // only in AllSerializer
}
 
export interface CreateEventPayload {
  title: string;
  description: string;
  date: string;           // "YYYY-MM-DD" for input, Django converts
  start_time: string;     // "HH:MM"
  end_time: string;
  location_name: string;
  latitude?: number | null;
  longitude?: number | null;
}
 
export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T;
}
 
export interface EventAttendee {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string;
  role: string;
}
 
export interface AssignPreview {
  summary: {
    will_receive_email: number;
    already_assigned: number;
    invalid_ids: number;
  };
  details: {
    to_be_added: { id: number; email: string; first_name: string }[];
    already_assigned: { id: number; email: string }[];
    invalid_ids: number[];
  };
}

export interface UserEventGroups {
  upcoming: Event[];
  active: Event[];
  past: Event[];
}

function isDeletedEvent(event: Event): boolean {
  return String(event.status || "").trim().toLowerCase() === "deleted";
}

function canCurrentUserSeeDeletedEvents(): boolean {
  const user = getStoredUser();
  return user?.is_superuser === true;
}

function filterEventsForCurrentUser(events: Event[]): Event[] {
  if (canCurrentUserSeeDeletedEvents()) {
    return events;
  }

  return events.filter((event) => !isDeletedEvent(event));
}

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

function normalizeEventGroups(payload: unknown): UserEventGroups {
  const root = payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
  const data = root.data && typeof root.data === "object" ? root.data as Record<string, unknown> : root;

  const readEvents = (...keys: string[]) => {
    for (const key of keys) {
      const value = data[key] ?? root[key];
      if (Array.isArray(value)) {
        return value as Event[];
      }
    }
    return [] as Event[];
  };

  return {
    active: filterEventsForCurrentUser(readEvents("active", "active_events", "activeEvents")),
    upcoming: filterEventsForCurrentUser(readEvents("upcoming", "upcoming_events", "upcomingEvents")),
    past: filterEventsForCurrentUser(readEvents("past", "past_events", "pastEvents", "previous")),
  };
}
 
// ── Helpers ────────────────────────────────────────────────────────────────
 
async function handleResponse<T>(res: Response): Promise<T> {
  const data = await res.json();
  if (!res.ok) {
    const msg = extractErrorMessage(data) || "Something went wrong.";
    throw new Error(String(msg));
  }
  return data as T;
}
 
// ── Event endpoints ────────────────────────────────────────────────────────
 
/** POST api/events/create/ — admin only */
export async function createEvent(payload: CreateEventPayload): Promise<{ message: string; data: Event }> {
  const res = await authorizedFetch(`${BASE_URL}/events/create/`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return handleResponse(res);
}
 
/** GET api/events/allevents/ — admin sees their events, superuser sees all */
export async function getAllEvents(params?: {
  search?: string;
  date?: string;
  status?: string;
  page?: number;
}): Promise<PaginatedResponse<Event[]>> {
  const p = new URLSearchParams();
  if (params?.search) p.set("search", params.search);
  if (params?.date) p.set("date", params.date);
  if (params?.status) p.set("status", params.status);
  if (params?.page) p.set("page", String(params.page));
  const res = await authorizedFetch(`${BASE_URL}/events/allevents/?${p}`);
  return handleResponse(res);
}

export async function getAllEventsList(params?: {
  search?: string;
  date?: string;
  status?: string;
}): Promise<Event[]> {
  const collected: Event[] = [];
  let page = 1;
  let totalCount = 0;

  do {
    const response = await getAllEvents({ ...params, page });
    collected.push(...(response.results || []));
    totalCount = response.count || 0;
    page += 1;
  } while (collected.length < totalCount);

  return filterEventsForCurrentUser(collected);
}
 
/** GET api/events/<uuid>/ */
export async function getEventDetail(eventId: string): Promise<{ success: string; data: Event }> {
  const res = await authorizedFetch(`${BASE_URL}/events/${eventId}/`);
  return handleResponse(res);
}
 
/** PUT api/events/<uuid>/update/ */
export async function updateEvent(
  eventId: string,
  payload: Partial<CreateEventPayload>
): Promise<{ message: string; data: Event }> {
  const res = await authorizedFetch(`${BASE_URL}/events/${eventId}/update/`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  return handleResponse(res);
}
 
/** DELETE api/events/<uuid>/delete/ — soft delete */
export async function deleteEvent(eventId: string): Promise<{ message: string }> {
  const res = await authorizedFetch(`${BASE_URL}/events/${eventId}/delete/`, {
    method: "DELETE",
  });
  return handleResponse(res);
}
 
/**
 * POST api/events/<uuid>/generate-qr/
 * Django proxies this to the .NET API and returns QR data
 */
export async function generateEventQr(eventId: string): Promise<{
  message: string;
  event_id: string;
  event_code?: string;
  event_title: string;
  payload?: string | null;
  check_in_url?: string | null;
  data: {
    id: string;
    eventId: string;
    imageUrl: string;     // base64 data:image/png;base64,...
    generatedAt: string;
    expiresAt: string;
  };
}> {
  const res = await authorizedFetch(`${BASE_URL}/events/${eventId}/generate-qr/`, {
    method: "POST",
  });
  return handleResponse(res);
}
 
/** GET api/events/<uuid>/eventattendees/ */
export async function getEventAttendees(
  eventId: string,
  params?: { search?: string; page?: number }
): Promise<PaginatedResponse<{ event: string; attendees: EventAttendee[] }>> {
  const p = new URLSearchParams();
  if (params?.search) p.set("search", params.search);
  if (params?.page) p.set("page", String(params.page));
  const res = await authorizedFetch(`${BASE_URL}/events/${eventId}/eventattendees/?${p}`);
  return handleResponse(res);
}
 
/** POST api/events/<uuid>/preview-assign/ */
export async function previewAssign(
  eventId: string,
  user_ids: number[]
): Promise<AssignPreview> {
  const res = await authorizedFetch(`${BASE_URL}/events/${eventId}/preview-assign/`, {
    method: "POST",
    body: JSON.stringify({ user_ids }),
  });
  return handleResponse(res);
}
 
/**
 * POST api/events/<uuid>/assign/
 * First call without confirm → get preview
 * Second call with confirm: true → actually assign
 */
export async function assignUsers(
  eventId: string,
  user_ids: number[],
  confirm: boolean
): Promise<{
  message: string;
  added?: number[];
  summary?: AssignPreview["summary"];
  preview?: AssignPreview["summary"];
}> {
  const res = await authorizedFetch(`${BASE_URL}/events/${eventId}/assign/`, {
    method: "POST",
    body: JSON.stringify({ user_ids, confirm }),
  });
  return handleResponse(res);
}

export async function getMyEvents(params?: {
  search?: string;
  date?: string;
}): Promise<UserEventGroups> {
  const p = new URLSearchParams();
  if (params?.search) p.set("search", params.search);
  if (params?.date) p.set("date", params.date);
  const res = await authorizedFetch(`${BASE_URL}/events/my-events/${p.toString() ? `?${p}` : ""}`);
  const payload = await handleResponse<unknown>(res);
  return normalizeEventGroups(payload);
}
 
