-- Simplified Chinese (mainland) as a third language. 'zh' stays Traditional (Taiwan).
alter table people drop constraint people_lang_check;
alter table people add constraint people_lang_check check (lang in ('en', 'zh', 'zhs'));
