import { Transition, TransitionGuard } from '../types';
import { PVExplorationContext, PVState, PVEvent } from './PVStateMachine';
import { PVTransitionGuards } from './PVTransitionGuards';

// Enhanced transition definitions with detailed guards
export const PV_ENHANCED_TRANSITIONS: Transition<PVExplorationContext>[] = [
  // IDLE → INITIALIZING
  {
    from: PVState.IDLE,
    to: PVState.INITIALIZING,
    on: PVEvent.START_EXPLORATION,
    guard: PVTransitionGuards.canStartExploration,
    action: async context => {
      console.log(`Starting PV exploration for ${context.rootFen}`);
    },
  },

  // INITIALIZING → ANALYZING_ROOT
  {
    from: PVState.INITIALIZING,
    to: PVState.ANALYZING_ROOT,
    on: PVEvent.QUEUE_READY,
    guard: context =>
      PVTransitionGuards.hasValidQueue(context) &&
      PVTransitionGuards.isEngineReady(context),
    action: async context => {
      console.log('Engine initialized, starting root analysis');
    },
  },

  // ANALYZING_ROOT → BUILDING_GRAPH
  {
    from: PVState.ANALYZING_ROOT,
    to: PVState.BUILDING_GRAPH,
    on: PVEvent.ROOT_ANALYSIS_COMPLETE,
    action: async context => {
      console.log(`Root analysis complete for ${context.rootFen}`);
    },
  },

  // BUILDING_GRAPH → STORING_RESULTS (from root)
  {
    from: PVState.BUILDING_GRAPH,
    to: PVState.STORING_RESULTS,
    on: PVEvent.GRAPH_UPDATE_COMPLETE,
    guard: context => !!context.rootNodeId,
    action: async context => {
      console.log(`Graph updated with root node: ${context.rootNodeId}`);
    },
  },

  // STORING_RESULTS → PROCESSING_QUEUE
  {
    from: PVState.STORING_RESULTS,
    to: PVState.PROCESSING_QUEUE,
    on: PVEvent.STORAGE_COMPLETE,
    guard: PVTransitionGuards.canContinueExploration,
    action: async context => {
      console.log(
        `Continuing exploration: ${context.explorationQueue.length} positions in queue`
      );
    },
  },

  // STORING_RESULTS → COMPLETED
  {
    from: PVState.STORING_RESULTS,
    to: PVState.COMPLETED,
    on: PVEvent.STORAGE_COMPLETE,
    guard: PVTransitionGuards.shouldComplete,
    action: async context => {
      console.log(
        `Exploration completed: ${context.analyzedPositions} positions analyzed`
      );
    },
  },

  // PROCESSING_QUEUE → ANALYZING_POSITION
  {
    from: PVState.PROCESSING_QUEUE,
    to: PVState.ANALYZING_POSITION,
    on: PVEvent.QUEUE_READY,
    guard: context =>
      PVTransitionGuards.canAnalyzePosition(context) &&
      PVTransitionGuards.isWithinDepthLimit(context) &&
      PVTransitionGuards.isWithinNodeLimit(context),
    action: async context => {
      const queueItem = context.explorationQueue[0];
      console.log(
        `Analyzing position at depth ${queueItem?.depth}: ${context.currentPosition}`
      );
    },
  },

  // PROCESSING_QUEUE → COMPLETED (queue empty or limits reached)
  {
    from: PVState.PROCESSING_QUEUE,
    to: PVState.COMPLETED,
    on: PVEvent.QUEUE_EMPTY,
    guard: PVTransitionGuards.shouldComplete,
    action: async context => {
      const reason =
        context.explorationQueue.length === 0
          ? 'queue empty'
          : 'node limit reached';
      console.log(`Exploration completed: ${reason}`);
    },
  },

  // ANALYZING_POSITION → BUILDING_GRAPH
  {
    from: PVState.ANALYZING_POSITION,
    to: PVState.BUILDING_GRAPH,
    on: PVEvent.POSITION_ANALYSIS_COMPLETE,
    action: async context => {
      console.log(`Position analysis complete: ${context.currentPosition}`);
    },
  },

  // BUILDING_GRAPH → STORING_RESULTS (from position)
  {
    from: PVState.BUILDING_GRAPH,
    to: PVState.STORING_RESULTS,
    on: PVEvent.GRAPH_UPDATE_COMPLETE,
    guard: context => context.graphNodeCount > 0,
    action: async context => {
      console.log(`Graph updated: ${context.graphNodeCount} total nodes`);
    },
  },

  // Pause transitions from active states - separate transitions for each state
  {
    from: PVState.ANALYZING_ROOT,
    to: PVState.PAUSED,
    on: PVEvent.PAUSE_REQUESTED,
    action: async context => {
      console.log('Exploration paused');
    },
  },
  {
    from: PVState.PROCESSING_QUEUE,
    to: PVState.PAUSED,
    on: PVEvent.PAUSE_REQUESTED,
    action: async context => {
      console.log('Exploration paused');
    },
  },
  {
    from: PVState.ANALYZING_POSITION,
    to: PVState.PAUSED,
    on: PVEvent.PAUSE_REQUESTED,
    action: async context => {
      console.log('Exploration paused');
    },
  },
  {
    from: PVState.BUILDING_GRAPH,
    to: PVState.PAUSED,
    on: PVEvent.PAUSE_REQUESTED,
    action: async context => {
      console.log('Exploration paused');
    },
  },

  // Resume from paused
  {
    from: PVState.PAUSED,
    to: PVState.PROCESSING_QUEUE,
    on: PVEvent.RESUME_REQUESTED,
    guard: PVTransitionGuards.canContinueExploration,
    action: async context => {
      console.log('Exploration resumed');
    },
  },

  // Cancel from each state - separate transitions
  {
    from: PVState.IDLE,
    to: PVState.CANCELLED,
    on: PVEvent.CANCEL_REQUESTED,
    action: async context => {
      console.log('Exploration cancelled');
    },
  },
  {
    from: PVState.INITIALIZING,
    to: PVState.CANCELLED,
    on: PVEvent.CANCEL_REQUESTED,
    action: async context => {
      console.log('Exploration cancelled');
    },
  },
  {
    from: PVState.ANALYZING_ROOT,
    to: PVState.CANCELLED,
    on: PVEvent.CANCEL_REQUESTED,
    action: async context => {
      console.log('Exploration cancelled');
    },
  },
  {
    from: PVState.PROCESSING_QUEUE,
    to: PVState.CANCELLED,
    on: PVEvent.CANCEL_REQUESTED,
    action: async context => {
      console.log('Exploration cancelled');
    },
  },
  {
    from: PVState.ANALYZING_POSITION,
    to: PVState.CANCELLED,
    on: PVEvent.CANCEL_REQUESTED,
    action: async context => {
      console.log('Exploration cancelled');
    },
  },
  {
    from: PVState.BUILDING_GRAPH,
    to: PVState.CANCELLED,
    on: PVEvent.CANCEL_REQUESTED,
    action: async context => {
      console.log('Exploration cancelled');
    },
  },
  {
    from: PVState.STORING_RESULTS,
    to: PVState.CANCELLED,
    on: PVEvent.CANCEL_REQUESTED,
    action: async context => {
      console.log('Exploration cancelled');
    },
  },
  {
    from: PVState.PAUSED,
    to: PVState.CANCELLED,
    on: PVEvent.CANCEL_REQUESTED,
    action: async context => {
      console.log('Exploration cancelled');
    },
  },

  // Error handling from each state - separate transitions
  {
    from: PVState.IDLE,
    to: PVState.ERROR,
    on: PVEvent.ERROR_OCCURRED,
    action: async context => {
      console.error(`Error occurred: ${context.lastError?.message}`);
    },
  },
  {
    from: PVState.INITIALIZING,
    to: PVState.ERROR,
    on: PVEvent.ERROR_OCCURRED,
    action: async context => {
      console.error(`Error occurred: ${context.lastError?.message}`);
    },
  },
  {
    from: PVState.ANALYZING_ROOT,
    to: PVState.ERROR,
    on: PVEvent.ERROR_OCCURRED,
    action: async context => {
      console.error(`Error occurred: ${context.lastError?.message}`);
    },
  },
  {
    from: PVState.PROCESSING_QUEUE,
    to: PVState.ERROR,
    on: PVEvent.ERROR_OCCURRED,
    action: async context => {
      console.error(`Error occurred: ${context.lastError?.message}`);
    },
  },
  {
    from: PVState.ANALYZING_POSITION,
    to: PVState.ERROR,
    on: PVEvent.ERROR_OCCURRED,
    action: async context => {
      console.error(`Error occurred: ${context.lastError?.message}`);
    },
  },
  {
    from: PVState.BUILDING_GRAPH,
    to: PVState.ERROR,
    on: PVEvent.ERROR_OCCURRED,
    action: async context => {
      console.error(`Error occurred: ${context.lastError?.message}`);
    },
  },
  {
    from: PVState.STORING_RESULTS,
    to: PVState.ERROR,
    on: PVEvent.ERROR_OCCURRED,
    action: async context => {
      console.error(`Error occurred: ${context.lastError?.message}`);
    },
  },

  // Retry from error state
  {
    from: PVState.ERROR,
    to: PVState.PROCESSING_QUEUE,
    on: PVEvent.RETRY_REQUESTED,
    guard: PVTransitionGuards.canRetry,
    action: async context => {
      console.log(
        `Retrying exploration (attempt ${context.retryCount + 1}/${context.maxRetries})`
      );
    },
  },
];
