ALTER TABLE `messages` ADD `status` text DEFAULT 'processing' NOT NULL;
UPDATE `messages` SET `status` = 'ready';