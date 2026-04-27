import "dotenv/config";
import express from "express";
import cors from "cors";
import mysql from "mysql2/promise";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const app = express();
const port = Number(process.env.API_PORT ?? 3334);
const jwtSecret = process.env.JWT_SECRET ?? "dev-secret-change-me";
const appBaseUrl = process.env.APP_BASE_URL ?? "http://127.0.0.1:5173";
const apiBaseUrl = process.env.API_BASE_URL ?? `http://127.0.0.1:${port}`;
const mercadoPagoAccessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN ?? "";

function moneyCents(name, fallback) {
  const value = Number(process.env[name] ?? fallback);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

const pool = mysql.createPool({
  host: process.env.DB_HOST ?? "127.0.0.1",
  port: Number(process.env.DB_PORT ?? 3306),
  user: process.env.DB_USER ?? "root",
  password: process.env.DB_PASSWORD ?? "",
  database: process.env.DB_NAME ?? "pamelapersonal",
  waitForConnections: true,
  connectionLimit: 10
});

const subscriptionPlans = {
  monthly: {
    id: "monthly",
    name: "Mensal",
    months: 1,
    priceCents: moneyCents("PLAN_MONTHLY_CENTS", 0),
    includedEvaluations: 0
  },
  quarterly: {
    id: "quarterly",
    name: "Trimestral",
    months: 3,
    priceCents: moneyCents("PLAN_QUARTERLY_CENTS", 0),
    includedEvaluations: 2
  },
  semiannual: {
    id: "semiannual",
    name: "Semestral",
    months: 6,
    priceCents: moneyCents("PLAN_SEMIANNUAL_CENTS", 0),
    includedEvaluations: 3
  }
};
const evaluationFeeCents = moneyCents("EVALUATION_FEE_CENTS", 0);

const corsOrigins = new Set([
  "http://127.0.0.1:5173",
  "http://localhost:5173",
  "http://localhost",
  "http://127.0.0.1",
  "https://localhost",
  "https://127.0.0.1",
  "capacitor://localhost",
  "ionic://localhost"
]);
try {
  corsOrigins.add(new URL(appBaseUrl).origin);
} catch {
  /* ignore */
}
for (const piece of String(process.env.CORS_ORIGINS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean)) {
  corsOrigins.add(piece);
}
const corsStrict = process.env.CORS_STRICT === "1";

/** No APK (WebView), a origem e' http://localhost:PORT; no browser ao digitar a URL nao ha CORS como no fetch. */
function corsOriginAllowed(origin) {
  if (!origin) return true;
  if (corsOrigins.has(origin)) return true;
  if (origin === "file://" || origin === "null") return true;
  if (origin.startsWith("capacitor://") || origin.startsWith("ionic://")) return true;
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)) return true;
  return false;
}

const corsOptions = {
  origin(o, callback) {
    if (!corsStrict) {
      return callback(null, true);
    }
    if (corsOriginAllowed(o)) {
      return callback(null, true);
    }
    return callback(null, false);
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: false,
  optionsSuccessStatus: 204
};

app.use(cors(corsOptions));
app.use(express.json({ limit: "2mb" }));

function subscriptionPaymentUrl(studentId) {
  return `/pagamento/mercado-pago-pendente?studentId=${studentId}`;
}

function subscriptionTotalCents(plan, evaluationPreference) {
  const needsEvaluationFee = evaluationPreference === "team" && plan.includedEvaluations === 0;
  return plan.priceCents + (needsEvaluationFee ? evaluationFeeCents : 0);
}

async function createMercadoPagoPreference({ studentId, student, plan, evaluationPreference }) {
  const totalCents = subscriptionTotalCents(plan, evaluationPreference);
  if (!mercadoPagoAccessToken) {
    return {
      paymentUrl: subscriptionPaymentUrl(studentId),
      paymentReference: `pending-${Date.now()}`,
      providerPayload: null
    };
  }
  if (totalCents <= 0) {
    return {
      paymentUrl: subscriptionPaymentUrl(studentId),
      paymentReference: `missing-price-${Date.now()}`,
      providerPayload: null
    };
  }

  const response = await fetch("https://api.mercadopago.com/checkout/preferences", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${mercadoPagoAccessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      external_reference: String(studentId),
      items: [
        {
          title: `Plano ${plan.name} - Pâmela Mendes Personal`,
          quantity: 1,
          currency_id: "BRL",
          unit_price: totalCents / 100
        }
      ],
      payer: {
        name: student?.name,
        email: student?.email || undefined,
        phone: student?.phone ? { number: student.phone } : undefined
      },
      metadata: {
        student_id: studentId,
        subscription_plan_id: plan.id,
        evaluation_preference: evaluationPreference
      },
      back_urls: {
        success: `${appBaseUrl}/?payment=success`,
        pending: `${appBaseUrl}/?payment=pending`,
        failure: `${appBaseUrl}/?payment=failure`
      },
      notification_url: `${apiBaseUrl}/api/payments/mercado-pago/webhook`
    })
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw Object.assign(new Error(payload.message ?? "Não foi possível criar o pagamento."), {
      statusCode: response.status
    });
  }

  return {
    paymentUrl: payload.init_point ?? payload.sandbox_init_point ?? subscriptionPaymentUrl(studentId),
    paymentReference: payload.id ? String(payload.id) : `pending-${Date.now()}`,
    providerPayload: payload
  };
}

function normalizeSubscriptionChoice(body) {
  const plan = subscriptionPlans[String(body.subscriptionPlanId ?? "")];
  const evaluationPreference = String(body.evaluationPreference ?? "team");
  if (!plan) return { error: "Plano selecionado é inválido." };
  if (!["team", "send_info"].includes(evaluationPreference)) {
    return { error: "Escolha como deseja realizar a avaliação." };
  }
  return { plan, evaluationPreference };
}

async function confirmStudentPaymentById(studentId) {
  const [result] = await pool.query(
    `UPDATE students
        SET payment_status = 'confirmed',
            subscription_status = 'active',
            status = IF(status = 'pending_payment', 'awaiting_evaluation', status),
            payment_confirmed_at = NOW(),
            subscription_started_at = COALESCE(subscription_started_at, NOW()),
            subscription_ends_at = COALESCE(subscription_ends_at, DATE_ADD(NOW(), INTERVAL COALESCE(subscription_months, 1) MONTH))
      WHERE id = ?
      LIMIT 1`,
    [studentId]
  );
  return result.affectedRows > 0;
}

async function refreshStudentAccess(studentId) {
  const [expiredRows] = await pool.query(
    `SELECT id
       FROM students
      WHERE id = ?
        AND subscription_status = 'active'
        AND subscription_ends_at IS NOT NULL
        AND subscription_ends_at < NOW()
      LIMIT 1`,
    [studentId]
  );
  if (!expiredRows.length) return;
  await pool.query(
    `UPDATE students
        SET subscription_status = 'expired',
            payment_status = 'expired',
            status = 'pending_payment',
            included_evaluations_remaining = 0
      WHERE id = ?
      LIMIT 1`,
    [studentId]
  );
  await pool.query(
    "UPDATE evaluation_slots SET status = 'available', student_id = NULL WHERE student_id = ? AND status = 'booked'",
    [studentId]
  );
}

function signAdmin(admin) {
  const sv = Number(admin.session_version ?? 1);
  return jwt.sign(
    {
      sub: admin.id,
      username: admin.username ?? null,
      email: admin.email ?? null,
      name: admin.name,
      role: admin.role,
      sv
    },
    jwtSecret,
    { expiresIn: "12h" }
  );
}

function signStudent(student) {
  const sv = Number(student.session_version ?? 1);
  return jwt.sign(
    { sub: student.id, username: student.username, name: student.name, role: "student", sv },
    jwtSecret,
    { expiresIn: "12h" }
  );
}

function requireAdmin(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Login administrativo necessário." });
    return;
  }
  let payload;
  try {
    payload = jwt.verify(header.slice(7), jwtSecret);
  } catch {
    res.status(401).json({ error: "Sessão inválida ou expirada." });
    return;
  }
  pool
    .query("SELECT COALESCE(session_version, 1) AS sv FROM admins WHERE id = ? LIMIT 1", [payload.sub])
    .then(([rows]) => {
      if (!rows.length) {
        res.status(401).json({ error: "Sessão inválida. Faça login novamente." });
        return;
      }
      const dbSv = Number(rows[0].sv);
      const tokenSv = Number(payload.sv ?? 1);
      if (tokenSv !== dbSv) {
        res.status(401).json({
          error: "Seu usuário ou senha foram alterados. Faça login novamente."
        });
        return;
      }
      req.admin = payload;
      next();
    })
    .catch((err) => next(err));
}

function requireStudent(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Login do aluno necessário." });
    return;
  }
  let payload;
  try {
    payload = jwt.verify(header.slice(7), jwtSecret);
  } catch {
    res.status(401).json({ error: "Sessão inválida ou expirada." });
    return;
  }
  if (payload.role !== "student") {
    res.status(403).json({ error: "Acesso de aluno necessário." });
    return;
  }
  pool
    .query("SELECT COALESCE(session_version, 1) AS sv FROM students WHERE id = ? LIMIT 1", [payload.sub])
    .then(([rows]) => {
      if (!rows.length) {
        res.status(401).json({ error: "Aluno não encontrado." });
        return;
      }
      const dbSv = Number(rows[0].sv);
      const tokenSv = Number(payload.sv ?? 1);
      if (tokenSv !== dbSv) {
        res.status(401).json({
          error: "Seu usuário ou senha foram alterados. Faça login novamente."
        });
        return;
      }
      req.student = payload;
      next();
    })
    .catch((err) => next(err));
}

function normalizeStudent(body) {
  return {
    name: String(body.name ?? "").trim(),
    username: body.username ? String(body.username).trim().toLowerCase() : "",
    password: String(body.password ?? ""),
    email: body.email ? String(body.email).trim().toLowerCase() : null,
    phone: body.phone ? String(body.phone).trim() : null,
    age: Number(body.age),
    heightCm: Number(body.heightCm),
    weightKg: Number(body.weightKg),
    goal: String(body.goal ?? ""),
    modality: String(body.modality ?? ""),
    experience: String(body.experience ?? ""),
    availableDays: Number(body.availableDays),
    sessionMinutes: Number(body.sessionMinutes),
    injury: String(body.injury ?? "nenhuma"),
    observations: body.observations ? String(body.observations).trim() : null,
    temporaryPlan: body.temporaryPlan ?? null,
    evaluationSlotId: body.evaluationSlotId ? Number(body.evaluationSlotId) : null,
    subscriptionPlanId: String(body.subscriptionPlanId ?? "monthly"),
    evaluationPreference: String(body.evaluationPreference ?? "team")
  };
}

function validateStudent(student) {
  if (!student.name || student.name.length < 2) return "Nome do aluno é obrigatório.";
  if (!/^[a-z0-9._-]{3,30}$/.test(student.username)) {
    return "Nome de usuário deve ter 3 a 30 caracteres e usar letras, números, ponto, traço ou underline.";
  }
  if (!student.password || student.password.length < 6) {
    return "Senha do aluno precisa ter pelo menos 6 caracteres.";
  }
  if (!Number.isFinite(student.age) || student.age < 12 || student.age > 90) return "Idade inválida.";
  if (!Number.isFinite(student.heightCm) || student.heightCm < 120 || student.heightCm > 230) {
    return "Altura inválida.";
  }
  if (!Number.isFinite(student.weightKg) || student.weightKg < 30 || student.weightKg > 250) {
    return "Peso inválido.";
  }
  if (!student.goal || !student.modality || !student.experience) {
    return "Objetivo, modalidade e nível são obrigatórios.";
  }
  if (!subscriptionPlans[student.subscriptionPlanId]) return "Plano selecionado é inválido.";
  if (!["team", "send_info"].includes(student.evaluationPreference)) {
    return "Escolha como deseja realizar a avaliação.";
  }
  return null;
}

const numberEvaluationFields = [
  "weightKg",
  "bodyFatPercent",
  "leanMassKg",
  "muscleMassKg",
  "bodyWaterPercent",
  "visceralFat",
  "boneMassKg",
  "basalMetabolicRate",
  "metabolicAge",
  "bmi",
  "restingHeartRate",
  "chestCm",
  "waistCm",
  "abdomenCm",
  "hipCm",
  "rightArmCm",
  "leftArmCm",
  "rightArmRelaxedCm",
  "leftArmRelaxedCm",
  "rightArmContractedCm",
  "leftArmContractedCm",
  "rightForearmCm",
  "leftForearmCm",
  "rightThighCm",
  "leftThighCm",
  "rightCalfCm",
  "leftCalfCm",
  "tricepsMm",
  "subscapularMm",
  "suprailiacMm",
  "abdominalMm",
  "thighMm",
  "chestSkinfoldMm",
  "midaxillaryMm",
  "calfSkinfoldMm"
];

function optionalNumber(body, key) {
  if (body[key] === "" || body[key] === undefined || body[key] === null) return null;
  const value = Number(body[key]);
  return Number.isFinite(value) ? value : null;
}

function optionalText(body, key) {
  const value = body[key];
  if (value === "" || value === undefined || value === null) return null;
  return String(value).trim();
}

function parseJsonValue(value) {
  if (!value) return null;
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }
  return value;
}

function normalizePlanPayload(body) {
  if (!body) return null;
  const plan = {
    headline: String(body.headline ?? "").trim(),
    summary: String(body.summary ?? "").trim(),
    intensity: String(body.intensity ?? "").trim(),
    weeklyFrequency: String(body.weeklyFrequency ?? "").trim(),
    warnings: Array.isArray(body.warnings) ? body.warnings.map(String).filter(Boolean) : [],
    days: Array.isArray(body.days) ? body.days : []
  };
  if (!plan.headline || !plan.summary || !plan.intensity || !plan.weeklyFrequency) return null;
  if (!plan.days.length) return null;
  plan.days = plan.days.map((day) => ({
    title: String(day.title ?? "").trim(),
    focus: String(day.focus ?? "").trim(),
    warmup: String(day.warmup ?? "").trim(),
    cooldown: String(day.cooldown ?? "").trim(),
    exercises: Array.isArray(day.exercises)
      ? day.exercises.map((exercise) => ({
          name: String(exercise.name ?? "").trim(),
          prescription: String(exercise.prescription ?? "").trim(),
          notes: exercise.notes ? String(exercise.notes).trim() : ""
        }))
      : []
  }));
  if (plan.days.some((day) => !day.title || !day.focus || !day.exercises.length)) return null;
  if (plan.days.some((day) => day.exercises.some((exercise) => !exercise.name || !exercise.prescription))) {
    return null;
  }
  return plan;
}

async function insertTrainingPlan(studentId, plan, { source = "suggested", status = "pending" } = {}) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [result] = await connection.query(
      `INSERT INTO training_plans
        (student_id, headline, summary, intensity, weekly_frequency, warnings_json, source, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        studentId,
        plan.headline,
        plan.summary,
        plan.intensity,
        plan.weeklyFrequency,
        JSON.stringify(plan.warnings ?? []),
        source,
        status
      ]
    );
    const planId = result.insertId;
    for (const [dayIndex, day] of plan.days.entries()) {
      const [dayResult] = await connection.query(
        `INSERT INTO training_days (plan_id, day_order, title, focus, warmup, cooldown)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [planId, dayIndex + 1, day.title, day.focus, day.warmup ?? "", day.cooldown ?? ""]
      );
      for (const [exerciseIndex, exercise] of day.exercises.entries()) {
        await connection.query(
          `INSERT INTO training_exercises
            (day_id, exercise_order, name, prescription, notes, is_multi_joint)
           VALUES (?, ?, ?, ?, ?, 0)`,
          [
            dayResult.insertId,
            exerciseIndex + 1,
            exercise.name,
            exercise.prescription,
            exercise.notes || null
          ]
        );
      }
    }
    await connection.commit();
    return planId;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function replaceTrainingPlan(planId, plan) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.query(
      `UPDATE training_plans
          SET headline = ?, summary = ?, intensity = ?, weekly_frequency = ?, warnings_json = ?
        WHERE id = ?
        LIMIT 1`,
      [
        plan.headline,
        plan.summary,
        plan.intensity,
        plan.weeklyFrequency,
        JSON.stringify(plan.warnings ?? []),
        planId
      ]
    );
    await connection.query(
      "DELETE d FROM training_days d INNER JOIN training_plans p ON p.id = d.plan_id WHERE p.id = ?",
      [planId]
    );
    for (const [dayIndex, day] of plan.days.entries()) {
      const [dayResult] = await connection.query(
        `INSERT INTO training_days (plan_id, day_order, title, focus, warmup, cooldown)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [planId, dayIndex + 1, day.title, day.focus, day.warmup ?? "", day.cooldown ?? ""]
      );
      for (const [exerciseIndex, exercise] of day.exercises.entries()) {
        await connection.query(
          `INSERT INTO training_exercises
            (day_id, exercise_order, name, prescription, notes, is_multi_joint)
           VALUES (?, ?, ?, ?, ?, 0)`,
          [
            dayResult.insertId,
            exerciseIndex + 1,
            exercise.name,
            exercise.prescription,
            exercise.notes || null
          ]
        );
      }
    }
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function fetchTrainingPlans(studentId, { status } = {}) {
  const params = [studentId];
  const statusWhere = status ? "AND p.status = ?" : "";
  if (status) params.push(status);
  const [rows] = await pool.query(
    `SELECT p.id AS planId, p.headline, p.summary, p.intensity,
            p.weekly_frequency AS weeklyFrequency, p.warnings_json AS warnings,
            p.source, p.status, p.released_at AS releasedAt, p.created_at AS createdAt,
            d.id AS dayId, d.day_order AS dayOrder, d.title AS dayTitle,
            d.focus, d.warmup, d.cooldown,
            e.id AS exerciseId, e.exercise_order AS exerciseOrder,
            e.name AS exerciseName, e.prescription, e.notes AS exerciseNotes
       FROM training_plans p
       LEFT JOIN training_days d ON d.plan_id = p.id
       LEFT JOIN training_exercises e ON e.day_id = d.id
      WHERE p.student_id = ?
        ${statusWhere}
      ORDER BY p.created_at DESC, d.day_order ASC, e.exercise_order ASC`,
    params
  );
  const plans = [];
  const byId = new Map();
  for (const row of rows) {
    if (!byId.has(row.planId)) {
      const plan = {
        id: row.planId,
        headline: row.headline,
        summary: row.summary,
        intensity: row.intensity,
        weeklyFrequency: row.weeklyFrequency,
        warnings: parseJsonValue(row.warnings) ?? [],
        source: row.source,
        status: row.status,
        releasedAt: row.releasedAt,
        createdAt: row.createdAt,
        days: []
      };
      byId.set(row.planId, plan);
      plans.push(plan);
    }
    if (!row.dayId) continue;
    const plan = byId.get(row.planId);
    let day = plan.days.find((item) => item.id === row.dayId);
    if (!day) {
      day = {
        id: row.dayId,
        title: row.dayTitle,
        focus: row.focus,
        warmup: row.warmup,
        cooldown: row.cooldown,
        exercises: []
      };
      plan.days.push(day);
    }
    if (row.exerciseId) {
      day.exercises.push({
        id: row.exerciseId,
        name: row.exerciseName,
        prescription: row.prescription,
        notes: row.exerciseNotes ?? ""
      });
    }
  }
  return plans;
}

async function createSuggestedPlanFromStudent(studentId) {
  const [rows] = await pool.query(
    `SELECT name, modality, goal, experience, available_days AS availableDays,
            session_minutes AS sessionMinutes, injury, temporary_plan_json AS temporaryPlan
       FROM students
      WHERE id = ?
      LIMIT 1`,
    [studentId]
  );
  if (!rows.length) return null;
  const temporaryPlan = parseJsonValue(rows[0]?.temporaryPlan);
  const plan = normalizePlanPayload(temporaryPlan) ?? buildFallbackSuggestedPlan(rows[0]);
  if (!plan) return null;
  plan.headline = `Sugestão pós-avaliação: ${plan.headline}`;
  plan.summary = `${plan.summary} Revise cargas, exercícios e observações antes de aprovar para o aluno.`;
  return insertTrainingPlan(studentId, plan, { source: "evaluation_suggestion", status: "pending" });
}

function buildFallbackSuggestedPlan(student) {
  const days = Math.min(5, Math.max(2, Number(student.availableDays ?? 3)));
  const scheme =
    student.experience === "avancado"
      ? "4 séries de 6 a 10 repetições"
      : student.experience === "intermediario"
        ? "3 a 4 séries de 8 a 12 repetições"
        : "2 a 3 séries de 10 a 12 repetições";
  const templatesByModality = {
    musculacao: [
      {
        title: "Treino A",
        focus: "inferiores e core",
        warmup: "8 minutos de caminhada leve e mobilidade de quadril",
        exercises: [
          { name: "Leg press", prescription: scheme, notes: "Ajustar carga pela execução." },
          { name: "Cadeira extensora", prescription: "3 séries de 12 repetições" },
          { name: "Mesa flexora", prescription: "3 séries de 10 a 12 repetições" },
          { name: "Elevação pélvica", prescription: "3 séries de 12 repetições" },
          { name: "Prancha", prescription: "3 séries de 30 segundos" }
        ],
        cooldown: "Alongamento leve para membros inferiores"
      },
      {
        title: "Treino B",
        focus: "superiores",
        warmup: "6 minutos de ergômetro e ativação escapular",
        exercises: [
          { name: "Supino máquina", prescription: scheme },
          { name: "Remada baixa", prescription: scheme },
          { name: "Puxada frontal", prescription: "3 séries de 10 a 12 repetições" },
          { name: "Desenvolvimento de ombros", prescription: "3 séries de 10 repetições" },
          { name: "Tríceps corda", prescription: "3 séries de 12 repetições" }
        ],
        cooldown: "Mobilidade leve de ombros e respiração controlada"
      },
      {
        title: "Treino C",
        focus: "corpo inteiro",
        warmup: "10 minutos de bicicleta leve",
        exercises: [
          { name: "Agachamento guiado", prescription: scheme },
          { name: "Remada unilateral", prescription: "3 séries de 10 repetições por lado" },
          { name: "Flexão inclinada", prescription: "3 séries de 8 a 12 repetições" },
          { name: "Farmer walk", prescription: "4 caminhadas de 30 metros" }
        ],
        cooldown: "Alongamento global por 5 minutos"
      }
    ],
    natacao: [
      {
        title: "Piscina A",
        focus: "técnica e respiração",
        warmup: "200m leve",
        exercises: [
          { name: "Educativo de pernada", prescription: "6x25m com 30s de descanso" },
          { name: "Educativo de braçada", prescription: "6x25m" },
          { name: "Crawl principal", prescription: "8x50m em ritmo confortável" }
        ],
        cooldown: "100m solto"
      },
      {
        title: "Piscina B",
        focus: "resistência",
        warmup: "300m leve",
        exercises: [
          { name: "Série contínua", prescription: "12 a 20 minutos em ritmo sustentável" },
          { name: "Intervalado moderado", prescription: "6x50m com 40s de descanso" }
        ],
        cooldown: "100m leve"
      }
    ],
    corrida: [
      {
        title: "Corrida A",
        focus: "base aeróbica",
        warmup: "8 minutos de caminhada",
        exercises: [
          { name: "Bloco principal", prescription: "25 a 35 minutos em ritmo confortável" },
          { name: "Core anti-rotação", prescription: "3 séries de 30 segundos por lado" }
        ],
        cooldown: "5 minutos caminhando"
      },
      {
        title: "Corrida B",
        focus: "intervalos leves",
        warmup: "10 minutos bem leve",
        exercises: [
          { name: "Intervalado", prescription: "6 blocos de 1min forte + 2min leve" },
          { name: "Panturrilha", prescription: "3 séries de 15 repetições" }
        ],
        cooldown: "Caminhada leve e alongamento"
      }
    ]
  };
  const templates = templatesByModality[student.modality] ?? templatesByModality.musculacao;
  return {
    headline: `Plano de ${student.modality || "treino"} para ${student.goal || "evolução"}`,
    summary: `${student.name}, sugestão inicial baseada na avaliação, objetivo informado e disponibilidade de ${days} dias por semana.`,
    intensity: "moderada, com progressão de carga acompanhada pela personal",
    weeklyFrequency: `${days}x por semana`,
    warnings:
      student.injury && student.injury !== "nenhuma"
        ? ["Ajustar amplitudes e cargas por causa da restrição informada.", "Interromper em caso de dor aguda."]
        : ["Aumentar cargas apenas mantendo boa execução.", "Interromper em caso de dor aguda."],
    days: Array.from({ length: days }, (_item, index) => templates[index % templates.length])
  };
}

async function insertStudent(student, { paymentConfirmed = false } = {}) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    if (paymentConfirmed && student.evaluationSlotId) {
      const [slotRows] = await connection.query(
        "SELECT id FROM evaluation_slots WHERE id = ? AND status = 'available' AND starts_at >= NOW() FOR UPDATE",
        [student.evaluationSlotId]
      );
      if (!slotRows.length) {
        throw Object.assign(new Error("Horário de avaliação indisponível. Escolha outro horário."), {
          statusCode: 409
        });
      }
    }

    const plan = subscriptionPlans[student.subscriptionPlanId] ?? subscriptionPlans.monthly;
    const wantsTeamEvaluation = student.evaluationPreference === "team";
    const evaluationCoveredByPlan = plan.includedEvaluations > 0;
    const paymentStatus = paymentConfirmed ? "confirmed" : "pending";
    const subscriptionStatus = paymentConfirmed ? "active" : "pending_payment";
    const studentStatus = paymentConfirmed ? "awaiting_evaluation" : "pending_payment";
    const passwordHash = await bcrypt.hash(student.password, 10);
    const [result] = await connection.query(
      `INSERT INTO students
        (name, username, password_hash, email, phone, age, height_cm, weight_kg, goal, modality, experience,
         available_days, session_minutes, injury, observations, status, subscription_status,
         subscription_plan_id, subscription_plan_name, subscription_months, subscription_price_cents,
         subscription_started_at, subscription_ends_at, payment_status, payment_provider, payment_reference,
         payment_confirmed_at, evaluation_preference, evaluation_fee_required, evaluation_fee_cents,
         included_evaluations_remaining, temporary_plan_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
         IF(? = 'confirmed', NOW(), NULL), IF(? = 'confirmed', DATE_ADD(NOW(), INTERVAL ? MONTH), NULL),
         ?, 'mercado_pago', ?, IF(? = 'confirmed', NOW(), NULL), ?, ?, ?, ?, ?)`,
      [
        student.name,
        student.username,
        passwordHash,
        student.email,
        student.phone,
        student.age,
        student.heightCm,
        student.weightKg,
        student.goal,
        student.modality,
        student.experience,
        student.availableDays,
        student.sessionMinutes,
        student.injury,
        student.observations,
        studentStatus,
        subscriptionStatus,
        plan.id,
        plan.name,
        plan.months,
        plan.priceCents,
        paymentStatus,
        paymentStatus,
        plan.months,
        paymentStatus,
        `pending-${Date.now()}`,
        paymentStatus,
        student.evaluationPreference,
        wantsTeamEvaluation && !evaluationCoveredByPlan ? 1 : 0,
        wantsTeamEvaluation && !evaluationCoveredByPlan ? evaluationFeeCents : 0,
        plan.includedEvaluations,
        student.temporaryPlan ? JSON.stringify(student.temporaryPlan) : null
      ]
    );
    const studentId = result.insertId;

    if (paymentConfirmed && student.evaluationSlotId) {
      await connection.query(
        "UPDATE evaluation_slots SET status = 'booked', student_id = ? WHERE id = ?",
        [studentId, student.evaluationSlotId]
      );
    }

    await connection.commit();
    return studentId;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "pamelapersonal-api" });
});

app.get("/api/public/evaluation-slots", async (_req, res) => {
  const [rows] = await pool.query(
    `SELECT id, starts_at AS startsAt, ends_at AS endsAt, notes
       FROM evaluation_slots
      WHERE status = 'available'
        AND starts_at >= NOW()
      ORDER BY starts_at ASC
      LIMIT 100`
  );
  res.json({ slots: rows });
});

app.post("/api/public/students", async (req, res) => {
  try {
    const student = normalizeStudent(req.body);
    const error = validateStudent(student);
    if (error) {
      res.status(400).json({ error });
      return;
    }
    const id = await insertStudent(student, { paymentConfirmed: false });
    const plan = subscriptionPlans[student.subscriptionPlanId] ?? subscriptionPlans.monthly;
    const payment = await createMercadoPagoPreference({
      studentId: id,
      student,
      plan,
      evaluationPreference: student.evaluationPreference
    });
    await pool.query(
      "UPDATE students SET payment_reference = ? WHERE id = ? LIMIT 1",
      [payment.paymentReference, id]
    );
    res.status(201).json({
      id,
      status: "pending_payment",
      subscriptionStatus: "pending_payment",
      paymentStatus: "pending",
      paymentUrl: payment.paymentUrl,
      message: "Cadastro recebido. Próxima etapa: pagamento via Mercado Pago. A integração real será configurada depois."
    });
  } catch (error) {
    console.error(error);
    if (error.code === "ER_DUP_ENTRY") {
      res.status(409).json({ error: "Esse nome de usuário já está em uso." });
      return;
    }
    res.status(error.statusCode ?? 500).json({
      error: error.message ?? "Não foi possível cadastrar o aluno."
    });
  }
});

app.post("/api/payments/mercado-pago/webhook", async (req, res) => {
  const paymentId =
    req.query["data.id"] ??
    req.query.id ??
    req.body?.data?.id ??
    req.body?.id;
  const type = req.query.type ?? req.body?.type ?? req.body?.action;
  if (!paymentId || !mercadoPagoAccessToken) {
    res.json({ ok: true });
    return;
  }
  if (type && !String(type).includes("payment")) {
    res.json({ ok: true });
    return;
  }

  try {
    const response = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${mercadoPagoAccessToken}` }
    });
    const payment = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error("Mercado Pago webhook error", payment);
      res.json({ ok: true });
      return;
    }
    const studentId = payment.metadata?.student_id ?? payment.external_reference;
    if (!studentId) {
      res.json({ ok: true });
      return;
    }
    if (payment.status === "approved") {
      await confirmStudentPaymentById(studentId);
    } else if (["cancelled", "rejected", "refunded", "charged_back"].includes(payment.status)) {
      await pool.query(
        `UPDATE students
            SET payment_status = ?,
                subscription_status = IF(subscription_status = 'pending_payment', 'pending_payment', subscription_status),
                status = IF(status = 'pending_payment', 'pending_payment', status)
          WHERE id = ?
          LIMIT 1`,
        [payment.status, studentId]
      );
    }
    res.json({ ok: true });
  } catch (error) {
    console.error(error);
    res.json({ ok: true });
  }
});

app.post("/api/student/login", async (req, res) => {
  const username = String(req.body.username ?? "").trim().toLowerCase();
  const password = String(req.body.password ?? "");
  const [rows] = await pool.query(
    "SELECT id, name, username, password_hash, status, COALESCE(session_version, 1) AS session_version FROM students WHERE username = ? LIMIT 1",
    [username]
  );
  const student = rows[0];
  if (!student || !student.password_hash || !(await bcrypt.compare(password, student.password_hash))) {
    res.status(401).json({ error: "Usuário ou senha inválidos." });
    return;
  }
  await refreshStudentAccess(student.id);
  if (student.status === "suspended") {
    res.status(403).json({ error: "Seu acesso está suspenso. Entre em contato com a equipe." });
    return;
  }
  res.json({
    token: signStudent(student),
    student: { id: student.id, name: student.name, username: student.username }
  });
});

app.get("/api/student/me", requireStudent, async (req, res) => {
  await refreshStudentAccess(req.student.sub);
  const [rows] = await pool.query(
    `SELECT id, name, username, email, phone, age, height_cm AS heightCm, weight_kg AS weightKg,
            goal, modality, experience, available_days AS availableDays,
            session_minutes AS sessionMinutes, injury, observations, status,
            subscription_status AS subscriptionStatus,
            subscription_plan_id AS subscriptionPlanId,
            subscription_plan_name AS subscriptionPlanName,
            subscription_ends_at AS subscriptionEndsAt,
            payment_status AS paymentStatus,
            evaluation_preference AS evaluationPreference,
            evaluation_fee_required AS evaluationFeeRequired,
            included_evaluations_remaining AS includedEvaluationsRemaining,
            temporary_plan_json AS temporaryPlan
       FROM students
      WHERE id = ?
      LIMIT 1`,
    [req.student.sub]
  );
  if (!rows.length) {
    res.status(404).json({ error: "Aluno não encontrado." });
    return;
  }
  const [slots] = await pool.query(
    `SELECT id, starts_at AS startsAt, ends_at AS endsAt, status, notes
       FROM evaluation_slots
      WHERE student_id = ?
      ORDER BY starts_at DESC`,
    [req.student.sub]
  );
  const [availableSlots] = await pool.query(
    `SELECT id, starts_at AS startsAt, ends_at AS endsAt, notes
       FROM evaluation_slots
      WHERE status = 'available'
        AND starts_at >= NOW()
      ORDER BY starts_at ASC
      LIMIT 100`
  );
  const [evaluations] = await pool.query(
    `SELECT id, evaluated_at AS evaluatedAt, next_evaluation_at AS nextEvaluationAt,
            weight_kg AS weightKg, body_fat_percent AS bodyFatPercent,
            lean_mass_kg AS leanMassKg, muscle_mass_kg AS muscleMassKg,
            body_water_percent AS bodyWaterPercent, visceral_fat AS visceralFat,
            bone_mass_kg AS boneMassKg, basal_metabolic_rate AS basalMetabolicRate,
            metabolic_age AS metabolicAge, bmi, blood_pressure AS bloodPressure,
            resting_heart_rate AS restingHeartRate, chest_cm AS chestCm,
            waist_cm AS waistCm, abdomen_cm AS abdomenCm, hip_cm AS hipCm,
            right_arm_cm AS rightArmCm, left_arm_cm AS leftArmCm,
            right_arm_relaxed_cm AS rightArmRelaxedCm, left_arm_relaxed_cm AS leftArmRelaxedCm,
            right_arm_contracted_cm AS rightArmContractedCm, left_arm_contracted_cm AS leftArmContractedCm,
            right_forearm_cm AS rightForearmCm, left_forearm_cm AS leftForearmCm,
            right_thigh_cm AS rightThighCm, left_thigh_cm AS leftThighCm,
            right_calf_cm AS rightCalfCm, left_calf_cm AS leftCalfCm,
            triceps_mm AS tricepsMm, subscapular_mm AS subscapularMm,
            suprailiac_mm AS suprailiacMm, abdominal_mm AS abdominalMm,
            thigh_mm AS thighMm, chest_skinfold_mm AS chestSkinfoldMm,
            midaxillary_mm AS midaxillaryMm, calf_skinfold_mm AS calfSkinfoldMm,
            postural_notes AS posturalNotes,
            movement_limitations AS movementLimitations,
            professional_recommendations AS professionalRecommendations,
            notes
       FROM evaluations
      WHERE student_id = ?
      ORDER BY evaluated_at DESC
      LIMIT 5`,
    [req.student.sub]
  );
  const [workoutLogs] = await pool.query(
    `SELECT id, logged_at AS loggedAt, day_index AS dayIndex, day_title AS dayTitle,
            exercise_name AS exerciseName, prescription, load_text AS loadText,
            student_comment AS studentComment, admin_comment AS adminComment,
            updated_at AS updatedAt
       FROM workout_logs
      WHERE student_id = ?
      ORDER BY logged_at DESC, day_index ASC, id DESC
      LIMIT 500`,
    [req.student.sub]
  );
  const approvedTrainingPlans = await fetchTrainingPlans(req.student.sub, { status: "approved" });
  res.json({
    student: rows[0],
    slots,
    availableSlots,
    evaluations,
    workoutLogs,
    approvedTrainingPlan: approvedTrainingPlans[0] ?? null
  });
});

app.post("/api/student/evaluation-slot", requireStudent, async (req, res) => {
  const slotId = Number(req.body.slotId);
  if (!Number.isFinite(slotId)) {
    res.status(400).json({ error: "Horário inválido." });
    return;
  }
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [students] = await connection.query(
      "SELECT id, payment_status AS paymentStatus FROM students WHERE id = ? FOR UPDATE",
      [req.student.sub]
    );
    if (!students.length) {
      await connection.rollback();
      res.status(404).json({ error: "Aluno não encontrado." });
      return;
    }
    if (students[0].paymentStatus !== "confirmed") {
      await connection.rollback();
      res.status(403).json({ error: "O agendamento será liberado após a confirmação do pagamento." });
      return;
    }
    const [slotRows] = await connection.query(
      "SELECT id FROM evaluation_slots WHERE id = ? AND status = 'available' AND starts_at >= NOW() FOR UPDATE",
      [slotId]
    );
    if (!slotRows.length) {
      await connection.rollback();
      res.status(409).json({ error: "Horário indisponível. Escolha outro horário." });
      return;
    }
    await connection.query(
      "UPDATE evaluation_slots SET status = 'booked', student_id = ? WHERE id = ?",
      [req.student.sub, slotId]
    );
    await connection.commit();
    res.json({ ok: true });
  } catch (error) {
    await connection.rollback();
    console.error(error);
    res.status(500).json({ error: "Não foi possível agendar a avaliação." });
  } finally {
    connection.release();
  }
});

app.put("/api/student/subscription", requireStudent, async (req, res) => {
  const choice = normalizeSubscriptionChoice(req.body);
  if (choice.error) {
    res.status(400).json({ error: choice.error });
    return;
  }
  const { plan, evaluationPreference } = choice;
  const wantsTeamEvaluation = evaluationPreference === "team";
  const evaluationCoveredByPlan = plan.includedEvaluations > 0;
  const [result] = await pool.query(
    `UPDATE students
        SET subscription_plan_id = ?,
            subscription_plan_name = ?,
            subscription_months = ?,
            subscription_price_cents = ?,
            subscription_status = 'pending_payment',
            payment_status = 'pending',
            payment_provider = 'mercado_pago',
            payment_reference = ?,
            payment_confirmed_at = NULL,
            subscription_started_at = NULL,
            subscription_ends_at = NULL,
            status = 'pending_payment',
            evaluation_preference = ?,
            evaluation_fee_required = ?,
            evaluation_fee_cents = ?,
            included_evaluations_remaining = ?
      WHERE id = ?
      LIMIT 1`,
    [
      plan.id,
      plan.name,
      plan.months,
      plan.priceCents,
      `pending-${Date.now()}`,
      evaluationPreference,
      wantsTeamEvaluation && !evaluationCoveredByPlan ? 1 : 0,
      wantsTeamEvaluation && !evaluationCoveredByPlan ? evaluationFeeCents : 0,
      plan.includedEvaluations,
      req.student.sub
    ]
  );
  if (!result.affectedRows) {
    res.status(404).json({ error: "Aluno não encontrado." });
    return;
  }
  const [students] = await pool.query(
    "SELECT id, name, email, phone FROM students WHERE id = ? LIMIT 1",
    [req.student.sub]
  );
  const payment = await createMercadoPagoPreference({
    studentId: req.student.sub,
    student: students[0],
    plan,
    evaluationPreference
  });
  await pool.query(
    "UPDATE students SET payment_reference = ? WHERE id = ? LIMIT 1",
    [payment.paymentReference, req.student.sub]
  );
  res.json({ ok: true, paymentUrl: payment.paymentUrl });
});

app.post("/api/student/subscription/cancel", requireStudent, async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.query(
      "UPDATE evaluation_slots SET status = 'available', student_id = NULL WHERE student_id = ? AND status = 'booked'",
      [req.student.sub]
    );
    const [result] = await connection.query(
      `UPDATE students
          SET subscription_status = 'canceled',
              payment_status = 'canceled',
              status = 'pending_payment',
              subscription_ends_at = NOW(),
              included_evaluations_remaining = 0
        WHERE id = ?
        LIMIT 1`,
      [req.student.sub]
    );
    if (!result.affectedRows) {
      await connection.rollback();
      res.status(404).json({ error: "Aluno não encontrado." });
      return;
    }
    await connection.commit();
    res.json({ ok: true });
  } catch (error) {
    await connection.rollback();
    console.error(error);
    res.status(500).json({ error: "Não foi possível cancelar a assinatura." });
  } finally {
    connection.release();
  }
});

app.post("/api/student/workout-logs", requireStudent, async (req, res) => {
  const loggedAt = String(req.body.loggedAt ?? new Date().toISOString().slice(0, 10)).slice(0, 10);
  const dayIndex = Number(req.body.dayIndex);
  const dayTitle = String(req.body.dayTitle ?? "").trim();
  const exerciseName = String(req.body.exerciseName ?? "").trim();
  const prescription = optionalText(req.body, "prescription");
  const loadText = optionalText(req.body, "loadText");
  const studentComment = optionalText(req.body, "studentComment");

  if (!Number.isInteger(dayIndex) || dayIndex < 0 || !dayTitle || !exerciseName) {
    res.status(400).json({ error: "Informe o dia e o exercício do treino." });
    return;
  }
  if (!loadText && !studentComment) {
    res.status(400).json({ error: "Informe a carga usada ou um comentário sobre o exercício." });
    return;
  }

  const [result] = await pool.query(
    `INSERT INTO workout_logs
      (student_id, logged_at, day_index, day_title, exercise_name, prescription, load_text, student_comment)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       prescription = VALUES(prescription),
       load_text = VALUES(load_text),
       student_comment = VALUES(student_comment)`,
    [
      req.student.sub,
      loggedAt,
      dayIndex,
      dayTitle,
      exerciseName,
      prescription,
      loadText,
      studentComment
    ]
  );
  res.status(201).json({ id: result.insertId, ok: true });
});

app.post("/api/admin/login", async (req, res) => {
  const username = String(req.body.username ?? "").trim().toLowerCase();
  const password = String(req.body.password ?? "");
  if (!username) {
    res.status(400).json({ error: "Informe o nome de usuário." });
    return;
  }
  const [rows] = await pool.query("SELECT * FROM admins WHERE username = ? LIMIT 1", [username]);
  const admin = rows[0];
  if (!admin || !(await bcrypt.compare(password, admin.password_hash))) {
    res.status(401).json({ error: "Usuário ou senha inválidos." });
    return;
  }
  res.json({
    token: signAdmin(admin),
    admin: {
      id: admin.id,
      name: admin.name,
      username: admin.username ?? null,
      email: admin.email ?? null,
      role: admin.role
    }
  });
});

app.get("/api/admin/me", requireAdmin, (req, res) => {
  res.json({ admin: req.admin });
});

app.get("/api/admin/dashboard", requireAdmin, async (_req, res) => {
  const [[students], [admins], [awaiting], [reevaluations], [availableSlots]] = await Promise.all([
    pool.query("SELECT COUNT(*) AS total FROM students"),
    pool.query("SELECT COUNT(*) AS total FROM admins"),
    pool.query("SELECT COUNT(*) AS total FROM students WHERE status = 'awaiting_evaluation'"),
    pool.query(
      `SELECT COUNT(*) AS total
         FROM evaluations
        WHERE next_evaluation_at <= DATE_ADD(CURDATE(), INTERVAL 15 DAY)`
    ),
    pool.query(
      "SELECT COUNT(*) AS total FROM evaluation_slots WHERE status = 'available' AND starts_at >= NOW()"
    )
  ]);
  res.json({
    totalStudents: Number(students[0].total),
    totalAdmins: Number(admins[0].total),
    awaitingEvaluation: Number(awaiting[0].total),
    reevaluationsDueSoon: Number(reevaluations[0].total),
    availableEvaluationSlots: Number(availableSlots[0].total)
  });
});

app.get("/api/admin/evaluation-slots", requireAdmin, async (_req, res) => {
  const [rows] = await pool.query(
    `SELECT s.id, s.starts_at AS startsAt, s.ends_at AS endsAt, s.status, s.notes,
            st.id AS studentId, st.name AS studentName
       FROM evaluation_slots s
       LEFT JOIN students st ON st.id = s.student_id
      ORDER BY s.starts_at DESC
      LIMIT 200`
  );
  res.json({ slots: rows });
});

app.post("/api/admin/evaluation-slots", requireAdmin, async (req, res) => {
  const startsAt = String(req.body.startsAt ?? "").replace("T", " ");
  const endsAt = String(req.body.endsAt ?? "").replace("T", " ");
  const notes = req.body.notes ? String(req.body.notes).trim() : null;
  if (!startsAt || !endsAt) {
    res.status(400).json({ error: "Informe início e fim da avaliação." });
    return;
  }
  if (new Date(endsAt) <= new Date(startsAt)) {
    res.status(400).json({ error: "O fim precisa ser depois do início." });
    return;
  }
  const [result] = await pool.query(
    `INSERT INTO evaluation_slots (starts_at, ends_at, created_by_admin_id, notes)
     VALUES (?, ?, ?, ?)`,
    [startsAt, endsAt, req.admin.sub, notes]
  );
  res.status(201).json({ id: result.insertId });
});

app.get("/api/admin/admins", requireAdmin, async (_req, res) => {
  const [rows] = await pool.query(
    "SELECT id, name, username, email, role, created_at AS createdAt FROM admins ORDER BY created_at DESC"
  );
  res.json({ admins: rows });
});

app.post("/api/admin/admins", requireAdmin, async (req, res) => {
  const name = String(req.body.name ?? "").trim();
  const username = String(req.body.username ?? "").trim().toLowerCase();
  const emailRaw = String(req.body.email ?? "").trim().toLowerCase();
  const email = emailRaw || null;
  const password = String(req.body.password ?? "");
  if (!name || !username || password.length < 6) {
    res.status(400).json({
      error: "Informe nome, nome de usuário e senha com pelo menos 6 caracteres."
    });
    return;
  }
  if (!/^[a-z0-9._-]{3,30}$/.test(username)) {
    res.status(400).json({
      error: "Usuário admin: 3 a 30 caracteres, letras minúsculas, números, ponto, traço ou underline."
    });
    return;
  }
  try {
    const hash = await bcrypt.hash(password, 10);
    await pool.query(
      "INSERT INTO admins (name, username, email, password_hash, role) VALUES (?, ?, ?, ?, 'admin')",
      [name, username, email, hash]
    );
    res.status(201).json({ ok: true });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      res.status(409).json({ error: "Já existe um admin com este nome de usuário ou email." });
      return;
    }
    console.error(error);
    res.status(500).json({ error: "Não foi possível criar o admin." });
  }
});

app.get("/api/admin/students", requireAdmin, async (req, res) => {
  const search = String(req.query.search ?? "").trim();
  const where = search ? "WHERE name LIKE ? OR email LIKE ? OR phone LIKE ?" : "";
  const params = search ? [`%${search}%`, `%${search}%`, `%${search}%`] : [];
  const [rows] = await pool.query(
    `SELECT id, name, email, phone, age, goal, modality, experience, status,
            subscription_status AS subscriptionStatus,
            subscription_plan_id AS subscriptionPlanId,
            subscription_plan_name AS subscriptionPlanName,
            subscription_ends_at AS subscriptionEndsAt,
            payment_status AS paymentStatus,
            evaluation_preference AS evaluationPreference,
            evaluation_fee_required AS evaluationFeeRequired,
            included_evaluations_remaining AS includedEvaluationsRemaining,
            created_at AS createdAt
       FROM students
       ${where}
      ORDER BY created_at DESC
      LIMIT 200`,
    params
  );
  res.json({ students: rows });
});

app.patch("/api/admin/students/:id/status", requireAdmin, async (req, res) => {
  const status = String(req.body.status ?? "");
  const allowed = ["pending_payment", "awaiting_evaluation", "evaluated", "suspended"];
  if (!allowed.includes(status)) {
    res.status(400).json({ error: "Status inválido." });
    return;
  }
  const [result] = await pool.query("UPDATE students SET status = ? WHERE id = ? LIMIT 1", [
    status,
    req.params.id
  ]);
  if (!result.affectedRows) {
    res.status(404).json({ error: "Aluno não encontrado." });
    return;
  }
  res.json({ ok: true });
});

app.post("/api/admin/students/:id/payment/confirm", requireAdmin, async (req, res) => {
  const confirmed = await confirmStudentPaymentById(req.params.id);
  if (!confirmed) {
    res.status(404).json({ error: "Aluno não encontrado." });
    return;
  }
  res.json({ ok: true });
});

async function deleteStudentById(req, res) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.query(
      "UPDATE evaluation_slots SET status = 'available', student_id = NULL WHERE student_id = ?",
      [req.params.id]
    );
    const [result] = await connection.query("DELETE FROM students WHERE id = ? LIMIT 1", [
      req.params.id
    ]);
    if (!result.affectedRows) {
      await connection.rollback();
      res.status(404).json({ error: "Aluno não encontrado." });
      return;
    }
    await connection.commit();
    res.json({ ok: true });
  } catch (error) {
    await connection.rollback();
    console.error(error);
    res.status(500).json({ error: "Não foi possível excluir o aluno." });
  } finally {
    connection.release();
  }
}

app.delete("/api/admin/students/:id", requireAdmin, deleteStudentById);
app.post("/api/admin/students/:id/delete", requireAdmin, deleteStudentById);

app.post("/api/admin/students", requireAdmin, async (req, res) => {
  try {
    const student = normalizeStudent(req.body);
    const error = validateStudent(student);
    if (error) {
      res.status(400).json({ error });
      return;
    }
    const id = await insertStudent(student, { paymentConfirmed: true });
    res.status(201).json({ id });
  } catch (error) {
    console.error(error);
    if (error.code === "ER_DUP_ENTRY") {
      res.status(409).json({ error: "Esse nome de usuário já está em uso." });
      return;
    }
    res.status(500).json({ error: "Não foi possível criar o aluno." });
  }
});

app.get("/api/admin/students/:id", requireAdmin, async (req, res) => {
  const [rows] = await pool.query(
    `SELECT id, name, username, email, phone, age, height_cm AS heightCm, weight_kg AS weightKg,
            goal, modality, experience, available_days AS availableDays,
            session_minutes AS sessionMinutes, injury, observations, status,
            subscription_status AS subscriptionStatus, temporary_plan_json AS temporaryPlan,
            subscription_plan_id AS subscriptionPlanId,
            subscription_plan_name AS subscriptionPlanName,
            payment_status AS paymentStatus,
            evaluation_preference AS evaluationPreference,
            evaluation_fee_required AS evaluationFeeRequired,
            included_evaluations_remaining AS includedEvaluationsRemaining,
            created_at AS createdAt
       FROM students
      WHERE id = ?
      LIMIT 1`,
    [req.params.id]
  );
  if (!rows.length) {
    res.status(404).json({ error: "Aluno não encontrado." });
    return;
  }
  const [evaluations] = await pool.query(
    `SELECT id, evaluated_at AS evaluatedAt, next_evaluation_at AS nextEvaluationAt,
            weight_kg AS weightKg, body_fat_percent AS bodyFatPercent,
            lean_mass_kg AS leanMassKg, muscle_mass_kg AS muscleMassKg,
            body_water_percent AS bodyWaterPercent, visceral_fat AS visceralFat,
            bone_mass_kg AS boneMassKg, basal_metabolic_rate AS basalMetabolicRate,
            metabolic_age AS metabolicAge, bmi, blood_pressure AS bloodPressure,
            resting_heart_rate AS restingHeartRate, chest_cm AS chestCm,
            waist_cm AS waistCm, abdomen_cm AS abdomenCm, hip_cm AS hipCm,
            right_arm_cm AS rightArmCm, left_arm_cm AS leftArmCm,
            right_arm_relaxed_cm AS rightArmRelaxedCm,
            left_arm_relaxed_cm AS leftArmRelaxedCm,
            right_arm_contracted_cm AS rightArmContractedCm,
            left_arm_contracted_cm AS leftArmContractedCm,
            right_forearm_cm AS rightForearmCm, left_forearm_cm AS leftForearmCm,
            right_thigh_cm AS rightThighCm, left_thigh_cm AS leftThighCm,
            right_calf_cm AS rightCalfCm, left_calf_cm AS leftCalfCm,
            triceps_mm AS tricepsMm, subscapular_mm AS subscapularMm,
            suprailiac_mm AS suprailiacMm, abdominal_mm AS abdominalMm,
            thigh_mm AS thighMm, chest_skinfold_mm AS chestSkinfoldMm,
            midaxillary_mm AS midaxillaryMm, calf_skinfold_mm AS calfSkinfoldMm,
            postural_notes AS posturalNotes,
            movement_limitations AS movementLimitations,
            professional_recommendations AS professionalRecommendations,
            notes, created_at AS createdAt
       FROM evaluations
      WHERE student_id = ?
      ORDER BY evaluated_at DESC`,
    [req.params.id]
  );
  const [slots] = await pool.query(
    `SELECT id, starts_at AS startsAt, ends_at AS endsAt, status, notes
       FROM evaluation_slots
      WHERE student_id = ?
      ORDER BY starts_at DESC`,
    [req.params.id]
  );
  const [workoutLogs] = await pool.query(
    `SELECT id, logged_at AS loggedAt, day_index AS dayIndex, day_title AS dayTitle,
            exercise_name AS exerciseName, prescription, load_text AS loadText,
            student_comment AS studentComment, admin_comment AS adminComment,
            updated_at AS updatedAt
       FROM workout_logs
      WHERE student_id = ?
      ORDER BY logged_at DESC, day_index ASC, id DESC
      LIMIT 200`,
    [req.params.id]
  );
  const trainingPlans = await fetchTrainingPlans(req.params.id);
  res.json({ student: rows[0], evaluations, slots, workoutLogs, trainingPlans });
});

app.patch("/api/admin/students/:id/credentials", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) {
    res.status(400).json({ error: "Aluno inválido." });
    return;
  }
  const rawUser = req.body.username;
  const rawPass = req.body.password;
  const username =
    rawUser !== undefined && rawUser !== null && String(rawUser).trim() !== ""
      ? String(rawUser).trim().toLowerCase()
      : null;
  const password = rawPass !== undefined && rawPass !== null ? String(rawPass) : "";
  if (!username && !password) {
    res.status(400).json({ error: "Informe um novo nome de usuário e/ou uma nova senha." });
    return;
  }
  if (username && !/^[a-z0-9._-]{3,30}$/.test(username)) {
    res.status(400).json({
      error: "Nome de usuário: 3 a 30 caracteres, letras minúsculas, números, ponto, traço ou underline."
    });
    return;
  }
  if (password && password.length < 6) {
    res.status(400).json({ error: "A senha deve ter pelo menos 6 caracteres." });
    return;
  }
  const [exists] = await pool.query("SELECT id FROM students WHERE id = ? LIMIT 1", [id]);
  if (!exists.length) {
    res.status(404).json({ error: "Aluno não encontrado." });
    return;
  }
  const updates = [];
  const params = [];
  if (username) {
    updates.push("username = ?");
    params.push(username);
  }
  if (password) {
    updates.push("password_hash = ?");
    params.push(await bcrypt.hash(password, 10));
  }
  try {
    await pool.query(`UPDATE students SET ${updates.join(", ")} WHERE id = ? LIMIT 1`, [...params, id]);
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      res.status(409).json({ error: "Esse nome de usuário já está em uso." });
      return;
    }
    throw error;
  }
  res.json({ ok: true });
});

app.patch("/api/admin/workout-logs/:id/comment", requireAdmin, async (req, res) => {
  const adminComment = optionalText(req.body, "adminComment");
  const [result] = await pool.query(
    "UPDATE workout_logs SET admin_comment = ?, admin_id = ? WHERE id = ? LIMIT 1",
    [adminComment, req.admin.sub, req.params.id]
  );
  if (!result.affectedRows) {
    res.status(404).json({ error: "Registro de treino não encontrado." });
    return;
  }
  res.json({ ok: true });
});

app.put("/api/admin/training-plans/:id", requireAdmin, async (req, res) => {
  const plan = normalizePlanPayload(req.body);
  if (!plan) {
    res.status(400).json({ error: "Preencha o treino com título, resumo, intensidade, frequência e exercícios." });
    return;
  }
  const [rows] = await pool.query("SELECT id FROM training_plans WHERE id = ? LIMIT 1", [req.params.id]);
  if (!rows.length) {
    res.status(404).json({ error: "Treino não encontrado." });
    return;
  }
  await replaceTrainingPlan(req.params.id, plan);
  res.json({ ok: true });
});

app.patch("/api/admin/training-plans/:id/status", requireAdmin, async (req, res) => {
  const status = String(req.body.status ?? "");
  if (!["approved", "rejected", "pending"].includes(status)) {
    res.status(400).json({ error: "Status do treino inválido." });
    return;
  }
  const [plans] = await pool.query("SELECT id, student_id AS studentId FROM training_plans WHERE id = ? LIMIT 1", [
    req.params.id
  ]);
  if (!plans.length) {
    res.status(404).json({ error: "Treino não encontrado." });
    return;
  }
  if (status === "approved") {
    await pool.query(
      "UPDATE training_plans SET status = 'rejected', released_at = NULL WHERE student_id = ? AND status = 'approved' AND id <> ?",
      [plans[0].studentId, req.params.id]
    );
  }
  await pool.query(
    "UPDATE training_plans SET status = ?, released_at = IF(? = 'approved', NOW(), released_at) WHERE id = ? LIMIT 1",
    [status, status, req.params.id]
  );
  res.json({ ok: true });
});

app.post("/api/admin/students/:id/training-plans/suggest", requireAdmin, async (req, res) => {
  const suggestedPlanId = await createSuggestedPlanFromStudent(req.params.id);
  if (!suggestedPlanId) {
    res.status(404).json({ error: "Não foi possível gerar sugestão para este aluno." });
    return;
  }
  res.status(201).json({ id: suggestedPlanId });
});

app.post("/api/admin/students/:id/evaluations", requireAdmin, async (req, res) => {
  const evaluatedAt = req.body.evaluatedAt || new Date().toISOString().slice(0, 10);
  const notes = String(req.body.notes ?? "").trim();
  if (!notes) {
    res.status(400).json({ error: "Informe o resumo/observações gerais da avaliação." });
    return;
  }
  const values = Object.fromEntries(
    numberEvaluationFields.map((field) => [field, optionalNumber(req.body, field)])
  );
  const [result] = await pool.query(
    `INSERT INTO evaluations
      (student_id, admin_id, evaluated_at, next_evaluation_at,
       weight_kg, body_fat_percent, lean_mass_kg, muscle_mass_kg, body_water_percent,
       visceral_fat, bone_mass_kg, basal_metabolic_rate, metabolic_age, bmi,
       blood_pressure, resting_heart_rate,
       chest_cm, waist_cm, abdomen_cm, hip_cm, right_arm_cm, left_arm_cm,
       right_arm_relaxed_cm, left_arm_relaxed_cm, right_arm_contracted_cm,
       left_arm_contracted_cm, right_forearm_cm, left_forearm_cm,
       right_thigh_cm, left_thigh_cm, right_calf_cm, left_calf_cm,
       triceps_mm, subscapular_mm, suprailiac_mm, abdominal_mm, thigh_mm,
       chest_skinfold_mm, midaxillary_mm, calf_skinfold_mm,
       postural_notes, movement_limitations, professional_recommendations, notes)
     VALUES (?, ?, ?, DATE_ADD(?, INTERVAL 3 MONTH),
       ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      req.params.id,
      req.admin.sub,
      evaluatedAt,
      evaluatedAt,
      values.weightKg,
      values.bodyFatPercent,
      values.leanMassKg,
      values.muscleMassKg,
      values.bodyWaterPercent,
      values.visceralFat,
      values.boneMassKg,
      values.basalMetabolicRate,
      values.metabolicAge,
      values.bmi,
      optionalText(req.body, "bloodPressure"),
      values.restingHeartRate,
      values.chestCm,
      values.waistCm,
      values.abdomenCm,
      values.hipCm,
      values.rightArmCm,
      values.leftArmCm,
      values.rightArmRelaxedCm,
      values.leftArmRelaxedCm,
      values.rightArmContractedCm,
      values.leftArmContractedCm,
      values.rightForearmCm,
      values.leftForearmCm,
      values.rightThighCm,
      values.leftThighCm,
      values.rightCalfCm,
      values.leftCalfCm,
      values.tricepsMm,
      values.subscapularMm,
      values.suprailiacMm,
      values.abdominalMm,
      values.thighMm,
      values.chestSkinfoldMm,
      values.midaxillaryMm,
      values.calfSkinfoldMm,
      optionalText(req.body, "posturalNotes"),
      optionalText(req.body, "movementLimitations"),
      optionalText(req.body, "professionalRecommendations"),
      notes
    ]
  );
  await pool.query(
    `UPDATE students
        SET status = 'evaluated',
            included_evaluations_remaining = IF(included_evaluations_remaining > 0, included_evaluations_remaining - 1, 0)
      WHERE id = ?`,
    [req.params.id]
  );
  const suggestedPlanId = await createSuggestedPlanFromStudent(req.params.id);
  res.status(201).json({ id: result.insertId, suggestedPlanId });
});

app.use((_req, res) => {
  res.status(404).json({ error: "Rota não encontrada." });
});

const listenHost = process.env.API_LISTEN_HOST ?? "0.0.0.0";
const server = app.listen(port, listenHost, () => {
  console.log(
    `Pâmela Mendes Personal API na porta ${port} (host ${listenHost}). No telemóvel use http://SEU_IP_LAN:${port} no api-url-for-apk.txt`
  );
});
server.keepAliveTimeout = 65000;
setInterval(() => undefined, 60_000);

