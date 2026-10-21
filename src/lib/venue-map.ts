/**
 * PLACEHOLDER venue map. Positions are on the illustrated map in VenueMap.tsx (360 × 420 units),
 * keyed by each activity's English place name (Staff → Schedule & capacity → Place).
 * When the real map is ready, replace the drawing in VenueMap.tsx and update these points.
 * A place not listed here still shows in the list under the map, just without a pin.
 */
export type Label = 'left' | 'right' | 'above' | 'below';
export const MAP_POINTS: Record<string, { x: number; y: number; label: Label }> = {
  'North Trailhead': { x: 96, y: 84, label: 'right' },
  Hilltop: { x: 292, y: 72, label: 'left' },
  'The Meadow': { x: 140, y: 200, label: 'above' },
  Pavilion: { x: 198, y: 272, label: 'right' },
  Boathouse: { x: 236, y: 226, label: 'left' },
  'Lake Path': { x: 316, y: 318, label: 'below' },
  'Barn Studio': { x: 70, y: 316, label: 'right' },
  'Farm Kitchen': { x: 122, y: 360, label: 'right' },
  'Tea House': { x: 62, y: 398, label: 'right' },
  'Sports Field': { x: 252, y: 372, label: 'below' },
  'Range B': { x: 330, y: 400, label: 'above' },
};
