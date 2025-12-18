export function distPointToSegment(
  px: number, py: number,
  ax: number, ay: number,
  bx: number, by: number
) {
  const abx = bx - ax;
  const aby = by - ay;
  const apx = px - ax;
  const apy = py - ay;

  const ab2 = abx * abx + aby * aby;
  if (ab2 === 0) return Math.hypot(px - ax, py - ay);

  // t = projection of AP onto AB, clamped to [0,1]
  let t = (apx * abx + apy * aby) / ab2;
  t = Math.max(0, Math.min(1, t));

  const cx = ax + t * abx;
  const cy = ay + t * aby;

  return Math.hypot(px - cx, py - cy);
}
