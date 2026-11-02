-- When a photo first appeared in the show. Until then it counts as new and plays ahead of the
-- topic order, even if the show's page is reloaded.
alter table photos add column first_shown_at timestamptz;
