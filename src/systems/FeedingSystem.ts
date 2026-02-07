import { FoodTypeId } from '../data/foodTypes';
import { EvolutionNodeId, evolutionTree, ALL_NODE_IDS } from '../data/evolutionTree';

export type EvolveCallback = (nodeId: EvolutionNodeId) => void;

/**
 * Tracks food points per type and automatically triggers evolution
 * when thresholds are met.
 */
export class FeedingSystem {
  private points: Record<FoodTypeId, number> = { dust: 0, sap: 0 };
  private activeEvolutions: Set<EvolutionNodeId> = new Set();
  private evolveCallbacks: EvolveCallback[] = [];

  /** Add food points and check for new evolutions. */
  consume(foodTypeId: FoodTypeId, amount: number): void {
    this.points[foodTypeId] += amount;
    this.checkEvolutions(foodTypeId);
  }

  /** Register a callback that fires when an evolution is gained. */
  onEvolve(callback: EvolveCallback): void {
    this.evolveCallbacks.push(callback);
  }

  /** Check if a specific evolution is active. */
  isActive(nodeId: EvolutionNodeId): boolean {
    return this.activeEvolutions.has(nodeId);
  }

  /** Get all active evolution node IDs. */
  getActiveEvolutions(): EvolutionNodeId[] {
    return Array.from(this.activeEvolutions);
  }

  /** Get current food points for a given type. */
  getPoints(foodTypeId: FoodTypeId): number {
    return this.points[foodTypeId];
  }

  /** Reset all state for a new run. */
  reset(): void {
    this.points = { dust: 0, sap: 0 };
    this.activeEvolutions.clear();
  }

  private checkEvolutions(foodTypeId: FoodTypeId): void {
    for (const nodeId of ALL_NODE_IDS) {
      const node = evolutionTree[nodeId];
      if (node.branch !== foodTypeId) continue;
      if (this.activeEvolutions.has(nodeId)) continue;

      // Previous tier must be active (or null for tier 1)
      if (node.prev !== null && !this.activeEvolutions.has(node.prev)) continue;

      // Check threshold
      if (this.points[foodTypeId] >= node.threshold) {
        this.activeEvolutions.add(nodeId);
        for (const cb of this.evolveCallbacks) {
          cb(nodeId);
        }
      }
    }
  }
}
