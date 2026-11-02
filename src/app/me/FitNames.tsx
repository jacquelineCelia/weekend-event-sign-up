'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * A line of text ending with the people it covers: every name when they fit on one line,
 * otherwise the first name "and others". Measured in the browser, and again when the width changes.
 */
export default function FitNames({ full, short }: { full: string; short: string }) {
  const box = useRef<HTMLSpanElement>(null);
  const ruler = useRef<HTMLSpanElement>(null);
  const [fits, setFits] = useState(true);
  useEffect(() => {
    if (!box.current || !ruler.current) return;
    const check = () => {
      if (box.current && ruler.current) setFits(ruler.current.getBoundingClientRect().width <= box.current.getBoundingClientRect().width);
    };
    const watch = new ResizeObserver(check); // also runs once right away, before the page is drawn
    watch.observe(box.current);
    watch.observe(ruler.current); // the web font arriving changes the width
    return () => watch.disconnect();
  }, [full]);
  return (
    <span ref={box} style={{ display: 'block' }}>
      <span aria-hidden="true" style={{ display: 'block', height: 0, overflow: 'hidden', visibility: 'hidden' }}>
        <span ref={ruler} style={{ display: 'inline-block', whiteSpace: 'nowrap' }}>{full}</span>
      </span>
      {fits ? full : short}
    </span>
  );
}
