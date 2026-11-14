import { toSimplified } from './hans';
import type { Lang } from './event';

/**
 * Text for the multi-page feedback form: 法會 questions 1–7, the weekend activities as 8, a closing comment as 9.
 * Chinese is written once in Traditional; Simplified is converted. English is Claude's draft translation.
 * Built on the server and passed to the form as plain data.
 */

export const AGES = ['u30', '30s', '40s', '50s', '60s', '70s', '80plus'] as const;
export type Age = (typeof AGES)[number];

/** Questions 3–6: what people took away from each part of the programme. */
export const LEARN = ['talks', 'sangha', 'lay', 'chant'] as const;
export type Learn = (typeof LEARN)[number];

/** 7-1 … 7-11: satisfaction with the 憶師恩法會, in three groups. */
export const SAT_GROUPS = [
  ['moving', 'timing', 'hosts', 'performers'],
  ['stage', 'lighting', 'sound', 'video'],
  ['seating', 'food', 'volunteers'],
] as const;
export const SAT = SAT_GROUPS.flat();
export type Sat = (typeof SAT)[number];

const zh = {
  steps: ['關於你', '法會心得', '法會滿意度', '療癒體驗活動'],
  stepOf: (n: number, of: number) => `第 ${n} 頁，共 ${of} 頁`,
  next: '下一頁',
  back: '上一頁',
  age: '年齡',
  ages: { u30: '30 歲以下', '30s': '30–39 歲', '40s': '40–49 歲', '50s': '50–59 歲', '60s': '60–69 歲', '70s': '70–79 歲', '80plus': '80 歲以上' } as Record<Age, string>,
  errAge: '請選擇你的年齡。',
  q1: '想對上師說的話',
  q2: '整場法會給你的歡喜程度',
  q2ends: ['普通', '非常歡喜'] as [string, string],
  learnStem: '學習以下內容的心得受用',
  learn: { talks: '師長及和尚開示', sangha: '【僧團功德】影片', lay: '【居士影片】', chant: '【讚頌】' } as Record<Learn, string>,
  learnEnds: ['普通', '非常受用'] as [string, string],
  q7: '對於憶師恩法會的滿意度',
  satGroups: ['法會與節目', '舞台與影音', '現場與服務'],
  sat: {
    moving: '法會感動度', timing: '節目時間', hosts: '主持群', performers: '藝人表演',
    stage: '舞台設計', lighting: '燈光效果', sound: '音響效果', video: '影片字幕及效果',
    seating: '座位視野', food: '餐飲菜色', volunteers: '義工服務',
  } as Record<Sat, string>,
  satEnds: ['普通', '非常滿意'] as [string, string],
  scaleNote: '5 分最高，1 分為普通。',
  q8: '療癒體驗活動',
  q8lede: '也想聽聽你對這兩天療癒體驗活動的感受。',
  q9: '還有什麼想對我們說的嗎？任何學習心得、建議、感受或小故事，我們都很樂意聽。',
  noActivities: '我沒有參加療癒體驗活動',
  noActivitiesNote: '沒關係，8-1 到 8-5 可以略過。',
};

const en: typeof zh = {
  steps: ['About you', 'The ceremony', 'Rating the ceremony', 'Mindfulness activities'],
  stepOf: (n, of) => `Page ${n} of ${of}`,
  next: 'Next',
  back: 'Back',
  age: 'Age',
  ages: { u30: 'Under 30', '30s': '30–39', '40s': '40–49', '50s': '50–59', '60s': '60–69', '70s': '70–79', '80plus': '80 and over' },
  errAge: 'Please choose your age.',
  q1: 'What would you like to say to the Guru?',
  q2: 'How much joy did the whole ceremony bring you?',
  q2ends: ['Average', 'Great joy'],
  learnStem: 'How much did you take away from…',
  learn: { talks: 'the teachings by the teachers and monastics', sangha: 'the “Merits of the Sangha” video', lay: 'the lay practitioners’ videos', chant: 'the chanting of praises' },
  learnEnds: ['Average', 'Very much'],
  q7: 'How satisfied were you with the Memorial Ceremony for Late Master?',
  satGroups: ['Ceremony and programme', 'Stage, sound and video', 'On the day'],
  sat: {
    moving: 'How moving it was', timing: 'Programme timing', hosts: 'Hosts', performers: 'Performances',
    stage: 'Stage design', lighting: 'Lighting', sound: 'Sound', video: 'Videos and subtitles',
    seating: 'Seats and view', food: 'Food', volunteers: 'Volunteer service',
  },
  satEnds: ['Average', 'Very satisfied'],
  scaleNote: '5 is the highest, 1 is average.',
  q8: 'Mindfulness activities',
  q8lede: 'We’d also love to hear how this weekend’s activities felt for you.',
  q9: 'Is there anything else you’d like to share? Reflections on what you learned, suggestions, feelings or a small story — we’d love to hear it.',
  noActivities: 'I didn’t join any activities',
  noActivitiesNote: 'That’s fine — you can skip 8-1 to 8-5.',
};

export type FeedbackText = typeof zh;

function simplify(t: FeedbackText): FeedbackText {
  // Converts every string (deep), keeping functions and arrays.
  const walk = (v: unknown): unknown => {
    if (typeof v === 'string') return toSimplified(v);
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x)]));
    return v;
  };
  const out = walk(t) as FeedbackText;
  out.stepOf = (n, of) => `第 ${n} 页，共 ${of} 页`;
  return out;
}

/** Strings only (stepOf is applied here), so the result can be passed to a client component. */
export function feedbackText(lang: Lang) {
  const t = lang === 'en' ? en : lang === 'zhs' ? simplify(zh) : zh;
  const { stepOf, ...rest } = t;
  return { ...rest, stepLabels: t.steps.map((_, i) => stepOf(i + 1, t.steps.length)) };
}
export type FeedbackStrings = ReturnType<typeof feedbackText>;
