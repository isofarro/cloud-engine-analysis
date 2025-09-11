import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { StateMachineProgressIntegration } from './StateMachineProgressIntegration';
import { ProgressReporter } from './ProgressReporter';
import { ProgressEventType } from './ProgressTypes';
import {
  PVExplorationState,
  PVExplorationEvent,
} from '../../../core/project/state-machine/pv-exploration/types';
import { StateMachineEngine } from '../../../core/project/state-machine/StateMachineEngine';
import { SimpleEventBus } from '../../../core/project/state-machine/EventBus';
import {
  TestDataFactories,
  ProgressTestAssertions,
} from '../../../test/progress-test-utils';

describe('StateMachineProgressIntegration', () => {
  let integration: StateMachineProgressIntegration;
  let mockStateMachine: StateMachineEngine<any, any, any>;
  let mockProgressReporter: ProgressReporter;
  let mockEventBus: SimpleEventBus;
  let emittedEvents: any[];
  let metricUpdates: { [key: string]: number };

  beforeEach(() => {
    vi.useFakeTimers();

    // Create mock progress reporter
    const mockConfig = TestDataFactories.createMockProgressConfig();
    mockProgressReporter = new ProgressReporter(mockConfig);

    // Track emitted events and metric updates
    emittedEvents = [];
    metricUpdates = {};

    vi.spyOn(mockProgressReporter, 'emitEvent').mockImplementation(
      (type, data) => {
        emittedEvents.push({ type, data });
      }
    );

    vi.spyOn(mockProgressReporter, 'incrementMetric').mockImplementation(
      (key, delta = 1) => {
        metricUpdates[key] = (metricUpdates[key] || 0) + delta;
      }
    );

    vi.spyOn(mockProgressReporter, 'getSnapshot').mockReturnValue({
      timestamp: Date.now(),
      state: 'testing',
      metrics: {
        totalPositions: 100,
        analyzedPositions: 25,
        queuedPositions: 10,
        failedPositions: 2,
        currentDepth: 3,
        maxDepth: 8,
        elapsedTime: 5000,
        estimatedTimeRemaining: 15000,
        analysisRate: 5.2,
        memoryUsage: 1024,
        graphNodes: 50,
        graphEdges: 75,
      },
      currentPosition:
        'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      recentErrors: [],
    });

    // Create mock state machine
    mockStateMachine = {
      id: 'test-state-machine',
      currentState: PVExplorationState.IDLE,
      context: {},
      isFinished: false,
      hasError: false,
      lastError: null,
      states: new Map(),
      transitions: new Map(),
      hooks: new Map(),
      eventBus: new SimpleEventBus(),
      send: vi.fn().mockResolvedValue(undefined),
      canTransition: vi.fn().mockReturnValue(true),
      getPossibleTransitions: vi.fn().mockReturnValue([]),
      registerHook: vi.fn(),
      unregisterHook: vi.fn(),
      reset: vi.fn(),
      getStateHistory: vi.fn().mockReturnValue([]),
    } as any;

    // Create mock event bus
    mockEventBus = new SimpleEventBus();

    // Create integration
    integration = new StateMachineProgressIntegration(
      mockStateMachine,
      mockProgressReporter,
      mockEventBus
    );
  });

  afterEach(() => {
    mockProgressReporter.destroy();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('State Change Handling', () => {
    it('should emit exploration started event when transitioning to INITIALIZING', () => {
      mockEventBus.emit({
        type: 'stateChanged',
        payload: {
          from: PVExplorationState.IDLE,
          to: PVExplorationState.INITIALIZING,
          event: PVExplorationEvent.START_EXPLORATION,
        },
        timestamp: Date.now(),
      });

      expect(emittedEvents).toHaveLength(1);
      expect(emittedEvents[0].type).toBe(ProgressEventType.EXPLORATION_STARTED);
    });

    it('should emit root analysis started event when transitioning to ANALYZING_ROOT', () => {
      mockEventBus.emit({
        type: 'stateChanged',
        payload: {
          from: PVExplorationState.INITIALIZING,
          to: PVExplorationState.ANALYZING_ROOT,
          event: PVExplorationEvent.INITIALIZATION_COMPLETE,
        },
        timestamp: Date.now(),
      });

      expect(emittedEvents).toHaveLength(1);
      expect(emittedEvents[0].type).toBe(
        ProgressEventType.ROOT_ANALYSIS_STARTED
      );
    });

    it('should emit queue updated event when transitioning to PROCESSING_QUEUE', () => {
      mockEventBus.emit({
        type: 'stateChanged',
        payload: {
          from: PVExplorationState.ANALYZING_ROOT,
          to: PVExplorationState.PROCESSING_QUEUE,
          event: PVExplorationEvent.QUEUE_READY,
        },
        timestamp: Date.now(),
      });

      expect(emittedEvents).toHaveLength(1);
      expect(emittedEvents[0].type).toBe(ProgressEventType.QUEUE_UPDATED);
      expect(emittedEvents[0].data).toEqual({ queueSize: 10 });
    });

    it('should emit exploration completed event when transitioning to COMPLETED', () => {
      mockEventBus.emit({
        type: 'stateChanged',
        payload: {
          from: PVExplorationState.PROCESSING_QUEUE,
          to: PVExplorationState.COMPLETED,
          event: PVExplorationEvent.QUEUE_PROCESSING_COMPLETE,
        },
        timestamp: Date.now(),
      });

      expect(emittedEvents).toHaveLength(1);
      expect(emittedEvents[0].type).toBe(
        ProgressEventType.EXPLORATION_COMPLETED
      );
    });

    it('should emit exploration paused event when transitioning to PAUSED', () => {
      mockEventBus.emit({
        type: 'stateChanged',
        payload: {
          from: PVExplorationState.PROCESSING_QUEUE,
          to: PVExplorationState.PAUSED,
          event: PVExplorationEvent.PAUSE_REQUESTED,
        },
        timestamp: Date.now(),
      });

      expect(emittedEvents).toHaveLength(1);
      expect(emittedEvents[0].type).toBe(ProgressEventType.EXPLORATION_PAUSED);
    });

    it('should emit error occurred event when transitioning to ERROR', () => {
      mockEventBus.emit({
        type: 'stateChanged',
        payload: {
          from: PVExplorationState.PROCESSING_QUEUE,
          to: PVExplorationState.ERROR,
          event: PVExplorationEvent.ERROR_OCCURRED,
        },
        timestamp: Date.now(),
      });

      expect(emittedEvents).toHaveLength(1);
      expect(emittedEvents[0].type).toBe(ProgressEventType.ERROR_OCCURRED);
    });
  });

  describe('Event Processing Handling', () => {
    it('should emit root analysis completed event', () => {
      mockEventBus.emit({
        type: 'eventProcessed',
        payload: {
          event: PVExplorationEvent.ROOT_ANALYSIS_COMPLETE,
          state: PVExplorationState.ANALYZING_ROOT,
        },
        timestamp: Date.now(),
      });

      expect(emittedEvents).toHaveLength(1);
      expect(emittedEvents[0].type).toBe(
        ProgressEventType.ROOT_ANALYSIS_COMPLETED
      );
    });

    it('should increment analyzed positions and emit position analysis completed event', () => {
      mockEventBus.emit({
        type: 'eventProcessed',
        payload: {
          event: PVExplorationEvent.POSITION_ANALYSIS_COMPLETE,
          state: PVExplorationState.PROCESSING_QUEUE,
        },
        timestamp: Date.now(),
      });

      expect(metricUpdates.analyzedPositions).toBe(1);
      expect(emittedEvents).toHaveLength(1);
      expect(emittedEvents[0].type).toBe(
        ProgressEventType.POSITION_ANALYSIS_COMPLETED
      );
    });

    it('should increment failed positions and emit position analysis failed event', () => {
      mockEventBus.emit({
        type: 'eventProcessed',
        payload: {
          event: PVExplorationEvent.ERROR_OCCURRED,
          state: PVExplorationState.PROCESSING_QUEUE,
        },
        timestamp: Date.now(),
      });

      expect(metricUpdates.failedPositions).toBe(1);
      expect(emittedEvents).toHaveLength(1);
      expect(emittedEvents[0].type).toBe(
        ProgressEventType.POSITION_ANALYSIS_FAILED
      );
    });

    it('should emit graph updated event', () => {
      mockEventBus.emit({
        type: 'eventProcessed',
        payload: {
          event: PVExplorationEvent.GRAPH_UPDATE_COMPLETE,
          state: PVExplorationState.PROCESSING_QUEUE,
        },
        timestamp: Date.now(),
      });

      expect(emittedEvents).toHaveLength(1);
      expect(emittedEvents[0].type).toBe(ProgressEventType.GRAPH_UPDATED);
    });
  });

  describe('Error Handling', () => {
    it('should emit error occurred event with error details', () => {
      const testError = new Error('Test error message');
      const testContext = { position: 'test-position', depth: 3 };

      mockEventBus.emit({
        type: 'error',
        payload: {
          error: testError,
          context: testContext,
        },
        timestamp: Date.now(),
      });

      expect(emittedEvents).toHaveLength(1);
      expect(emittedEvents[0].type).toBe(ProgressEventType.ERROR_OCCURRED);
      expect(emittedEvents[0].data).toEqual({
        error: 'Test error message',
        context: testContext,
      });
    });
  });

  describe('Integration Setup', () => {
    it('should subscribe to required event bus events during construction', () => {
      const subscribeSpy = vi.spyOn(mockEventBus, 'subscribe');

      new StateMachineProgressIntegration(
        mockStateMachine,
        mockProgressReporter,
        mockEventBus
      );

      expect(subscribeSpy).toHaveBeenCalledWith(
        'stateChanged',
        expect.any(Function)
      );
      expect(subscribeSpy).toHaveBeenCalledWith(
        'eventProcessed',
        expect.any(Function)
      );
      expect(subscribeSpy).toHaveBeenCalledWith('error', expect.any(Function));
      expect(subscribeSpy).toHaveBeenCalledTimes(3);
    });
  });

  describe('Complex Workflow Integration', () => {
    it('should handle complete exploration workflow', () => {
      // Start exploration
      mockEventBus.emit({
        type: 'stateChanged',
        payload: {
          from: PVExplorationState.IDLE,
          to: PVExplorationState.INITIALIZING,
          event: PVExplorationEvent.START_EXPLORATION,
        },
        timestamp: Date.now(),
      });

      // Start root analysis
      mockEventBus.emit({
        type: 'stateChanged',
        payload: {
          from: PVExplorationState.INITIALIZING,
          to: PVExplorationState.ANALYZING_ROOT,
          event: PVExplorationEvent.INITIALIZATION_COMPLETE,
        },
        timestamp: Date.now(),
      });

      // Complete root analysis
      mockEventBus.emit({
        type: 'eventProcessed',
        payload: {
          event: PVExplorationEvent.ROOT_ANALYSIS_COMPLETE,
          state: PVExplorationState.ANALYZING_ROOT,
        },
        timestamp: Date.now(),
      });

      // Start queue processing
      mockEventBus.emit({
        type: 'stateChanged',
        payload: {
          from: PVExplorationState.ANALYZING_ROOT,
          to: PVExplorationState.PROCESSING_QUEUE,
          event: PVExplorationEvent.QUEUE_READY,
        },
        timestamp: Date.now(),
      });

      // Process some positions
      mockEventBus.emit({
        type: 'eventProcessed',
        payload: {
          event: PVExplorationEvent.POSITION_ANALYSIS_COMPLETE,
          state: PVExplorationState.PROCESSING_QUEUE,
        },
        timestamp: Date.now(),
      });

      mockEventBus.emit({
        type: 'eventProcessed',
        payload: {
          event: PVExplorationEvent.POSITION_ANALYSIS_COMPLETE,
          state: PVExplorationState.PROCESSING_QUEUE,
        },
        timestamp: Date.now(),
      });

      // Complete exploration
      mockEventBus.emit({
        type: 'stateChanged',
        payload: {
          from: PVExplorationState.PROCESSING_QUEUE,
          to: PVExplorationState.COMPLETED,
          event: PVExplorationEvent.QUEUE_PROCESSING_COMPLETE,
        },
        timestamp: Date.now(),
      });

      // Verify the complete workflow
      expect(emittedEvents).toHaveLength(7);
      expect(emittedEvents[0].type).toBe(ProgressEventType.EXPLORATION_STARTED);
      expect(emittedEvents[1].type).toBe(
        ProgressEventType.ROOT_ANALYSIS_STARTED
      );
      expect(emittedEvents[2].type).toBe(
        ProgressEventType.ROOT_ANALYSIS_COMPLETED
      );
      expect(emittedEvents[3].type).toBe(ProgressEventType.QUEUE_UPDATED);
      expect(emittedEvents[4].type).toBe(
        ProgressEventType.POSITION_ANALYSIS_COMPLETED
      );
      expect(emittedEvents[5].type).toBe(
        ProgressEventType.POSITION_ANALYSIS_COMPLETED
      );
      expect(emittedEvents[6].type).toBe(
        ProgressEventType.EXPLORATION_COMPLETED
      );

      expect(metricUpdates.analyzedPositions).toBe(2);
    });

    it('should handle error scenarios during exploration', () => {
      // Start exploration
      mockEventBus.emit({
        type: 'stateChanged',
        payload: {
          from: PVExplorationState.IDLE,
          to: PVExplorationState.INITIALIZING,
          event: PVExplorationEvent.START_EXPLORATION,
        },
        timestamp: Date.now(),
      });

      // Encounter an error
      const testError = new Error('Analysis failed');
      mockEventBus.emit({
        type: 'error',
        payload: {
          error: testError,
          context: { position: 'error-position' },
        },
        timestamp: Date.now(),
      });

      // Transition to error state
      mockEventBus.emit({
        type: 'stateChanged',
        payload: {
          from: PVExplorationState.PROCESSING_QUEUE,
          to: PVExplorationState.ERROR,
          event: PVExplorationEvent.ERROR_OCCURRED,
        },
        timestamp: Date.now(),
      });

      // Process error event
      mockEventBus.emit({
        type: 'eventProcessed',
        payload: {
          event: PVExplorationEvent.ERROR_OCCURRED,
          state: PVExplorationState.ERROR,
        },
        timestamp: Date.now(),
      });

      expect(emittedEvents).toHaveLength(4);
      expect(emittedEvents[0].type).toBe(ProgressEventType.EXPLORATION_STARTED);
      expect(emittedEvents[1].type).toBe(ProgressEventType.ERROR_OCCURRED);
      expect(emittedEvents[2].type).toBe(ProgressEventType.ERROR_OCCURRED);
      expect(emittedEvents[3].type).toBe(
        ProgressEventType.POSITION_ANALYSIS_FAILED
      );

      expect(metricUpdates.failedPositions).toBe(1);
    });
  });
});
