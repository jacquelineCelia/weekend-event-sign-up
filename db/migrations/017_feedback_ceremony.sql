-- Feedback form in four pages (/feedback): age, the 憶師恩法會 questions (1–7) and an option for people
-- who didn't join the weekend activities (then the five activity scores stay blank). `comment` now holds
-- the closing question 9 (還有什麼想對我們說的嗎？…). All 1–5.
alter table event_feedback
  add column age            text check (age in ('u30', '30s', '40s', '50s', '60s', '70s', '80plus')),
  add column to_guru        text not null default '',                       -- 1 想對上師說的話
  add column joy            int check (joy between 1 and 5),                -- 2 整場法會給你的歡喜程度
  add column learn_talks    int check (learn_talks between 1 and 5),        -- 3 師長及和尚開示
  add column learn_sangha   int check (learn_sangha between 1 and 5),       -- 4 【僧團功德】影片
  add column learn_lay      int check (learn_lay between 1 and 5),          -- 5 【居士影片】
  add column learn_chant    int check (learn_chant between 1 and 5),        -- 6 【讚頌】
  add column sat_moving     int check (sat_moving between 1 and 5),         -- 7-1 法會感動度
  add column sat_timing     int check (sat_timing between 1 and 5),         -- 7-2 節目時間
  add column sat_hosts      int check (sat_hosts between 1 and 5),          -- 7-3 主持群
  add column sat_performers int check (sat_performers between 1 and 5),     -- 7-4 藝人表演
  add column sat_stage      int check (sat_stage between 1 and 5),          -- 7-5 舞台設計
  add column sat_lighting   int check (sat_lighting between 1 and 5),       -- 7-6 燈光效果
  add column sat_sound      int check (sat_sound between 1 and 5),          -- 7-7 音響效果
  add column sat_video      int check (sat_video between 1 and 5),          -- 7-8 影片字幕及效果
  add column sat_seating    int check (sat_seating between 1 and 5),        -- 7-9 座位視野
  add column sat_food       int check (sat_food between 1 and 5),           -- 7-10 餐飲菜色
  add column sat_volunteers int check (sat_volunteers between 1 and 5),     -- 7-11 義工服務
  add column no_activities  boolean not null default false;                 -- 我沒有參加療癒體驗活動

-- 8-1 … 8-5 (the weekend activities) are blank when no_activities is true.
alter table event_feedback
  alter column relax drop not null,
  alter column venue drop not null,
  alter column guidance drop not null,
  alter column again drop not null;
