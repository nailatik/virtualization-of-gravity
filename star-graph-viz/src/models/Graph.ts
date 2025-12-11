import type { Star, GraphLink } from './Star';

export class StarGraph {
  stars: Star[];
  links: GraphLink[];

  constructor() {
    this.stars = [];
    this.links = [];
  }

  addStar(star: Star): void {
    this.stars.push(star);
  }

  removeStar(id: string): void {
    this.stars = this.stars.filter(s => s.id !== id);
    this.links = this.links.filter(l => l.source !== id && l.target !== id);
  }

  addLink(source: string, target: string, distance?: number): void {
    this.links.push({ source, target, distance });
  }

  removeLink(source: string, target: string): void {
    this.links = this.links.filter(
      l => !(l.source === source && l.target === target)
    );
  }

  getStarById(id: string): Star | undefined {
    return this.stars.find(s => s.id === id);
  }
}
