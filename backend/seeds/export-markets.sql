-- Read-only export of market definitions and current YES probability, for recreating the same markets
-- after a database reset. Run this in the Neon SQL editor. It only reads: no data is changed.
-- Copy the result rows (slug, yes_probability, insert_statement) into backend/seeds/markets-seed.sql.
-- yes_probability is computed with the same formula as amm.CalculateSpotPrices: reserve_no / (reserve_yes + reserve_no).
SELECT
    m.slug,
    ROUND(p.reserve_no / NULLIF(p.reserve_yes + p.reserve_no, 0), 8) AS yes_probability,
    format(
        'INSERT INTO markets (id, slug, title, description, category, resolution_source, resolution_date, status, winning_outcome, created_at) VALUES (%L, %L, %L, %L, %L, %L, %L, %L, %L, %L);',
        m.id, m.slug, m.title, m.description, m.category, m.resolution_source, m.resolution_date, m.status, m.winning_outcome, m.created_at
    ) AS insert_statement
FROM markets m
LEFT JOIN liquidity_pools p ON p.market_id = m.id
ORDER BY m.created_at;
