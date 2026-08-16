-- The admin UI sent this field as JSON (Content-Type: application/json), but the
-- backend reads it as a raw String — Spring's StringHttpMessageConverter picked up
-- the request before Jackson could strip the JSON quoting, so values like "WC" got
-- stored literally with the surrounding quotes. Fixed client-side (text/plain body);
-- this strips the quotes from any value already saved with the bug.
UPDATE competitions
SET football_data_competition_code = substring(football_data_competition_code FROM 2 FOR length(football_data_competition_code) - 2)
WHERE football_data_competition_code LIKE '"%"'
  AND length(football_data_competition_code) >= 2;
