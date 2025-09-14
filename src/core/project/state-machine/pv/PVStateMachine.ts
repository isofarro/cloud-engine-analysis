import {
  State,
  Event,
  Transition,
  StateMachine,
  StateMachineConfig,
} from '../types';
import { IServiceContainer, AnalysisRequest } from '../services/types';

// PV Exploration States
export enum PVState {
  IDLE = 'IDLE',
  INITIALIZING = 'INITIALIZING',
  ANALYZING_ROOT = 'ANALYZING_ROOT',
  PROCESSING_QUEUE = 'PROCESSING_QUEUE',
  ANALYZING_POSITION = 'ANALYZING_POSITION',
  BUILDING_GRAPH = 'BUILDING_GRAPH',
  STORING_RESULTS = 'STORING_RESULTS',
  PAUSED = 'PAUSED',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR',
  CANCELLED = 'CANCELLED',
}

// PV Exploration Events
export enum PVEvent {
  START_EXPLORATION = 'START_EXPLORATION',
  ROOT_ANALYSIS_COMPLETE = 'ROOT_ANALYSIS_COMPLETE',
  QUEUE_READY = 'QUEUE_READY',
  POSITION_ANALYSIS_COMPLETE = 'POSITION_ANALYSIS_COMPLETE',
  GRAPH_UPDATE_COMPLETE = 'GRAPH_UPDATE_COMPLETE',
  STORAGE_COMPLETE = 'STORAGE_COMPLETE',
  QUEUE_EMPTY = 'QUEUE_EMPTY',
  PAUSE_REQUESTED = 'PAUSE_REQUESTED',
  RESUME_REQUESTED = 'RESUME_REQUESTED',
  CANCEL_REQUESTED = 'CANCEL_REQUESTED',
  ERROR_OCCURRED = 'ERROR_OCCURRED',
  RETRY_REQUESTED = 'RETRY_REQUESTED',
}

// PV Exploration Context Data
export interface PVExplorationContext {
  // Configuration
  rootFen: string;
  maxDepth: number;
  maxNodes: number;
  timePerPosition: number;
  engineConfig: any;

  // Runtime State
  currentPosition?: string;
  explorationQueue: Array<{
    fen: string;
    depth: number;
    parentNodeId?: string;
    move?: string;
  }>;
  processedPositions: Set<string>;

  // Progress Tracking
  totalPositions: number;
  analyzedPositions: number;
  startTime: number;

  // Results
  rootNodeId?: string;
  graphNodeCount: number;

  // Error Handling
  lastError?: Error;
  lastAnalysisResult?: any;
  retryCount: number;
  maxRetries: number;

  // Services
  services: IServiceContainer;
}

// State Definitions - Simple state objects without lifecycle methods
export const PV_STATES: Record<PVState, State<PVExplorationContext>> = {
  [PVState.IDLE]: {
    id: PVState.IDLE,
    name: PVState.IDLE,
  },

  [PVState.INITIALIZING]: {
    id: PVState.INITIALIZING,
    name: PVState.INITIALIZING,
  },

  [PVState.ANALYZING_ROOT]: {
    id: PVState.ANALYZING_ROOT,
    name: PVState.ANALYZING_ROOT,
  },

  [PVState.PROCESSING_QUEUE]: {
    id: PVState.PROCESSING_QUEUE,
    name: PVState.PROCESSING_QUEUE,
  },

  [PVState.ANALYZING_POSITION]: {
    id: PVState.ANALYZING_POSITION,
    name: PVState.ANALYZING_POSITION,
  },

  [PVState.BUILDING_GRAPH]: {
    id: PVState.BUILDING_GRAPH,
    name: PVState.BUILDING_GRAPH,
  },

  [PVState.STORING_RESULTS]: {
    id: PVState.STORING_RESULTS,
    name: PVState.STORING_RESULTS,
  },

  [PVState.PAUSED]: {
    id: PVState.PAUSED,
    name: PVState.PAUSED,
  },

  [PVState.COMPLETED]: {
    id: PVState.COMPLETED,
    name: PVState.COMPLETED,
    isFinal: true,
  },

  [PVState.ERROR]: {
    id: PVState.ERROR,
    name: PVState.ERROR,
    isFinal: true,
  },

  [PVState.CANCELLED]: {
    id: PVState.CANCELLED,
    name: PVState.CANCELLED,
    isFinal: true,
  },
};

// Transition Definitions
export const PV_TRANSITIONS: Transition<PVExplorationContext>[] = [
  // From IDLE
  {
    from: PVState.IDLE,
    to: PVState.INITIALIZING,
    on: PVEvent.START_EXPLORATION,
    guard: context => !!context.rootFen && context.maxDepth > 0,
  },

  // From INITIALIZING
  {
    from: PVState.INITIALIZING,
    to: PVState.ANALYZING_ROOT,
    on: PVEvent.QUEUE_READY,
    guard: context => context.explorationQueue.length > 0,
  },
  {
    from: PVState.INITIALIZING,
    to: PVState.ERROR,
    on: PVEvent.ERROR_OCCURRED,
  },

  // From ANALYZING_ROOT
  {
    from: PVState.ANALYZING_ROOT,
    to: PVState.BUILDING_GRAPH,
    on: PVEvent.ROOT_ANALYSIS_COMPLETE,
  },
  {
    from: PVState.ANALYZING_ROOT,
    to: PVState.ERROR,
    on: PVEvent.ERROR_OCCURRED,
  },

  // From PROCESSING_QUEUE
  {
    from: PVState.PROCESSING_QUEUE,
    to: PVState.ANALYZING_POSITION,
    on: PVEvent.QUEUE_READY,
    guard: context =>
      !!context.currentPosition &&
      !context.processedPositions.has(context.currentPosition),
  },
  {
    from: PVState.PROCESSING_QUEUE,
    to: PVState.COMPLETED,
    on: PVEvent.QUEUE_EMPTY,
    guard: context => context.explorationQueue.length === 0,
  },
  {
    from: PVState.PROCESSING_QUEUE,
    to: PVState.COMPLETED,
    on: PVEvent.QUEUE_READY,
    guard: context => context.graphNodeCount >= context.maxNodes,
  },

  // From ANALYZING_POSITION
  {
    from: PVState.ANALYZING_POSITION,
    to: PVState.BUILDING_GRAPH,
    on: PVEvent.POSITION_ANALYSIS_COMPLETE,
  },
  {
    from: PVState.ANALYZING_POSITION,
    to: PVState.ERROR,
    on: PVEvent.ERROR_OCCURRED,
  },

  // From BUILDING_GRAPH
  {
    from: PVState.BUILDING_GRAPH,
    to: PVState.STORING_RESULTS,
    on: PVEvent.GRAPH_UPDATE_COMPLETE,
  },
  {
    from: PVState.BUILDING_GRAPH,
    to: PVState.ERROR,
    on: PVEvent.ERROR_OCCURRED,
  },

  // From STORING_RESULTS
  {
    from: PVState.STORING_RESULTS,
    to: PVState.PROCESSING_QUEUE,
    on: PVEvent.STORAGE_COMPLETE,
    guard: context =>
      context.explorationQueue.length > 0 &&
      context.graphNodeCount < context.maxNodes,
  },
  {
    from: PVState.STORING_RESULTS,
    to: PVState.COMPLETED,
    on: PVEvent.STORAGE_COMPLETE,
    guard: context =>
      context.explorationQueue.length === 0 ||
      context.graphNodeCount >= context.maxNodes,
  },

  // Pause/Resume from any active state
  {
    from: PVState.ANALYZING_ROOT,
    to: PVState.PAUSED,
    on: PVEvent.PAUSE_REQUESTED,
  },
  {
    from: PVState.PROCESSING_QUEUE,
    to: PVState.PAUSED,
    on: PVEvent.PAUSE_REQUESTED,
  },
  {
    from: PVState.ANALYZING_POSITION,
    to: PVState.PAUSED,
    on: PVEvent.PAUSE_REQUESTED,
  },
  {
    from: PVState.BUILDING_GRAPH,
    to: PVState.PAUSED,
    on: PVEvent.PAUSE_REQUESTED,
  },
  {
    from: PVState.PAUSED,
    to: PVState.PROCESSING_QUEUE,
    on: PVEvent.RESUME_REQUESTED,
  },

  // Cancel from any state
  {
    from: PVState.IDLE,
    to: PVState.CANCELLED,
    on: PVEvent.CANCEL_REQUESTED,
  },
  {
    from: PVState.INITIALIZING,
    to: PVState.CANCELLED,
    on: PVEvent.CANCEL_REQUESTED,
  },
  {
    from: PVState.ANALYZING_ROOT,
    to: PVState.CANCELLED,
    on: PVEvent.CANCEL_REQUESTED,
  },
  {
    from: PVState.PROCESSING_QUEUE,
    to: PVState.CANCELLED,
    on: PVEvent.CANCEL_REQUESTED,
  },
  {
    from: PVState.ANALYZING_POSITION,
    to: PVState.CANCELLED,
    on: PVEvent.CANCEL_REQUESTED,
  },
  {
    from: PVState.BUILDING_GRAPH,
    to: PVState.CANCELLED,
    on: PVEvent.CANCEL_REQUESTED,
  },
  {
    from: PVState.STORING_RESULTS,
    to: PVState.CANCELLED,
    on: PVEvent.CANCEL_REQUESTED,
  },
  {
    from: PVState.PAUSED,
    to: PVState.CANCELLED,
    on: PVEvent.CANCEL_REQUESTED,
  },

  // Error handling
  {
    from: PVState.IDLE,
    to: PVState.ERROR,
    on: PVEvent.ERROR_OCCURRED,
  },
  {
    from: PVState.PROCESSING_QUEUE,
    to: PVState.ERROR,
    on: PVEvent.ERROR_OCCURRED,
  },
  {
    from: PVState.STORING_RESULTS,
    to: PVState.ERROR,
    on: PVEvent.ERROR_OCCURRED,
  },
  {
    from: PVState.ERROR,
    to: PVState.PROCESSING_QUEUE,
    on: PVEvent.RETRY_REQUESTED,
    guard: context => context.retryCount < context.maxRetries,
  },
];

// State Machine Configuration
export const PV_STATE_MACHINE_CONFIG: StateMachineConfig<PVExplorationContext> =
  {
    id: 'pv-exploration',
    initialState: PVState.IDLE,
    states: Object.values(PV_STATES),
    transitions: PV_TRANSITIONS,
    context: {} as PVExplorationContext,
  };

// Lifecycle Actions - These should be implemented as hooks when creating the state machine
export class PVStateMachineActions {
  constructor(private eventBus: any) {}

  async initializeExploration(context: PVExplorationContext): Promise<void> {
    await context.services.progress.reportProgress({
      step: 'idle',
      progress: 0,
      stats: {
        analyzed: 0,
        discovered: 0,
        remaining: 0,
        currentDepth: 0,
        maxDepth: context.maxDepth,
      },
      timestamp: Date.now(),
    });

    await context.services.progress.startSession(
      'pv-exploration',
      'Initializing PV exploration'
    );

    // Initialize exploration queue with root position
    context.explorationQueue = [
      {
        fen: context.rootFen,
        depth: 0,
      },
    ];
    context.processedPositions = new Set();
    context.analyzedPositions = 0;
    context.totalPositions = 1;
    context.graphNodeCount = 0;
    context.retryCount = 0;
    context.startTime = Date.now();
  }

  async analyzeRootPosition(context: PVExplorationContext): Promise<void> {
    await context.services.progress.reportProgress({
      step: 'analyzing_root',
      progress: 0.1,
      currentPosition: context.rootFen,
      stats: {
        analyzed: 0,
        discovered: 1,
        remaining: 1,
        currentDepth: 0,
        maxDepth: context.maxDepth,
      },
      timestamp: Date.now(),
    });

    const engineService = context.services.engine;
    const analysisRequest: AnalysisRequest = {
      position: context.rootFen,
      config: {
        depth: 15,
        time: context.timePerPosition,
      },
    };

    const response = await engineService.analyzePosition(analysisRequest);

    // Store analysis result
    context.currentPosition = context.rootFen;

    // Add root node to graph
    const graphService = context.services.graph;
    await graphService.addMove(context.rootFen, {
      move: response.result.pvs[0]?.split(' ')[0] || '',
      toFen: context.rootFen,
      metadata: {
        evaluation:
          response.result.score.type === 'cp'
            ? response.result.score.score
            : response.result.score.type === 'mate'
              ? response.result.score.score > 0
                ? 30000
                : -30000
              : 0,
        depth: response.result.depth,
        principalVariation: response.result.pvs[0] || '',
        analysisTime: response.duration,
      },
    });

    context.graphNodeCount++;
  }

  async processQueue(context: PVExplorationContext): Promise<void> {
    // Check if queue is empty
    if (context.explorationQueue.length === 0) {
      return; // Will trigger QUEUE_EMPTY event
    }

    // Get next position from queue
    const nextPosition = context.explorationQueue.shift()!;
    context.currentPosition = nextPosition.fen;

    // Check if already processed
    if (context.processedPositions.has(nextPosition.fen)) {
      return; // Will continue processing queue
    }

    // Check depth and node limits
    if (
      nextPosition.depth >= context.maxDepth ||
      context.graphNodeCount >= context.maxNodes
    ) {
      return; // Will trigger completion
    }

    context.processedPositions.add(nextPosition.fen);
  }

  async analyzePosition(context: PVExplorationContext): Promise<void> {
    if (!context.currentPosition) return;

    await context.services.progress.reportProgress({
      step: 'analyzing_position',
      progress: context.analyzedPositions / context.totalPositions,
      currentPosition: context.currentPosition,
      stats: {
        analyzed: context.analyzedPositions,
        discovered: context.totalPositions,
        remaining: context.explorationQueue.length,
        currentDepth: 0,
        maxDepth: context.maxDepth,
      },
      timestamp: Date.now(),
    });

    const engineService = context.services.engine;
    const analysisRequest: AnalysisRequest = {
      position: context.currentPosition,
      config: {
        depth: 15,
        time: context.timePerPosition,
      },
    };

    try {
      const analysisResult =
        await engineService.analyzePosition(analysisRequest);
      context.analyzedPositions++;

      // Store the analysis result for the BUILDING_GRAPH state
      context.lastAnalysisResult = analysisResult;

      // Emit POSITION_ANALYSIS_COMPLETE event to trigger transition to BUILDING_GRAPH
      // This should be handled by the event bus in the state machine integration
      if (this.eventBus) {
        await this.eventBus.emit({
          type: PVEvent.POSITION_ANALYSIS_COMPLETE,
          payload: {
            position: context.currentPosition,
            result: analysisResult,
            context: context,
          },
          timestamp: Date.now(),
        });
      }
    } catch (error) {
      context.lastError = error as Error;
      if (this.eventBus) {
        await this.eventBus.emit({
          type: PVEvent.ERROR_OCCURRED,
          payload: context,
          timestamp: Date.now(),
        });
      }
      throw error;
    }
  }

  async buildGraph(context: PVExplorationContext): Promise<void> {
    // Add current position to graph and create edges
    // Add PV moves to exploration queue
    // This will be implemented in the action handlers
  }

  async storeResults(context: PVExplorationContext): Promise<void> {
    const storageService = context.services.storage;
    const graphService = context.services.graph;

    // Save current graph state
    await graphService.save();

    // Store analysis metadata
    await storageService.storeAnalysis({
      result: {
        fen: context.rootFen,
        depth: 0,
        selDepth: 0,
        multiPV: 1,
        score: {
          type: 'cp' as const,
          score: 0,
        },
        pvs: [],
      },
      engineSlug: 'pv-exploration',
      metadata: {
        rootFen: context.rootFen,
        nodeCount: context.graphNodeCount,
        analyzedPositions: context.analyzedPositions,
        duration: Date.now() - context.startTime,
      },
    });
  }

  async handlePause(context: PVExplorationContext): Promise<void> {
    const engineService = context.services.engine;
    await engineService.stop();

    await context.services.progress.reportProgress({
      step: 'paused',
      progress: context.analyzedPositions / context.totalPositions,
      stats: {
        analyzed: context.analyzedPositions,
        discovered: context.totalPositions,
        remaining: context.explorationQueue.length,
        currentDepth: 0,
        maxDepth: context.maxDepth,
      },
      timestamp: Date.now(),
    });
  }

  async handleCompletion(context: PVExplorationContext): Promise<void> {
    await context.services.progress.endSession('pv-exploration', true);

    const engineService = context.services.engine;
    await engineService.stop();
  }

  async handleError(context: PVExplorationContext): Promise<void> {
    await context.services.progress.endSession('pv-exploration', false);

    const engineService = context.services.engine;
    await engineService.stop();
  }

  async handleCancellation(context: PVExplorationContext): Promise<void> {
    await context.services.progress.endSession('pv-exploration', false);

    const engineService = context.services.engine;
    await engineService.stop();
  }
}
