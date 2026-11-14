/** Question keys for the feedback form, shared by the form, its text and the server (no imports, so safe anywhere). */

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

/** 8-1 … 8-5: the weekend activities. "transition" may be left blank. */
export const SCALES = ['relax', 'venue', 'guidance', 'transition', 'again'] as const;
export type Scale = (typeof SCALES)[number];
export const OPTIONAL_SCALES: readonly Scale[] = ['transition'];

/** The 法會 ratings (2–7), all required. */
export const CEREMONY = ['joy', ...LEARN, ...SAT] as const;
export type Ceremony = (typeof CEREMONY)[number];
export type Rated = Ceremony | Scale;

export const MAX_TEXT = 2000;
