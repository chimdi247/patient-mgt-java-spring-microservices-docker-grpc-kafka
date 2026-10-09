import type { Patient, PatientInput } from "./types";

const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";
const STORAGE_KEY = "caredesk.session";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

let unauthorizedHandler: (() => void) | null = null;
export const onUnauthorized = (fn: () => void) => { unauthorizedHandler = fn; };

export function getToken(): string | null {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "null")?.token ?? null;
  } catch {
    return null;
  }
}
export const STORAGE = STORAGE_KEY;

/**
 * The services answer errors in three shapes:
 *   400 validation   {"email": "Email should be valid", "name": "Name is required"}
 *   400/404 domain   {"message": "Email address already exists"}
 *   401 / 403        empty body (api-gateway)
 */
function messageFrom(status: number, body: unknown): string {
  if (body && typeof body === "object") {
    const o = body as Record<string, unknown>;
    if (typeof o.message === "string") return o.message;
    const parts = Object.values(o).filter((v): v is string => typeof v === "string");
    if (parts.length) return parts.join(". ");
  }
  if (status === 401) return "Your session has expired. Please sign in again.";
  if (status === 403) return "Your role does not allow this action.";
  if (status === 404) return "Not found.";
  if (status === 503) return "A backend service is unavailable right now. Try again in a moment.";
  if (status >= 500) return "Something went wrong on our side. Try again in a moment.";
  return "The request could not be completed.";
}

async function request<T>(method: string, path: string, body?: unknown, auth = true): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const token = getToken();
  if (auth && token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  } catch {
    throw new ApiError("Cannot reach the server. Check that the platform is running.", 0);
  }

  const text = await res.text();
  let json: unknown = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* empty / non-JSON body */ }

  if (res.status === 401 && auth) {
    unauthorizedHandler?.();
    throw new ApiError(messageFrom(401, json), 401);
  }
  if (!res.ok) throw new ApiError(messageFrom(res.status, json), res.status);
  return json as T;
}

export const api = {
  login: (email: string, password: string) =>
    request<{ token: string }>("POST", "/auth/login", { email, password }, false).catch((e) => {
      if (e instanceof ApiError && e.status === 401) throw new ApiError("Wrong email or password.", 401);
      throw e;
    }),
  listPatients: () => request<Patient[]>("GET", "/api/patients"),
  createPatient: (p: PatientInput) => request<Patient>("POST", "/api/patients", p),
  updatePatient: (id: string, p: PatientInput) => request<Patient>("PUT", `/api/patients/${id}`, p),
  deletePatient: (id: string) => request<void>("DELETE", `/api/patients/${id}`),
};
