import type { TrainingPlan, UserProfile } from "./types";

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

/** Em produção/APK, defina VITE_API_URL (ex.: https://seu-dominio.com) para apontar para o servidor da API. */
const apiBase = String(import.meta.env.VITE_API_URL ?? "")
  .trim()
  .replace(/\/$/, "");

function apiUrl(path: string) {
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `${apiBase}${path}`;
}

const tokenKey = "pamelapersonal_admin_token";
const studentTokenKey = "pamelapersonal_student_token";

export type SubscriptionPlanId = "monthly" | "quarterly" | "semiannual";
export type EvaluationPreference = "team" | "send_info";
export type PaymentStatus = "pending" | "confirmed" | "failed" | "refunded" | string;

export type StudentPayload = UserProfile & {
  username?: string;
  password?: string;
  email?: string;
  phone?: string;
  observations?: string;
  temporaryPlan?: TrainingPlan;
  evaluationSlotId?: number | null;
  subscriptionPlanId?: SubscriptionPlanId;
  evaluationPreference?: EvaluationPreference;
};

export type AdminSession = {
  id: number;
  name: string;
  username: string | null;
  email: string | null;
  role: string;
};

export type StudentListItem = {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  age: number;
  goal: string;
  modality: string;
  experience: string;
  status: string;
  subscriptionStatus: string;
  subscriptionPlanId: SubscriptionPlanId | null;
  subscriptionPlanName: string | null;
  paymentStatus: PaymentStatus;
  evaluationPreference: EvaluationPreference | null;
  includedEvaluationsRemaining: number;
  evaluationFeeRequired: boolean;
  createdAt: string;
};

export type EvaluationSlot = {
  id: number;
  startsAt: string;
  endsAt: string;
  status?: string;
  notes: string | null;
  studentId?: number | null;
  studentName?: string | null;
};

export type WorkoutLog = {
  id: number;
  loggedAt: string;
  dayIndex: number;
  dayTitle: string;
  exerciseName: string;
  prescription: string | null;
  loadText: string | null;
  studentComment: string | null;
  adminComment: string | null;
  updatedAt: string;
};

export type TrainingPlanReview = TrainingPlan & {
  id: number;
  source: string;
  status: "pending" | "approved" | "rejected" | string;
  releasedAt: string | null;
  createdAt: string;
};

export type EvaluationRecord = {
  id: number;
  evaluatedAt: string;
  nextEvaluationAt: string;
  weightKg: number | null;
  bodyFatPercent: number | null;
  leanMassKg: number | null;
  muscleMassKg: number | null;
  bodyWaterPercent: number | null;
  visceralFat: number | null;
  boneMassKg: number | null;
  basalMetabolicRate: number | null;
  metabolicAge: number | null;
  bmi: number | null;
  bloodPressure: string | null;
  restingHeartRate: number | null;
  chestCm: number | null;
  waistCm: number | null;
  abdomenCm: number | null;
  hipCm: number | null;
  rightArmCm: number | null;
  leftArmCm: number | null;
  rightArmRelaxedCm: number | null;
  leftArmRelaxedCm: number | null;
  rightArmContractedCm: number | null;
  leftArmContractedCm: number | null;
  rightForearmCm: number | null;
  leftForearmCm: number | null;
  rightThighCm: number | null;
  leftThighCm: number | null;
  rightCalfCm: number | null;
  leftCalfCm: number | null;
  tricepsMm: number | null;
  subscapularMm: number | null;
  suprailiacMm: number | null;
  abdominalMm: number | null;
  thighMm: number | null;
  chestSkinfoldMm: number | null;
  midaxillaryMm: number | null;
  calfSkinfoldMm: number | null;
  posturalNotes?: string | null;
  movementLimitations?: string | null;
  professionalRecommendations?: string | null;
  notes: string | null;
};

export function getToken() {
  return localStorage.getItem(tokenKey);
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem(tokenKey, token);
  else localStorage.removeItem(tokenKey);
}

export function getStudentToken() {
  return localStorage.getItem(studentTokenKey);
}

export function setStudentToken(token: string | null) {
  if (token) localStorage.setItem(studentTokenKey, token);
  else localStorage.removeItem(studentTokenKey);
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  return requestWithToken<T>(path, getToken(), init);
}

async function readJsonResponse(response: Response): Promise<Record<string, unknown>> {
  const text = await response.text();
  const trimmed = text.trimStart();
  if (trimmed.startsWith("<")) {
    const hint =
      apiBase.length === 0
        ? " No APK, gere o build com api-url-for-apk.txt (URL da API) — ver api-url-for-apk.example.txt."
        : " Confirme se a API esta no ar e se VITE_API_URL esta correta.";
    throw new ApiError(
      `O servidor respondeu com HTML em vez de JSON (login nao chegou a API).${hint}`,
      response.status || 502
    );
  }
  if (!trimmed) return {};
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new ApiError(
      (text.length > 160 ? `${text.slice(0, 160)}…` : text) || "Resposta invalida do servidor.",
      response.status || 502
    );
  }
}

async function requestWithToken<T>(
  path: string,
  token: string | null,
  init?: RequestInit
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init?.headers as Record<string, string> | undefined)
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const url = apiUrl(path);
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers,
      cache: "no-store"
    });
  } catch (err) {
    const baseMsg = err instanceof Error ? err.message : "Erro de rede";
    const hint =
      apiBase.length === 0
        ? " O APK foi gerado sem VITE_API_URL (ficheiro api-url-for-apk.txt). Gere o build de novo."
        : ` Confirme no telemovel no Chrome: ${apiBase}/api/health — se nao abrir, firewall da VPS, operadora a bloquear a porta ou Wi-Fi com isolamento entre clientes.`;
    throw new ApiError(`Falha de ligacao (${baseMsg}).${hint}`, 0);
  }
  const body = await readJsonResponse(response);
  if (!response.ok) {
    throw new ApiError(
      (typeof body.error === "string" ? body.error : null) ?? `Erro HTTP ${response.status}`,
      response.status
    );
  }
  return body as T;
}

export const api = {
  registerStudent: (payload: StudentPayload) =>
    request<{
      id: number;
      status: string;
      subscriptionStatus: string;
      paymentStatus: PaymentStatus;
      paymentUrl: string;
      message: string;
    }>(
      "/api/public/students",
      {
        method: "POST",
        body: JSON.stringify(payload)
      }
    ),
  login: (username: string, password: string) =>
    request<{ token: string; admin: AdminSession }>("/api/admin/login", {
      method: "POST",
      body: JSON.stringify({ username, password })
    }),
  adminMe: () =>
    request<{
      admin: {
        sub?: number | string;
        username?: string | null;
        email?: string | null;
        name: string;
        role: string;
      };
    }>("/api/admin/me").then(({ admin: payload }) => ({
      id: Number(payload.sub),
      username: payload.username ?? null,
      email: payload.email ?? null,
      name: payload.name,
      role: payload.role
    })),
  studentLogin: (username: string, password: string) =>
    request<{ token: string; student: { id: number; name: string; username: string } }>(
      "/api/student/login",
      {
        method: "POST",
        body: JSON.stringify({ username, password })
      }
    ),
  studentMe: () =>
    requestWithToken<{
      student: StudentPayload & {
        id: number;
        status: string;
        subscriptionStatus: string;
        subscriptionPlanId: SubscriptionPlanId | null;
        subscriptionPlanName: string | null;
        subscriptionEndsAt: string | null;
        paymentStatus: PaymentStatus;
        evaluationPreference: EvaluationPreference | null;
        includedEvaluationsRemaining: number;
        evaluationFeeRequired: boolean;
        temporaryPlan: TrainingPlan | null;
      };
      slots: EvaluationSlot[];
      availableSlots: EvaluationSlot[];
      evaluations: EvaluationRecord[];
      workoutLogs: WorkoutLog[];
      approvedTrainingPlan: TrainingPlanReview | null;
    }>("/api/student/me", getStudentToken()),
  saveWorkoutLog: (payload: {
    loggedAt: string;
    dayIndex: number;
    dayTitle: string;
    exerciseName: string;
    prescription?: string;
    loadText?: string;
    studentComment?: string;
  }) =>
    requestWithToken<{ id: number; ok: boolean }>("/api/student/workout-logs", getStudentToken(), {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  dashboard: () =>
    request<{
      totalStudents: number;
      totalAdmins: number;
      awaitingEvaluation: number;
      reevaluationsDueSoon: number;
      availableEvaluationSlots: number;
    }>("/api/admin/dashboard"),
  publicEvaluationSlots: () =>
    request<{ slots: EvaluationSlot[] }>("/api/public/evaluation-slots"),
  listStudents: (search = "") => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    return request<{ students: StudentListItem[] }>(`/api/admin/students?${params}`);
  },
  createStudent: (payload: StudentPayload) =>
    request<{ id: number }>("/api/admin/students", {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  updateStudentStatus: (id: number, status: "awaiting_evaluation" | "evaluated" | "suspended") =>
    request<{ ok: boolean }>(`/api/admin/students/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status })
    }),
  updateStudentCredentials: (
    id: number,
    payload: { username?: string; password?: string }
  ) =>
    request<{ ok: boolean }>(`/api/admin/students/${id}/credentials`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    }),
  deleteStudent: (id: number) =>
    request<{ ok: boolean }>(`/api/admin/students/${id}/delete`, {
      method: "POST"
    }),
  listAdmins: () =>
    request<{
      admins: Array<{
        id: number;
        name: string;
        username: string | null;
        email: string | null;
        role: string;
        createdAt: string;
      }>;
    }>("/api/admin/admins"),
  createAdmin: (payload: { name: string; username: string; email?: string; password: string }) =>
    request<{ ok: boolean }>("/api/admin/admins", {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  getStudent: (id: number) =>
    request<{
      student: StudentPayload & {
        id: number;
        status: string;
        subscriptionStatus: string;
        subscriptionPlanId: SubscriptionPlanId | null;
        subscriptionPlanName: string | null;
        subscriptionEndsAt: string | null;
        paymentStatus: PaymentStatus;
        evaluationPreference: EvaluationPreference | null;
        includedEvaluationsRemaining: number;
        evaluationFeeRequired: boolean;
        temporaryPlan: TrainingPlan | null;
      };
      evaluations: EvaluationRecord[];
      slots?: EvaluationSlot[];
      workoutLogs?: WorkoutLog[];
      trainingPlans?: TrainingPlanReview[];
    }>(`/api/admin/students/${id}`),
  updateWorkoutLogComment: (id: number, adminComment: string) =>
    request<{ ok: boolean }>(`/api/admin/workout-logs/${id}/comment`, {
      method: "PATCH",
      body: JSON.stringify({ adminComment })
    }),
  updateTrainingPlan: (id: number, payload: TrainingPlan) =>
    request<{ ok: boolean }>(`/api/admin/training-plans/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload)
    }),
  updateTrainingPlanStatus: (id: number, status: "pending" | "approved" | "rejected") =>
    request<{ ok: boolean }>(`/api/admin/training-plans/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status })
    }),
  generateTrainingPlanSuggestion: (studentId: number) =>
    request<{ id: number }>(`/api/admin/students/${studentId}/training-plans/suggest`, {
      method: "POST"
    }),
  listEvaluationSlots: () =>
    request<{ slots: EvaluationSlot[] }>("/api/admin/evaluation-slots"),
  createEvaluationSlot: (payload: { startsAt: string; endsAt: string; notes?: string }) =>
    request<{ id: number }>("/api/admin/evaluation-slots", {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  createEvaluation: (
    studentId: number,
    payload: Record<string, string | number | undefined>
  ) =>
    request<{ id: number; suggestedPlanId: number | null }>(`/api/admin/students/${studentId}/evaluations`, {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  confirmStudentPayment: (studentId: number) =>
    request<{ ok: boolean }>(`/api/admin/students/${studentId}/payment/confirm`, {
      method: "POST"
    }),
  updateMySubscription: (payload: {
    subscriptionPlanId: SubscriptionPlanId;
    evaluationPreference: EvaluationPreference;
  }) =>
    requestWithToken<{ ok: boolean; paymentUrl: string }>("/api/student/subscription", getStudentToken(), {
      method: "PUT",
      body: JSON.stringify(payload)
    }),
  cancelMySubscription: () =>
    requestWithToken<{ ok: boolean }>("/api/student/subscription/cancel", getStudentToken(), {
      method: "POST"
    }),
  scheduleMyEvaluation: (slotId: number) =>
    requestWithToken<{ ok: boolean }>("/api/student/evaluation-slot", getStudentToken(), {
      method: "POST",
      body: JSON.stringify({ slotId })
    })
};
