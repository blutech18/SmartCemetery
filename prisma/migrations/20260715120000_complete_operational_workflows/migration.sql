-- Additive operational-readiness migration.
-- Apply only after backup, migration status review, and the occupancy preflight
-- documented in prisma/migrations/README.md.

ALTER TABLE `locations`
  ADD COLUMN `is_active` BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN `deactivated_at` DATETIME(3) NULL,
  ADD COLUMN `deactivated_by_id` INTEGER NULL,
  ADD INDEX `locations_is_active_name_idx` (`is_active`, `name`),
  ADD CONSTRAINT `locations_deactivated_by_id_fkey`
    FOREIGN KEY (`deactivated_by_id`) REFERENCES `users`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `location_details`
  ADD COLUMN `sort_order` INTEGER NOT NULL DEFAULT 0;
UPDATE `location_details` SET `sort_order` = `id`;
ALTER TABLE `location_details`
  ADD INDEX `location_details_location_id_sort_order_idx` (`location_id`, `sort_order`);

ALTER TABLE `graves`
  ADD COLUMN `verification_status` VARCHAR(20) NOT NULL DEFAULT 'pending',
  ADD COLUMN `verified_at` DATETIME(3) NULL,
  ADD COLUMN `verified_by_id` INTEGER NULL,
  ADD COLUMN `verification_note` VARCHAR(500) NULL,
  ADD INDEX `graves_burial_date_idx` (`burial_date`),
  ADD INDEX `graves_status_verification_status_idx` (`status`, `verification_status`),
  ADD CONSTRAINT `graves_verified_by_id_fkey`
    FOREIGN KEY (`verified_by_id`) REFERENCES `users`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `grave_details`
  ADD COLUMN `encryption_key_version` VARCHAR(40) NOT NULL DEFAULT 'v1',
  ADD COLUMN `notes_encrypted` BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE `user_logs`
  DROP FOREIGN KEY `user_logs_user_id_fkey`;
ALTER TABLE `user_logs`
  MODIFY `user_id` INTEGER NULL,
  ADD INDEX `user_logs_created_at_idx` (`created_at`),
  ADD INDEX `user_logs_action_idx` (`action`),
  ADD CONSTRAINT `user_logs_user_id_fkey`
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;
CREATE TABLE `broadcasts` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `creator_id` INTEGER NOT NULL,
  `audience` VARCHAR(20) NOT NULL,
  `title` VARCHAR(160) NOT NULL,
  `message` TEXT NOT NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'processing',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `sent_at` DATETIME(3) NULL,
  INDEX `broadcasts_created_at_idx` (`created_at`),
  PRIMARY KEY (`id`),
  CONSTRAINT `broadcasts_creator_id_fkey`
    FOREIGN KEY (`creator_id`) REFERENCES `users`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `broadcast_deliveries` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `broadcast_id` INTEGER NOT NULL,
  `user_id` INTEGER NOT NULL,
  `email_status` VARCHAR(20) NOT NULL DEFAULT 'none',
  `attempts` INTEGER NOT NULL DEFAULT 0,
  `error` VARCHAR(500) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  UNIQUE INDEX `broadcast_deliveries_broadcast_id_user_id_key` (`broadcast_id`, `user_id`),
  INDEX `broadcast_deliveries_user_id_created_at_idx` (`user_id`, `created_at`),
  PRIMARY KEY (`id`),
  CONSTRAINT `broadcast_deliveries_broadcast_id_fkey`
    FOREIGN KEY (`broadcast_id`) REFERENCES `broadcasts`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `broadcast_deliveries_user_id_fkey`
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `notifications`
  DROP FOREIGN KEY `notifications_request_id_fkey`;
ALTER TABLE `notifications`
  MODIFY `request_id` INTEGER NULL,
  MODIFY `reference_id` VARCHAR(20) NULL,
  MODIFY `outcome` VARCHAR(20) NULL,
  ADD COLUMN `broadcast_id` INTEGER NULL,
  ADD COLUMN `category` VARCHAR(30) NOT NULL DEFAULT 'request_outcome',
  ADD COLUMN `title` VARCHAR(160) NOT NULL DEFAULT 'Notification',
  ADD COLUMN `message` TEXT NULL,
  ADD INDEX `notifications_broadcast_id_idx` (`broadcast_id`),
  ADD CONSTRAINT `notifications_request_id_fkey`
    FOREIGN KEY (`request_id`) REFERENCES `requests`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `notifications_broadcast_id_fkey`
    FOREIGN KEY (`broadcast_id`) REFERENCES `broadcasts`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;

UPDATE `notifications`
SET `title` = CONCAT('Request ', `reference_id`, ' ', `outcome`),
    `message` = CONCAT('Your request ', `reference_id`, ' has been ', `outcome`, '.');
ALTER TABLE `navigations`
  ADD COLUMN `plot_id` INTEGER NULL,
  ADD COLUMN `channel` VARCHAR(20) NOT NULL DEFAULT 'dashboard',
  ADD COLUMN `outcome` VARCHAR(20) NOT NULL DEFAULT 'success',
  ADD COLUMN `distance_meters` INTEGER NULL,
  ADD COLUMN `duration_seconds` INTEGER NULL,
  ADD INDEX `navigations_created_at_idx` (`created_at`),
  ADD INDEX `navigations_channel_created_at_idx` (`channel`, `created_at`),
  ADD INDEX `navigations_plot_id_created_at_idx` (`plot_id`, `created_at`),
  ADD CONSTRAINT `navigations_plot_id_fkey`
    FOREIGN KEY (`plot_id`) REFERENCES `plots`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE `archival_runs` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `run_key` VARCHAR(80) NOT NULL,
  `source` VARCHAR(20) NOT NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'running',
  `archived_count` INTEGER NOT NULL DEFAULT 0,
  `error` VARCHAR(500) NULL,
  `started_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `finished_at` DATETIME(3) NULL,
  UNIQUE INDEX `archival_runs_run_key_key` (`run_key`),
  INDEX `archival_runs_started_at_idx` (`started_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
