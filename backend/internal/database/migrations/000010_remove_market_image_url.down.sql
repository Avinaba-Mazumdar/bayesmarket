-- 000010_remove_market_image_url.down.sql
ALTER TABLE markets ADD COLUMN IF NOT EXISTS image_url VARCHAR(512);
