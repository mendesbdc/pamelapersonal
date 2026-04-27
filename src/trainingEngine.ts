import type {
  Experience,
  Goal,
  TrainingModality,
  TrainingPlan,
  UserProfile,
  WorkoutDay,
  WorkoutExercise
} from "./types";

const goalLabels: Record<Goal, string> = {
  emagrecimento: "emagrecimento",
  hipertrofia: "hipertrofia",
  condicionamento: "condicionamento",
  saude: "saúde e rotina",
  performance: "performance"
};

const modalityLabels: Record<TrainingModality, string> = {
  musculacao: "musculação",
  natacao: "natação",
  corrida: "corrida",
  funcional: "funcional",
  mobilidade: "mobilidade"
};

const intensityByExperience: Record<Experience, string> = {
  iniciante: "leve a moderada, priorizando técnica e adaptação",
  intermediario: "moderada, com progressão semanal controlada",
  avancado: "moderada a alta, com maior volume e variação de estímulos"
};

const setSchemeByExperience: Record<Experience, string> = {
  iniciante: "2 a 3 séries de 10 a 12 repetições",
  intermediario: "3 a 4 séries de 8 a 12 repetições",
  avancado: "4 séries de 6 a 12 repetições"
};

function limitDays(days: number) {
  return Math.min(6, Math.max(2, days));
}

function shouldReduceImpact(profile: UserProfile) {
  return profile.injury === "joelho" || profile.injury === "coluna" || profile.age >= 55;
}

function buildWarnings(profile: UserProfile) {
  const warnings = [
    "Este treino é uma sugestão inicial e não substitui avaliação presencial de um profissional.",
    "Dor aguda, tontura, falta de ar incomum ou desconforto no peito exigem interrupção imediata."
  ];

  if (profile.injury !== "nenhuma") {
    warnings.push(
      "Como você informou limitação ou lesão, adapte amplitudes, cargas e impacto antes de executar."
    );
  }

  if (profile.injury === "cardiaca") {
    warnings.push(
      "Com histórico cardíaco, treinos de alta intensidade devem ser liberados por médico."
    );
  }

  return warnings;
}

function goalModifier(goal: Goal) {
  switch (goal) {
    case "emagrecimento":
      return "descanso curto, ritmo contínuo e maior gasto calórico";
    case "hipertrofia":
      return "controle de carga, execução lenta e progressão semanal";
    case "condicionamento":
      return "blocos intervalados e melhora cardiorrespiratória";
    case "performance":
      return "qualidade técnica, velocidade controlada e recuperação adequada";
    case "saude":
      return "regularidade, mobilidade e intensidade sustentável";
  }
}

function rotate<T>(items: T[], count: number) {
  return Array.from({ length: count }, (_, index) => items[index % items.length]);
}

function withInjuryNote(exercise: WorkoutExercise, profile: UserProfile): WorkoutExercise {
  if (profile.injury === "joelho" && /agachamento|avanço|corrida|saltos/i.test(exercise.name)) {
    return { ...exercise, notes: "Reduza amplitude e evite dor no joelho." };
  }
  if (profile.injury === "ombro" && /supino|desenvolvimento|braçada|remada/i.test(exercise.name)) {
    return { ...exercise, notes: "Use carga leve e amplitude confortável para o ombro." };
  }
  if (profile.injury === "coluna" && /terra|prancha|remada|corrida/i.test(exercise.name)) {
    return { ...exercise, notes: "Mantenha coluna neutra e evite compensações." };
  }
  return exercise;
}

function isMultiJointExercise(exercise: WorkoutExercise) {
  return /agachamento|leg press|supino|remada|puxada|desenvolvimento|terra|avanço|flexão|farmer|circuito|emom|crawl|série contínua|bloco principal|intervalado/i.test(
    exercise.name
  );
}

function prioritizeMultiJoint(exercises: WorkoutExercise[], profile: UserProfile) {
  return exercises
    .map((exercise, index) => {
      const withNote = withInjuryNote(exercise, profile);
      if (!isMultiJointExercise(withNote)) {
        return { ...withNote, order: index, priority: 1 };
      }

      const priorityNote = "Multiarticular: execute no começo do treino.";
      return {
        ...withNote,
        notes: withNote.notes ? `${priorityNote} ${withNote.notes}` : priorityNote,
        order: index,
        priority: 0
      };
    })
    .sort((a, b) => a.priority - b.priority || a.order - b.order)
    .map(({ order: _order, priority: _priority, ...exercise }) => exercise);
}

function muscularDays(profile: UserProfile): WorkoutDay[] {
  const scheme = setSchemeByExperience[profile.experience];
  const templates: WorkoutDay[] = [
    {
      title: "Treino A",
      focus: "membros inferiores e core",
      warmup: "8 minutos de caminhada leve + mobilidade de quadril e tornozelo",
      exercises: [
        { name: "Agachamento guiado ou livre", prescription: scheme },
        { name: "Leg press", prescription: scheme },
        { name: "Cadeira extensora", prescription: "3 séries de 12 a 15 repetições" },
        { name: "Mesa flexora", prescription: "3 séries de 10 a 12 repetições" },
        { name: "Elevação pélvica", prescription: "3 séries de 12 repetições" },
        { name: "Prancha", prescription: "3 séries de 20 a 45 segundos" }
      ],
      cooldown: "5 minutos de alongamento leve para pernas"
    },
    {
      title: "Treino B",
      focus: "peito, costas, ombros e braços",
      warmup: "6 minutos de ergômetro + ativação escapular",
      exercises: [
        { name: "Supino máquina ou halteres", prescription: scheme },
        { name: "Remada baixa", prescription: scheme },
        { name: "Puxada frontal", prescription: "3 séries de 10 a 12 repetições" },
        { name: "Desenvolvimento de ombros", prescription: "3 séries de 10 repetições" },
        { name: "Rosca direta", prescription: "3 séries de 12 repetições" },
        { name: "Tríceps corda", prescription: "3 séries de 12 repetições" }
      ],
      cooldown: "Respiração controlada + mobilidade de ombro"
    },
    {
      title: "Treino C",
      focus: "corpo inteiro e condicionamento",
      warmup: "10 minutos de bicicleta em ritmo confortável",
      exercises: [
        { name: "Levantamento terra romeno", prescription: "3 séries de 8 a 10 repetições" },
        { name: "Avanço alternado", prescription: "3 séries de 10 repetições por perna" },
        { name: "Remada unilateral", prescription: "3 séries de 10 repetições por lado" },
        { name: "Flexão inclinada", prescription: "3 séries de 8 a 12 repetições" },
        { name: "Farmer walk", prescription: "4 caminhadas de 30 metros" },
        { name: "Bike ou elíptico", prescription: "12 a 20 minutos em zona moderada" }
      ],
      cooldown: "Alongamento global por 5 minutos"
    }
  ];

  return rotate(templates, limitDays(profile.availableDays)).map((day) => ({
    ...day,
    exercises: prioritizeMultiJoint(day.exercises, profile)
  }));
}

function swimDays(profile: UserProfile): WorkoutDay[] {
  const mainVolume =
    profile.experience === "iniciante"
      ? "6 a 10 tiros de 25m"
      : profile.experience === "intermediario"
        ? "8 a 12 tiros de 50m"
        : "10 a 16 tiros de 50m a 100m";

  const templates: WorkoutDay[] = [
    {
      title: "Piscina A",
      focus: "técnica e respiração",
      warmup: "200m leve alternando crawl e costas",
      exercises: [
        { name: "Educativo de pernada", prescription: "6x25m com descanso de 30s" },
        { name: "Educativo de braçada", prescription: "6x25m com foco na entrada da mão" },
        { name: "Crawl principal", prescription: mainVolume },
        { name: "Nado solto", prescription: "100m a 200m leve" }
      ],
      cooldown: "100m bem leve + mobilidade de ombros fora da água"
    },
    {
      title: "Piscina B",
      focus: "resistência aeróbica",
      warmup: "300m leve em ritmo confortável",
      exercises: [
        { name: "Série contínua", prescription: "10 a 25 minutos em ritmo sustentável" },
        { name: "Intervalado moderado", prescription: "6x50m com 40s de descanso" },
        { name: "Técnica de respiração bilateral", prescription: "8x25m" }
      ],
      cooldown: "100m solto"
    }
  ];

  return rotate(templates, limitDays(profile.availableDays)).map((day) => ({
    ...day,
    exercises: prioritizeMultiJoint(day.exercises, profile)
  }));
}

function runDays(profile: UserProfile): WorkoutDay[] {
  const lowImpact = shouldReduceImpact(profile);
  const baseRun = lowImpact
    ? "caminhada inclinada ou bike em vez de corrida contínua"
    : profile.experience === "iniciante"
      ? "alternar 2min caminhando + 1min trotando por 20 a 30min"
      : profile.experience === "intermediario"
        ? "30 a 45min em ritmo confortável"
        : "45 a 60min com controle de zona";

  const templates: WorkoutDay[] = [
    {
      title: "Corrida A",
      focus: "base aeróbica",
      warmup: "8 minutos de caminhada + mobilidade de tornozelo e quadril",
      exercises: [
        { name: "Bloco principal", prescription: baseRun },
        { name: "Técnica de corrida", prescription: lowImpact ? "pular drills de impacto" : "4x30m educativos leves" },
        { name: "Core anti-rotação", prescription: "3 séries de 20 a 30 segundos por lado" }
      ],
      cooldown: "5 a 8 minutos caminhando"
    },
    {
      title: "Corrida B",
      focus: "intervalos controlados",
      warmup: "10 minutos bem leve",
      exercises: [
        {
          name: "Intervalado",
          prescription: lowImpact
            ? "8 a 12 blocos de 1min forte + 1min leve na bike"
            : "6 a 10 blocos de 1min forte + 2min leve"
        },
        { name: "Fortalecimento de panturrilha", prescription: "3 séries de 15 repetições" },
        { name: "Ponte de glúteo", prescription: "3 séries de 12 repetições" }
      ],
      cooldown: "Caminhada leve e alongamento de panturrilha"
    }
  ];

  return rotate(templates, limitDays(profile.availableDays)).map((day) => ({
    ...day,
    exercises: prioritizeMultiJoint(day.exercises, profile)
  }));
}

function functionalDays(profile: UserProfile): WorkoutDay[] {
  const impact = shouldReduceImpact(profile) ? "sem saltos" : "com saltos baixos opcionais";
  const templates: WorkoutDay[] = [
    {
      title: "Funcional A",
      focus: "força geral e gasto calórico",
      warmup: "8 minutos de mobilidade dinâmica",
      exercises: [
        { name: "Circuito 1", prescription: `3 a 5 voltas: agachamento, remada elástica, prancha e polichinelo ${impact}` },
        { name: "Circuito 2", prescription: "3 voltas: avanço, flexão inclinada, abdominal dead bug" },
        { name: "Cardio final", prescription: "8 a 12 minutos moderados" }
      ],
      cooldown: "Alongamento leve e respiração"
    },
    {
      title: "Funcional B",
      focus: "condicionamento e estabilidade",
      warmup: "10 minutos com caminhada e mobilidade",
      exercises: [
        { name: "EMOM adaptado", prescription: "12 minutos alternando pernas, empurrar, puxar e core" },
        { name: "Farmer walk ou mochila carregada", prescription: "5x30 segundos" },
        { name: "Mobilidade ativa", prescription: "8 minutos" }
      ],
      cooldown: "Respiração nasal por 3 minutos"
    }
  ];

  return rotate(templates, limitDays(profile.availableDays)).map((day) => ({
    ...day,
    exercises: prioritizeMultiJoint(day.exercises, profile)
  }));
}

function mobilityDays(profile: UserProfile): WorkoutDay[] {
  const templates: WorkoutDay[] = [
    {
      title: "Mobilidade A",
      focus: "coluna, quadril e respiração",
      warmup: "5 minutos de respiração diafragmática",
      exercises: [
        { name: "Cat-cow", prescription: "2 séries de 8 a 10 repetições" },
        { name: "Mobilidade de quadril 90/90", prescription: "3 séries de 45 segundos por lado" },
        { name: "Alongamento de posterior", prescription: "3 séries de 30 segundos por lado" },
        { name: "Dead bug", prescription: "3 séries de 8 repetições por lado" }
      ],
      cooldown: "Relaxamento guiado por 3 minutos"
    },
    {
      title: "Mobilidade B",
      focus: "ombros, tornozelos e postura",
      warmup: "Caminhada leve por 5 minutos",
      exercises: [
        { name: "Wall slide", prescription: "3 séries de 10 repetições" },
        { name: "Mobilidade torácica", prescription: "3 séries de 8 repetições por lado" },
        { name: "Mobilidade de tornozelo", prescription: "3 séries de 12 repetições por lado" },
        { name: "Prancha lateral", prescription: "3 séries de 20 segundos por lado" }
      ],
      cooldown: "Alongamento leve de pescoço e peitoral"
    }
  ];

  return rotate(templates, limitDays(profile.availableDays)).map((day) => ({
    ...day,
    exercises: prioritizeMultiJoint(day.exercises, profile)
  }));
}

function daysFor(profile: UserProfile) {
  switch (profile.modality) {
    case "musculacao":
      return muscularDays(profile);
    case "natacao":
      return swimDays(profile);
    case "corrida":
      return runDays(profile);
    case "funcional":
      return functionalDays(profile);
    case "mobilidade":
      return mobilityDays(profile);
  }
}

export function generateTrainingPlan(profile: UserProfile): TrainingPlan {
  const days = daysFor(profile);
  const bmi = profile.weightKg / Math.pow(profile.heightCm / 100, 2);
  const bmiHint =
    bmi >= 30
      ? "começar com impacto reduzido e progressão mais gradual"
      : bmi < 18.5
        ? "priorizar força, recuperação e ingestão adequada"
        : "manter progressão semanal moderada";

  return {
    headline: `Plano de ${modalityLabels[profile.modality]} para ${goalLabels[profile.goal]}`,
    summary: `${profile.name || "Aluno(a)"}, seu plano foi montado para ${limitDays(
      profile.availableDays
    )} dias por semana, sessões de aproximadamente ${profile.sessionMinutes} minutos, com foco em ${goalModifier(
      profile.goal
    )}. Pelo seu perfil, a recomendação inicial é ${bmiHint}.`,
    intensity: intensityByExperience[profile.experience],
    weeklyFrequency: `${limitDays(profile.availableDays)}x por semana`,
    warnings: buildWarnings(profile),
    days
  };
}
