-- Placeholder schedule: 13 activities on Sat 14 and Sun 15 November 2026.
-- Times are local to the event (America/New_York). Staff can change all of
-- this later from the Schedule & capacity screen.

insert into activities (name, place, duration_min, sort_order, description) values
  ('Sunrise Yoga',        'The Meadow',      45,  1, ''),
  ('Pottery Wheel',       'Barn Studio',     60,  2, 'Slow down and throw your first bowl with a studio potter. Aprons and clay provided; pieces are fired and ready for pickup Sunday afternoon.'),
  ('Guided Forest Walk',  'North Trailhead', 90,  3, ''),
  ('Kayak Tour',          'Boathouse',      120,  4, ''),
  ('Bread Baking',        'Farm Kitchen',    75,  5, ''),
  ('Archery',             'Range B',         45,  6, ''),
  ('Stargazing',          'Hilltop',         60,  7, ''),
  ('Watercolor Basics',   'Barn Studio',     90,  8, ''),
  ('Kids'' Craft Corner', 'Pavilion',        45,  9, ''),
  ('Wine Tasting',        'Cellar',          60, 10, ''),
  ('Climbing Wall',       'Sports Field',    30, 11, ''),
  ('Photography Walk',    'Lake Path',       75, 12, ''),
  ('Cooking Demo',        'Farm Kitchen',    60, 13, '');

with s(name, day, t, cap) as (values
  ('Sunrise Yoga','2026-11-14','07:30',20), ('Sunrise Yoga','2026-11-14','09:00',20),
  ('Sunrise Yoga','2026-11-15','07:30',20), ('Sunrise Yoga','2026-11-15','09:00',20),
  ('Pottery Wheel','2026-11-14','10:00',10), ('Pottery Wheel','2026-11-14','11:30',10),
  ('Pottery Wheel','2026-11-14','13:00',10), ('Pottery Wheel','2026-11-14','14:30',10),
  ('Pottery Wheel','2026-11-14','16:00',10),
  ('Pottery Wheel','2026-11-15','10:00',10), ('Pottery Wheel','2026-11-15','11:30',10),
  ('Pottery Wheel','2026-11-15','13:00',10),
  ('Guided Forest Walk','2026-11-14','09:30',25), ('Guided Forest Walk','2026-11-14','13:30',25),
  ('Guided Forest Walk','2026-11-15','09:30',25), ('Guided Forest Walk','2026-11-15','13:30',25),
  ('Kayak Tour','2026-11-14','10:00',12), ('Kayak Tour','2026-11-14','14:00',12),
  ('Kayak Tour','2026-11-15','10:00',12), ('Kayak Tour','2026-11-15','14:00',12),
  ('Bread Baking','2026-11-14','11:00',8), ('Bread Baking','2026-11-14','15:00',8),
  ('Bread Baking','2026-11-15','11:00',8), ('Bread Baking','2026-11-15','15:00',8),
  ('Archery','2026-11-14','10:30',6), ('Archery','2026-11-14','12:00',6),
  ('Archery','2026-11-14','13:30',6), ('Archery','2026-11-14','15:00',6),
  ('Archery','2026-11-15','10:30',6), ('Archery','2026-11-15','13:30',6),
  ('Stargazing','2026-11-14','20:00',40), ('Stargazing','2026-11-14','21:00',40),
  ('Stargazing','2026-11-15','20:00',40),
  ('Watercolor Basics','2026-11-14','10:00',12), ('Watercolor Basics','2026-11-14','13:00',12),
  ('Watercolor Basics','2026-11-15','10:00',12), ('Watercolor Basics','2026-11-15','13:00',12),
  ('Kids'' Craft Corner','2026-11-14','09:30',15), ('Kids'' Craft Corner','2026-11-14','11:00',15),
  ('Kids'' Craft Corner','2026-11-15','09:30',15), ('Kids'' Craft Corner','2026-11-15','11:00',15),
  ('Kids'' Craft Corner','2026-11-15','14:00',15),
  ('Wine Tasting','2026-11-14','16:00',16),
  ('Wine Tasting','2026-11-15','14:00',16), ('Wine Tasting','2026-11-15','16:00',16),
  ('Climbing Wall','2026-11-14','10:00',8), ('Climbing Wall','2026-11-14','11:00',8),
  ('Climbing Wall','2026-11-14','14:00',8),
  ('Climbing Wall','2026-11-15','10:00',8), ('Climbing Wall','2026-11-15','11:00',8),
  ('Climbing Wall','2026-11-15','12:00',8), ('Climbing Wall','2026-11-15','13:00',8),
  ('Photography Walk','2026-11-14','08:00',14), ('Photography Walk','2026-11-14','16:30',14),
  ('Photography Walk','2026-11-15','08:00',14), ('Photography Walk','2026-11-15','16:30',14),
  ('Cooking Demo','2026-11-14','12:00',30),
  ('Cooking Demo','2026-11-15','12:00',30), ('Cooking Demo','2026-11-15','15:00',30)
)
insert into slots (activity_id, starts_at, capacity)
select a.id, ((s.day || ' ' || s.t)::timestamp at time zone 'America/New_York'), s.cap
from s join activities a on a.name = s.name;
