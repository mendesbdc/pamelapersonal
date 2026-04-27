import { useEffect, useMemo, useRef, useState } from "react";
import {
  api,
  ApiError,
  getToken,
  getStudentToken,
  setStudentToken,
  setToken,
  type AdminSession,
  type EvaluationPreference,
  type EvaluationSlot,
  type StudentListItem,
  type SubscriptionPlanId,
  type WorkoutLog
} from "./api";
import { generateTrainingPlan } from "./trainingEngine";

function isUnauthorized(err: unknown): err is ApiError {
  return err instanceof ApiError && err.status === 401;
}
import type {
  Experience,
  Goal,
  InjuryProfile,
  TrainingModality,
  TrainingPlan,
  UserProfile,
  WorkoutExercise
} from "./types";

type View = "home" | "register" | "admin" | "student";

const VIEW_STORAGE_KEY = "pamelapersonal_current_view";
const ALL_VIEWS: View[] = ["home", "register", "admin", "student"];

function readStoredView(): View {
  if (typeof sessionStorage === "undefined") return "home";
  try {
    const raw = sessionStorage.getItem(VIEW_STORAGE_KEY);
    if (raw && ALL_VIEWS.includes(raw as View)) return raw as View;
  } catch {
    /* modo privado / storage bloqueado */
  }
  return "home";
}

function persistView(next: View) {
  try {
    sessionStorage.setItem(VIEW_STORAGE_KEY, next);
  } catch {
    /* ignore */
  }
}

const initialProfile: UserProfile = {
  name: "",
  age: 28,
  heightCm: 170,
  weightKg: 75,
  goal: "condicionamento",
  modality: "musculacao",
  experience: "iniciante",
  availableDays: 3,
  sessionMinutes: 45,
  injury: "nenhuma"
};

const goalOptions: Array<{ value: Goal; label: string }> = [
  { value: "emagrecimento", label: "Emagrecimento" },
  { value: "hipertrofia", label: "Hipertrofia" },
  { value: "condicionamento", label: "Condicionamento" },
  { value: "saude", label: "Saúde e rotina" },
  { value: "performance", label: "Performance" }
];

const modalityOptions: Array<{ value: TrainingModality; label: string }> = [
  { value: "musculacao", label: "Musculação" },
  { value: "natacao", label: "Natação" },
  { value: "corrida", label: "Corrida / atletismo" },
  { value: "funcional", label: "Funcional" },
  { value: "mobilidade", label: "Mobilidade" }
];

const experienceOptions: Array<{ value: Experience; label: string }> = [
  { value: "iniciante", label: "Iniciante" },
  { value: "intermediario", label: "Intermediário" },
  { value: "avancado", label: "Avançado" }
];

const injuryOptions: Array<{ value: InjuryProfile; label: string }> = [
  { value: "nenhuma", label: "Nenhuma" },
  { value: "joelho", label: "Joelho" },
  { value: "ombro", label: "Ombro" },
  { value: "coluna", label: "Coluna" },
  { value: "cardiaca", label: "Cardíaca" },
  { value: "outra", label: "Outra" }
];

const subscriptionPlans: Array<{
  id: SubscriptionPlanId;
  name: string;
  duration: string;
  price: string;
  includedEvaluations: number;
  description: string;
}> = [
  {
    id: "monthly",
    name: "Mensal",
    duration: "1 mês",
    price: "R$ 69,90",
    includedEvaluations: 0,
    description: "Acesso mensal ao site. Avaliação comigo é cobrada à parte."
  },
  {
    id: "quarterly",
    name: "Trimestral",
    duration: "3 meses",
    price: "R$ 178,90",
    includedEvaluations: 2,
    description: "Acesso por 3 meses com 2 avaliações de brinde."
  },
  {
    id: "semiannual",
    name: "Semestral",
    duration: "6 meses",
    price: "R$ 329,90",
    includedEvaluations: 3,
    description: "Acesso por 6 meses com 3 avaliações de brinde."
  }
];
const evaluationFeeLabel = "R$ 40,00";

const evaluationPreferenceLabels: Record<EvaluationPreference, string> = {
  team: "Fazer a avaliação comigo (presencial)",
  send_info: "Só me enviar as medidas; eu preencho sua ficha"
};

const evaluationSections = [
  {
    title: "Sinais vitais e composição geral",
    fields: [
      { key: "weightKg", label: "Peso atual (kg)", type: "number" },
      { key: "bmi", label: "IMC", type: "number" },
      { key: "bloodPressure", label: "Pressão arterial", type: "text", placeholder: "Ex.: 120/80" },
      { key: "restingHeartRate", label: "FC repouso (bpm)", type: "number" }
    ]
  },
  {
    title: "Bioimpedância",
    fields: [
      { key: "bodyFatPercent", label: "% gordura", type: "number" },
      { key: "leanMassKg", label: "Massa magra (kg)", type: "number" },
      { key: "muscleMassKg", label: "Massa muscular (kg)", type: "number" },
      { key: "bodyWaterPercent", label: "% água corporal", type: "number" },
      { key: "visceralFat", label: "Gordura visceral", type: "number" },
      { key: "boneMassKg", label: "Massa óssea (kg)", type: "number" },
      { key: "basalMetabolicRate", label: "Taxa metabólica basal", type: "number" },
      { key: "metabolicAge", label: "Idade metabólica", type: "number" }
    ]
  },
  {
    title: "Circunferências",
    fields: [
      { key: "chestCm", label: "Peitoral (cm)", type: "number" },
      { key: "waistCm", label: "Cintura (cm)", type: "number" },
      { key: "abdomenCm", label: "Abdômen (cm)", type: "number" },
      { key: "hipCm", label: "Quadril (cm)", type: "number" },
      { key: "rightArmRelaxedCm", label: "Braço direito relaxado (cm)", type: "number" },
      { key: "leftArmRelaxedCm", label: "Braço esquerdo relaxado (cm)", type: "number" },
      { key: "rightArmContractedCm", label: "Braço direito contraído (cm)", type: "number" },
      { key: "leftArmContractedCm", label: "Braço esquerdo contraído (cm)", type: "number" },
      { key: "rightForearmCm", label: "Antebraço direito (cm)", type: "number" },
      { key: "leftForearmCm", label: "Antebraço esquerdo (cm)", type: "number" },
      { key: "rightThighCm", label: "Coxa direita (cm)", type: "number" },
      { key: "leftThighCm", label: "Coxa esquerda (cm)", type: "number" },
      { key: "rightCalfCm", label: "Panturrilha direita (cm)", type: "number" },
      { key: "leftCalfCm", label: "Panturrilha esquerda (cm)", type: "number" }
    ]
  },
  {
    title: "Adipômetro / dobras cutâneas",
    fields: [
      { key: "tricepsMm", label: "Tríceps (mm)", type: "number" },
      { key: "subscapularMm", label: "Subescapular (mm)", type: "number" },
      { key: "suprailiacMm", label: "Suprailíaca (mm)", type: "number" },
      { key: "abdominalMm", label: "Abdominal (mm)", type: "number" },
      { key: "thighMm", label: "Coxa (mm)", type: "number" },
      { key: "chestSkinfoldMm", label: "Peitoral dobra (mm)", type: "number" },
      { key: "midaxillaryMm", label: "Axilar média (mm)", type: "number" }
    ]
  }
];

const initialEvaluationState = () => ({
  evaluatedAt: new Date().toISOString().slice(0, 10),
  weightKg: "",
  bodyFatPercent: "",
  leanMassKg: "",
  muscleMassKg: "",
  bodyWaterPercent: "",
  visceralFat: "",
  boneMassKg: "",
  basalMetabolicRate: "",
  metabolicAge: "",
  bmi: "",
  bloodPressure: "",
  restingHeartRate: "",
  chestCm: "",
  waistCm: "",
  abdomenCm: "",
  hipCm: "",
  rightArmRelaxedCm: "",
  leftArmRelaxedCm: "",
  rightArmContractedCm: "",
  leftArmContractedCm: "",
  rightForearmCm: "",
  leftForearmCm: "",
  rightThighCm: "",
  leftThighCm: "",
  rightCalfCm: "",
  leftCalfCm: "",
  tricepsMm: "",
  subscapularMm: "",
  suprailiacMm: "",
  abdominalMm: "",
  thighMm: "",
  chestSkinfoldMm: "",
  midaxillaryMm: "",
  posturalNotes: "",
  movementLimitations: "",
  professionalRecommendations: "",
  notes: ""
});

const comparisonFields = evaluationSections.flatMap((section) => section.fields);
const lowerIsBetter = new Set([
  "weightKg",
  "bodyFatPercent",
  "visceralFat",
  "bmi",
  "waistCm",
  "abdomenCm",
  "hipCm",
  "tricepsMm",
  "subscapularMm",
  "suprailiacMm",
  "abdominalMm",
  "thighMm",
  "chestSkinfoldMm",
  "midaxillaryMm"
]);
const higherIsBetter = new Set(["leanMassKg", "muscleMassKg", "bodyWaterPercent", "basalMetabolicRate"]);

function formatComparisonValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "-";
  return String(value);
}

function evaluationValue(value: string | number | null | undefined, suffix = "") {
  if (value === null || value === undefined || value === "") return "-";
  return `${value}${suffix}`;
}

function evolutionStatus(fieldKey: string, previous: unknown, current: unknown) {
  if (previous === null || previous === undefined || current === null || current === undefined) {
    return "Sem base";
  }
  const previousNumber = Number(previous);
  const currentNumber = Number(current);
  if (Number.isFinite(previousNumber) && Number.isFinite(currentNumber)) {
    const diff = currentNumber - previousNumber;
    if (diff === 0) return "Estável";
    if (lowerIsBetter.has(fieldKey)) return diff < 0 ? "Evoluiu" : "Atenção";
    if (higherIsBetter.has(fieldKey)) return diff > 0 ? "Evoluiu" : "Atenção";
    return diff > 0 ? `Subiu ${diff.toFixed(2)}` : `Caiu ${Math.abs(diff).toFixed(2)}`;
  }
  return previous === current ? "Sem mudança" : "Alterado";
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function todayDateKey() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(value: string) {
  const date = value.includes("T") ? new Date(value) : new Date(`${value}T00:00:00`);
  return date.toLocaleDateString("pt-BR");
}

function workoutInputKey(dayIndex: number, exerciseName: string) {
  return `${dayIndex}:${exerciseName}`;
}

function workoutDayLabel(index: number) {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  return `Treino ${letters[index] ?? index + 1}`;
}

function exerciseVideoSlug(name: string) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function exerciseDemoCandidates(name: string) {
  const cleanName = name.trim();
  const slug = exerciseVideoSlug(cleanName);
  const names = Array.from(new Set([cleanName, slug].filter(Boolean)));

  return names.flatMap((fileName) => [
    {
      src: `/exercise-videos/${encodeURIComponent(fileName)}.mp4`,
      type: "video" as const,
      fileLabel: `${fileName}.mp4`
    },
    {
      src: `/exercise-videos/${encodeURIComponent(fileName)}.webm`,
      type: "video" as const,
      fileLabel: `${fileName}.webm`
    },
    {
      src: `/exercise-videos/${encodeURIComponent(fileName)}.gif`,
      type: "image" as const,
      fileLabel: `${fileName}.gif`
    }
  ]);
}

function exerciseDemoConfig(name: string) {
  const normalized = name.toLowerCase();
  if (/leg press/.test(normalized)) {
    return {
      kind: "leg-press",
      title: "Demo: Leg press",
      cues: ["Pés firmes", "Desça controlando", "Empurre sem travar joelhos"]
    };
  }
  if (/agachamento/.test(normalized)) {
    return {
      kind: "squat",
      title: "Demo: Agachamento",
      cues: ["Quadril para trás", "Joelhos alinhados", "Suba empurrando o chão"]
    };
  }
  if (/cadeira extensora/.test(normalized)) {
    return {
      kind: "knee-extension",
      title: "Demo: Cadeira extensora",
      cues: ["Costas apoiadas", "Estenda até controlar", "Desça devagar"]
    };
  }
  if (/mesa flexora/.test(normalized)) {
    return {
      kind: "leg-curl",
      title: "Demo: Mesa flexora",
      cues: ["Quadril apoiado", "Flexione sem impulso", "Controle a volta"]
    };
  }
  if (/elevação pélvica|ponte/.test(normalized)) {
    return {
      kind: "hip-thrust",
      title: "Demo: Elevação pélvica",
      cues: ["Pés apoiados", "Suba contraindo glúteos", "Não hiperestenda lombar"]
    };
  }
  if (/supino|flexão/.test(normalized)) {
    return {
      kind: "bench-press",
      title: "Demo: Empurrar",
      cues: ["Escápulas firmes", "Desça controlando", "Empurre sem perder postura"]
    };
  }
  if (/remada|puxada/.test(normalized)) {
    return {
      kind: "row",
      title: "Demo: Puxar",
      cues: ["Peito aberto", "Puxe com cotovelos", "Controle a volta"]
    };
  }
  if (/desenvolvimento|ombro/.test(normalized)) {
    return {
      kind: "shoulder-press",
      title: "Demo: Ombros",
      cues: ["Core firme", "Empurre acima da cabeça", "Evite arquear a lombar"]
    };
  }
  if (/rosca/.test(normalized)) {
    return {
      kind: "curl",
      title: "Demo: Rosca",
      cues: ["Cotovelo parado", "Suba sem balanço", "Desça controlando"]
    };
  }
  if (/tríceps|triceps/.test(normalized)) {
    return {
      kind: "triceps",
      title: "Demo: Tríceps",
      cues: ["Cotovelo junto", "Estenda completo", "Volte controlando"]
    };
  }
  if (/prancha|core/.test(normalized)) {
    return {
      kind: "plank",
      title: "Demo: Prancha/Core",
      cues: ["Corpo alinhado", "Abdômen contraído", "Respire sem perder postura"]
    };
  }
  if (/corrida|caminhada|intervalado/.test(normalized)) {
    return {
      kind: "run",
      title: "Demo: Corrida",
      cues: ["Postura alta", "Passada leve", "Ritmo controlado"]
    };
  }
  if (/crawl|nado|braçada|pernada|piscina|série contínua/.test(normalized)) {
    return {
      kind: "swim",
      title: "Demo: Natação",
      cues: ["Corpo alinhado", "Respiração cadenciada", "Braçada longa"]
    };
  }
  return {
    kind: "general",
    title: `Demo: ${name}`,
    cues: ["Movimento controlado", "Postura firme", "Pare se sentir dor"]
  };
}

function ExerciseDemo({ name }: { name: string }) {
  const demo = exerciseDemoConfig(name);
  const demoCandidates = useMemo(() => exerciseDemoCandidates(name), [name]);
  const [assetIndex, setAssetIndex] = useState(0);
  const currentAsset = demoCandidates[assetIndex];
  const mediaMissing = !currentAsset;

  useEffect(() => {
    setAssetIndex(0);
  }, [name]);

  return (
    <div className={`exercise-demo demo-${demo.kind}`}>
      {currentAsset?.type === "video" ? (
        <video
          className="exercise-gif"
          src={currentAsset.src}
          autoPlay
          loop
          muted
          playsInline
          controls
          onError={() => setAssetIndex((current) => current + 1)}
        />
      ) : currentAsset?.type === "image" ? (
        <img
          alt={`Demonstração do exercício ${name}`}
          className="exercise-gif"
          src={currentAsset.src}
          onError={() => setAssetIndex((current) => current + 1)}
        />
      ) : (
        <div className="demo-stage" aria-hidden="true">
          <span className="demo-machine" />
          <span className="demo-bench" />
          <span className="demo-water" />
          <span className="demo-head" />
          <span className="demo-body" />
          <span className="demo-arm left" />
          <span className="demo-arm right" />
          <span className="demo-leg left" />
          <span className="demo-leg right" />
          <span className="demo-weight" />
        </div>
      )}
      <div>
        <strong>{demo.title}</strong>
        <span>
          {mediaMissing
            ? `Adicione o vídeo em public-assets/exercise-videos/${demoCandidates[0]?.fileLabel ?? `${name}.mp4`}.`
            : "Veja o movimento antes de executar."}
        </span>
        <span className="demo-source">
          Use o mesmo nome do exercício. Também aceito `.mp4`, `.webm` ou `.gif`.
        </span>
        <ul className="demo-cues">
          {demo.cues.map((cue) => (
            <li key={cue}>{cue}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function editablePlan(plan: TrainingPlan): TrainingPlan {
  return {
    headline: plan.headline,
    summary: plan.summary,
    intensity: plan.intensity,
    weeklyFrequency: plan.weeklyFrequency,
    warnings: [...(plan.warnings ?? [])],
    days: (plan.days ?? []).map((day) => ({
      title: day.title,
      focus: day.focus,
      warmup: day.warmup,
      cooldown: day.cooldown,
      exercises: (day.exercises ?? []).map((exercise) => ({
        name: exercise.name,
        prescription: exercise.prescription,
        notes: exercise.notes ?? ""
      }))
    }))
  };
}

function FieldNumber({
  label,
  value,
  min,
  max,
  onChange
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

function SelectField<T extends string>({
  label,
  value,
  options,
  onChange
}: {
  label: string;
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value as T)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function PlanPreview({ profile }: { profile: UserProfile }) {
  const plan = useMemo(() => generateTrainingPlan(profile), [profile]);
  return (
    <div className="workout-grid compact-grid">
      {plan.days.slice(0, 3).map((day, index) => (
        <article className="workout-card" key={`${day.title}-${index}`}>
          <span className="day-number">Provisório {index + 1}</span>
          <h3>{day.title}</h3>
          <p className="focus">{day.focus}</p>
          <ul>
            {day.exercises.slice(0, 4).map((exercise) => (
              <li key={exercise.name}>
                <strong>{exercise.name}</strong>
                <span>{exercise.prescription}</span>
                {exercise.notes ? <em>{exercise.notes}</em> : null}
              </li>
            ))}
          </ul>
        </article>
      ))}
    </div>
  );
}

function StudentForm({
  mode,
  onCreated
}: {
  mode: "public" | "admin";
  onCreated?: () => void;
}) {
  const [profile, setProfile] = useState<UserProfile>(initialProfile);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [observations, setObservations] = useState("");
  const [subscriptionPlanId, setSubscriptionPlanId] = useState<SubscriptionPlanId>("monthly");
  const [evaluationPreference, setEvaluationPreference] = useState<EvaluationPreference>("team");
  const [created, setCreated] = useState<{ id: number; message: string; paymentUrl?: string } | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const temporaryPlan = useMemo(() => generateTrainingPlan(profile), [profile]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const payload = {
        ...profile,
        username,
        password,
        email,
        phone,
        observations,
        temporaryPlan,
        subscriptionPlanId,
        evaluationPreference,
        evaluationSlotId: null
      };
      const result = await (mode === "admin"
        ? api.createStudent(payload)
        : api.registerStudent(payload));
      const successMessage =
        "message" in result
          ? String(result.message)
          : "Cadastro salvo. Você já tem um treino provisório até a gente fazer a avaliação.";
      setCreated({
        id: result.id,
        message: successMessage,
        paymentUrl: "paymentUrl" in result ? String(result.paymentUrl) : undefined
      });
      onCreated?.();
      if (mode === "public") window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao cadastrar aluno.");
    } finally {
      setLoading(false);
    }
  }

  if (created && mode === "public") {
    return (
      <section className="panel result-panel">
        <p className="eyebrow">Cadastro recebido</p>
        <h2>Seu plano foi selecionado</h2>
        <p className="hero-copy">
          {created.message}
        </p>
        <div className="warnings">
          <p>
            Guarde seu acesso: usuário <strong>{username}</strong> e a senha que você criou no cadastro.
          </p>
          <p>
            Plano escolhido:{" "}
            <strong>
              {subscriptionPlans.find((plan) => plan.id === subscriptionPlanId)?.name} -{" "}
              {subscriptionPlans.find((plan) => plan.id === subscriptionPlanId)?.price}
            </strong>.
          </p>
          <p>
            Avaliação: <strong>{evaluationPreferenceLabels[evaluationPreference]}</strong>.
            {subscriptionPlanId === "monthly" && evaluationPreference === "team"
              ? ` A taxa de avaliação de ${evaluationFeeLabel} será cobrada junto ao pagamento.`
              : null}
          </p>
          <p>
            Depois da confirmação do pagamento, você entra na área do aluno e escolhe uma data para a
            avaliação. Se não houver vaga, eu te chamo no WhatsApp e a gente combina.
          </p>
          <p>Status: pagamento pendente via Mercado Pago.</p>
        </div>
        <a className="button primary" href={created.paymentUrl ?? "#"}>
          Ir para pagamento Mercado Pago
        </a>
      </section>
    );
  }

  return (
    <form className="panel form-panel" onSubmit={submit}>
      <div className="section-heading">
        <p className="eyebrow">{mode === "public" ? "Cadastro e plano" : "Novo aluno"}</p>
        <h2>{mode === "public" ? "Preencha seus dados" : "Cadastrar aluno manualmente"}</h2>
        <p>
          {mode === "public"
            ? "Escolhe o plano, me diz como prefere a avaliação e segue para o pagamento — daqui a pouco a gente se vê no app."
            : "Cadastro manual já fica ativo para acompanhamento da personal."}
        </p>
      </div>

      {created && mode === "admin" ? <p className="success">{created.message}</p> : null}
      {error ? <p className="error">{error}</p> : null}

      <label className="field field-full">
        <span>Nome</span>
        <input
          value={profile.name}
          required
          onChange={(event) => setProfile({ ...profile, name: event.target.value })}
        />
      </label>

      <div className="field-row">
        <label className="field">
          <span>Nome de usuário</span>
          <input
            value={username}
            required
            placeholder="ex.: ana.silva"
            onChange={(event) => setUsername(event.target.value.toLowerCase())}
          />
        </label>
        <label className="field">
          <span>Senha de acesso</span>
          <input
            type="password"
            value={password}
            required
            minLength={6}
            placeholder="mínimo 6 caracteres"
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
      </div>

      <div className="field-row">
        <label className="field">
          <span>Email</span>
          <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
        </label>
        <label className="field">
          <span>Telefone / WhatsApp</span>
          <input value={phone} onChange={(event) => setPhone(event.target.value)} />
        </label>
      </div>

      <div className="field-row">
        <FieldNumber
          label="Idade"
          min={12}
          max={90}
          value={profile.age}
          onChange={(age) => setProfile({ ...profile, age })}
        />
        <FieldNumber
          label="Altura (cm)"
          min={120}
          max={230}
          value={profile.heightCm}
          onChange={(heightCm) => setProfile({ ...profile, heightCm })}
        />
        <FieldNumber
          label="Peso (kg)"
          min={30}
          max={250}
          value={profile.weightKg}
          onChange={(weightKg) => setProfile({ ...profile, weightKg })}
        />
      </div>

      <div className="field-row">
        <SelectField
          label="Objetivo"
          value={profile.goal}
          options={goalOptions}
          onChange={(goal) => setProfile({ ...profile, goal })}
        />
        <SelectField
          label="Modalidade"
          value={profile.modality}
          options={modalityOptions}
          onChange={(modality) => setProfile({ ...profile, modality })}
        />
      </div>

      <div className="field-row">
        <SelectField
          label="Nível"
          value={profile.experience}
          options={experienceOptions}
          onChange={(experience) => setProfile({ ...profile, experience })}
        />
        <SelectField
          label="Restrição ou lesão"
          value={profile.injury}
          options={injuryOptions}
          onChange={(injury) => setProfile({ ...profile, injury })}
        />
      </div>

      <div className="range-grid">
        <label className="range-field">
          <span>Dias por semana: {profile.availableDays}</span>
          <input
            type="range"
            min={2}
            max={6}
            value={profile.availableDays}
            onChange={(event) =>
              setProfile({ ...profile, availableDays: Number(event.target.value) })
            }
          />
        </label>
        <label className="range-field">
          <span>Tempo por sessão: {profile.sessionMinutes} min</span>
          <input
            type="range"
            min={25}
            max={90}
            step={5}
            value={profile.sessionMinutes}
            onChange={(event) =>
              setProfile({ ...profile, sessionMinutes: Number(event.target.value) })
            }
          />
        </label>
      </div>

      <label className="field field-full">
        <span>Observações importantes</span>
        <textarea
          value={observations}
          placeholder="Rotina, dores, horários, objetivo específico..."
          onChange={(event) => setObservations(event.target.value)}
        />
      </label>

      {mode === "public" ? (
        <>
          <fieldset className="evaluation-section">
            <legend>Escolha seu plano</legend>
            <div className="plan-choice-grid">
              {subscriptionPlans.map((plan) => (
                <label
                  className={`choice-card ${subscriptionPlanId === plan.id ? "selected" : ""}`}
                  key={plan.id}
                >
                  <input
                    checked={subscriptionPlanId === plan.id}
                    name="subscriptionPlan"
                    onChange={() => setSubscriptionPlanId(plan.id)}
                    type="radio"
                  />
                  <strong>{plan.name}</strong>
                  <strong className="plan-price">{plan.price}</strong>
                  <span>{plan.duration}</span>
                  <p>{plan.description}</p>
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset className="evaluation-section">
            <legend>Avaliação</legend>
            <div className="plan-choice-grid">
              <label className={`choice-card ${evaluationPreference === "team" ? "selected" : ""}`}>
                <input
                  checked={evaluationPreference === "team"}
                  name="evaluationPreference"
                  onChange={() => setEvaluationPreference("team")}
                  type="radio"
                />
                <strong>Fazer comigo (presencial)</strong>
                <span>
                  {subscriptionPlanId === "monthly"
                    ? `Taxa de avaliação à parte: ${evaluationFeeLabel}`
                    : "Avaliações inclusas no plano"}
                </span>
                <p>
                  No mensal há taxa de avaliação. No trimestral são 2 avaliações de brinde e no semestral são
                  3.
                </p>
              </label>
              <label className={`choice-card ${evaluationPreference === "send_info" ? "selected" : ""}`}>
                <input
                  checked={evaluationPreference === "send_info"}
                  name="evaluationPreference"
                  onChange={() => setEvaluationPreference("send_info")}
                  type="radio"
                />
                <strong>Enviar minhas informações</strong>
                <span>Sem agendar avaliação presencial agora</span>
                <p>Você me passa os dados e eu deixo sua ficha pronta para acompanhar você de perto.</p>
              </label>
            </div>
          </fieldset>
        </>
      ) : null}

      <button className="button primary submit" disabled={loading} type="submit">
        {loading ? "Salvando..." : mode === "public" ? "Cadastrar e ir para pagamento" : "Cadastrar aluno"}
      </button>
    </form>
  );
}

function AdminLogin({ onLogin }: { onLogin: (admin: AdminSession) => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await api.login(username.trim().toLowerCase(), password);
      setToken(result.token);
      onLogin(result.admin);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha no login.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="center-screen">
      <form className="panel login-panel" onSubmit={submit}>
        <p className="eyebrow">Admin</p>
        <h2>Entrar no painel</h2>
        {error ? <p className="error">{error}</p> : null}
        <label className="field">
          <span>Nome de usuário</span>
          <input
            autoComplete="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
          />
        </label>
        <label className="field">
          <span>Senha</span>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        <button className="button primary" disabled={loading} type="submit">
          {loading ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </section>
  );
}

function AdminPanel({ admin, onLogout }: { admin: AdminSession; onLogout: () => void }) {
  const [dashboard, setDashboard] = useState<Awaited<ReturnType<typeof api.dashboard>> | null>(null);
  const [students, setStudents] = useState<StudentListItem[]>([]);
  const [admins, setAdmins] = useState<Awaited<ReturnType<typeof api.listAdmins>>["admins"]>([]);
  const [slots, setSlots] = useState<EvaluationSlot[]>([]);
  const [search, setSearch] = useState("");
  const [activeAdminTool, setActiveAdminTool] = useState<"schedule" | "student" | "admin" | null>(null);
  const [adminForm, setAdminForm] = useState({ name: "", username: "", email: "", password: "" });
  const [slotForm, setSlotForm] = useState({
    startsAt: "",
    endsAt: "",
    notes: ""
  });
  const [selectedStudent, setSelectedStudent] = useState<number | null>(null);
  const [detail, setDetail] = useState<Awaited<ReturnType<typeof api.getStudent>> | null>(null);
  const [adminWorkoutComments, setAdminWorkoutComments] = useState<Record<number, string>>({});
  const [planEdits, setPlanEdits] = useState<Record<number, TrainingPlan>>({});
  const [detailLoading, setDetailLoading] = useState(false);
  const [evaluation, setEvaluation] = useState<Record<string, string>>(initialEvaluationState);
  const [showNewEvaluationAction, setShowNewEvaluationAction] = useState(false);
  const [activeStudentSection, setActiveStudentSection] = useState<
    "profile" | "evaluation" | "plans" | "progress" | "comparison" | "history"
  >("profile");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [studentCred, setStudentCred] = useState({ username: "", password: "" });

  useEffect(() => {
    setStudentCred({ username: "", password: "" });
  }, [selectedStudent]);

  async function load() {
    setError(null);
    try {
      const dash = await api.dashboard();
      setDashboard(dash);
    } catch (err) {
      if (isUnauthorized(err)) {
        onLogout();
        return;
      }
      setError(err instanceof Error ? err.message : "Erro ao carregar resumo.");
    }

    try {
      const studentRows = await api.listStudents(search);
      setStudents(studentRows.students);
    } catch (err) {
      if (isUnauthorized(err)) {
        onLogout();
        return;
      }
      setError(err instanceof Error ? err.message : "Erro ao carregar alunos.");
    }

    try {
      const adminRows = await api.listAdmins();
      setAdmins(adminRows.admins);
    } catch (err) {
      if (isUnauthorized(err)) {
        onLogout();
        return;
      }
      setAdmins([]);
    }

    try {
      const slotRows = await api.listEvaluationSlots();
      setSlots(slotRows.slots);
    } catch (err) {
      if (isUnauthorized(err)) {
        onLogout();
        return;
      }
      // A agenda foi adicionada depois; se a API antiga ainda estiver rodando,
      // o painel continua mostrando alunos até o usuário reiniciar o start.bat.
      setSlots([]);
    }
  }

  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    void load().catch((err) => {
      if (isUnauthorized(err)) {
        onLogout();
        return;
      }
      setError(err instanceof Error ? err.message : "Erro ao carregar.");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    function onVisibility() {
      if (document.visibilityState === "visible") void loadRef.current();
    }
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  async function openStudent(studentId: number) {
    setSelectedStudent(studentId);
    setDetail(null);
    setDetailLoading(true);
    setShowNewEvaluationAction(false);
    setActiveStudentSection("profile");
    setError(null);
    try {
      const studentDetail = await api.getStudent(studentId);
      setDetail(studentDetail);
      setAdminWorkoutComments(
        Object.fromEntries((studentDetail.workoutLogs ?? []).map((log) => [log.id, log.adminComment ?? ""]))
      );
      setPlanEdits(
        Object.fromEntries((studentDetail.trainingPlans ?? []).map((plan) => [plan.id, editablePlan(plan)]))
      );
      window.setTimeout(() => {
        document.getElementById("student-detail")?.scrollIntoView({ behavior: "smooth" });
      }, 50);
    } catch (err) {
      if (isUnauthorized(err)) {
        onLogout();
        return;
      }
      setError(
        err instanceof Error
          ? `Não foi possível abrir a ficha do aluno: ${err.message}`
          : "Não foi possível abrir a ficha do aluno."
      );
    } finally {
      setDetailLoading(false);
    }
  }

  async function refreshStudentDetail(studentId: number) {
    try {
      const studentDetail = await api.getStudent(studentId);
      setDetail(studentDetail);
      setAdminWorkoutComments(
        Object.fromEntries((studentDetail.workoutLogs ?? []).map((log) => [log.id, log.adminComment ?? ""]))
      );
      setPlanEdits(
        Object.fromEntries((studentDetail.trainingPlans ?? []).map((plan) => [plan.id, editablePlan(plan)]))
      );
    } catch (err) {
      if (isUnauthorized(err)) {
        onLogout();
        return;
      }
      throw err;
    }
  }

  async function refreshAll() {
    setRefreshing(true);
    try {
      await load();
      const sid = selectedStudent;
      if (sid != null) {
        try {
          await refreshStudentDetail(sid);
        } catch (err) {
          if (isUnauthorized(err)) {
            onLogout();
            return;
          }
          setError(err instanceof Error ? err.message : "Erro ao atualizar ficha do aluno.");
        }
      }
    } finally {
      setRefreshing(false);
    }
  }

  async function saveStudentCredentials(event: React.FormEvent) {
    event.preventDefault();
    if (!detail) return;
    const u = studentCred.username.trim().toLowerCase();
    const p = studentCred.password;
    if (!u && !p) {
      setError("Preencha novo usuário e/ou nova senha.");
      return;
    }
    setMessage(null);
    setError(null);
    try {
      await api.updateStudentCredentials(detail.student.id, {
        username: u || undefined,
        password: p || undefined
      });
      setStudentCred({ username: "", password: "" });
      setMessage("Login do aluno atualizado. Ele deve abrir o app e entrar de novo com os dados novos.");
      await refreshStudentDetail(detail.student.id);
      await load();
    } catch (err) {
      if (isUnauthorized(err)) {
        onLogout();
        return;
      }
      setError(err instanceof Error ? err.message : "Erro ao atualizar login do aluno.");
    }
  }

  async function createAdmin(event: React.FormEvent) {
    event.preventDefault();
    setMessage(null);
    setError(null);
    try {
      await api.createAdmin({
        name: adminForm.name,
        username: adminForm.username.trim().toLowerCase(),
        email: adminForm.email.trim().toLowerCase() || undefined,
        password: adminForm.password
      });
      setAdminForm({ name: "", username: "", email: "", password: "" });
      setMessage("Admin criado com sucesso.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar admin.");
    }
  }

  async function createEvaluationSlot(event: React.FormEvent) {
    event.preventDefault();
    setMessage(null);
    setError(null);
    try {
      await api.createEvaluationSlot(slotForm);
      setSlotForm({ startsAt: "", endsAt: "", notes: "" });
      setMessage("Data de avaliação criada com sucesso.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar data de avaliação.");
    }
  }

  async function saveEvaluation(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedStudent) return;
    setMessage(null);
    setError(null);
    try {
      await api.createEvaluation(selectedStudent, evaluation);
      setShowNewEvaluationAction(true);
      setMessage("Avaliação registrada com sucesso. Você já pode comparar a evolução ou realizar nova avaliação.");
      await Promise.all([load(), refreshStudentDetail(selectedStudent)]);
      setActiveStudentSection("comparison");
      window.setTimeout(() => {
        document.getElementById("evaluation-comparison")?.scrollIntoView({ behavior: "smooth" });
      }, 80);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar avaliação.");
    }
  }

  function startNewEvaluation() {
    setEvaluation(initialEvaluationState());
    setShowNewEvaluationAction(false);
    setActiveStudentSection("evaluation");
    setMessage("Formulário limpo. O aluno continua selecionado para uma nova avaliação.");
    window.setTimeout(() => {
      document.getElementById("evaluation-form")?.scrollIntoView({ behavior: "smooth" });
    }, 50);
  }

  async function saveWorkoutComment(logId: number) {
    if (!selectedStudent) return;
    setMessage(null);
    setError(null);
    try {
      await api.updateWorkoutLogComment(logId, adminWorkoutComments[logId] ?? "");
      const studentDetail = await api.getStudent(selectedStudent);
      setDetail(studentDetail);
      setAdminWorkoutComments(
        Object.fromEntries((studentDetail.workoutLogs ?? []).map((log) => [log.id, log.adminComment ?? ""]))
      );
      setMessage("Comentário da personal salvo.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar comentário.");
    }
  }

  function updatePlanEdit(planId: number, updater: (plan: TrainingPlan) => TrainingPlan) {
    const currentPlan = planEdits[planId];
    if (!currentPlan) return;
    setPlanEdits({ ...planEdits, [planId]: updater(currentPlan) });
  }

  function addExerciseToPlan(planId: number, dayIndex: number) {
    updatePlanEdit(planId, (current) => ({
      ...current,
      days: current.days.map((day, index) =>
        index === dayIndex
          ? {
              ...day,
              exercises: [
                ...day.exercises,
                {
                  name: "Novo exercício",
                  prescription: "3 séries de 10 repetições",
                  notes: ""
                }
              ]
            }
          : day
      )
    }));
  }

  function removeExerciseFromPlan(planId: number, dayIndex: number, exerciseIndex: number) {
    updatePlanEdit(planId, (current) => ({
      ...current,
      days: current.days.map((day, index) =>
        index === dayIndex
          ? {
              ...day,
              exercises: day.exercises.filter((_, currentIndex) => currentIndex !== exerciseIndex)
            }
          : day
      )
    }));
  }

  async function saveTrainingPlan(planId: number) {
    if (!selectedStudent || !planEdits[planId]) return;
    setMessage(null);
    setError(null);
    try {
      await api.updateTrainingPlan(planId, planEdits[planId]);
      await refreshStudentDetail(selectedStudent);
      setMessage("Treino salvo como rascunho. Para aparecer no login do aluno, clique em Aprovar e liberar ao aluno.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao editar treino.");
    }
  }

  async function setTrainingPlanStatus(planId: number, status: "pending" | "approved" | "rejected") {
    if (!selectedStudent) return;
    setMessage(null);
    setError(null);
    try {
      if (planEdits[planId]) {
        await api.updateTrainingPlan(planId, planEdits[planId]);
      }
      await api.updateTrainingPlanStatus(planId, status);
      await refreshStudentDetail(selectedStudent);
      setMessage(
        status === "approved"
          ? "Treino aprovado e liberado para o aluno."
          : status === "rejected"
            ? "Sugestão de treino recusada."
            : "Treino voltou para pendente."
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao alterar treino.");
    }
  }

  async function generateTrainingPlanSuggestion() {
    if (!selectedStudent) return;
    setMessage(null);
    setError(null);
    try {
      await api.generateTrainingPlanSuggestion(selectedStudent);
      await refreshStudentDetail(selectedStudent);
      setMessage("Sugestão de treino criada. Revise, edite e aprove antes de liberar ao aluno.");
      window.setTimeout(() => {
        document.getElementById("training-plan-review")?.scrollIntoView({ behavior: "smooth" });
      }, 80);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao gerar sugestão de treino.");
    }
  }

  async function setStudentStatus(studentId: number, status: "awaiting_evaluation" | "evaluated" | "suspended") {
    setMessage(null);
    setError(null);
    try {
      await api.updateStudentStatus(studentId, status);
      setMessage(status === "suspended" ? "Aluno suspenso com sucesso." : "Aluno reativado com sucesso.");
      await load();
      if (selectedStudent === studentId) {
        await refreshStudentDetail(studentId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao alterar status do aluno.");
    }
  }

  async function deleteStudent(studentId: number, studentName: string) {
    const confirmed = window.confirm(
      `Tem certeza que deseja excluir permanentemente o aluno "${studentName}"? Essa ação não pode ser desfeita.`
    );
    if (!confirmed) return;
    setMessage(null);
    setError(null);
    try {
      await api.deleteStudent(studentId);
      setMessage("Aluno excluído com sucesso.");
      if (selectedStudent === studentId) {
        setSelectedStudent(null);
        setDetail(null);
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao excluir aluno.");
    }
  }

  async function confirmStudentPayment(studentId: number) {
    setMessage(null);
    setError(null);
    try {
      await api.confirmStudentPayment(studentId);
      setMessage("Pagamento confirmado. O aluno já pode acessar a agenda.");
      await load();
      if (selectedStudent === studentId) {
        await refreshStudentDetail(studentId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao confirmar pagamento.");
    }
  }

  return (
    <main className="page admin-page">
      <header className="admin-header">
        <div>
          <p className="eyebrow">Painel administrativo</p>
          <h1>Gestão Pâmela Mendes Personal</h1>
          <p className="muted">
            Logado como {admin.name}
            {admin.username ? ` · @${admin.username}` : null}
          </p>
        </div>
        <div className="admin-header-actions">
          <button
            className="button secondary"
            disabled={refreshing}
            onClick={() => void refreshAll()}
            type="button"
          >
            {refreshing ? "Atualizando…" : "Atualizar dados"}
          </button>
          <button className="button secondary" onClick={onLogout} type="button">
            Sair
          </button>
        </div>
      </header>

      {message ? <p className="success">{message}</p> : null}
      {showNewEvaluationAction ? (
        <div className="action-feedback">
          <button className="button primary" onClick={startNewEvaluation} type="button">
            + Realizar Nova Avaliação
          </button>
        </div>
      ) : null}
      {error ? <p className="error">{error}</p> : null}

      <section className="card-grid">
        <div className="card">
          <span>Alunos</span>
          <strong>{dashboard?.totalStudents ?? "-"}</strong>
        </div>
        <div className="card">
          <span>Aguardando avaliação</span>
          <strong>{dashboard?.awaitingEvaluation ?? "-"}</strong>
        </div>
        <div className="card">
          <span>Reavaliações próximas</span>
          <strong>{dashboard?.reevaluationsDueSoon ?? "-"}</strong>
        </div>
        <div className="card">
          <span>Datas disponíveis</span>
          <strong>{dashboard?.availableEvaluationSlots ?? "-"}</strong>
        </div>
        <div className="card">
          <span>Admins</span>
          <strong>{dashboard?.totalAdmins ?? "-"}</strong>
        </div>
      </section>

      <section className="admin-grid">
        <div className="panel">
          <div className="section-heading">
            <p className="eyebrow">Alunos</p>
            <h2>Cadastrados</h2>
          </div>
          <div className="toolbar">
            <input
              placeholder="Buscar aluno..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <button className="button secondary" onClick={() => void load()} type="button">
              Buscar
            </button>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Objetivo</th>
                  <th>Plano / pagamento</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {students.map((student) => (
                  <tr key={student.id}>
                    <td>
                      <strong>{student.name}</strong>
                      <span>{student.email || student.phone || "sem contato"}</span>
                    </td>
                    <td>
                      <strong>{student.goal}</strong>
                      <span>{student.subscriptionPlanName ?? "sem plano"}</span>
                    </td>
                    <td>
                      <strong>{student.paymentStatus === "confirmed" ? "Pago" : "Pendente"}</strong>
                      <span>{student.status}</span>
                    </td>
                    <td>
                      <div className="action-row">
                      <button
                        className="button secondary small"
                        onClick={() => void openStudent(student.id)}
                        type="button"
                      >
                        {detailLoading && selectedStudent === student.id ? "Abrindo..." : "Abrir"}
                      </button>
                      <button
                        className="button secondary small"
                        onClick={() =>
                          void setStudentStatus(
                            student.id,
                            student.status === "suspended" ? "awaiting_evaluation" : "suspended"
                          )
                        }
                        type="button"
                      >
                        {student.status === "suspended" ? "Reativar" : "Suspender"}
                      </button>
                      {student.paymentStatus !== "confirmed" ? (
                        <button
                          className="button primary small"
                          onClick={() => void confirmStudentPayment(student.id)}
                          type="button"
                        >
                          Confirmar pagamento
                        </button>
                      ) : null}
                      <button
                        className="button danger small"
                        onClick={() => void deleteStudent(student.id, student.name)}
                        type="button"
                      >
                        Excluir
                      </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="stack">
          <section className="panel collapsed-panel">
            <p className="eyebrow">Ações rápidas</p>
            <h2>O que deseja abrir?</h2>
            <div className="action-row">
              <button
                className={`button small ${activeAdminTool === "schedule" ? "primary" : "secondary"}`}
                onClick={() => setActiveAdminTool(activeAdminTool === "schedule" ? null : "schedule")}
                type="button"
              >
                Agenda
              </button>
              <button
                className={`button small ${activeAdminTool === "student" ? "primary" : "secondary"}`}
                onClick={() => setActiveAdminTool(activeAdminTool === "student" ? null : "student")}
                type="button"
              >
                Novo aluno
              </button>
              <button
                className={`button small ${activeAdminTool === "admin" ? "primary" : "secondary"}`}
                onClick={() => setActiveAdminTool(activeAdminTool === "admin" ? null : "admin")}
                type="button"
              >
                Criar admin
              </button>
            </div>
          </section>

          {activeAdminTool === "schedule" ? (
            <section className="panel collapsed-panel">
              <p className="eyebrow">Agenda</p>
              <div className="collapsed-heading">
                <div>
                  <h2>Datas para avaliação</h2>
                  <p className="muted">{slots.length} data(s) cadastrada(s).</p>
                </div>
              </div>
              <form className="form-panel" onSubmit={createEvaluationSlot}>
                <div className="field-row">
                  <label className="field">
                    <span>Início</span>
                    <input
                      type="datetime-local"
                      value={slotForm.startsAt}
                      onChange={(event) => setSlotForm({ ...slotForm, startsAt: event.target.value })}
                      required
                    />
                  </label>
                  <label className="field">
                    <span>Fim</span>
                    <input
                      type="datetime-local"
                      value={slotForm.endsAt}
                      onChange={(event) => setSlotForm({ ...slotForm, endsAt: event.target.value })}
                      required
                    />
                  </label>
                </div>
                <label className="field">
                  <span>Observação</span>
                  <input
                    placeholder="Ex.: online, presencial, unidade..."
                    value={slotForm.notes}
                    onChange={(event) => setSlotForm({ ...slotForm, notes: event.target.value })}
                  />
                </label>
                <button className="button primary" type="submit">
                  Criar data disponível
                </button>
              </form>
              <div className="mini-list">
                {slots.slice(0, 5).map((slot) => (
                  <div key={slot.id}>
                    <strong>{formatDateTime(slot.startsAt)}</strong>
                    <span>
                      {slot.status === "booked"
                        ? `Agendado: ${slot.studentName ?? "aluno"}`
                        : "Disponível"}
                    </span>
                  </div>
                ))}
                {slots.length === 0 ? <p className="muted">Nenhuma data cadastrada ainda.</p> : null}
              </div>
            </section>
          ) : null}

          {activeAdminTool === "student" ? (
            <section className="panel collapsed-panel">
              <p className="eyebrow">Novo aluno</p>
              <h2>Cadastrar aluno manualmente</h2>
              <p className="muted">O site libera um treino provisório e deixa o aluno aguardando avaliação.</p>
              <StudentForm mode="admin" onCreated={() => void load()} />
            </section>
          ) : null}

          {activeAdminTool === "admin" ? (
            <form className="panel form-panel" onSubmit={createAdmin}>
              <p className="eyebrow">Admins</p>
              <h2>Criar admin</h2>
              <label className="field">
                <span>Nome</span>
                <input
                  value={adminForm.name}
                  onChange={(event) => setAdminForm({ ...adminForm, name: event.target.value })}
                />
              </label>
              <label className="field">
                <span>Nome de usuário</span>
                <input
                  autoComplete="off"
                  value={adminForm.username}
                  onChange={(event) => setAdminForm({ ...adminForm, username: event.target.value })}
                />
              </label>
              <label className="field">
                <span>Email (opcional)</span>
                <input
                  type="email"
                  value={adminForm.email}
                  onChange={(event) => setAdminForm({ ...adminForm, email: event.target.value })}
                />
              </label>
              <label className="field">
                <span>Senha</span>
                <input
                  type="password"
                  value={adminForm.password}
                  onChange={(event) => setAdminForm({ ...adminForm, password: event.target.value })}
                />
              </label>
              <button className="button primary" type="submit">
                Criar admin
              </button>
              <p className="muted">{admins.length} admin(s) cadastrado(s).</p>
            </form>
          ) : null}
        </div>
      </section>

      {detailLoading ? (
        <section className="panel detail-panel" id="student-detail">
          <p className="muted">Carregando ficha do aluno...</p>
        </section>
      ) : null}

      {detail ? (
        <section className="panel detail-panel" id="student-detail">
          <div className="section-heading">
            <p className="eyebrow">Ficha do aluno</p>
            <h2>{detail.student.name}</h2>
            <p>
              Status: {detail.student.status} · Plano: {detail.student.subscriptionStatus}
            </p>
            <div className="action-row">
              <button
                className="button secondary small"
                onClick={() =>
                  void setStudentStatus(
                    detail.student.id,
                    detail.student.status === "suspended" ? "awaiting_evaluation" : "suspended"
                  )
                }
                type="button"
              >
                {detail.student.status === "suspended" ? "Reativar aluno" : "Suspender aluno"}
              </button>
              {detail.student.paymentStatus !== "confirmed" ? (
                <button
                  className="button primary small"
                  onClick={() => void confirmStudentPayment(detail.student.id)}
                  type="button"
                >
                  Confirmar pagamento
                </button>
              ) : null}
              <button
                className="button danger small"
                onClick={() => void deleteStudent(detail.student.id, detail.student.name)}
                type="button"
              >
                Excluir aluno
              </button>
            </div>
          </div>
          <div className="student-section-tabs">
            <button
              className={`button small ${activeStudentSection === "profile" ? "primary" : "secondary"}`}
              onClick={() => setActiveStudentSection("profile")}
              type="button"
            >
              Resumo
            </button>
            <button
              className={`button small ${activeStudentSection === "evaluation" ? "primary" : "secondary"}`}
              onClick={() => setActiveStudentSection("evaluation")}
              type="button"
            >
              Avaliação
            </button>
            <button
              className={`button small ${activeStudentSection === "plans" ? "primary" : "secondary"}`}
              onClick={() => setActiveStudentSection("plans")}
              type="button"
            >
              Treinos
            </button>
            <button
              className={`button small ${activeStudentSection === "progress" ? "primary" : "secondary"}`}
              onClick={() => setActiveStudentSection("progress")}
              type="button"
            >
              Progressão
            </button>
            <button
              className={`button small ${activeStudentSection === "comparison" ? "primary" : "secondary"}`}
              onClick={() => setActiveStudentSection("comparison")}
              type="button"
            >
              Comparativo
            </button>
            <button
              className={`button small ${activeStudentSection === "history" ? "primary" : "secondary"}`}
              onClick={() => setActiveStudentSection("history")}
              type="button"
            >
              Histórico
            </button>
          </div>
          {activeStudentSection === "profile" || activeStudentSection === "evaluation" ? (
          <div className="detail-grid">
            {activeStudentSection === "profile" ? (
            <div>
              <h3>Anamnese</h3>
              <div className="info-grid">
                <div>
                  <span>Usuário</span>
                  <strong>{detail.student.username || "não informado"}</strong>
                </div>
                <div>
                  <span>Email</span>
                  <strong>{detail.student.email || "não informado"}</strong>
                </div>
                <div>
                  <span>Telefone / WhatsApp</span>
                  <strong>{detail.student.phone || "não informado"}</strong>
                </div>
                <div>
                  <span>Idade</span>
                  <strong>{detail.student.age} anos</strong>
                </div>
                <div>
                  <span>Altura</span>
                  <strong>{detail.student.heightCm} cm</strong>
                </div>
                <div>
                  <span>Peso informado</span>
                  <strong>{detail.student.weightKg} kg</strong>
                </div>
                <div>
                  <span>Objetivo</span>
                  <strong>{detail.student.goal}</strong>
                </div>
                <div>
                  <span>Modalidade</span>
                  <strong>{detail.student.modality}</strong>
                </div>
                <div>
                  <span>Nível</span>
                  <strong>{detail.student.experience}</strong>
                </div>
                <div>
                  <span>Dias disponíveis</span>
                  <strong>{detail.student.availableDays}x por semana</strong>
                </div>
                <div>
                  <span>Tempo por sessão</span>
                  <strong>{detail.student.sessionMinutes} min</strong>
                </div>
                <div>
                  <span>Restrição ou lesão</span>
                  <strong>{detail.student.injury}</strong>
                </div>
                <div>
                  <span>Status da assinatura</span>
                  <strong>{detail.student.subscriptionStatus}</strong>
                </div>
                <div>
                  <span>Plano contratado</span>
                  <strong>{detail.student.subscriptionPlanName || "não informado"}</strong>
                </div>
                <div>
                  <span>Pagamento</span>
                  <strong>{detail.student.paymentStatus === "confirmed" ? "confirmado" : "pendente"}</strong>
                </div>
                <div>
                  <span>Avaliações inclusas restantes</span>
                  <strong>{detail.student.includedEvaluationsRemaining ?? 0}</strong>
                </div>
                <div>
                  <span>Tipo de avaliação</span>
                  <strong>
                    {detail.student.evaluationPreference
                      ? evaluationPreferenceLabels[detail.student.evaluationPreference]
                      : "não informado"}
                  </strong>
                </div>
                <div className="info-wide">
                  <span>Avaliação agendada</span>
                  <strong>
                    {detail.slots?.[0]
                      ? `${formatDateTime(detail.slots[0].startsAt)} (${detail.slots[0].status})`
                      : "sem horário vinculado"}
                  </strong>
                </div>
                <div className="info-wide">
                  <span>Observações do aluno</span>
                  <strong>{detail.student.observations || "sem observações"}</strong>
                </div>
              </div>
              <form className="panel form-panel" onSubmit={(e) => void saveStudentCredentials(e)}>
                <h3>Login no app (usuário e senha)</h3>
                <p className="muted">
                  Ao alterar aqui ou direto no banco, a sessão antiga do app deixa de valer. O aluno precisa
                  entrar de novo. Deixe em branco o que não for mudar.
                </p>
                <label className="field">
                  <span>Novo nome de usuário</span>
                  <input
                    autoComplete="off"
                    value={studentCred.username}
                    onChange={(e) => setStudentCred({ ...studentCred, username: e.target.value })}
                  />
                </label>
                <label className="field">
                  <span>Nova senha</span>
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={studentCred.password}
                    onChange={(e) => setStudentCred({ ...studentCred, password: e.target.value })}
                  />
                </label>
                <button className="button secondary" type="submit">
                  Salvar login do aluno
                </button>
              </form>
            </div>
            ) : null}
            {activeStudentSection === "evaluation" ? (
            <form className="form-panel" id="evaluation-form" onSubmit={saveEvaluation}>
              <h3>Registrar avaliação</h3>
              <label className="field">
                <span>Data</span>
                <input
                  type="date"
                  value={evaluation.evaluatedAt}
                  onChange={(event) => setEvaluation({ ...evaluation, evaluatedAt: event.target.value })}
                />
              </label>
              {evaluationSections.map((section) => (
                <fieldset className="evaluation-section" key={section.title}>
                  <legend>{section.title}</legend>
                  <div className="field-row">
                    {section.fields.map((field) => (
                      <label className="field" key={field.key}>
                        <span>{field.label}</span>
                        <input
                          type={field.type}
                          step={field.type === "number" ? "0.01" : undefined}
                          placeholder={field.placeholder}
                          value={evaluation[field.key] ?? ""}
                          onChange={(event) =>
                            setEvaluation({ ...evaluation, [field.key]: event.target.value })
                          }
                        />
                      </label>
                    ))}
                  </div>
                </fieldset>
              ))}
              <fieldset className="evaluation-section">
                <legend>Observações profissionais</legend>
                <label className="field">
                  <span>Análise postural</span>
                  <textarea
                    value={evaluation.posturalNotes}
                    onChange={(event) =>
                      setEvaluation({ ...evaluation, posturalNotes: event.target.value })
                    }
                  />
                </label>
                <label className="field">
                  <span>Limitações de movimento / dores</span>
                  <textarea
                    value={evaluation.movementLimitations}
                    onChange={(event) =>
                      setEvaluation({ ...evaluation, movementLimitations: event.target.value })
                    }
                  />
                </label>
                <label className="field">
                  <span>Recomendações da personal</span>
                  <textarea
                    value={evaluation.professionalRecommendations}
                    onChange={(event) =>
                      setEvaluation({
                        ...evaluation,
                        professionalRecommendations: event.target.value
                      })
                    }
                  />
                </label>
              </fieldset>
              <label className="field">
                <span>Resumo geral da avaliação</span>
                <textarea
                  required
                  value={evaluation.notes}
                  onChange={(event) => setEvaluation({ ...evaluation, notes: event.target.value })}
                />
              </label>
              <button className="button primary" type="submit">
                Salvar avaliação
              </button>
            </form>
            ) : null}
          </div>
          ) : null}
          {activeStudentSection === "plans" ? (
          <>
          <div className="review-shortcut compact-review">
            <div>
              <p className="eyebrow">Treino para análise</p>
              <strong>
                {(detail.trainingPlans ?? []).length > 0
                  ? `${(detail.trainingPlans ?? []).length} sugestão(ões) ou treino(s) disponível(is)`
                  : "Nenhuma sugestão criada ainda"}
              </strong>
              <span>Edite, aprove ou recuse as sugestões de treino deste aluno.</span>
            </div>
            <button
              className="button secondary small"
              onClick={() => void generateTrainingPlanSuggestion()}
              type="button"
            >
              Gerar sugestão agora
            </button>
          </div>
          <h3 id="training-plan-review">Sugestões e treinos do aluno</h3>
          <div className="plan-review-list">
            {(detail.trainingPlans ?? []).map((plan) => {
              const edit = planEdits[plan.id] ?? editablePlan(plan);
              return (
                <article className="plan-review-card" key={plan.id}>
                  <div className="section-heading">
                    <p className="eyebrow">
                      {plan.status === "approved"
                        ? "Aprovado"
                        : plan.status === "rejected"
                          ? "Recusado"
                          : "Pendente de aprovação"}
                    </p>
                    <h3>{plan.headline}</h3>
                    <p className="muted">
                      Criado automaticamente após avaliação. Treinos pendentes ou recusados não aparecem para o aluno.
                    </p>
                  </div>
                  <div className="field-row">
                    <label className="field">
                      <span>Título do treino</span>
                      <input
                        value={edit.headline}
                        onChange={(event) =>
                          updatePlanEdit(plan.id, (current) => ({
                            ...current,
                            headline: event.target.value
                          }))
                        }
                      />
                    </label>
                    <label className="field">
                      <span>Frequência semanal</span>
                      <input
                        value={edit.weeklyFrequency}
                        onChange={(event) =>
                          updatePlanEdit(plan.id, (current) => ({
                            ...current,
                            weeklyFrequency: event.target.value
                          }))
                        }
                      />
                    </label>
                  </div>
                  <label className="field">
                    <span>Resumo do treino</span>
                    <textarea
                      value={edit.summary}
                      onChange={(event) =>
                        updatePlanEdit(plan.id, (current) => ({
                          ...current,
                          summary: event.target.value
                        }))
                      }
                    />
                  </label>
                  <label className="field">
                    <span>Intensidade</span>
                    <input
                      value={edit.intensity}
                      onChange={(event) =>
                        updatePlanEdit(plan.id, (current) => ({
                          ...current,
                          intensity: event.target.value
                        }))
                      }
                    />
                  </label>
                  <label className="field">
                    <span>Avisos para o aluno</span>
                    <textarea
                      value={(edit.warnings ?? []).join("\n")}
                      onChange={(event) =>
                        updatePlanEdit(plan.id, (current) => ({
                          ...current,
                          warnings: event.target.value.split("\n").map((item) => item.trim()).filter(Boolean)
                        }))
                      }
                    />
                  </label>
                  <div className="editable-days">
                    {edit.days.map((day, dayIndex) => (
                      <fieldset className="evaluation-section" key={`${day.title}-${dayIndex}`}>
                        <legend>Dia {dayIndex + 1}</legend>
                        <div className="field-row">
                          <label className="field">
                            <span>Nome do dia</span>
                            <input
                              value={day.title}
                              onChange={(event) =>
                                updatePlanEdit(plan.id, (current) => ({
                                  ...current,
                                  days: current.days.map((item, index) =>
                                    index === dayIndex ? { ...item, title: event.target.value } : item
                                  )
                                }))
                              }
                            />
                          </label>
                          <label className="field">
                            <span>Foco</span>
                            <input
                              value={day.focus}
                              onChange={(event) =>
                                updatePlanEdit(plan.id, (current) => ({
                                  ...current,
                                  days: current.days.map((item, index) =>
                                    index === dayIndex ? { ...item, focus: event.target.value } : item
                                  )
                                }))
                              }
                            />
                          </label>
                        </div>
                        <div className="field-row">
                          <label className="field">
                            <span>Aquecimento</span>
                            <input
                              value={day.warmup}
                              onChange={(event) =>
                                updatePlanEdit(plan.id, (current) => ({
                                  ...current,
                                  days: current.days.map((item, index) =>
                                    index === dayIndex ? { ...item, warmup: event.target.value } : item
                                  )
                                }))
                              }
                            />
                          </label>
                          <label className="field">
                            <span>Finalização</span>
                            <input
                              value={day.cooldown}
                              onChange={(event) =>
                                updatePlanEdit(plan.id, (current) => ({
                                  ...current,
                                  days: current.days.map((item, index) =>
                                    index === dayIndex ? { ...item, cooldown: event.target.value } : item
                                  )
                                }))
                              }
                            />
                          </label>
                        </div>
                        <div className="editable-exercises">
                          {day.exercises.map((exercise, exerciseIndex) => (
                            <div className="exercise-edit-row" key={`${exercise.name}-${exerciseIndex}`}>
                              <label className="field">
                                <span>Exercício</span>
                                <input
                                  value={exercise.name}
                                  onChange={(event) =>
                                    updatePlanEdit(plan.id, (current) => ({
                                      ...current,
                                      days: current.days.map((item, index) =>
                                        index === dayIndex
                                          ? {
                                              ...item,
                                              exercises: item.exercises.map((currentExercise, currentIndex) =>
                                                currentIndex === exerciseIndex
                                                  ? { ...currentExercise, name: event.target.value }
                                                  : currentExercise
                                              )
                                            }
                                          : item
                                      )
                                    }))
                                  }
                                />
                              </label>
                              <label className="field">
                                <span>Prescrição</span>
                                <input
                                  value={exercise.prescription}
                                  onChange={(event) =>
                                    updatePlanEdit(plan.id, (current) => ({
                                      ...current,
                                      days: current.days.map((item, index) =>
                                        index === dayIndex
                                          ? {
                                              ...item,
                                              exercises: item.exercises.map((currentExercise, currentIndex) =>
                                                currentIndex === exerciseIndex
                                                  ? { ...currentExercise, prescription: event.target.value }
                                                  : currentExercise
                                              )
                                            }
                                          : item
                                      )
                                    }))
                                  }
                                />
                              </label>
                              <label className="field">
                                <span>Observação</span>
                                <input
                                  value={exercise.notes ?? ""}
                                  onChange={(event) =>
                                    updatePlanEdit(plan.id, (current) => ({
                                      ...current,
                                      days: current.days.map((item, index) =>
                                        index === dayIndex
                                          ? {
                                              ...item,
                                              exercises: item.exercises.map((currentExercise, currentIndex) =>
                                                currentIndex === exerciseIndex
                                                  ? { ...currentExercise, notes: event.target.value }
                                                  : currentExercise
                                              )
                                            }
                                          : item
                                      )
                                    }))
                                  }
                                />
                              </label>
                              <button
                                className="button danger small"
                                onClick={() => removeExerciseFromPlan(plan.id, dayIndex, exerciseIndex)}
                                type="button"
                              >
                                Remover
                              </button>
                            </div>
                          ))}
                          <button
                            className="button secondary small"
                            onClick={() => addExerciseToPlan(plan.id, dayIndex)}
                            type="button"
                          >
                            + Adicionar exercício
                          </button>
                        </div>
                      </fieldset>
                    ))}
                  </div>
                  <div className="action-row">
                    <button
                      className="button secondary small"
                      onClick={() => void saveTrainingPlan(plan.id)}
                      type="button"
                    >
                      Salvar rascunho
                    </button>
                    <button
                      className="button primary small"
                      onClick={() => void setTrainingPlanStatus(plan.id, "approved")}
                      type="button"
                    >
                      Aprovar e liberar ao aluno
                    </button>
                    <button
                      className="button danger small"
                      onClick={() => void setTrainingPlanStatus(plan.id, "rejected")}
                      type="button"
                    >
                      Recusar
                    </button>
                  </div>
                </article>
              );
            })}
            {(detail.trainingPlans ?? []).length === 0 ? (
              <div className="empty-review">
                <p className="muted">
                  Nenhuma sugestão criada ainda. Gere uma sugestão automática para revisar e aprovar.
                </p>
                <button
                  className="button primary small"
                  onClick={() => void generateTrainingPlanSuggestion()}
                  type="button"
                >
                  Gerar sugestão de treino
                </button>
              </div>
            ) : null}
          </div>
          </>
          ) : null}
          {activeStudentSection === "progress" ? (
          <>
          <h3>Progressão de carga e feedback dos exercícios</h3>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Exercício</th>
                  <th>Carga / comentário do aluno</th>
                  <th>Comentário da personal</th>
                </tr>
              </thead>
              <tbody>
                {(detail.workoutLogs ?? []).map((log) => (
                  <tr key={log.id}>
                    <td>{formatDate(log.loggedAt)}</td>
                    <td>
                      <strong>{log.exerciseName}</strong>
                      <span>
                        {log.dayTitle} · {log.prescription ?? "sem prescrição"}
                      </span>
                    </td>
                    <td>
                      <strong>{log.loadText || "Carga não informada"}</strong>
                      <span>{log.studentComment || "sem comentário do aluno"}</span>
                    </td>
                    <td>
                      <div className="inline-comment">
                        <textarea
                          value={adminWorkoutComments[log.id] ?? log.adminComment ?? ""}
                          onChange={(event) =>
                            setAdminWorkoutComments({
                              ...adminWorkoutComments,
                              [log.id]: event.target.value
                            })
                          }
                          placeholder="Comentário para o aluno ver..."
                        />
                        <button
                          className="button secondary small"
                          onClick={() => void saveWorkoutComment(log.id)}
                          type="button"
                        >
                          Salvar comentário
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {(detail.workoutLogs ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={4}>Nenhum treino registrado pelo aluno ainda.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          </>
          ) : null}
          {activeStudentSection === "comparison" ? (
          <>
          <h3 id="evaluation-comparison">Comparativo de evolução</h3>
          {(detail.evaluations ?? []).length >= 2 ? (
            <div className="comparison-card">
              <div className="comparison-header">
                <div>
                  <span>Avaliação anterior</span>
                  <strong>{formatDate((detail.evaluations ?? [])[1].evaluatedAt)}</strong>
                </div>
                <div>
                  <span>Avaliação atual</span>
                  <strong>{formatDate((detail.evaluations ?? [])[0].evaluatedAt)}</strong>
                </div>
                <div>
                  <span>Regra</span>
                  <strong>N-1 vs N</strong>
                </div>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Indicador</th>
                      <th>Avaliação anterior</th>
                      <th>Avaliação atual</th>
                      <th>Status de evolução</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comparisonFields.map((field) => {
                      const previous = (detail.evaluations ?? [])[1] as Record<string, unknown>;
                      const current = (detail.evaluations ?? [])[0] as Record<string, unknown>;
                      const status = evolutionStatus(field.key, previous[field.key], current[field.key]);
                      return (
                        <tr key={field.key}>
                          <td>{field.label}</td>
                          <td>{formatComparisonValue(previous[field.key])}</td>
                          <td>{formatComparisonValue(current[field.key])}</td>
                          <td>
                            <span
                              className={
                                status === "Evoluiu"
                                  ? "status-good"
                                  : status === "Atenção"
                                    ? "status-warning"
                                    : "status-neutral"
                              }
                            >
                              {status}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <p className="muted">
              O comparativo será exibido automaticamente quando houver pelo menos duas avaliações para este aluno.
            </p>
          )}
          </>
          ) : null}
          {activeStudentSection === "history" ? (
          <>
          <h3>Avaliações</h3>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Próxima reavaliação</th>
                  <th>Notas</th>
                </tr>
              </thead>
              <tbody>
                {(detail.evaluations ?? []).map((item) => (
                  <tr key={item.id}>
                    <td>{item.evaluatedAt}</td>
                    <td>{item.nextEvaluationAt}</td>
                    <td>
                      <strong>{item.notes}</strong>
                      <span>
                        Peso: {item.weightKg ?? "-"} kg · Gordura: {item.bodyFatPercent ?? "-"}% ·
                        Massa magra: {item.leanMassKg ?? "-"} kg · Cintura: {item.waistCm ?? "-"} cm
                      </span>
                    </td>
                  </tr>
                ))}
                {(detail.evaluations ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={3}>Nenhuma avaliação registrada ainda.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          </>
          ) : null}
        </section>
      ) : null}
    </main>
  );
}

function StudentLogin({ onLogin }: { onLogin: () => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await api.studentLogin(username, password);
      setStudentToken(result.token);
      onLogin();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha no login do aluno.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="center-screen">
      <form className="panel login-panel" onSubmit={submit}>
        <p className="eyebrow">Área do aluno</p>
        <h2>Acessar minhas informações</h2>
        {error ? <p className="error">{error}</p> : null}
        <label className="field">
          <span>Nome de usuário</span>
          <input value={username} onChange={(event) => setUsername(event.target.value)} />
        </label>
        <label className="field">
          <span>Senha</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        <button className="button primary" disabled={loading} type="submit">
          {loading ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </section>
  );
}

function StudentArea({ onLogout }: { onLogout: () => void }) {
  const [data, setData] = useState<Awaited<ReturnType<typeof api.studentMe>> | null>(null);
  const [workoutInputs, setWorkoutInputs] = useState<
    Record<string, { loadText: string; studentComment: string }>
  >({});
  const [selectedWorkoutDay, setSelectedWorkoutDay] = useState(0);
  const [selectedExerciseIndex, setSelectedExerciseIndex] = useState(0);
  const [openExerciseHistory, setOpenExerciseHistory] = useState<Record<string, boolean>>({});
  const [showFullWorkoutHistory, setShowFullWorkoutHistory] = useState(false);
  const [showEvaluationDetails, setShowEvaluationDetails] = useState(false);
  const [showSubscriptionDetails, setShowSubscriptionDetails] = useState(false);
  const [showWorkoutDetails, setShowWorkoutDetails] = useState(false);
  const [showEvaluationsPanel, setShowEvaluationsPanel] = useState(false);
  const [selectedEvaluationSlotId, setSelectedEvaluationSlotId] = useState("");
  const [selectedSubscriptionPlanId, setSelectedSubscriptionPlanId] =
    useState<SubscriptionPlanId>("monthly");
  const [selectedSubscriptionEvaluationPreference, setSelectedSubscriptionEvaluationPreference] =
    useState<EvaluationPreference>("team");
  const [savingWorkoutKey, setSavingWorkoutKey] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadStudentArea() {
    setError(null);
    try {
      const studentData = await api.studentMe();
      setData(studentData);
    } catch (err) {
      if (isUnauthorized(err)) {
        onLogout();
        return;
      }
      setError(err instanceof Error ? err.message : "Erro ao carregar aluno.");
    }
  }

  const loadStudentRef = useRef(loadStudentArea);
  loadStudentRef.current = loadStudentArea;

  useEffect(() => {
    void loadStudentArea();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    function onVisibility() {
      if (document.visibilityState === "visible") {
        void loadStudentRef.current();
      }
    }
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  useEffect(() => {
    if (!data) return;
    setSelectedSubscriptionPlanId(data.student.subscriptionPlanId ?? "monthly");
    setSelectedSubscriptionEvaluationPreference(data.student.evaluationPreference ?? "team");
  }, [data]);

  async function saveExerciseLog(
    dayIndex: number,
    dayTitle: string,
    exercise: WorkoutExercise
  ) {
    const key = workoutInputKey(dayIndex, exercise.name);
    const input = workoutInputs[key] ?? { loadText: "", studentComment: "" };
    setSavingWorkoutKey(key);
    setMessage(null);
    setError(null);
    try {
      await api.saveWorkoutLog({
        loggedAt: todayDateKey(),
        dayIndex,
        dayTitle,
        exerciseName: exercise.name,
        prescription: exercise.prescription,
        loadText: input.loadText,
        studentComment: input.studentComment
      });
      setMessage("Treino registrado. A personal já consegue acompanhar sua evolução.");
      await loadStudentArea();
    } catch (err) {
      if (isUnauthorized(err)) {
        onLogout();
        return;
      }
      setError(err instanceof Error ? err.message : "Erro ao registrar treino.");
    } finally {
      setSavingWorkoutKey(null);
    }
  }

  async function scheduleEvaluationSlot() {
    if (!selectedEvaluationSlotId) {
      setError("Escolha uma data disponível para agendar.");
      return;
    }
    setMessage(null);
    setError(null);
    try {
      await api.scheduleMyEvaluation(Number(selectedEvaluationSlotId));
      setMessage("Avaliação agendada com sucesso.");
      setSelectedEvaluationSlotId("");
      await loadStudentArea();
    } catch (err) {
      if (isUnauthorized(err)) {
        onLogout();
        return;
      }
      setError(err instanceof Error ? err.message : "Erro ao agendar avaliação.");
    }
  }

  async function updateSubscription() {
    setMessage(null);
    setError(null);
    try {
      const result = await api.updateMySubscription({
        subscriptionPlanId: selectedSubscriptionPlanId,
        evaluationPreference: selectedSubscriptionEvaluationPreference
      });
      setMessage("Plano atualizado. Finalize o pagamento para liberar o acesso.");
      await loadStudentArea();
      window.location.href = result.paymentUrl;
    } catch (err) {
      if (isUnauthorized(err)) {
        onLogout();
        return;
      }
      setError(err instanceof Error ? err.message : "Erro ao atualizar plano.");
    }
  }

  async function cancelSubscription() {
    const confirmed = window.confirm("Tem certeza que deseja cancelar sua assinatura?");
    if (!confirmed) return;
    setMessage(null);
    setError(null);
    try {
      await api.cancelMySubscription();
      setMessage("Assinatura cancelada. Você pode escolher um novo plano quando quiser.");
      await loadStudentArea();
    } catch (err) {
      if (isUnauthorized(err)) {
        onLogout();
        return;
      }
      setError(err instanceof Error ? err.message : "Erro ao cancelar assinatura.");
    }
  }

  if (error) {
    return (
      <main className="page">
        <section className="panel">
          <p className="error">{error}</p>
          <button className="button secondary" onClick={onLogout} type="button">
            Sair
          </button>
        </section>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="page">
        <p className="muted">Carregando suas informações...</p>
      </main>
    );
  }

  const slots = data.slots ?? [];
  const availableSlots = data.availableSlots ?? [];
  const evaluations = data.evaluations ?? [];
  const latestEvaluation = evaluations[0] ?? null;
  const temporaryPlan =
    data.student.temporaryPlan &&
    Array.isArray(data.student.temporaryPlan.days)
      ? data.student.temporaryPlan
      : null;
  const activePlan =
    data.approvedTrainingPlan && Array.isArray(data.approvedTrainingPlan.days)
      ? data.approvedTrainingPlan
      : temporaryPlan;
  const workoutLogs = data.workoutLogs ?? [];
  const safeSelectedWorkoutDay =
    activePlan?.days.length && selectedWorkoutDay < activePlan.days.length ? selectedWorkoutDay : 0;
  const selectedDay = activePlan?.days[safeSelectedWorkoutDay] ?? null;
  const safeSelectedExerciseIndex =
    selectedDay?.exercises.length && selectedExerciseIndex < selectedDay.exercises.length
      ? selectedExerciseIndex
      : 0;
  const selectedExercise = selectedDay?.exercises[safeSelectedExerciseIndex] ?? null;
  const todayLogs = workoutLogs.filter((log) => log.loggedAt.slice(0, 10) === todayDateKey());
  const previousLogsByExercise = workoutLogs
    .filter((log) => log.loggedAt.slice(0, 10) !== todayDateKey())
    .reduce<Record<string, WorkoutLog>>((acc, log) => {
    if (!acc[log.exerciseName]) acc[log.exerciseName] = log;
    return acc;
  }, {});
  const selectedExerciseKey = selectedExercise
    ? workoutInputKey(safeSelectedWorkoutDay, selectedExercise.name)
    : "";
  const selectedExistingTodayLog = selectedExercise
    ? todayLogs.find(
        (log) => log.dayIndex === safeSelectedWorkoutDay && log.exerciseName === selectedExercise.name
      )
    : undefined;
  const selectedPreviousLog = selectedExercise ? previousLogsByExercise[selectedExercise.name] : undefined;
  const selectedExerciseHistory = selectedExercise
    ? workoutLogs.filter((log) => log.exerciseName === selectedExercise.name)
    : [];
  const selectedLatestTrainerComment = selectedExerciseHistory.find((log) => log.adminComment);
  const selectedExerciseInput = workoutInputs[selectedExerciseKey] ?? {
    loadText: selectedExistingTodayLog?.loadText ?? "",
    studentComment: selectedExistingTodayLog?.studentComment ?? ""
  };
  const hasChosenPlan = Boolean(data.student.subscriptionPlanId);
  const subscriptionActionLabel = !hasChosenPlan
    ? "Escolher plano"
    : data.student.paymentStatus === "confirmed"
      ? "Mudar plano"
      : "Atualizar plano";
  const subscriptionManager = (
    <section className="panel detail-panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Assinatura</p>
          <h2>{data.student.subscriptionPlanName ?? "Nenhum plano escolhido"}</h2>
          <p className="muted">
            Vencimento:{" "}
            {data.student.subscriptionEndsAt ? formatDate(data.student.subscriptionEndsAt) : "não definido"}
          </p>
        </div>
        <button
          className="button secondary small"
          onClick={() => setShowSubscriptionDetails(!showSubscriptionDetails)}
          type="button"
        >
          {showSubscriptionDetails ? "Ocultar assinatura" : "Ver assinatura"}
        </button>
      </div>
      {showSubscriptionDetails ? (
        <>
          <div className="warnings">
            <p>Plano atual: {data.student.subscriptionPlanName ?? "nenhum plano escolhido"}.</p>
            <p>Status da assinatura: {data.student.subscriptionStatus}.</p>
            <p>Pagamento: {data.student.paymentStatus === "confirmed" ? "confirmado" : "pendente"}.</p>
            <p>
              Vencimento do plano:{" "}
              {data.student.subscriptionEndsAt ? formatDate(data.student.subscriptionEndsAt) : "não definido"}.
            </p>
          </div>
          <fieldset className="evaluation-section">
            <legend>Planos disponíveis</legend>
            <div className="plan-choice-grid">
              {subscriptionPlans.map((plan) => (
                <label
                  className={`choice-card ${selectedSubscriptionPlanId === plan.id ? "selected" : ""}`}
                  key={plan.id}
                >
                  <input
                    checked={selectedSubscriptionPlanId === plan.id}
                    name="studentSubscriptionPlan"
                    onChange={() => setSelectedSubscriptionPlanId(plan.id)}
                    type="radio"
                  />
                  <strong>{plan.name}</strong>
                  <strong className="plan-price">{plan.price}</strong>
                  <span>{plan.duration}</span>
                  <p>{plan.description}</p>
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset className="evaluation-section">
            <legend>Avaliação</legend>
            <div className="plan-choice-grid">
              <label className={`choice-card ${selectedSubscriptionEvaluationPreference === "team" ? "selected" : ""}`}>
                <input
                  checked={selectedSubscriptionEvaluationPreference === "team"}
                  name="studentEvaluationPreference"
                  onChange={() => setSelectedSubscriptionEvaluationPreference("team")}
                  type="radio"
                />
                <strong>Fazer comigo (presencial)</strong>
                <span>
                  {selectedSubscriptionPlanId === "monthly"
                    ? `Taxa de avaliação à parte: ${evaluationFeeLabel}`
                    : "Avaliações inclusas no plano"}
                </span>
                <p>Trimestral inclui 2 avaliações e semestral inclui 3 avaliações.</p>
              </label>
              <label className={`choice-card ${selectedSubscriptionEvaluationPreference === "send_info" ? "selected" : ""}`}>
                <input
                  checked={selectedSubscriptionEvaluationPreference === "send_info"}
                  name="studentEvaluationPreference"
                  onChange={() => setSelectedSubscriptionEvaluationPreference("send_info")}
                  type="radio"
                />
                <strong>Enviar minhas informações</strong>
                <span>Sem agendar avaliação presencial agora</span>
                <p>Com o que você mandar, eu preencho sua ficha e sigo monitorando seu plano.</p>
              </label>
            </div>
          </fieldset>
          <div className="action-row">
            <button className="button primary" onClick={() => void updateSubscription()} type="button">
              {subscriptionActionLabel}
            </button>
            {data.student.subscriptionStatus === "active" ? (
              <button className="button danger" onClick={() => void cancelSubscription()} type="button">
                Cancelar assinatura
              </button>
            ) : null}
          </div>
        </>
      ) : null}
    </section>
  );

  if (data.student.paymentStatus !== "confirmed") {
    return (
      <main className="page">
        <nav className="topbar">
          <strong>Área do aluno</strong>
          <button className="button secondary small" onClick={onLogout} type="button">
            Sair
          </button>
        </nav>
        {error ? <p className="error">{error}</p> : null}
        <section className="panel result-panel">
          <p className="eyebrow">Pagamento pendente</p>
          <h1>{data.student.name}</h1>
          <p className="hero-copy">
            Seu cadastro foi recebido, mas o acesso ao site será liberado após a confirmação do pagamento
            via Mercado Pago.
          </p>
          <div className="warnings">
            <p>Plano escolhido: {data.student.subscriptionPlanName ?? "não informado"}.</p>
            <p>
              Avaliação:{" "}
              {data.student.evaluationPreference
                ? evaluationPreferenceLabels[data.student.evaluationPreference]
                : "não informada"}.
            </p>
            {data.student.evaluationFeeRequired ? (
              <p>Esse plano tem taxa de avaliação comigo (presencial).</p>
            ) : null}
          </div>
          <a className="button primary" href={`/pagamento/mercado-pago-pendente?studentId=${data.student.id}`}>
            Ir para pagamento Mercado Pago
          </a>
        </section>
        {subscriptionManager}
      </main>
    );
  }

  return (
    <main className="page">
      <nav className="topbar">
        <strong>Área do aluno</strong>
        <button className="button secondary small" onClick={onLogout} type="button">
          Sair
        </button>
      </nav>
      {message ? <p className="success">{message}</p> : null}
      {error ? <p className="error">{error}</p> : null}
      <section className="panel result-panel">
        <p className="eyebrow">Minhas informações</p>
        <h1>{data.student.name}</h1>
        <div className="info-grid">
          <div>
            <span>Status</span>
            <strong>{data.student.status}</strong>
          </div>
          <div>
            <span>Plano</span>
            <strong>{data.student.subscriptionStatus}</strong>
          </div>
          <div>
            <span>Objetivo</span>
            <strong>{data.student.goal}</strong>
          </div>
          <div>
            <span>Modalidade</span>
            <strong>{data.student.modality}</strong>
          </div>
          <div className="info-wide">
            <span>Avaliação</span>
            <strong>
              {slots[0]
                ? `${formatDateTime(slots[0].startsAt)} (${slots[0].status})`
                : latestEvaluation
                  ? `Próxima reavaliação sugerida: ${formatDate(latestEvaluation.nextEvaluationAt)}`
                  : data.student.evaluationPreference === "send_info"
                  ? "Você optou por só me enviar as medidas; eu preencho sua ficha."
                  : "Escolha uma data disponível abaixo."}
            </strong>
          </div>
        </div>
      </section>

      {subscriptionManager}

      {data.student.evaluationPreference === "team" && slots.length === 0 ? (
        <section className="panel detail-panel">
          {latestEvaluation ? (
            <>
              <p className="eyebrow">Próxima reavaliação</p>
              <h2>{formatDate(latestEvaluation.nextEvaluationAt)}</h2>
              <p className="muted">
                Sua avaliação já foi realizada. Quando chegar perto dessa data, a gente combina o horário.
              </p>
            </>
          ) : (
          <>
          <p className="eyebrow">Agendamento de avaliação</p>
          <h2>Escolha um horário</h2>
          {availableSlots.length === 0 ? (
            <p className="muted">
              Não há dias disponíveis no momento. Te chamo no WhatsApp e a gente acha um horário.
            </p>
          ) : (
            <div className="field-row">
              <label className="field">
                <span>Datas disponíveis</span>
                <select
                  value={selectedEvaluationSlotId}
                  onChange={(event) => setSelectedEvaluationSlotId(event.target.value)}
                >
                  <option value="">Selecione uma data</option>
                  {availableSlots.map((slot) => (
                    <option key={slot.id} value={slot.id}>
                      {formatDateTime(slot.startsAt)} até {formatDateTime(slot.endsAt)}
                      {slot.notes ? ` - ${slot.notes}` : ""}
                    </option>
                  ))}
                </select>
              </label>
              <button className="button primary small" onClick={() => void scheduleEvaluationSlot()} type="button">
                Agendar avaliação
              </button>
            </div>
          )}
          </>
          )}
        </section>
      ) : null}

      {selectedDay ? (
        <section className="panel detail-panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">
                {data.approvedTrainingPlan ? "Treino aprovado pela personal" : "Treino provisório"}
              </p>
              <h2>{activePlan?.headline}</h2>
              <p className="muted">{activePlan?.weeklyFrequency} · {activePlan?.intensity}</p>
            </div>
            <button
              className="button secondary small"
              onClick={() => setShowWorkoutDetails(!showWorkoutDetails)}
              type="button"
            >
              {showWorkoutDetails ? "Ocultar treino" : "Ver treino"}
            </button>
          </div>
          {showWorkoutDetails ? (
          <>
          <p className="muted">{activePlan?.summary}</p>
          <div className="workout-tabs">
            {(activePlan?.days ?? []).map((day, index) => (
              <button
                className={`button small ${safeSelectedWorkoutDay === index ? "primary" : "secondary"}`}
                key={`${day.title}-${index}`}
                onClick={() => {
                  setSelectedWorkoutDay(index);
                  setSelectedExerciseIndex(0);
                }}
                type="button"
              >
                {workoutDayLabel(index)}
              </button>
            ))}
          </div>
          <h3>{workoutDayLabel(safeSelectedWorkoutDay)}</h3>
          <p className="muted">
            {selectedDay.focus}. Registre a carga usada e sua percepção para a personal acompanhar sua
            progressão.
          </p>
          <div className="action-row">
            <button
              className="button secondary small"
              onClick={() => setShowFullWorkoutHistory(!showFullWorkoutHistory)}
              type="button"
            >
              {showFullWorkoutHistory ? "Ocultar histórico completo" : "Ver histórico completo de treinos"}
            </button>
          </div>
          {showFullWorkoutHistory ? (
            <div className="full-history">
              <h3>Histórico completo de cargas e comentários</h3>
              {workoutLogs.length === 0 ? (
                <p className="muted">Nenhum registro salvo ainda.</p>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Data</th>
                        <th>Treino</th>
                        <th>Exercício</th>
                        <th>Carga</th>
                        <th>Comentário do aluno</th>
                        <th>Comentário da personal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {workoutLogs.map((log) => (
                        <tr key={log.id}>
                          <td>{formatDate(log.loggedAt)}</td>
                          <td>{workoutDayLabel(log.dayIndex)}</td>
                          <td>{log.exerciseName}</td>
                          <td>{log.loadText || "não informada"}</td>
                          <td>{log.studentComment || "sem comentário"}</td>
                          <td>{log.adminComment || "sem comentário"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : null}
          <div className="exercise-tabs">
            {selectedDay.exercises.map((exercise, index) => (
              <button
                className={`button small ${safeSelectedExerciseIndex === index ? "primary" : "secondary"}`}
                key={`${exercise.name}-${index}`}
                onClick={() => setSelectedExerciseIndex(index)}
                type="button"
              >
                {exercise.name}
              </button>
            ))}
          </div>
          {selectedExercise ? (
            <article className="exercise-log-card">
              <div>
                <h3>{selectedExercise.name}</h3>
                <p className="muted">{selectedExercise.prescription}</p>
                {selectedExercise.notes ? <p className="note">{selectedExercise.notes}</p> : null}
                <ExerciseDemo name={selectedExercise.name} />
                <div className="previous-log">
                  <span>Registro anterior</span>
                  {selectedPreviousLog ? (
                    <>
                      <strong>
                        {selectedPreviousLog.loadText || "sem carga"} em{" "}
                        {formatDate(selectedPreviousLog.loggedAt)}
                      </strong>
                      <p>{selectedPreviousLog.studentComment || "sem comentário do aluno"}</p>
                      {selectedPreviousLog.adminComment ? (
                        <p>Comentário da personal: {selectedPreviousLog.adminComment}</p>
                      ) : null}
                    </>
                  ) : (
                    <p>Nenhum registro anterior para este exercício.</p>
                  )}
                </div>
                {selectedLatestTrainerComment?.adminComment ? (
                  <p className="trainer-comment">
                    Comentário mais recente da personal: {selectedLatestTrainerComment.adminComment}
                  </p>
                ) : null}
              </div>
              <div className="exercise-log-fields">
                <label className="field">
                  <span>Carga usada hoje</span>
                  <input
                    placeholder="Ex.: 20 kg, halter 8 kg, 6x50m..."
                    value={selectedExerciseInput.loadText}
                    onChange={(event) =>
                      setWorkoutInputs({
                        ...workoutInputs,
                        [selectedExerciseKey]: { ...selectedExerciseInput, loadText: event.target.value }
                      })
                    }
                  />
                </label>
                <label className="field">
                  <span>Comentário do exercício</span>
                  <textarea
                    placeholder="Ex.: senti fácil, dor no joelho, quero trocar..."
                    value={selectedExerciseInput.studentComment}
                    onChange={(event) =>
                      setWorkoutInputs({
                        ...workoutInputs,
                        [selectedExerciseKey]: {
                          ...selectedExerciseInput,
                          studentComment: event.target.value
                        }
                      })
                    }
                  />
                </label>
                <button
                  className="button primary small"
                  disabled={savingWorkoutKey === selectedExerciseKey}
                  onClick={() => void saveExerciseLog(safeSelectedWorkoutDay, selectedDay.title, selectedExercise)}
                  type="button"
                >
                  {savingWorkoutKey === selectedExerciseKey ? "Salvando..." : "Salvar exercício"}
                </button>
                <button
                  className="button secondary small"
                  onClick={() =>
                    setOpenExerciseHistory({
                      ...openExerciseHistory,
                      [selectedExerciseKey]: !openExerciseHistory[selectedExerciseKey]
                    })
                  }
                  type="button"
                >
                  {openExerciseHistory[selectedExerciseKey] ? "Ocultar histórico" : "Ver histórico"}
                </button>
              </div>
              {openExerciseHistory[selectedExerciseKey] ? (
                <div className="exercise-history">
                  <h4>Histórico completo</h4>
                  {selectedExerciseHistory.length === 0 ? (
                    <p className="muted">Nenhum registro salvo ainda.</p>
                  ) : (
                    selectedExerciseHistory.map((log) => (
                      <div key={log.id}>
                        <strong>{formatDate(log.loggedAt)}</strong>
                        <span>Carga: {log.loadText || "não informada"}</span>
                        <p>{log.studentComment || "sem comentário do aluno"}</p>
                        {log.adminComment ? <em>Personal: {log.adminComment}</em> : null}
                      </div>
                    ))
                  )}
                </div>
              ) : null}
            </article>
          ) : null}
          </>
          ) : null}
        </section>
      ) : null}

      {!activePlan ? (
        <section className="panel detail-panel">
          <p className="eyebrow">Treino provisório</p>
          <h2>Treino ainda não disponível</h2>
          <p className="muted">
            Recebi seu cadastro. Em breve entro em contato e libero seu treino e as orientações por aqui.
          </p>
        </section>
      ) : null}

      <section className="panel detail-panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Avaliações</p>
            <h2>
              {latestEvaluation
                ? `Última avaliação: ${formatDate(latestEvaluation.evaluatedAt)}`
                : "Nenhuma avaliação registrada"}
            </h2>
            <p className="muted">
              {latestEvaluation
                ? `Próxima reavaliação: ${formatDate(latestEvaluation.nextEvaluationAt)}`
                : "Quando eu registrar sua avaliação, ela aparece aqui."}
            </p>
          </div>
          <button
            className="button secondary small"
            onClick={() => setShowEvaluationsPanel(!showEvaluationsPanel)}
            type="button"
          >
            {showEvaluationsPanel ? "Ocultar avaliações" : "Ver avaliações"}
          </button>
        </div>
        {showEvaluationsPanel ? (
        evaluations.length === 0 ? (
          <p className="muted">Nenhuma avaliação registrada ainda.</p>
        ) : (
          <>
            {latestEvaluation ? (
              <div className="latest-evaluation">
                <div className="section-heading">
                  <div>
                    <p className="eyebrow">Última avaliação</p>
                    <h3>{formatDate(latestEvaluation.evaluatedAt)}</h3>
                  </div>
                  <div>
                    <span>Próxima reavaliação</span>
                    <strong>{formatDate(latestEvaluation.nextEvaluationAt)}</strong>
                  </div>
                </div>
                <button
                  className="button secondary small"
                  onClick={() => setShowEvaluationDetails(!showEvaluationDetails)}
                  type="button"
                >
                  {showEvaluationDetails ? "Ocultar informações" : "Ver informações da avaliação"}
                </button>
                {showEvaluationDetails ? (
                  <div className="evaluation-details">
                    <div className="info-grid">
                      <div>
                        <span>Peso</span>
                        <strong>{evaluationValue(latestEvaluation.weightKg, " kg")}</strong>
                      </div>
                      <div>
                        <span>IMC</span>
                        <strong>{evaluationValue(latestEvaluation.bmi)}</strong>
                      </div>
                      <div>
                        <span>Gordura corporal</span>
                        <strong>{evaluationValue(latestEvaluation.bodyFatPercent, "%")}</strong>
                      </div>
                      <div>
                        <span>Massa magra</span>
                        <strong>{evaluationValue(latestEvaluation.leanMassKg, " kg")}</strong>
                      </div>
                      <div>
                        <span>Massa muscular</span>
                        <strong>{evaluationValue(latestEvaluation.muscleMassKg, " kg")}</strong>
                      </div>
                      <div>
                        <span>Gordura visceral</span>
                        <strong>{evaluationValue(latestEvaluation.visceralFat)}</strong>
                      </div>
                      <div>
                        <span>Pressão arterial</span>
                        <strong>{evaluationValue(latestEvaluation.bloodPressure)}</strong>
                      </div>
                      <div>
                        <span>Frequência de repouso</span>
                        <strong>{evaluationValue(latestEvaluation.restingHeartRate, " bpm")}</strong>
                      </div>
                    </div>
                    <div className="measurement-grid">
                      <div>
                        <span>Cintura</span>
                        <strong>{evaluationValue(latestEvaluation.waistCm, " cm")}</strong>
                      </div>
                      <div>
                        <span>Abdômen</span>
                        <strong>{evaluationValue(latestEvaluation.abdomenCm, " cm")}</strong>
                      </div>
                      <div>
                        <span>Quadril</span>
                        <strong>{evaluationValue(latestEvaluation.hipCm, " cm")}</strong>
                      </div>
                      <div>
                        <span>Braço dir. relaxado</span>
                        <strong>{evaluationValue(latestEvaluation.rightArmRelaxedCm, " cm")}</strong>
                      </div>
                      <div>
                        <span>Braço esq. relaxado</span>
                        <strong>{evaluationValue(latestEvaluation.leftArmRelaxedCm, " cm")}</strong>
                      </div>
                      <div>
                        <span>Braço dir. contraído</span>
                        <strong>{evaluationValue(latestEvaluation.rightArmContractedCm, " cm")}</strong>
                      </div>
                      <div>
                        <span>Braço esq. contraído</span>
                        <strong>{evaluationValue(latestEvaluation.leftArmContractedCm, " cm")}</strong>
                      </div>
                      <div>
                        <span>Coxa direita</span>
                        <strong>{evaluationValue(latestEvaluation.rightThighCm, " cm")}</strong>
                      </div>
                      <div>
                        <span>Coxa esquerda</span>
                        <strong>{evaluationValue(latestEvaluation.leftThighCm, " cm")}</strong>
                      </div>
                      <div>
                        <span>Panturrilha direita</span>
                        <strong>{evaluationValue(latestEvaluation.rightCalfCm, " cm")}</strong>
                      </div>
                      <div>
                        <span>Panturrilha esquerda</span>
                        <strong>{evaluationValue(latestEvaluation.leftCalfCm, " cm")}</strong>
                      </div>
                    </div>
                    {latestEvaluation.notes ? (
                      <p className="note">Observações da personal: {latestEvaluation.notes}</p>
                    ) : null}
                    {latestEvaluation.posturalNotes ? (
                      <p className="note">Análise postural: {latestEvaluation.posturalNotes}</p>
                    ) : null}
                    {latestEvaluation.movementLimitations ? (
                      <p className="note">
                        Limitações de movimento / dores: {latestEvaluation.movementLimitations}
                      </p>
                    ) : null}
                    {latestEvaluation.professionalRecommendations ? (
                      <p className="note">
                        Recomendações da personal: {latestEvaluation.professionalRecommendations}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}
            <h3>Histórico de avaliações</h3>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Próxima reavaliação</th>
                    <th>Resumo</th>
                  </tr>
                </thead>
                <tbody>
                  {evaluations.map((item) => (
                    <tr key={`${item.evaluatedAt}-${item.nextEvaluationAt}`}>
                      <td>{formatDate(item.evaluatedAt)}</td>
                      <td>{formatDate(item.nextEvaluationAt)}</td>
                      <td>{item.notes || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )
        ) : null}
      </section>
    </main>
  );
}

function BrandLogo({ onGoHome }: { onGoHome?: () => void }) {
  const img = (
    <img
      className="topbar-brand__img"
      src="/brand/pamela-mendes-logo.png"
      alt="Pâmela Mendes — Personal Trainer"
      width={158}
      height={186}
      loading="eager"
      decoding="async"
    />
  );
  if (onGoHome) {
    return (
      <button type="button" className="topbar-brand topbar-brand--click" onClick={onGoHome}>
        {img}
      </button>
    );
  }
  return <div className="topbar-brand">{img}</div>;
}

function PublicSite({ setView }: { setView: (view: View) => void }) {
  return (
    <main className="page">
      <nav className="topbar">
        <BrandLogo />
        <div className="action-row">
          <button className="button secondary small" onClick={() => setView("student")} type="button">
            Área do aluno
          </button>
          <button className="button secondary small" onClick={() => setView("admin")} type="button">
            Login admin
          </button>
        </div>
      </nav>
      <section className="hero">
        <div>
          <h1>Cadastro, primeiro treino e avaliação comigo.</h1>
          <p className="hero-copy">
            Você preenche a ficha, recebe um treino base para começar com segurança e a gente agenda sua
            avaliação. Depois que eu te avaliar, monto o seu treino completo, do jeito que você precisa.
          </p>
          <div className="hero-actions">
            <button className="button primary" onClick={() => setView("register")} type="button">
              Fazer cadastro
            </button>
            <a className="button android" href="/downloads/pamela-mendes-personal.apk" download="pamela-mendes-personal.apk">
              Baixar APK Android
            </a>
            <button className="button secondary" onClick={() => setView("admin")} type="button">
              Área admin
            </button>
            <button className="button secondary" onClick={() => setView("student")} type="button">
              Já sou aluno
            </button>
          </div>
          <div className="android-install-help">
            <strong>Como instalar no Android:</strong>
            <span>
              Baixe o APK, abra o arquivo baixado, permita instalar apps desta fonte e toque em
              Instalar. Depois procure por <b>Pâmela Mendes Personal</b> na tela de apps.
            </span>
          </div>
        </div>
        <div className="hero-rail">
          <figure className="hero-portrait">
            <img
              src="/photos/pamela-mendes-hero.png"
              alt="Pâmela Mendes, personal trainer, no ginásio"
              width={720}
              height={480}
              loading="eager"
              decoding="async"
            />
          </figure>
          <aside className="hero-card">
            <span className="pill">Como funciona</span>
            <h2>Seu acompanhamento</h2>
            <p>
              Cadastro e escolha do plano, treino inicial, avaliação comigo, plano completo e reavaliação
              a cada 3 meses. Tudo alinhado ao que combinarmos.
            </p>
          </aside>
        </div>
      </section>
    </main>
  );
}

function SessionLoading({ label }: { label: string }) {
  return (
    <section className="center-screen">
      <p className="panel login-panel" style={{ textAlign: "center" }}>
        {label}
      </p>
    </section>
  );
}

export default function App() {
  const [view, setView] = useState<View>(() => readStoredView());
  const [admin, setAdmin] = useState<AdminSession | null>(null);
  const [adminMode, setAdminMode] = useState<"loading" | "login" | "panel">("loading");
  const [studentMode, setStudentMode] = useState<"loading" | "login" | "area">("loading");

  useEffect(() => {
    persistView(view);
  }, [view]);

  useEffect(() => {
    if (view !== "admin") return;
    let cancelled = false;
    setAdminMode("loading");
    const token = getToken();
    if (!token) {
      setAdmin(null);
      setAdminMode("login");
      return;
    }
    void api
      .adminMe()
      .then((session) => {
        if (cancelled) return;
        setAdmin(session);
        setAdminMode("panel");
      })
      .catch(() => {
        if (cancelled) return;
        setToken(null);
        setAdmin(null);
        setAdminMode("login");
      });
    return () => {
      cancelled = true;
    };
  }, [view]);

  useEffect(() => {
    if (view !== "student") return;
    let cancelled = false;
    setStudentMode("loading");
    const token = getStudentToken();
    if (!token) {
      setStudentMode("login");
      return;
    }
    void api
      .studentMe()
      .then(() => {
        if (cancelled) return;
        setStudentMode("area");
      })
      .catch(() => {
        if (cancelled) return;
        setStudentToken(null);
        setStudentMode("login");
      });
    return () => {
      cancelled = true;
    };
  }, [view]);

  if (view === "admin") {
    if (adminMode === "loading") return <SessionLoading label="Verificando sessão administrativa…" />;
    if (adminMode === "login") {
      return (
        <AdminLogin
          onLogin={(session) => {
            setAdmin(session);
            setAdminMode("panel");
          }}
        />
      );
    }
    if (admin) {
      return (
        <AdminPanel
          admin={admin}
          onLogout={() => {
            setToken(null);
            setAdmin(null);
            setView("home");
          }}
        />
      );
    }
    return (
      <AdminLogin
        onLogin={(session) => {
          setAdmin(session);
          setAdminMode("panel");
        }}
      />
    );
  }

  if (view === "student") {
    if (studentMode === "loading") return <SessionLoading label="Verificando sessão do aluno…" />;
    if (studentMode === "login") {
      return <StudentLogin onLogin={() => setStudentMode("area")} />;
    }
    return (
      <StudentArea
        onLogout={() => {
          setStudentToken(null);
          setView("home");
        }}
      />
    );
  }

  if (view === "register") {
    return (
      <main className="page">
        <nav className="topbar">
          <BrandLogo onGoHome={() => setView("home")} />
          <div className="action-row">
            <button className="button secondary small" onClick={() => setView("home")} type="button">
              Voltar
            </button>
            <button className="button secondary small" onClick={() => setView("admin")} type="button">
              Login admin
            </button>
          </div>
        </nav>
        <StudentForm mode="public" />
      </main>
    );
  }

  return <PublicSite setView={setView} />;
}

