import type { Star, GraphLink } from '../models/Star';

export function generateInitialGraph(): { stars: Star[], links: GraphLink[] } {
  const stars: Star[] = [
    { id: '1', name: 'Солнце', mass: 100, x: 0, y: 0, vx: 0, vy: 0, color: '#FFD700' },
    { id: '2', name: 'Альфа', mass: 50, x: 100, y: 50, vx: 0, vy: 0, color: '#FF6B6B' },
    { id: '3', name: 'Бета', mass: 30, x: -80, y: 80, vx: 0, vy: 0, color: '#4ECDC4' },
    { id: '4', name: 'Гамма', mass: 40, x: 50, y: -100, vx: 0, vy: 0, color: '#95E1D3' },
    { id: '5', name: 'Дельта', mass: 25, x: -100, y: -50, vx: 0, vy: 0, color: '#F38181' },
  ];

  const links: GraphLink[] = [
    { source: '1', target: '2', distance: 150 },
    { source: '1', target: '3', distance: 150 },
    { source: '1', target: '4', distance: 150 },
    { source: '2', target: '3', distance: 100 },
    { source: '3', target: '5', distance: 100 },
  ];

  return { stars, links };
}
