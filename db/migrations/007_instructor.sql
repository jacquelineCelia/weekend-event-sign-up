-- Who leads each activity. It belongs to the activity, so every time slot has the same instructor.
-- Blank means "not shown". instructor_zh is typed in Traditional (Simplified is converted); blank
-- shows the English.
alter table activities
  add column instructor text not null default '',
  add column instructor_zh text not null default '';
