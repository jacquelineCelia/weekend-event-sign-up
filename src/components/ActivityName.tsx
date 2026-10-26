import { Fragment, type ReactNode } from 'react';

// Latin words inside a Chinese activity name, e.g. "Let's Flow Vinyasa" in "展翼・Let's Flow Vinyasa 瑜伽".
const LATIN_RUN = /([A-Za-z0-9](?:[A-Za-z0-9'’&.\- ]*[A-Za-z0-9])?)/;

/**
 * An activity name for display. Chinese names are shown bold (the zhname class), but bold only suits
 * the Chinese characters: the serif font has no bold, so English words in a Chinese name come out
 * smeared. Those words are wrapped so they stay regular weight.
 */
export function nameRuns(name: string): ReactNode {
  if (!/\p{Script=Han}/u.test(name)) return name;
  return name.split(LATIN_RUN).map((part, i) =>
    i % 2 === 1 ? <span key={i} className="latin">{part}</span> : <Fragment key={i}>{part}</Fragment>,
  );
}
