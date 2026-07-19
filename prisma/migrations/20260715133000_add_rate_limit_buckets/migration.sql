-- Privacy-preserving, database-backed fixed-window rate-limit buckets.
-- Keys are SHA-256 digests; raw email addresses and IP addresses are not stored.
CREATE TABLE `rate_limit_buckets` (
  `bucket_key` CHAR(64) NOT NULL,
  `count` INTEGER NOT NULL DEFAULT 1,
  `expires_at` DATETIME(3) NOT NULL,
  `updated_at` DATETIME(3) NOT NULL,
  INDEX `rate_limit_buckets_expires_at_idx` (`expires_at`),
  PRIMARY KEY (`bucket_key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;