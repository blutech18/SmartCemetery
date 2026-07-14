-- Baseline schema before notifications and encrypted-column widening.
-- Existing databases created with `prisma db push` must mark this migration
-- applied after verifying these tables exist; see prisma/migrations/README.md.

CREATE TABLE `user_types` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `type_name` VARCHAR(20) NOT NULL,
  UNIQUE INDEX `user_types_type_name_key`(`type_name`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `users` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(100) NOT NULL,
  `email` VARCHAR(150) NOT NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `user_type_id` INTEGER NOT NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'active',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  UNIQUE INDEX `users_email_key`(`email`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `locations` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(100) NOT NULL,
  `description` TEXT NULL,
  `gps_lat` DECIMAL(10,8) NULL,
  `gps_lng` DECIMAL(11,8) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `location_details` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `location_id` INTEGER NOT NULL,
  `subsection` VARCHAR(50) NOT NULL,
  `capacity` INTEGER NOT NULL DEFAULT 0,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE TABLE `plots` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `location_detail_id` INTEGER NOT NULL,
  `plot_number` VARCHAR(30) NOT NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'available',
  `gps_lat` DECIMAL(10,8) NULL,
  `gps_lng` DECIMAL(11,8) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  UNIQUE INDEX `plots_location_detail_id_plot_number_key`(`location_detail_id`, `plot_number`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `graves` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `plot_id` INTEGER NOT NULL,
  `deceased_name` VARCHAR(200) NOT NULL,
  `burial_date` DATETIME(3) NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'active',
  `archived_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `grave_details` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `grave_id` INTEGER NOT NULL,
  `cause_of_death` VARCHAR(255) NULL,
  `contact_person` VARCHAR(150) NULL,
  `contact_phone` VARCHAR(30) NULL,
  `notes` TEXT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  UNIQUE INDEX `grave_details_grave_id_key`(`grave_id`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE TABLE `user_logs` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `user_id` INTEGER NOT NULL,
  `action` VARCHAR(255) NOT NULL,
  `ip_address` VARCHAR(45) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `requests` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `user_id` INTEGER NOT NULL,
  `type` VARCHAR(50) NOT NULL,
  `description` TEXT NOT NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'pending',
  `reference_id` VARCHAR(20) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  UNIQUE INDEX `requests_reference_id_key`(`reference_id`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `feedback` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `user_id` INTEGER NOT NULL,
  `rating` TINYINT NOT NULL,
  `comment` TEXT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `navigations` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `user_id` INTEGER NULL,
  `origin` VARCHAR(255) NULL,
  `destination` VARCHAR(255) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE `users` ADD CONSTRAINT `users_user_type_id_fkey`
  FOREIGN KEY (`user_type_id`) REFERENCES `user_types`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `location_details` ADD CONSTRAINT `location_details_location_id_fkey`
  FOREIGN KEY (`location_id`) REFERENCES `locations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `plots` ADD CONSTRAINT `plots_location_detail_id_fkey`
  FOREIGN KEY (`location_detail_id`) REFERENCES `location_details`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `graves` ADD CONSTRAINT `graves_plot_id_fkey`
  FOREIGN KEY (`plot_id`) REFERENCES `plots`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `grave_details` ADD CONSTRAINT `grave_details_grave_id_fkey`
  FOREIGN KEY (`grave_id`) REFERENCES `graves`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `user_logs` ADD CONSTRAINT `user_logs_user_id_fkey`
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `requests` ADD CONSTRAINT `requests_user_id_fkey`
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `feedback` ADD CONSTRAINT `feedback_user_id_fkey`
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `navigations` ADD CONSTRAINT `navigations_user_id_fkey`
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;