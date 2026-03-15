export const CLUB_ORDER = [
  'LW', 'SW', 'GW', 'PW', 'I9', 'I8', 'I7', 'I6', 'I5', 'I4', 'I3',
  'H5', 'H4', 'H3', 'W5', 'W3', 'W1', 'DR',
];

const CLUB_COLORS = {
  DR:  '#ef4444',
  W1:  '#f97316',
  W3:  '#f97316',
  W5:  '#f59e0b',
  H3:  '#84cc16',
  H4:  '#22c55e',
  H5:  '#10b981',
  I3:  '#06b6d4',
  I4:  '#3b82f6',
  I5:  '#6366f1',
  I6:  '#8b5cf6',
  I7:  '#a855f7',
  I8:  '#ec4899',
  I9:  '#14b8a6',
  PW:  '#f43f5e',
  GW:  '#fb923c',
  SW:  '#facc15',
  LW:  '#4ade80',
};

export function getClubColor(club) {
  return CLUB_COLORS[club] ?? '#94a3b8';
}

// Shot shape from D-Plane: face_to_target = starting direction, face_to_path = curve
export function getShotShape(face_to_target, face_to_path) {
  if (face_to_target == null || face_to_path == null) return null;

  const startRight = face_to_target >  2;
  const startLeft  = face_to_target < -2;

  let curve;
  if      (face_to_path >  7) curve = 'Slice';
  else if (face_to_path >  2) curve = 'Fade';
  else if (face_to_path < -7) curve = 'Hook';
  else if (face_to_path < -2) curve = 'Draw';
  else                         curve = 'Straight';

  if (!startRight && !startLeft) return curve;
  const prefix = startRight ? 'Push' : 'Pull';
  return curve === 'Straight' ? prefix : `${prefix}-${curve}`;
}

export function sortByClub(items, key = 'club') {
  return [...items].sort((a, b) => {
    const ai = CLUB_ORDER.indexOf(a[key]);
    const bi = CLUB_ORDER.indexOf(b[key]);
    const aIdx = ai === -1 ? 999 : ai;
    const bIdx = bi === -1 ? 999 : bi;
    return aIdx - bIdx;
  });
}
