CREATE DATABASE IF NOT EXISTS `pamelapersonal`
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

USE `pamelapersonal`;

CREATE TABLE IF NOT EXISTS `admins` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(120) NOT NULL,
  `username` VARCHAR(80) NULL,
  `email` VARCHAR(160) NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `role` VARCHAR(40) NOT NULL DEFAULT 'admin',
  `session_version` INT UNSIGNED NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_admin_username` (`username`),
  UNIQUE KEY `uniq_admin_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `students` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(120) NOT NULL,
  `username` VARCHAR(80) NULL,
  `password_hash` VARCHAR(255) NULL,
  `email` VARCHAR(160) NULL,
  `phone` VARCHAR(40) NULL,
  `age` INT UNSIGNED NOT NULL,
  `height_cm` INT UNSIGNED NOT NULL,
  `weight_kg` DECIMAL(6,2) NOT NULL,
  `goal` VARCHAR(40) NOT NULL,
  `modality` VARCHAR(40) NOT NULL,
  `experience` VARCHAR(40) NOT NULL,
  `available_days` TINYINT UNSIGNED NOT NULL,
  `session_minutes` SMALLINT UNSIGNED NOT NULL,
  `injury` VARCHAR(40) NOT NULL DEFAULT 'nenhuma',
  `observations` TEXT NULL,
  `status` VARCHAR(40) NOT NULL DEFAULT 'awaiting_evaluation',
  `subscription_status` VARCHAR(40) NOT NULL DEFAULT 'free',
  `subscription_plan_id` VARCHAR(40) NULL,
  `subscription_plan_name` VARCHAR(80) NULL,
  `subscription_months` TINYINT UNSIGNED NULL,
  `subscription_price_cents` INT UNSIGNED NULL,
  `subscription_started_at` DATETIME NULL,
  `subscription_ends_at` DATETIME NULL,
  `payment_status` VARCHAR(40) NOT NULL DEFAULT 'pending',
  `payment_provider` VARCHAR(40) NULL,
  `payment_reference` VARCHAR(120) NULL,
  `payment_confirmed_at` DATETIME NULL,
  `evaluation_preference` VARCHAR(40) NULL,
  `evaluation_fee_required` TINYINT(1) NOT NULL DEFAULT 0,
  `evaluation_fee_cents` INT UNSIGNED NOT NULL DEFAULT 0,
  `included_evaluations_remaining` TINYINT UNSIGNED NOT NULL DEFAULT 0,
  `temporary_plan_json` JSON NULL,
  `session_version` INT UNSIGNED NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_student_username` (`username`),
  KEY `idx_students_name` (`name`),
  KEY `idx_students_goal` (`goal`),
  KEY `idx_students_modality` (`modality`),
  KEY `idx_students_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `evaluations` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `student_id` INT UNSIGNED NOT NULL,
  `admin_id` INT UNSIGNED NULL,
  `evaluated_at` DATE NOT NULL,
  `next_evaluation_at` DATE NOT NULL,
  `weight_kg` DECIMAL(6,2) NULL,
  `body_fat_percent` DECIMAL(5,2) NULL,
  `lean_mass_kg` DECIMAL(6,2) NULL,
  `muscle_mass_kg` DECIMAL(6,2) NULL,
  `body_water_percent` DECIMAL(5,2) NULL,
  `visceral_fat` DECIMAL(6,2) NULL,
  `bone_mass_kg` DECIMAL(6,2) NULL,
  `basal_metabolic_rate` INT UNSIGNED NULL,
  `metabolic_age` INT UNSIGNED NULL,
  `bmi` DECIMAL(5,2) NULL,
  `blood_pressure` VARCHAR(20) NULL,
  `resting_heart_rate` INT UNSIGNED NULL,
  `chest_cm` DECIMAL(6,2) NULL,
  `waist_cm` DECIMAL(6,2) NULL,
  `abdomen_cm` DECIMAL(6,2) NULL,
  `hip_cm` DECIMAL(6,2) NULL,
  `right_arm_cm` DECIMAL(6,2) NULL,
  `left_arm_cm` DECIMAL(6,2) NULL,
  `right_arm_relaxed_cm` DECIMAL(6,2) NULL,
  `left_arm_relaxed_cm` DECIMAL(6,2) NULL,
  `right_arm_contracted_cm` DECIMAL(6,2) NULL,
  `left_arm_contracted_cm` DECIMAL(6,2) NULL,
  `right_forearm_cm` DECIMAL(6,2) NULL,
  `left_forearm_cm` DECIMAL(6,2) NULL,
  `right_thigh_cm` DECIMAL(6,2) NULL,
  `left_thigh_cm` DECIMAL(6,2) NULL,
  `right_calf_cm` DECIMAL(6,2) NULL,
  `left_calf_cm` DECIMAL(6,2) NULL,
  `triceps_mm` DECIMAL(6,2) NULL,
  `subscapular_mm` DECIMAL(6,2) NULL,
  `suprailiac_mm` DECIMAL(6,2) NULL,
  `abdominal_mm` DECIMAL(6,2) NULL,
  `thigh_mm` DECIMAL(6,2) NULL,
  `chest_skinfold_mm` DECIMAL(6,2) NULL,
  `midaxillary_mm` DECIMAL(6,2) NULL,
  `calf_skinfold_mm` DECIMAL(6,2) NULL,
  `postural_notes` TEXT NULL,
  `movement_limitations` TEXT NULL,
  `professional_recommendations` TEXT NULL,
  `notes` TEXT NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_evaluations_student_id` (`student_id`),
  KEY `idx_evaluations_next_evaluation_at` (`next_evaluation_at`),
  CONSTRAINT `fk_evaluations_student`
    FOREIGN KEY (`student_id`) REFERENCES `students` (`id`)
    ON DELETE CASCADE,
  CONSTRAINT `fk_evaluations_admin`
    FOREIGN KEY (`admin_id`) REFERENCES `admins` (`id`)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `evaluation_slots` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `starts_at` DATETIME NOT NULL,
  `ends_at` DATETIME NOT NULL,
  `status` VARCHAR(40) NOT NULL DEFAULT 'available',
  `student_id` INT UNSIGNED NULL,
  `created_by_admin_id` INT UNSIGNED NULL,
  `notes` TEXT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_evaluation_slots_starts_at` (`starts_at`),
  KEY `idx_evaluation_slots_status` (`status`),
  KEY `idx_evaluation_slots_student_id` (`student_id`),
  CONSTRAINT `fk_evaluation_slots_student`
    FOREIGN KEY (`student_id`) REFERENCES `students` (`id`)
    ON DELETE SET NULL,
  CONSTRAINT `fk_evaluation_slots_admin`
    FOREIGN KEY (`created_by_admin_id`) REFERENCES `admins` (`id`)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `training_plans` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `student_id` INT UNSIGNED NOT NULL,
  `headline` VARCHAR(180) NOT NULL,
  `summary` TEXT NOT NULL,
  `intensity` VARCHAR(180) NOT NULL,
  `weekly_frequency` VARCHAR(60) NOT NULL,
  `warnings_json` JSON NULL,
  `source` VARCHAR(40) NOT NULL DEFAULT 'admin',
  `status` VARCHAR(40) NOT NULL DEFAULT 'draft',
  `released_at` DATETIME NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_training_plans_student_id` (`student_id`),
  CONSTRAINT `fk_training_plans_student`
    FOREIGN KEY (`student_id`) REFERENCES `students` (`id`)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `training_days` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `plan_id` INT UNSIGNED NOT NULL,
  `day_order` TINYINT UNSIGNED NOT NULL,
  `title` VARCHAR(120) NOT NULL,
  `focus` VARCHAR(180) NOT NULL,
  `warmup` TEXT NOT NULL,
  `cooldown` TEXT NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_training_days_plan_id` (`plan_id`),
  CONSTRAINT `fk_training_days_plan`
    FOREIGN KEY (`plan_id`) REFERENCES `training_plans` (`id`)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `training_exercises` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `day_id` INT UNSIGNED NOT NULL,
  `exercise_order` TINYINT UNSIGNED NOT NULL,
  `name` VARCHAR(160) NOT NULL,
  `prescription` VARCHAR(255) NOT NULL,
  `notes` TEXT NULL,
  `is_multi_joint` TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `idx_training_exercises_day_id` (`day_id`),
  KEY `idx_training_exercises_multi_joint` (`is_multi_joint`),
  CONSTRAINT `fk_training_exercises_day`
    FOREIGN KEY (`day_id`) REFERENCES `training_days` (`id`)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `workout_logs` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `student_id` INT UNSIGNED NOT NULL,
  `admin_id` INT UNSIGNED NULL,
  `logged_at` DATE NOT NULL,
  `day_index` TINYINT UNSIGNED NOT NULL,
  `day_title` VARCHAR(120) NOT NULL,
  `exercise_name` VARCHAR(160) NOT NULL,
  `prescription` VARCHAR(255) NULL,
  `load_text` VARCHAR(120) NULL,
  `student_comment` TEXT NULL,
  `admin_comment` TEXT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_workout_log_exercise_day` (`student_id`, `logged_at`, `day_index`, `exercise_name`),
  KEY `idx_workout_logs_student_date` (`student_id`, `logged_at`),
  KEY `idx_workout_logs_admin_id` (`admin_id`),
  CONSTRAINT `fk_workout_logs_student`
    FOREIGN KEY (`student_id`) REFERENCES `students` (`id`)
    ON DELETE CASCADE,
  CONSTRAINT `fk_workout_logs_admin`
    FOREIGN KEY (`admin_id`) REFERENCES `admins` (`id`)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `exercise_library` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(160) NOT NULL,
  `modality` VARCHAR(40) NOT NULL,
  `category` VARCHAR(80) NULL,
  `is_multi_joint` TINYINT(1) NOT NULL DEFAULT 0,
  `default_prescription` VARCHAR(255) NULL,
  `notes` TEXT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_exercise_name_modality` (`name`, `modality`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
