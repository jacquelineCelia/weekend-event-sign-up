-- Topic 8's Chinese prompt: a clearer ending (a separate migration, since 012 may already have been run).
update photo_topics set hint_zh = '拍下能呈現風的痕跡的畫面。' where sort_order = 8;
