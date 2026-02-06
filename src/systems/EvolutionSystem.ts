import { EvolutionNodeId } from '../data/evolutionTree';

/** Per-run evolution state. Tracks which nodes have been unlocked this run. */
export class EvolutionSystem {
  private unlockedNodes: Set<EvolutionNodeId> = new Set();

  unlock(nodeId: EvolutionNodeId): void {
    this.unlockedNodes.add(nodeId);
  }

  isUnlocked(nodeId: EvolutionNodeId): boolean {
    return this.unlockedNodes.has(nodeId);
  }

  getUnlocked(): EvolutionNodeId[] {
    return [...this.unlockedNodes];
  }

  getUnlockedCount(): number {
    return this.unlockedNodes.size;
  }

  /** Get available (unlockable) nodes: parent is unlocked but node itself is not. */
  getAvailable(tree: import('../data/evolutionTree').EvolutionTree): EvolutionNodeId[] {
    const available: EvolutionNodeId[] = [];
    for (const [id, node] of Object.entries(tree)) {
      const nodeId = id as EvolutionNodeId;
      if (this.unlockedNodes.has(nodeId)) continue;
      if (node.parent === null || this.unlockedNodes.has(node.parent)) {
        available.push(nodeId);
      }
    }
    return available;
  }

  reset(): void {
    this.unlockedNodes.clear();
  }
}
