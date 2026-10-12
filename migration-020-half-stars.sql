-- Migration 020: half-star ratings (Oct 12). Ratings were whole numbers (1–5); now 1, 1.5, 2 … 5.
-- Existing ratings keep their exact values (4 becomes 4.0). No rows are added or removed. Run AFTER 019.
-- Undo (only if nobody has saved a half star yet): alter column rating type int using round(rating)::int, and restore the 1–5 check.
alter table public.ratings drop constraint if exists ratings_rating_check;
alter table public.ratings alter column rating type numeric(2,1) using rating::numeric(2,1);
alter table public.ratings add constraint ratings_rating_check check (rating between 1 and 5 and rating * 2 = round(rating * 2));
