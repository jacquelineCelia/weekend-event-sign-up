-- Feedback on My sign-ups: two questions instead of one 1–10 score.
--   calm:  這個活動有讓您放慢腳步、靜心於當下嗎？ (1–5)
--   again: 您會想再體驗一次這項活動嗎？ (yes / no)
-- Each answer is saved on its own, so either can be blank. The old 1–10 score is kept for any rows that have it.
alter table ratings alter column score drop not null;
alter table ratings add column calm int check (calm between 1 and 5);
alter table ratings add column again boolean;
