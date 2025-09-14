import {
  StateMachineEngine,
  SimpleEventBus,
  HookPhase,
  HookContext,
} from '../index';
import {
  PVExplorationContext,
  PVState,
  PVEvent,
  PV_STATE_MACHINE_CONFIG,
} from './PVStateMachine';
import { PVExplorationActions } from './PVExplorationActions';
import { IServiceContainer, ServiceFactory } from '../services';
import { ChessGraph } from '../../../graph/ChessGraph';
import { AnalysisStoreService } from '../../../analysis-store/AnalysisStoreService';
import { SerializableState } from '../../persistence/types';
// Remove StatePersistenceService import as it doesn't exist in the current codebase
// import { StatePersistenceService } from '../persistence/StatePersistenceService';

export interface PVExplorationConfig {
  rootFen: string;
  maxDepth: number;
  maxNodes: number;
  timePerPosition: number;
  engineConfig: any;
  maxRetries?: number;

  // Service dependencies
  graph?: ChessGraph;
  analysisStore?: AnalysisStoreService;
  // persistenceService?: StatePersistenceService; // Comment out until implemented
}

export class PVExplorationStrategy {
  private stateMachine: StateMachineEngine<PVExplorationContext>;
  private eventBus: SimpleEventBus;
  private actions: PVExplorationActions;
  private services: IServiceContainer;
  private context: PVExplorationContext;

  private constructor(
    config: PVExplorationConfig,
    services: IServiceContainer
  ) {
    this.services = services;

    // Initialize context
    this.context = {
      rootFen: config.rootFen,
      maxDepth: config.maxDepth,
      maxNodes: config.maxNodes,
      timePerPosition: config.timePerPosition,
      engineConfig: config.engineConfig,
      explorationQueue: [],
      processedPositions: new Set(),
      totalPositions: 0,
      analyzedPositions: 0,
      startTime: 0,
      graphNodeCount: 0,
      retryCount: 0,
      maxRetries: config.maxRetries || 3,
      services: this.services,
    };

    // Initialize event bus and actions
    this.eventBus = new SimpleEventBus();
    this.actions = new PVExplorationActions(this.eventBus);

    // Initialize state machine
    this.stateMachine = new StateMachineEngine(
      {
        ...PV_STATE_MACHINE_CONFIG,
        context: this.context,
      },
      this.eventBus
    );

    this.setupEventHandlers();
  }

  static async create(
    config: PVExplorationConfig
  ): Promise<PVExplorationStrategy> {
    // Initialize services
    const serviceFactory = new ServiceFactory();
    const services = await serviceFactory.createServices({
      // Pass engine configuration if provided
      engine: config.engineConfig?.engine
        ? {
            type: 'local',
            options: {
              engine: config.engineConfig.engine,
            },
          }
        : undefined,
      graph: config.graph ? { type: 'memory', options: {} } : undefined,
      storage: config.analysisStore
        ? { type: 'memory', options: {} }
        : undefined,
      persistence: {
        type: 'file',
        options: { stateDirectory: './tmp/test-state' },
      },
    });

    return new PVExplorationStrategy(config, services);
  }

  private setupEventHandlers(): void {
    console.log('🔍 DEBUG: Setting up event handlers');

    // Register hooks for each state to call the appropriate actions
    this.stateMachine.registerHook({
      id: 'initializing-enter',
      phase: HookPhase.AFTER_ENTER,
      states: [PVState.INITIALIZING],
      handler: async (hookContext: HookContext<any, any>) => {
        console.log('🔍 DEBUG: INITIALIZING state entered');
        try {
          // Initialize exploration queue
          this.context.explorationQueue = [
            {
              fen: this.context.rootFen,
              depth: 0,
            },
          ];
          this.context.processedPositions = new Set();
          this.context.totalPositions = 1;
          this.context.analyzedPositions = 0;
          this.context.startTime = Date.now();

          this.eventBus.emit({
            type: PVEvent.QUEUE_READY,
            payload: this.context,
            timestamp: Date.now(),
          });
        } catch (error) {
          console.error('🔍 DEBUG: Error in INITIALIZING state:', error);
          this.context.lastError = error as Error;
          this.eventBus.emit({
            type: PVEvent.ERROR_OCCURRED,
            payload: this.context,
            timestamp: Date.now(),
          });
        }
      },
    });

    this.stateMachine.registerHook({
      id: 'analyzing-root-enter',
      phase: HookPhase.AFTER_ENTER,
      states: [PVState.ANALYZING_ROOT],
      handler: async (hookContext: HookContext<any, any>) => {
        console.log('🔍 DEBUG: ANALYZING_ROOT state entered');
        try {
          await this.actions.handleRootAnalysisComplete(this.context);
        } catch (error) {
          console.error('🔍 DEBUG: Error in ANALYZING_ROOT state:', error);
          this.context.lastError = error as Error;
          this.eventBus.emit({
            type: PVEvent.ERROR_OCCURRED,
            payload: this.context,
            timestamp: Date.now(),
          });
        }
      },
    });

    this.stateMachine.registerHook({
      id: 'processing-queue-enter',
      phase: HookPhase.AFTER_ENTER,
      states: [PVState.PROCESSING_QUEUE],
      handler: async (hookContext: HookContext<any, any>) => {
        console.log('🔍 DEBUG: PROCESSING_QUEUE state entered');
        try {
          // Check queue state and trigger appropriate event
          if (this.context.explorationQueue.length === 0) {
            this.eventBus.emit({
              type: PVEvent.QUEUE_EMPTY,
              payload: this.context,
              timestamp: Date.now(),
            });
          } else if (this.context.graphNodeCount >= this.context.maxNodes) {
            this.eventBus.emit({
              type: PVEvent.QUEUE_EMPTY,
              payload: this.context,
              timestamp: Date.now(),
            });
          } else {
            // Get next position from queue and set as current
            const nextPosition = this.context.explorationQueue.shift();
            if (nextPosition) {
              this.context.currentPosition = nextPosition.fen;
              this.eventBus.emit({
                type: PVEvent.QUEUE_READY,
                payload: this.context,
                timestamp: Date.now(),
              });
            }
          }
        } catch (error) {
          console.error('🔍 DEBUG: Error in PROCESSING_QUEUE state:', error);
          this.context.lastError = error as Error;
          this.eventBus.emit({
            type: PVEvent.ERROR_OCCURRED,
            payload: this.context,
            timestamp: Date.now(),
          });
        }
      },
    });

    this.stateMachine.registerHook({
      id: 'analyzing-position-enter',
      phase: HookPhase.AFTER_ENTER,
      states: [PVState.ANALYZING_POSITION],
      handler: async (hookContext: HookContext<any, any>) => {
        console.log('🔍 DEBUG: ANALYZING_POSITION state entered');
        try {
          // Do the analysis work without emitting completion event
          await this.actions.analyzeCurrentPosition(this.context);

          // After analysis is complete, emit the transition event
          this.eventBus.emit({
            type: PVEvent.POSITION_ANALYSIS_COMPLETE,
            payload: this.context,
            timestamp: Date.now(),
          });
        } catch (error) {
          console.error('🔍 DEBUG: Error in ANALYZING_POSITION state:', error);
          this.context.lastError = error as Error;
          this.eventBus.emit({
            type: PVEvent.ERROR_OCCURRED,
            payload: this.context,
            timestamp: Date.now(),
          });
        }
      },
    });

    this.stateMachine.registerHook({
      id: 'building-graph-enter',
      phase: HookPhase.AFTER_ENTER,
      states: [PVState.BUILDING_GRAPH],
      handler: async (hookContext: HookContext<any, any>) => {
        console.log('🔍 DEBUG: BUILDING_GRAPH state entered');
        try {
          // Do the graph building work without emitting completion event
          await this.actions.buildGraphFromAnalysis(this.context);

          // After graph building is complete, emit the transition event
          this.eventBus.emit({
            type: PVEvent.GRAPH_UPDATE_COMPLETE,
            payload: this.context,
            timestamp: Date.now(),
          });
        } catch (error) {
          console.error('🔍 DEBUG: Error in BUILDING_GRAPH state:', error);
          this.context.lastError = error as Error;
          this.eventBus.emit({
            type: PVEvent.ERROR_OCCURRED,
            payload: this.context,
            timestamp: Date.now(),
          });
        }
      },
    });

    this.stateMachine.registerHook({
      id: 'storing-results-enter',
      phase: HookPhase.AFTER_ENTER,
      states: [PVState.STORING_RESULTS],
      handler: async (hookContext: HookContext<any, any>) => {
        console.log('🔍 DEBUG: STORING_RESULTS state entered');
        try {
          // Do the storage work without emitting completion event
          await this.actions.storeResults(this.context);

          // After storage is complete, emit the transition event
          this.eventBus.emit({
            type: PVEvent.STORAGE_COMPLETE,
            payload: this.context,
            timestamp: Date.now(),
          });
        } catch (error) {
          console.error('🔍 DEBUG: Error in STORING_RESULTS state:', error);
          this.context.lastError = error as Error;
          this.eventBus.emit({
            type: PVEvent.ERROR_OCCURRED,
            payload: this.context,
            timestamp: Date.now(),
          });
        }
      },
    });

    this.eventBus.subscribe(PVEvent.START_EXPLORATION, async event => {
      console.log('🔍 DEBUG: Received START_EXPLORATION event');
      try {
        // Use send() method instead of transition()
        await this.stateMachine.send({
          type: PVEvent.START_EXPLORATION,
          payload: this.context,
          timestamp: Date.now(),
        });
        console.log('🔍 DEBUG: Sent START_EXPLORATION to state machine');
      } catch (error) {
        console.error(
          '🔍 DEBUG: Error sending START_EXPLORATION:',
          (error as Error).message
        );
      }
    });

    this.eventBus.subscribe(PVEvent.QUEUE_READY, async event => {
      console.log('🔍 DEBUG: Received QUEUE_READY event');
      try {
        // Use send() method instead of transition()
        await this.stateMachine.send({
          type: PVEvent.QUEUE_READY,
          payload: this.context,
          timestamp: Date.now(),
        });
        console.log('🔍 DEBUG: Sent QUEUE_READY to state machine');
      } catch (error) {
        console.error('🔍 DEBUG: Error sending QUEUE_READY:', error);
      }
    });

    console.log('🔍 DEBUG: Event handlers setup completed');

    // Register action handlers for state machine events
    this.eventBus.subscribe(
      PVEvent.ROOT_ANALYSIS_COMPLETE,
      async (event: any) => {
        await this.actions.handleRootAnalysisComplete(
          event.payload || this.context
        );
      }
    );

    this.eventBus.subscribe(
      PVEvent.POSITION_ANALYSIS_COMPLETE,
      async (event: any) => {
        await this.actions.handlePositionAnalysisComplete(
          event.payload || this.context
        );
      }
    );

    this.eventBus.subscribe(
      PVEvent.GRAPH_UPDATE_COMPLETE,
      async (event: any) => {
        await this.actions.handleGraphUpdateComplete(
          event.payload || this.context
        );
      }
    );

    this.eventBus.subscribe(PVEvent.STORAGE_COMPLETE, async (event: any) => {
      await this.actions.handleStorageComplete(event.payload || this.context);
    });

    this.eventBus.subscribe(PVEvent.ERROR_OCCURRED, async (event: any) => {
      await this.actions.handleErrorOccurred(event.payload || this.context);
    });

    // Remove this entire subscription block - it's no longer needed since we use hooks
    // this.eventBus.subscribe('state_changed', async (event: any) => {
    //   await this.handleStateTransition(
    //     event.payload.from,
    //     event.payload.to,
    //     this.context
    //   );
    // });
  }

  // Public API methods
  async start(): Promise<void> {
    console.log('🔍 DEBUG: PVExplorationStrategy.start() called');
    console.log('🔍 DEBUG: Current state:', this.getCurrentState());
    console.log(
      '🔍 DEBUG: Context:',
      JSON.stringify(
        {
          rootFen: this.context.rootFen,
          maxDepth: this.context.maxDepth,
          maxNodes: this.context.maxNodes,
          engineConfig: this.context.engineConfig,
        },
        null,
        2
      )
    );

    try {
      console.log('🔍 DEBUG: Sending START_EXPLORATION event to state machine');
      await this.stateMachine.send({
        type: PVEvent.START_EXPLORATION,
        payload: this.context,
        timestamp: Date.now(),
      });
      console.log('🔍 DEBUG: State machine send completed');

      console.log('🔍 DEBUG: Emitting START_EXPLORATION event to event bus');
      this.eventBus.emit({
        type: PVEvent.START_EXPLORATION,
        payload: this.context,
        timestamp: Date.now(),
      });
      console.log('🔍 DEBUG: Event bus emit completed');
    } catch (error) {
      console.error('🔍 DEBUG: Error in start() method:', error);
      throw error;
    }
  }

  async pause(): Promise<void> {
    this.eventBus.emit({
      type: PVEvent.PAUSE_REQUESTED,
      payload: this.context,
      timestamp: Date.now(),
    });
  }

  async resume(): Promise<void> {
    this.eventBus.emit({
      type: PVEvent.RESUME_REQUESTED,
      payload: this.context,
      timestamp: Date.now(),
    });
  }

  async cancel(): Promise<void> {
    this.eventBus.emit({
      type: PVEvent.CANCEL_REQUESTED,
      payload: this.context,
      timestamp: Date.now(),
    });
    await this.stateMachine.send({
      type: PVEvent.CANCEL_REQUESTED,
      payload: this.context,
      timestamp: Date.now(),
    });
  }

  async retry(): Promise<void> {
    if (this.context.retryCount < this.context.maxRetries) {
      this.eventBus.emit({
        type: PVEvent.RETRY_REQUESTED,
        payload: this.context,
        timestamp: Date.now(),
      });
    }
  }

  // Status and monitoring
  getCurrentState(): PVState {
    return this.stateMachine.currentState.name as PVState;
  }

  getContext(): Readonly<PVExplorationContext> {
    return { ...this.context };
  }

  getProgress(): {
    current: number;
    total: number;
    percentage: number;
    state: PVState;
    nodesCreated: number;
    queueSize: number;
  } {
    return {
      current: this.context.analyzedPositions,
      total: this.context.totalPositions,
      percentage:
        this.context.totalPositions > 0
          ? (this.context.analyzedPositions / this.context.totalPositions) * 100
          : 0,
      state: this.getCurrentState(),
      nodesCreated: this.context.graphNodeCount,
      queueSize: this.context.explorationQueue.length,
    };
  }

  isRunning(): boolean {
    const state = this.getCurrentState();
    return ![
      PVState.IDLE,
      PVState.COMPLETED,
      PVState.ERROR,
      PVState.CANCELLED,
      PVState.PAUSED,
    ].includes(state);
  }

  isPaused(): boolean {
    return this.getCurrentState() === PVState.PAUSED;
  }

  isCompleted(): boolean {
    return this.getCurrentState() === PVState.COMPLETED;
  }

  hasError(): boolean {
    return this.getCurrentState() === PVState.ERROR;
  }

  getLastError(): Error | undefined {
    return this.context.lastError;
  }

  onProgress(callback: (progress: any) => void): () => void {
    const progressService = this.services.progress;
    // Cast to the concrete implementation to access event methods
    const eventEmitter = progressService as any;
    eventEmitter.on('progress', callback);
    return () => eventEmitter.off('progress', callback);
  }

  onEvent(
    event: PVEvent,
    callback: (context: PVExplorationContext) => void
  ): () => void {
    const unsubscribe = this.eventBus.subscribe(event, eventData => {
      callback(eventData.payload || this.stateMachine.context);
    });
    return unsubscribe;
  }

  onStateChange(
    callback: (from: string, to: string, context: PVExplorationContext) => void
  ): () => void {
    const unsubscribe = this.eventBus.subscribe('state_changed', event => {
      const { from, to, context } = event.payload;
      callback(from, to, context);
    });
    return unsubscribe;
  }

  // Cleanup method
  cleanup(): void {
    this.eventBus.clear();
    const progressService = this.services.progress as any;
    if (progressService.removeAllListeners) {
      progressService.removeAllListeners();
    }
  }

  // State management
  setState(state: string, context?: PVExplorationContext): Promise<void> {
    // Send an event to transition to the desired state
    return this.stateMachine.send({
      type: 'SET_STATE',
      payload: { targetState: state, context },
      timestamp: Date.now(),
    });
  }

  // Resource cleanup
  async dispose(): Promise<void> {
    await this.cancel();
    await this.services.engine.stop();
    this.eventBus.clear();
  }

  // Advanced features
  async saveCheckpoint(): Promise<void> {
    const checkpointData: SerializableState = {
      sessionId: `pv-checkpoint-${Date.now()}`,
      strategyName: 'PVExploration',
      projectName: 'current-project',
      rootPosition: this.context.rootFen,
      state: {
        positionsToAnalyze: this.context.explorationQueue.map(item => item.fen),
        analyzedPositions: Array.from(this.context.processedPositions),
        currentDepth: 0, // Use a default value since this property doesn't exist on context
        maxDepth: this.context.maxDepth,
        positionDepths: [], // Use empty array since positionDepths doesn't exist on context
        stats: {
          totalAnalyzed: this.context.analyzedPositions,
          totalDiscovered: this.context.totalPositions,
          startTime: new Date(this.context.startTime),
          lastUpdate: new Date(),
          avgTimePerPosition: 0,
        },
      },
      savedAt: new Date(),
      config: this.context.engineConfig,
      metadata: {
        version: '1.0.0',
        engineSlug: 'stockfish',
      },
    };

    await this.services.persistence.saveState({
      sessionId: checkpointData.sessionId,
      state: checkpointData,
      metadata: checkpointData.metadata,
    });
  }

  async loadCheckpoint(sessionId: string): Promise<boolean> {
    const savedState = await this.services.persistence.loadState(sessionId);
    if (!savedState) {
      return false;
    }

    // Restore context from saved state
    this.context.explorationQueue = savedState.state.positionsToAnalyze.map(
      fen => ({
        fen,
        depth:
          savedState.state.positionDepths.find(([f]) => f === fen)?.[1] || 0,
        parentNodeId: undefined,
        move: undefined,
      })
    );
    this.context.processedPositions = new Set(
      savedState.state.analyzedPositions || []
    );
    this.context.maxDepth = savedState.state.maxDepth || 0;

    return true;
  }

  async getAnalysisResults(): Promise<{
    graph: any;
    statistics: {
      totalPositions: number;
      analyzedPositions: number;
      nodesCreated: number;
      duration: number;
      averageTimePerPosition: number;
    };
  }> {
    const graphService = this.services.graph;
    const metadata = await graphService.getStats();

    const duration = Date.now() - this.context.startTime;

    return {
      graph: metadata,
      statistics: {
        totalPositions: this.context.totalPositions,
        analyzedPositions: this.context.analyzedPositions,
        nodesCreated: this.context.graphNodeCount,
        duration,
        averageTimePerPosition:
          this.context.analyzedPositions > 0
            ? duration / this.context.analyzedPositions
            : 0,
      },
    };
  }
}
