-- Widen sensitive GraveDetail columns to TEXT for encrypted (iv:authTag:ciphertext) values
ALTER TABLE `grave_details`
    MODIFY `cause_of_death` TEXT NULL,
    MODIFY `contact_person` TEXT NULL,
    MODIFY `contact_phone` TEXT NULL;

-- CreateTable
CREATE TABLE `notifications` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `request_id` INTEGER NOT NULL,
    `reference_id` VARCHAR(20) NOT NULL,
    `outcome` VARCHAR(20) NOT NULL,
    `email_status` VARCHAR(20) NOT NULL DEFAULT 'none',
    `read_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `notifications_user_id_created_at_idx`(`user_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_request_id_fkey` FOREIGN KEY (`request_id`) REFERENCES `requests`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
