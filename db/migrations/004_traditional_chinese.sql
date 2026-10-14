-- Traditional Chinese (Taiwan) support.
-- Each attendee keeps the language they signed up in, so reminders and codes come in it.
alter table people add column lang text not null default 'en' check (lang in ('en', 'zh'));

-- Chinese versions of what staff type in. Blank means "show the English".
alter table activities
  add column name_zh text not null default '',
  add column place_zh text not null default '',
  add column description_zh text not null default '';

-- Draft Traditional Chinese (Taiwan) text for the placeholder activities.
-- Matched by English name, so it only touches activities that still have these names.
update activities a set name_zh = t.name_zh, place_zh = t.place_zh, description_zh = t.description_zh
  from (values
    ('Sunrise Yoga',        '晨光瑜伽',     '草原區',     ''),
    ('Pottery Wheel',       '拉坯體驗',     '穀倉工作室', '放慢腳步，跟著駐點陶藝師拉出你的第一個碗。現場提供圍裙和陶土，作品燒製後可於週日下午領取。'),
    ('Guided Forest Walk',  '森林導覽散步', '北側步道口', ''),
    ('Kayak Tour',          '獨木舟巡遊',   '船屋',       ''),
    ('Bread Baking',        '手作麵包',     '農場廚房',   ''),
    ('Archery',             '射箭體驗',     'B 射箭場',   ''),
    ('Stargazing',          '星空觀察',     '山頂',       ''),
    ('Watercolor Basics',   '水彩入門',     '穀倉工作室', ''),
    ('Kids'' Craft Corner', '兒童手作區',   '涼亭',       ''),
    ('Wine Tasting',        '品酒',         '酒窖',       ''),
    ('Climbing Wall',       '攀岩牆',       '運動場',     ''),
    ('Photography Walk',    '攝影散步',     '湖畔步道',   ''),
    ('Cooking Demo',        '料理示範',     '農場廚房',   '')
  ) as t(name, name_zh, place_zh, description_zh)
 where a.name = t.name and a.name_zh = '';
