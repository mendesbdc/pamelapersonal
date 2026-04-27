import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import bcrypt from "bcryptjs";
import mysql from "mysql2/promise";

const config = {
  host: process.env.DB_HOST ?? "127.0.0.1",
  port: Number(process.env.DB_PORT ?? 3306),
  user: process.env.DB_USER ?? "root",
  password: process.env.DB_PASSWORD ?? "",
  multipleStatements: true
};

const schemaPath = resolve("db", "schema.sql");
const schema = await readFile(schemaPath, "utf8");

console.log("Conectando no MySQL/MariaDB...");
console.log(`Host: ${config.host}:${config.port}`);
console.log(`Usuario: ${config.user}`);
console.log("Senha: vazia");

const connection = await mysql.createConnection(config);

async function columnExists(table, column) {
  const [rows] = await connection.query(
    `SELECT COUNT(*) AS total
       FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = 'pamelapersonal'
        AND TABLE_NAME = ?
        AND COLUMN_NAME = ?`,
    [table, column]
  );
  return Number(rows[0]?.total ?? 0) > 0;
}

async function addColumnIfMissing(table, column, definition) {
  if (await columnExists(table, column)) return;
  await connection.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
  console.log(`Coluna adicionada: ${table}.${column}`);
}

async function ensureSessionTriggers() {
  await connection.query("DROP TRIGGER IF EXISTS tr_students_bump_session");
  await connection.query("DROP TRIGGER IF EXISTS tr_admins_bump_session");
  await connection.query(`
CREATE TRIGGER tr_students_bump_session
BEFORE UPDATE ON students
FOR EACH ROW
BEGIN
  IF NOT (NEW.username <=> OLD.username) OR NOT (NEW.password_hash <=> OLD.password_hash) THEN
    SET NEW.session_version = COALESCE(OLD.session_version, 1) + 1;
  END IF;
END
`);
  await connection.query(`
CREATE TRIGGER tr_admins_bump_session
BEFORE UPDATE ON admins
FOR EACH ROW
BEGIN
  IF NOT (NEW.username <=> OLD.username) OR NOT (NEW.password_hash <=> OLD.password_hash) THEN
    SET NEW.session_version = COALESCE(OLD.session_version, 1) + 1;
  END IF;
END
`);
  console.log("Triggers de sessao (usuario/senha) criados.");
}

async function seedAdmin() {
  const username = String(process.env.ADMIN_USERNAME ?? "pamelapersonal").trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD ?? "Mari@1805";
  const name = process.env.ADMIN_NAME ?? "Pâmela Mendes Personal";
  const [byUsername] = await connection.query(
    "SELECT id FROM `pamelapersonal`.`admins` WHERE username = ? LIMIT 1",
    [username]
  );
  if (byUsername.length) {
    console.log(`Admin principal ja existe (usuario: ${username}).`);
    return;
  }
  const passwordHash = await bcrypt.hash(password, 10);
  const [legacy] = await connection.query(
    "SELECT id FROM `pamelapersonal`.`admins` WHERE username IS NULL OR username = '' ORDER BY id ASC LIMIT 1"
  );
  if (legacy.length) {
    await connection.query(
      `UPDATE \`pamelapersonal\`.\`admins\`
          SET username = ?, password_hash = ?, name = COALESCE(NULLIF(TRIM(name), ''), ?)
        WHERE id = ?`,
      [username, passwordHash, name, legacy[0].id]
    );
    console.log(`Primeiro admin atualizado: usuario ${username} (senha definida no setup).`);
    return;
  }
  await connection.query(
    "INSERT INTO `pamelapersonal`.`admins` (`name`, `username`, `email`, `password_hash`, `role`) VALUES (?, ?, NULL, ?, 'owner')",
    [name, username, passwordHash]
  );
  console.log(`Admin principal criado: usuario ${username}`);
}

try {
  await connection.query(schema);
  await addColumnIfMissing("admins", "username", "VARCHAR(80) NULL");
  try {
    await connection.query(
      "ALTER TABLE `pamelapersonal`.`admins` MODIFY COLUMN `email` VARCHAR(160) NULL"
    );
    console.log("Coluna admins.email permite NULL.");
  } catch (error) {
    if (error.code !== "ER_BAD_FIELD_ERROR" && error.code !== "ER_NO_SUCH_TABLE") {
      console.warn("Aviso ao alterar admins.email:", error.message);
    }
  }
  try {
    await connection.query(
      "ALTER TABLE `pamelapersonal`.`admins` ADD UNIQUE KEY `uniq_admin_username` (`username`)"
    );
    console.log("Indice unico criado: admins.username");
  } catch (error) {
    if (error.code !== "ER_DUP_KEYNAME") throw error;
  }
  await addColumnIfMissing("students", "observations", "TEXT NULL");
  await addColumnIfMissing("students", "username", "VARCHAR(80) NULL");
  await addColumnIfMissing("students", "password_hash", "VARCHAR(255) NULL");
  await addColumnIfMissing(
    "students",
    "status",
    "VARCHAR(40) NOT NULL DEFAULT 'awaiting_evaluation'"
  );
  await addColumnIfMissing(
    "students",
    "subscription_status",
    "VARCHAR(40) NOT NULL DEFAULT 'free'"
  );
  await addColumnIfMissing("students", "subscription_plan_id", "VARCHAR(40) NULL");
  await addColumnIfMissing("students", "subscription_plan_name", "VARCHAR(80) NULL");
  await addColumnIfMissing("students", "subscription_months", "TINYINT UNSIGNED NULL");
  await addColumnIfMissing("students", "subscription_price_cents", "INT UNSIGNED NULL");
  await addColumnIfMissing("students", "subscription_started_at", "DATETIME NULL");
  await addColumnIfMissing("students", "subscription_ends_at", "DATETIME NULL");
  await addColumnIfMissing("students", "payment_status", "VARCHAR(40) NOT NULL DEFAULT 'pending'");
  await addColumnIfMissing("students", "payment_provider", "VARCHAR(40) NULL");
  await addColumnIfMissing("students", "payment_reference", "VARCHAR(120) NULL");
  await addColumnIfMissing("students", "payment_confirmed_at", "DATETIME NULL");
  await addColumnIfMissing("students", "evaluation_preference", "VARCHAR(40) NULL");
  await addColumnIfMissing("students", "evaluation_fee_required", "TINYINT(1) NOT NULL DEFAULT 0");
  await addColumnIfMissing("students", "evaluation_fee_cents", "INT UNSIGNED NOT NULL DEFAULT 0");
  await addColumnIfMissing(
    "students",
    "included_evaluations_remaining",
    "TINYINT UNSIGNED NOT NULL DEFAULT 0"
  );
  await addColumnIfMissing("students", "temporary_plan_json", "JSON NULL");
  await addColumnIfMissing("training_plans", "source", "VARCHAR(40) NOT NULL DEFAULT 'admin'");
  await addColumnIfMissing("training_plans", "status", "VARCHAR(40) NOT NULL DEFAULT 'draft'");
  await addColumnIfMissing("training_plans", "released_at", "DATETIME NULL");
  await addColumnIfMissing("evaluations", "lean_mass_kg", "DECIMAL(6,2) NULL");
  await addColumnIfMissing("evaluations", "muscle_mass_kg", "DECIMAL(6,2) NULL");
  await addColumnIfMissing("evaluations", "body_water_percent", "DECIMAL(5,2) NULL");
  await addColumnIfMissing("evaluations", "visceral_fat", "DECIMAL(6,2) NULL");
  await addColumnIfMissing("evaluations", "bone_mass_kg", "DECIMAL(6,2) NULL");
  await addColumnIfMissing("evaluations", "basal_metabolic_rate", "INT UNSIGNED NULL");
  await addColumnIfMissing("evaluations", "metabolic_age", "INT UNSIGNED NULL");
  await addColumnIfMissing("evaluations", "bmi", "DECIMAL(5,2) NULL");
  await addColumnIfMissing("evaluations", "blood_pressure", "VARCHAR(20) NULL");
  await addColumnIfMissing("evaluations", "resting_heart_rate", "INT UNSIGNED NULL");
  await addColumnIfMissing("evaluations", "chest_cm", "DECIMAL(6,2) NULL");
  await addColumnIfMissing("evaluations", "waist_cm", "DECIMAL(6,2) NULL");
  await addColumnIfMissing("evaluations", "abdomen_cm", "DECIMAL(6,2) NULL");
  await addColumnIfMissing("evaluations", "hip_cm", "DECIMAL(6,2) NULL");
  await addColumnIfMissing("evaluations", "right_arm_cm", "DECIMAL(6,2) NULL");
  await addColumnIfMissing("evaluations", "left_arm_cm", "DECIMAL(6,2) NULL");
  await addColumnIfMissing("evaluations", "right_arm_relaxed_cm", "DECIMAL(6,2) NULL");
  await addColumnIfMissing("evaluations", "left_arm_relaxed_cm", "DECIMAL(6,2) NULL");
  await addColumnIfMissing("evaluations", "right_arm_contracted_cm", "DECIMAL(6,2) NULL");
  await addColumnIfMissing("evaluations", "left_arm_contracted_cm", "DECIMAL(6,2) NULL");
  await addColumnIfMissing("evaluations", "right_forearm_cm", "DECIMAL(6,2) NULL");
  await addColumnIfMissing("evaluations", "left_forearm_cm", "DECIMAL(6,2) NULL");
  await addColumnIfMissing("evaluations", "right_thigh_cm", "DECIMAL(6,2) NULL");
  await addColumnIfMissing("evaluations", "left_thigh_cm", "DECIMAL(6,2) NULL");
  await addColumnIfMissing("evaluations", "right_calf_cm", "DECIMAL(6,2) NULL");
  await addColumnIfMissing("evaluations", "left_calf_cm", "DECIMAL(6,2) NULL");
  await addColumnIfMissing("evaluations", "triceps_mm", "DECIMAL(6,2) NULL");
  await addColumnIfMissing("evaluations", "subscapular_mm", "DECIMAL(6,2) NULL");
  await addColumnIfMissing("evaluations", "suprailiac_mm", "DECIMAL(6,2) NULL");
  await addColumnIfMissing("evaluations", "abdominal_mm", "DECIMAL(6,2) NULL");
  await addColumnIfMissing("evaluations", "thigh_mm", "DECIMAL(6,2) NULL");
  await addColumnIfMissing("evaluations", "chest_skinfold_mm", "DECIMAL(6,2) NULL");
  await addColumnIfMissing("evaluations", "midaxillary_mm", "DECIMAL(6,2) NULL");
  await addColumnIfMissing("evaluations", "calf_skinfold_mm", "DECIMAL(6,2) NULL");
  await addColumnIfMissing("evaluations", "postural_notes", "TEXT NULL");
  await addColumnIfMissing("evaluations", "movement_limitations", "TEXT NULL");
  await addColumnIfMissing("evaluations", "professional_recommendations", "TEXT NULL");
  await addColumnIfMissing("workout_logs", "admin_id", "INT UNSIGNED NULL");
  await addColumnIfMissing("workout_logs", "prescription", "VARCHAR(255) NULL");
  await addColumnIfMissing("workout_logs", "admin_comment", "TEXT NULL");
  try {
    await connection.query("ALTER TABLE `students` ADD UNIQUE KEY `uniq_student_username` (`username`)");
    console.log("Indice unico criado: students.username");
  } catch (error) {
    if (error.code !== "ER_DUP_KEYNAME") throw error;
  }
  await addColumnIfMissing("admins", "session_version", "INT UNSIGNED NOT NULL DEFAULT 1");
  await addColumnIfMissing("students", "session_version", "INT UNSIGNED NOT NULL DEFAULT 1");
  await connection.query(
    "UPDATE `pamelapersonal`.`students` SET session_version = 1 WHERE session_version IS NULL"
  );
  await connection.query(
    "UPDATE `pamelapersonal`.`admins` SET session_version = 1 WHERE session_version IS NULL"
  );
  try {
    await ensureSessionTriggers();
  } catch (error) {
    console.warn("Aviso ao criar triggers de sessao:", error.message ?? error);
  }
  await seedAdmin();
  console.log("");
  console.log("Banco `pamelapersonal` criado/atualizado com sucesso.");
  console.log("Tabelas iniciais prontas para o site.");
} finally {
  await connection.end();
}

