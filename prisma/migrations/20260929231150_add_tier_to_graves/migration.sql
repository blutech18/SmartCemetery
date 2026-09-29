-- AddColumn: tier to graves (default 1 — existing single-grave plots stay at tier 1)
ALTER TABLE `graves` ADD COLUMN `tier` INTEGER NOT NULL DEFAULT 1;

-- Drop FK first so we can drop the unique index it depends on
ALTER TABLE `graves` DROP FOREIGN KEY `graves_plot_id_fkey`;

-- DropIndex: remove old single-column unique on plot_id
ALTER TABLE `graves` DROP INDEX `graves_plot_id_key`;

-- CreateIndex: composite unique (plot_id, tier) — one grave per tier per plot
CREATE UNIQUE INDEX `graves_plot_id_tier_key` ON `graves`(`plot_id`, `tier`);

-- Re-add FK constraint
ALTER TABLE `graves` ADD CONSTRAINT `graves_plot_id_fkey` FOREIGN KEY (`plot_id`) REFERENCES `plots`(`id`) ON UPDATE CASCADE ON DELETE RESTRICT;
