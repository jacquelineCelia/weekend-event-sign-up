'use client';

import { useEffect } from 'react';
import { rememberSlotAction } from '../actions';

/** Notes the session open on Check-in, so the Check-in tab comes back to it after a walk-in or schedule visit. */
export default function RememberSlot({ slotId }: { slotId: string }) {
  useEffect(() => {
    rememberSlotAction(slotId).catch(() => {});
  }, [slotId]);
  return null;
}
