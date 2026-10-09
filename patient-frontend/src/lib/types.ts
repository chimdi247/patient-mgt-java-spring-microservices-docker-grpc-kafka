/** Mirrors PatientResponseDTO of the patient-service. Dates are ISO yyyy-MM-dd strings. */
export interface Patient {
  id: string;
  name: string;
  email: string;
  address: string;
  dateOfBirth: string;
  registeredDate?: string;
}

/** Body of POST /api/patients (registeredDate is required on create) and PUT /api/patients/{id}. */
export interface PatientInput {
  name: string;
  email: string;
  address: string;
  dateOfBirth: string;
  registeredDate?: string;
}

export type Role = "ADMIN" | "USER" | string;

export interface Session {
  token: string;
  email: string;
  role: Role;
  /** token expiry, ms since epoch */
  expiresAt: number;
}
