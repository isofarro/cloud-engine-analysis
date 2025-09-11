import { PVExplorationContext, PVState } from './PVStateMachine';

export class PVTransitionGuards {
  static canStartExploration(context: PVExplorationContext): boolean {
    return (
      !!context.rootFen &&
      context.maxDepth > 0 &&
      context.maxNodes > 0 &&
      context.timePerPosition > 0
    );
  }

  static canAnalyzePosition(context: PVExplorationContext): boolean {
    return (
      !!context.currentPosition &&
      !context.processedPositions.has(context.currentPosition) &&
      context.graphNodeCount < context.maxNodes
    );
  }

  static canContinueExploration(context: PVExplorationContext): boolean {
    return (
      context.explorationQueue.length > 0 &&
      context.graphNodeCount < context.maxNodes
    );
  }

  static shouldComplete(context: PVExplorationContext): boolean {
    return (
      context.explorationQueue.length === 0 ||
      context.graphNodeCount >= context.maxNodes
    );
  }

  static canRetry(context: PVExplorationContext): boolean {
    return context.retryCount < context.maxRetries;
  }

  static async isEngineReady(context: PVExplorationContext): Promise<boolean> {
    return await context.services.engine.isReady();
  }

  static hasValidQueue(context: PVExplorationContext): boolean {
    return context.explorationQueue.length > 0;
  }

  static isWithinDepthLimit(context: PVExplorationContext): boolean {
    const currentQueueItem = context.explorationQueue[0];
    return currentQueueItem ? currentQueueItem.depth < context.maxDepth : false;
  }

  static isWithinNodeLimit(context: PVExplorationContext): boolean {
    return context.graphNodeCount < context.maxNodes;
  }

  static isPositionUnprocessed(context: PVExplorationContext): boolean {
    return context.currentPosition
      ? !context.processedPositions.has(context.currentPosition)
      : false;
  }
}
