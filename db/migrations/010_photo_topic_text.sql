-- The real photo topics: a short title (also shown on the big screen) and a prompt for the upload page.
alter table photo_topics add column hint text not null default '', add column hint_zh text not null default '';

update photo_topics t
   set name = v.name, name_zh = v.name_zh, hint = v.hint, hint_zh = v.hint_zh
  from (values
    (1, 'Around the Corner', '轉角發現', 'Find a corner of the estate you’ve never noticed.', '找到一處你從未留意的莊園角落。'),
    (2, 'Path of Light', '光影小徑', 'Capture a ray of light on a trail, by a window or under a tree.', '拍下步道、窗邊或樹下的一道光。'),
    (3, 'A Quiet Pause', '安靜停頓', 'Find a place that makes you want to stop and breathe.', '找到一個讓你想停下呼吸的地方。'),
    (4, 'A Smiling Encounter', '微笑相遇', 'With permission, capture a genuine smile.', '徵得同意，記錄一個真誠的笑容。'),
    (5, 'Walking Together', '同行片刻', 'Photograph two people from behind as they walk or talk together.', '拍下兩人一起散步或交談的背影。'),
    (6, 'A Tender Moment', '溫柔一刻', 'Capture a moment of sharing, keeping company or helping one another.', '捕捉分享、陪伴或互相幫忙的瞬間。'),
    (7, 'Taking Flight', '輕盈飛翔', 'Capture the shape of a bird, a kite or outstretched wings.', '捕捉鳥影、風箏或展翼身形。'),
    (8, 'The Shape of Wind', '風的形狀', 'Photograph curtains, leaves or the edge of clothing moving in the wind.', '拍下被風吹動的布幔、葉子或衣角。'),
    (9, 'My Moment', '我的此刻', 'Use one image to express how you feel right now.', '用一張圖片，表達現在的心情。')
  ) as v(sort_order, name, name_zh, hint, hint_zh)
 where t.sort_order = v.sort_order;
