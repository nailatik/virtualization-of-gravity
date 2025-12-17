import type { Star, GraphLink } from '../models/Star';

type AdjEdge = { to: string; w: number };

export function dijkstraPath(
  nodes: Star[],
  links: GraphLink[],
  startId: string,
  goalId: string
): { path: string[]; cost: number } {
  const adj = new Map<string, AdjEdge[]>();
  for (const n of nodes) adj.set(n.id, []);

  for (const e of links) {
    const w = e.distance; // считаем "топливо" = distance
    if (!adj.has(e.source) || !adj.has(e.target)) continue;

    // граф неориентированный (перелёт туда-обратно)
    adj.get(e.source)!.push({ to: e.target, w });
    adj.get(e.target)!.push({ to: e.source, w });
  }

  const dist = new Map<string, number>();
  const prev = new Map<string, string | null>();
  const used = new Set<string>();

  for (const n of nodes) {
    dist.set(n.id, Infinity);
    prev.set(n.id, null);
  }
  dist.set(startId, 0);

  while (true) {
    // найти неиспользованную вершину с минимальной дистанцией
    let v: string | null = null;
    let best = Infinity;
    for (const [id, d] of dist) {
      if (used.has(id)) continue;
      if (d < best) {
        best = d;
        v = id;
      }
    }
    if (v === null) break;
    if (v === goalId) break;

    used.add(v);

    for (const ed of adj.get(v) ?? []) {
      const nd = (dist.get(v) ?? Infinity) + ed.w;
      if (nd < (dist.get(ed.to) ?? Infinity)) {
        dist.set(ed.to, nd);
        prev.set(ed.to, v);
      }
    }
  }

  const total = dist.get(goalId) ?? Infinity;
  if (!isFinite(total)) return { path: [], cost: Infinity };

  // восстановление пути
  const path: string[] = [];
  let cur: string | null = goalId;
  while (cur) {
    path.push(cur);
    cur = prev.get(cur) ?? null;
  }
  path.reverse();

  return { path, cost: total };
}
