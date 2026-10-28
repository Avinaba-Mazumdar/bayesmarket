-- Read-only export of market definitions, for recreating the same markets after a database reset.
-- Run this in the Neon SQL editor. It only reads: no data is changed.
-- Copy every row of the result into backend/seeds/markets-seed.sql.
SELECT format(
    'INSERT INTO markets (id, slug, title, description, category, image_url, resolution_source, resolution_date, status, winning_outcome, created_at) VALUES (%L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L);',
    id, slug, title, description, category, image_url, resolution_source, resolution_date, status, winning_outcome, created_at
) AS insert_statement
FROM markets
ORDER BY created_at;
