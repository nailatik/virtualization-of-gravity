export interface Star {
  id: string;
  name: string;
  mass: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  color?: string;
}

export interface GraphLink {
  source: string;
  target: string;
  distance?: number;
}