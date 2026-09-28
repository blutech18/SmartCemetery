-- Shared application settings (key/value JSON). First consumer: the cemetery
-- boundary polygon edited from the dashboard map, so it is no longer device-local.
CREATE TABLE `app_settings` (
  `setting_key` VARCHAR(80) NOT NULL,
  `value` TEXT NOT NULL,
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`setting_key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
