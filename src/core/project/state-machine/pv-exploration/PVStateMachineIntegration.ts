import { StateMachineEngine } from '../StateMachineEngine';
import { PVExplorationActions } from './PVAnalysisActions';
import { PVExplorationHooks, createDefaultPVHooks } from './PVExplorationHooks';
import {
  PVExplorationContext,
  PVExplorationState,
  PVExplorationEvent,
} from './types';
import { IServiceContainer } from '../services/types';
import { State } from '../types';
import { SimpleEventBus } from '../EventBus';

export class PVStateMachineIntegration {
  private actions: PVExplorationActions;
  private hooks: PVExplorationHooks;
  private eventBus: SimpleEventBus;

  constructor(
    private services: IServiceContainer,
    customHooks: Partial<PVExplorationHooks> = {}
  ) {
    this.actions = new PVExplorationActions(services);
    this.hooks = { ...createDefaultPVHooks(), ...customHooks };
    this.eventBus = new SimpleEventBus();
  }

  /**
   * Create and configure the PV exploration state machine
   */
  createStateMachine(): StateMachineEngine<any, any, PVExplorationContext> {
    // Create states array
    const states: State[] = [
      { id: PVExplorationState.IDLE, name: 'Idle' },
      { id: PVExplorationState.INITIALIZING, name: 'Initializing' },
      { id: PVExplorationState.ANALYZING_ROOT, name: 'Analyzing Root' },
      { id: PVExplorationState.PROCESSING_QUEUE, name: 'Processing Queue' },
      { id: PVExplorationState.COMPLETED, name: 'Completed', isFinal: true },
      { id: PVExplorationState.ERROR, name: 'Error', isFinal: true },
    ];

    const stateMachine = new StateMachineEngine(
      {
        id: 'pv-exploration',
        initialState: PVExplorationState.IDLE,
        states,
        transitions: [
          {
            from: PVExplorationState.IDLE,
            to: PVExplorationState.INITIALIZING,
            on: PVExplorationEvent.START_EXPLORATION,
          },
          {
            from: PVExplorationState.INITIALIZING,
            to: PVExplorationState.ANALYZING_ROOT,
            on: PVExplorationEvent.INITIALIZATION_COMPLETE,
          },
          {
            from: PVExplorationState.ANALYZING_ROOT,
            to: PVExplorationState.PROCESSING_QUEUE,
            on: PVExplorationEvent.ROOT_ANALYSIS_COMPLETE,
          },
          {
            from: PVExplorationState.PROCESSING_QUEUE,
            to: PVExplorationState.COMPLETED,
            on: PVExplorationEvent.QUEUE_PROCESSING_COMPLETE,
          },
          {
            from: '*',
            to: PVExplorationState.ERROR,
            on: PVExplorationEvent.EXPLORATION_ERROR,
          },
        ],
      },
      this.eventBus
    );

    // Register state enter/exit handlers
    stateMachine.registerHook({
      id: 'idle-enter',
      phase: 'before_enter' as any,
      states: [PVExplorationState.IDLE],
      handler: async hookContext => {
        console.log('🔍 DEBUG: Entering IDLE state');
      },
    });

    stateMachine.registerHook({
      id: 'idle-exit',
      phase: 'before_exit' as any,
      states: [PVExplorationState.IDLE],
      handler: async hookContext => {
        console.log('🔍 DEBUG: Exiting IDLE state');
        const context = hookContext.data.context as PVExplorationContext;
        await this.hooks.beforeRootAnalysis?.(context);
        console.log('🔍 DEBUG: beforeRootAnalysis hook completed');
      },
    });

    stateMachine.registerHook({
      id: 'initializing-enter',
      phase: 'after_enter' as any,
      states: [PVExplorationState.INITIALIZING],
      handler: async hookContext => {
        console.log('🔍 DEBUG: Entering INITIALIZING state');
        try {
          const context = hookContext.data.context as PVExplorationContext;
          console.log('🔍 DEBUG: About to call initializeExploration');
          await this.actions.initializeExploration(context);
          console.log('🔍 DEBUG: initializeExploration completed');
          // Emit initialization complete event
          console.log('🔍 DEBUG: Emitting INITIALIZATION_COMPLETE event');
          this.eventBus.emit({
            type: PVExplorationEvent.INITIALIZATION_COMPLETE,
            payload: context,
            timestamp: Date.now(),
          });
          console.log('🔍 DEBUG: INITIALIZATION_COMPLETE event emitted');
        } catch (error) {
          console.error('🔍 DEBUG: Error in INITIALIZING state:', error);
          const context = hookContext.data.context as PVExplorationContext;
          context.error = error as Error;
          this.eventBus.emit({
            type: PVExplorationEvent.EXPLORATION_ERROR,
            payload: context,
            timestamp: Date.now(),
          });
        }
      },
    });

    stateMachine.registerHook({
      id: 'analyzing-root-enter',
      phase: 'after_enter' as any,
      states: [PVExplorationState.ANALYZING_ROOT],
      handler: async hookContext => {
        console.log('🔍 DEBUG: Entering ANALYZING_ROOT state');
        try {
          const context = hookContext.data.context as PVExplorationContext;
          console.log('🔍 DEBUG: About to call analyzeRootPosition');
          const result = await this.actions.analyzeRootPosition(context);
          console.log('🔍 DEBUG: analyzeRootPosition completed');
          await this.hooks.afterRootAnalysis?.({ context, result });
          console.log('🔍 DEBUG: afterRootAnalysis hook completed');
          // Emit root analysis complete event
          console.log('🔍 DEBUG: Emitting ROOT_ANALYSIS_COMPLETE event');
          this.eventBus.emit({
            type: PVExplorationEvent.ROOT_ANALYSIS_COMPLETE,
            payload: context,
            timestamp: Date.now(),
          });
          console.log('🔍 DEBUG: ROOT_ANALYSIS_COMPLETE event emitted');
        } catch (error) {
          console.error('🔍 DEBUG: Error in ANALYZING_ROOT state:', error);
          const context = hookContext.data.context as PVExplorationContext;
          context.error = error as Error;
          this.eventBus.emit({
            type: PVExplorationEvent.EXPLORATION_ERROR,
            payload: context,
            timestamp: Date.now(),
          });
        }
      },
    });

    stateMachine.registerHook({
      id: 'processing-queue-enter',
      phase: 'after_enter' as any,
      states: [PVExplorationState.PROCESSING_QUEUE],
      handler: async hookContext => {
        console.log('🔍 DEBUG: Entering PROCESSING_QUEUE state');
        try {
          const context = hookContext.data.context as PVExplorationContext;
          console.log('🔍 DEBUG: About to call processExplorationQueue');
          await this.actions.processExplorationQueue(context);
          console.log('🔍 DEBUG: processExplorationQueue completed');
        } catch (error) {
          console.error('🔍 DEBUG: Error in PROCESSING_QUEUE state:', error);
          const context = hookContext.data.context as PVExplorationContext;
          context.error = error as Error;
          this.eventBus.emit({
            type: PVExplorationEvent.EXPLORATION_ERROR,
            payload: context,
            timestamp: Date.now(),
          });
        }
      },
    });

    stateMachine.registerHook({
      id: 'completed-enter',
      phase: 'after_enter' as any,
      states: [PVExplorationState.COMPLETED],
      handler: async hookContext => {
        const context = hookContext.data.context as PVExplorationContext;
        await this.actions.finalizeExploration(context);
        await this.hooks.onExplorationComplete?.({
          context,
          stats: context.state?.stats,
        });
      },
    });

    stateMachine.registerHook({
      id: 'error-enter',
      phase: 'after_enter' as any,
      states: [PVExplorationState.ERROR],
      handler: async hookContext => {
        const context = hookContext.data.context as PVExplorationContext;
        if (context.error) {
          await this.actions.handleExplorationError(context, context.error);
          await this.hooks.onExplorationError?.({
            context,
            error: context.error,
          });
        }
      },
    });

    // Register event handlers for progress reporting
    this.eventBus.subscribe(
      PVExplorationEvent.POSITION_ANALYSIS_STARTED,
      async event => {
        const data = event.payload as any;
        await this.hooks.onProgressUpdate?.({
          context: data.context,
          progress: {
            current: data.context?.state?.stats?.totalAnalyzed || 0,
            total: data.context?.state?.stats?.totalDiscovered || 1,
            operation: `Analyzing position at depth ${data.depth}`,
            metadata: { depth: data.depth, queueSize: data.queueSize },
          },
        });
      }
    );

    return stateMachine;
  }
}
