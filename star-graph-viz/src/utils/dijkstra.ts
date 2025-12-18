import type { Star, GraphLink } from '../models/Star';
import { distPointToSegment } from './geometry2d';

type AdjEdge = { to: string; w: number };

// helper: key для неориентированного ребра (если понадобится где-то ещё)
export function edgeKey(a: string, b: string) {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

export function dijkstraPath(
  nodes: Star[],
  links: GraphLink[],
  startId: string,
  goalId: string,
  opts?: {
    sunId?: string;
    sunBlockRadius?: number; // радиус опасной зоны в твоих “пикселях”
    forbidThroughSun?: boolean; // true = ребро запрещаем, false = даём штраф
    penalty?: number; // если forbidThroughSun=false
    power?: number; // топливо = distance^power (1 = линейно)
  }
): { path: string[]; cost: number } {
  const {
    sunId = '1',
    sunBlockRadius = 90,
    forbidThroughSun = false,
    penalty = 1e9,
    power = 1
  } = opts ?? {};

  const byId = new Map(nodes.map((n) => [n.id, n]));
  const sun = byId.get(sunId);

  // adjacency list
  const adj = new Map<string, AdjEdge[]>();
  for (const n of nodes) adj.set(n.id, []);

  // build graph once, with dynamic weights
  for (const e of links) {
    const a = byId.get(e.source);
    const b = byId.get(e.target);
    if (!a || !b) continue;
    if (!adj.has(a.id) || !adj.has(b.id)) continue;

    const d = Math.hypot(a.x - b.x, a.y - b.y);
    let w = power === 1 ? d : Math.pow(d, power);

    // запрет/штраф “пролёта через солнце”
    if (sun) {
      const minDist = distPointToSegment(sun.x, sun.y, a.x, a.y, b.x, b.y);
      if (minDist < sunBlockRadius) {
        if (forbidThroughSun) {
          continue; // ребро не добавляем
        } else {
          w += penalty; // ребро есть, но почти всегда невыгодно
        }
      }
    }

    // граф неориентированный (можно “лететь” в обе стороны)
    adj.get(a.id)!.push({ to: b.id, w });
    adj.get(b.id)!.push({ to: a.id, w });
  }

  // dijkstra
  const dist = new Map<string, number>();
  const prev = new Map<string, string | null>();
  const used = new Set<string>();

  for (const n of nodes) {
    dist.set(n.id, Infinity);
    prev.set(n.id, null);
  }
  dist.set(startId, 0);

  while (true) {
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
