-- Preflight before applying to an existing database:
-- SELECT plot_id, COUNT(*) FROM graves GROUP BY plot_id HAVING COUNT(*) > 1;
-- Resolve every returned row before migration. The unique constraint fails
-- safely if historical data violates one-grave-per-plot occupancy.

ALTER TABLE `location_details`
  DROP FOREIGN KEY `location_details_location_id_fkey`;
ALTER TABLE `location_details`
  ADD CONSTRAINT `location_details_location_id_fkey`
    FOREIGN KEY (`location_id`) REFERENCES `locations`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `plots`
  DROP FOREIGN KEY `plots_location_detail_id_fkey`;
ALTER TABLE `plots`
  ADD CONSTRAINT `plots_location_detail_id_fkey`
    FOREIGN KEY (`location_detail_id`) REFERENCES `location_details`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `graves`
  DROP FOREIGN KEY `graves_plot_id_fkey`;
ALTER TABLE `graves`
  ADD CONSTRAINT `graves_plot_id_key` UNIQUE (`plot_id`),
  ADD CONSTRAINT `graves_plot_id_fkey`
    FOREIGN KEY (`plot_id`) REFERENCES `plots`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;
