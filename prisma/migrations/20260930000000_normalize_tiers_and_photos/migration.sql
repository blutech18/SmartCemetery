-- AlterTable
ALTER TABLE `plots` ADD COLUMN `total_tiers` INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE `graves` ADD COLUMN `birth_date` DATETIME(3) NULL,
    ADD COLUMN `death_date` DATETIME(3) NULL;

-- CreateTable
CREATE TABLE `plot_photos` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `plot_id` INTEGER NOT NULL,
    `tier` INTEGER NOT NULL DEFAULT 0,
    `url` VARCHAR(2048) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `plot_photos_plot_id_tier_key`(`plot_id`, `tier`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `plot_photos` ADD CONSTRAINT `plot_photos_plot_id_fkey` FOREIGN KEY (`plot_id`) REFERENCES `plots`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: apartment crypt rows have four tiers. Remaining plots keep the
-- default of 1. Structured tier data still stored in encrypted notes JSON is
-- moved by `npm run db:backfill-tiers` (dry-run by default).
UPDATE `plots` p
JOIN `location_details` ld ON ld.id = p.location_detail_id
SET p.total_tiers = 4
WHERE p.plot_number LIKE 'ROW-%' OR ld.subsection LIKE 'ROW-%';
