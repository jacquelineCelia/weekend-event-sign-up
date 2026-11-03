-- The user's revised photo topic prompts (titles unchanged).
update photo_topics t
   set hint = v.hint, hint_zh = v.hint_zh
  from (values
    (1, 'Find a beautiful corner of the estate you’ve never noticed.', '找到一處你從沒留意，美麗的莊園角落。'),
    (4, 'With permission, capture a genuine smile.', '徵得同意，記錄一個真誠的微笑。'),
    (5, 'Capture a moment of walking together or sharing in joy.', '拍下同行散步或隨喜開心的瞬間。'),
    (7, 'Capture the shape of a kite or outstretched wings.', '捕捉風箏或展翼身影。'),
    (8, 'Capture something that shows the traces of the wind.', '拍下能呈現風的痕跡。')
  ) as v(sort_order, hint, hint_zh)
 where t.sort_order = v.sort_order;
