export type TrainingModality =
  | "musculacao"
  | "natacao"
  | "corrida"
  | "funcional"
  | "mobilidade";

export type Goal =
  | "emagrecimento"
  | "hipertrofia"
  | "condicionamento"
  | "saude"
  | "performance";

export type Experience = "iniciante" | "intermediario" | "avancado";

export type InjuryProfile =
  | "nenhuma"
  | "joelho"
  | "ombro"
  | "coluna"
  | "cardiaca"
  | "outra";

export type UserProfile = {
  name: string;
  age: number;
  heightCm: number;
  weightKg: number;
  goal: Goal;
  modality: TrainingModality;
  experience: Experience;
  availableDays: number;
  sessionMinutes: number;
  injury: InjuryProfile;
};

export type WorkoutExercise = {
  name: string;
  prescription: string;
  notes?: string;
};

export type WorkoutDay = {
  title: string;
  focus: string;
  warmup: string;
  exercises: WorkoutExercise[];
  cooldown: string;
};

export type TrainingPlan = {
  headline: string;
  summary: string;
  intensity: string;
  weeklyFrequency: string;
  warnings: string[];
  days: WorkoutDay[];
};
