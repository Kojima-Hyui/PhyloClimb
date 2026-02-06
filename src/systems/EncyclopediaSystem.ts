import { EvolutionNodeId, ALL_NODE_IDS } from '../data/evolutionTree';

const STORAGE_KEY = 'phyloclimb_encyclopedia';

export interface EncyclopediaData {
  discoveredNodes: EvolutionNodeId[];
  totalRuns: number;
  totalClears: number;
  bestRemainingHp: number;
}

/**
 * Persistent encyclopedia that survives page reloads via localStorage.
 * Records discovered evolution nodes and run statistics.
 */
export class EncyclopediaSystem {
  private data: EncyclopediaData;

  constructor() {
    this.data = this.load();
  }

  /** Record end of a run (death or clear). */
  recordRun(unlockedNodes: EvolutionNodeId[], cleared: boolean, remainingHp: number): void {
    this.data.totalRuns++;
    if (cleared) {
      this.data.totalClears++;
      if (remainingHp > this.data.bestRemainingHp) {
        this.data.bestRemainingHp = remainingHp;
      }
    }
    for (const node of unlockedNodes) {
      if (!this.data.discoveredNodes.includes(node)) {
        this.data.discoveredNodes.push(node);
      }
    }
    this.save();
  }

  isNodeDiscovered(nodeId: EvolutionNodeId): boolean {
    return this.data.discoveredNodes.includes(nodeId);
  }

  getDiscoveryRate(): number {
    return this.data.discoveredNodes.length / ALL_NODE_IDS.length;
  }

  getData(): Readonly<EncyclopediaData> {
    return this.data;
  }

  private load(): EncyclopediaData {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw) as EncyclopediaData;
    } catch { /* ignore corrupt data */ }
    return {
      discoveredNodes: [],
      totalRuns: 0,
      totalClears: 0,
      bestRemainingHp: 0,
    };
  }

  private save(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch { /* storage full, ignore */ }
  }
}
