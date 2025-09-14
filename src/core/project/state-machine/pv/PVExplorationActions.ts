import { PVExplorationContext, PVEvent, PVState } from './PVStateMachine';
import { SimpleEventBus } from '../EventBus';
import { Chess } from 'chess.ts';

export class PVExplorationActions {
  constructor(private eventBus: SimpleEventBus) {}

  async handleRootAnalysisComplete(
    context: PVExplorationContext
  ): Promise<void> {
    try {
      // Use the stored analysis result instead of re-analyzing
      if (!context.lastAnalysisResult) {
        throw new Error('No analysis result available for root position');
      }

      const result = context.lastAnalysisResult;

      console.log(
        `✅ Root analysis complete. Found ${result.result.pvs?.length || 0} variations`
      );
      console.log(
        `📊 Evaluation: ${result.result.score?.score || 'N/A'}, Depth: ${result.result.depth}`
      );

      if (result.result.pvs && result.result.pvs.length > 0) {
        const chess = new Chess(context.rootFen);
        let currentFen = context.rootFen;

        for (
          let i = 0;
          i <
          Math.min(result.result.pvs[0].split(' ').length, context.maxDepth);
          i++
        ) {
          const moves = result.result.pvs[0].split(' ');
          const move = moves[i];

          try {
            chess.move(move);
            currentFen = chess.fen();

            if (!context.processedPositions.has(currentFen)) {
              context.explorationQueue.push({
                fen: currentFen,
                depth: i + 1,
                parentNodeId: context.rootNodeId,
                move: move,
              });
              context.totalPositions++;
            }
          } catch (error) {
            console.warn(`Invalid move in PV: ${move}`);
            break;
          }
        }
      }

      this.eventBus.emit({
        type: PVEvent.GRAPH_UPDATE_COMPLETE,
        payload: context,
        timestamp: Date.now(),
      });
    } catch (error) {
      context.lastError = error as Error;
      this.eventBus.emit({
        type: PVEvent.ERROR_OCCURRED,
        payload: context,
        timestamp: Date.now(),
      });
    }
  }

  async handlePositionAnalysisComplete(
    context: PVExplorationContext
  ): Promise<void> {
    try {
      if (!context.currentPosition) return;

      const engineService = context.services.engine;
      const result = await engineService.analyzePosition({
        position: context.currentPosition,
        config: {
          depth: context.engineConfig.depth || 10, // Use configured depth or lighter default
          time: context.timePerPosition, // timePerPosition is already in seconds
        },
      });

      console.log(
        `✅ Position analysis complete. Evaluation: ${result.result.score?.score || 'N/A'}, Depth: ${result.result.depth}`
      );

      // Add current position to graph
      const graphService = context.services.graph;
      await graphService.addMove(
        context.currentPosition,
        {
          move: result.result.pvs[0]?.split(' ')[0] || '',
          toFen: context.currentPosition, // This should be the resulting position after the move
          metadata: {
            evaluation: result.result.score,
            depth: result.result.depth,
            analysisTime: context.timePerPosition,
            timestamp: Date.now(),
          },
        },
        { isPrimary: true }
      );

      context.graphNodeCount++;

      // Add PV moves to exploration queue
      if (result.result.pvs && result.result.pvs.length > 0) {
        const chess = new Chess(context.currentPosition);
        let currentFen = context.currentPosition;

        const pvMoves = result.result.pvs[0].split(' ');
        for (let i = 0; i < Math.min(pvMoves.length, 3); i++) {
          const move = pvMoves[i];

          try {
            chess.move(move);
            currentFen = chess.fen();
            // Get depth from the current queue item instead of context.currentDepth
            const currentQueueItem = context.explorationQueue.find(
              item => item.fen === context.currentPosition
            );
            const newDepth = (currentQueueItem?.depth || 0) + 1;

            if (
              !context.processedPositions.has(currentFen) &&
              newDepth < context.maxDepth
            ) {
              context.explorationQueue.push({
                fen: currentFen,
                depth: newDepth,
                parentNodeId: context.currentPosition, // Use current position as parent reference
                move: move,
              });
              context.totalPositions++;
            }
          } catch (error) {
            // Invalid move, skip
            break;
          }
        }
      }

      // Mark position as processed
      context.processedPositions.add(context.currentPosition);
      context.analyzedPositions++;

      // Store the analysis result
      context.lastAnalysisResult = result.result;

      // Emit the correct event for state transition
      this.eventBus.emit({
        type: PVEvent.POSITION_ANALYSIS_COMPLETE,
        payload: context,
        timestamp: Date.now(),
      });
    } catch (error) {
      context.lastError = error as Error;
      this.eventBus.emit({
        type: PVEvent.ERROR_OCCURRED,
        payload: context,
        timestamp: Date.now(),
      });
    }
  }

  async handleGraphUpdateComplete(
    context: PVExplorationContext
  ): Promise<void> {
    try {
      // Periodic storage of intermediate results
      if (context.graphNodeCount % 10 === 0) {
        const storageService = context.services.storage;
        const engineService = context.services.engine;

        // Get analysis result for the current position
        const result = await engineService.analyzePosition({
          position: context.currentPosition || context.rootFen,
          config: {
            depth: 15,
            time: context.timePerPosition,
          },
        });

        await storageService.storeAnalysis({
          result: result.result,
          engineSlug: 'pv-exploration',
          metadata: {
            checkpoint: true,
            nodeCount: context.graphNodeCount,
            analyzedPositions: context.analyzedPositions,
          },
        });
      }

      this.eventBus.emit({
        type: PVEvent.STORAGE_COMPLETE,
        payload: context,
        timestamp: Date.now(),
      });
    } catch (error) {
      context.lastError = error as Error;
      this.eventBus.emit({
        type: PVEvent.ERROR_OCCURRED,
        payload: context,
        timestamp: Date.now(),
      });
    }
  }

  async handleStorageComplete(context: PVExplorationContext): Promise<void> {
    try {
      const storageService = context.services.storage;

      // Get the latest analysis result from context or re-analyze if needed
      const engineService = context.services.engine;
      const result = await engineService.analyzePosition({
        position: context.currentPosition || context.rootFen,
        config: {
          depth: 15,
          time: context.timePerPosition,
        },
      });

      await storageService.storeAnalysis({
        result: result.result,
        engineSlug: 'pv-exploration',
        metadata: {
          checkpoint: true,
          nodeCount: context.graphNodeCount,
          analyzedPositions: context.analyzedPositions,
        },
      });

      this.eventBus.emit({
        type: PVEvent.STORAGE_COMPLETE,
        payload: context,
        timestamp: Date.now(),
      });
    } catch (error) {
      context.lastError = error as Error;
      this.eventBus.emit({
        type: PVEvent.ERROR_OCCURRED,
        payload: context,
        timestamp: Date.now(),
      });
    }
  }

  async handleErrorOccurred(context: PVExplorationContext): Promise<void> {
    context.retryCount++;

    if (context.retryCount < context.maxRetries) {
      // Wait before retry
      await new Promise(resolve =>
        setTimeout(resolve, 1000 * context.retryCount)
      );
      this.eventBus.emit({
        type: PVEvent.RETRY_REQUESTED,
        payload: context,
        timestamp: Date.now(),
      });
    }
  }

  async analyzeCurrentPosition(context: PVExplorationContext): Promise<void> {
    if (!context.currentPosition) return;

    const engineService = context.services.engine;
    const result = await engineService.analyzePosition({
      position: context.currentPosition,
      config: {
        depth: context.engineConfig.depth || 10,
        time: context.timePerPosition,
      },
    });

    console.log(
      `✅ Position analysis complete. Evaluation: ${result.result.score?.score || 'N/A'}, Depth: ${result.result.depth}`
    );

    // Store the analysis result for the next state
    context.lastAnalysisResult = result;

    // Mark position as processed
    context.processedPositions.add(context.currentPosition);
    context.analyzedPositions++;
  }

  async buildGraphFromAnalysis(context: PVExplorationContext): Promise<void> {
    if (!context.lastAnalysisResult || !context.currentPosition) return;

    const result = context.lastAnalysisResult;

    // Add current position to graph
    const graphService = context.services.graph;
    await graphService.addMove(
      context.currentPosition,
      {
        move: result.result.pvs[0]?.split(' ')[0] || '',
        toFen: context.currentPosition,
        metadata: {
          evaluation: result.result.score,
          depth: result.result.depth,
          analysisTime: context.timePerPosition,
          timestamp: Date.now(),
        },
      },
      { isPrimary: true }
    );

    context.graphNodeCount++;

    // Add PV moves to exploration queue
    if (result.result.pvs && result.result.pvs.length > 0) {
      const chess = new Chess(context.currentPosition);
      const moves = result.result.pvs[0].split(' ');

      for (const moveStr of moves.slice(0, 3)) {
        try {
          const move = chess.move(moveStr);
          if (move) {
            const newFen = chess.fen();
            if (!context.processedPositions.has(newFen)) {
              context.explorationQueue.push({
                fen: newFen,
                depth: (context.explorationQueue[0]?.depth || 0) + 1,
                parentNodeId: context.currentPosition,
                move: moveStr,
              });
              context.totalPositions++;
            }
          }
        } catch {
          break;
        }
      }
    }
  }

  async storeResults(context: PVExplorationContext): Promise<void> {
    // Store analysis results if needed
    if (context.services.storage && context.lastAnalysisResult) {
      await context.services.storage.storeAnalysis({
        result: context.lastAnalysisResult.result,
        engineSlug: 'default-engine',
        metadata: {
          timestamp: Date.now(),
          position: context.currentPosition,
        },
      });
    }
  }
}
