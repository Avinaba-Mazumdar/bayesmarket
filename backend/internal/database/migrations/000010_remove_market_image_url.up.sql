-- 000010_remove_market_image_url.up.sql
-- Market cards no longer render images, and the API has stopped accepting image_url. The column is
-- removed so no stored value can be published by mistake.
ALTER TABLE markets DROP COLUMN IF EXISTS image_url;
