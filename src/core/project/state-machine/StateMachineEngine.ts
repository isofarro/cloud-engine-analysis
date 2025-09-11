/**
 * Core state machine engine implementation
 */

import {
  StateMachine,
  StateMachineConfig,
  State,
  Event,
  Transition,
  Hook,
  HookContext,
  HookPhase,
  EventBus,
} from './types.js';
import { SimpleEventBus } from './EventBus.js';

/**
 * Concrete implementation of the StateMachine interface
 */
export class StateMachineEngine<
  TState = any,
  TEvent extends Event = Event,
  TContext = any,
> implements StateMachine<TState, TEvent, TContext>
{
  public readonly id: string;
  private _currentState: State<TState>;
  private _context: TContext;
  private _isFinished = false;
  private _hasError = false;
  private _lastError?: Error;
  private _stateHistory: State<TState>[] = [];

  private readonly states = new Map<string, State<TState>>();
  private readonly transitions = new Map<
    string,
    Transition<TContext, TEvent>[]
  >();
  private readonly hooks = new Map<
    HookPhase,
    Hook<HookContext<TState, TEvent>>[]
  >();
  private readonly eventBus: EventBus;
  private readonly strict: boolean;

  constructor(
    config: StateMachineConfig<TState, TEvent, TContext>,
    eventBus?: EventBus
  ) {
    this.id = config.id;
    this.strict = config.strict ?? true;
    this.eventBus = eventBus ?? new SimpleEventBus();
    this._context = config.context ?? ({} as TContext);

    // Initialize states map
    for (const state of config.states) {
      this.states.set(state.id, state);
    }

    // Initialize transitions map
    for (const transition of config.transitions) {
      if (!this.transitions.has(transition.from)) {
        this.transitions.set(transition.from, []);
      }
      this.transitions.get(transition.from)!.push(transition);
    }

    // Initialize hooks map
    for (const phase of Object.values(HookPhase)) {
      this.hooks.set(phase, []);
    }

    // Set initial state
    const initialState = this.states.get(config.initialState);
    if (!initialState) {
      throw new Error(`Initial state '${config.initialState}' not found`);
    }

    this._currentState = initialState;
    this._stateHistory.push(initialState);
  }

  // ============================================================================
  // Public API
  // ============================================================================

  get currentState(): State<TState> {
    return this._currentState;
  }

  get context(): TContext {
    return this._context;
  }

  get isFinished(): boolean {
    return this._isFinished || this._currentState.isFinal === true;
  }

  get hasError(): boolean {
    return this._hasError;
  }

  get lastError(): Error | undefined {
    return this._lastError;
  }

  /**
   * Send an event to the state machine
   */
  async send(event: TEvent): Promise<void> {
    if (this.isFinished) {
      if (this.strict) {
        throw new Error(
          `Cannot send event '${event.type}' to finished state machine`
        );
      }
      return;
    }

    try {
      await this.processEvent(event);
    } catch (error) {
      this._hasError = true;
      this._lastError = error as Error;

      // Execute error hooks
      await this.executeHooks(HookPhase.ON_ERROR, {
        currentState: this._currentState,
        event,
        data: { error },
        timestamp: Date.now(),
      });

      if (this.strict) {
        throw error;
      }
    }
  }

  /**
   * Check if a transition is possible from current state
   */
  canTransition(eventType: string): boolean {
    const possibleTransitions =
      this.transitions.get(this._currentState.id) ?? [];
    return possibleTransitions.some(t => t.on === eventType);
  }

  /**
   * Get all possible transitions from current state
   */
  getPossibleTransitions(): Transition<TContext, TEvent>[] {
    return this.transitions.get(this._currentState.id) ?? [];
  }

  /**
   * Register a hook
   */
  registerHook(hook: Hook<HookContext<TState, TEvent>>): void {
    const phaseHooks = this.hooks.get(hook.phase) ?? [];
    phaseHooks.push(hook);

    // Sort by priority (higher priority first)
    phaseHooks.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));

    this.hooks.set(hook.phase, phaseHooks);
  }

  /**
   * Unregister a hook
   */
  unregisterHook(hookId: string): void {
    for (const [phase, phaseHooks] of this.hooks.entries()) {
      const filtered = phaseHooks.filter(h => h.id !== hookId);
      this.hooks.set(phase, filtered);
    }
  }

  /**
   * Reset the state machine to its initial state
   */
  async reset(newContext?: TContext): Promise<void> {
    const initialState = this._stateHistory[0];
    if (!initialState) {
      throw new Error('No initial state found in history');
    }

    this._currentState = initialState;
    this._context = newContext ?? this._context;
    this._isFinished = false;
    this._hasError = false;
    this._lastError = undefined;
    this._stateHistory = [initialState];
  }

  /**
   * Get the current state history
   */
  getStateHistory(): State<TState>[] {
    return [...this._stateHistory];
  }

  // ============================================================================
  // Private Implementation
  // ============================================================================

  /**
   * Process an incoming event
   */
  private async processEvent(event: TEvent): Promise<void> {
    const possibleTransitions =
      this.transitions.get(this._currentState.id) ?? [];
    const matchingTransition = possibleTransitions.find(
      t => t.on === event.type
    );

    if (!matchingTransition) {
      if (this.strict) {
        throw new Error(
          `No transition found for event '${event.type}' from state '${this._currentState.id}'`
        );
      }
      return;
    }

    // Check guard condition
    if (matchingTransition.guard) {
      const guardResult = await matchingTransition.guard(this._context, event);
      if (!guardResult) {
        return; // Guard rejected the transition
      }
    }

    await this.executeTransition(matchingTransition, event);
  }

  /**
   * Execute a state transition
   */
  private async executeTransition(
    transition: Transition<TContext, TEvent>,
    event: TEvent
  ): Promise<void> {
    const fromState = this._currentState;
    const toState = this.states.get(transition.to);

    if (!toState) {
      throw new Error(`Target state '${transition.to}' not found`);
    }

    // Execute before transition hooks
    await this.executeHooks(HookPhase.BEFORE_TRANSITION, {
      currentState: fromState,
      event,
      data: { transition, toState },
      timestamp: Date.now(),
    });

    // Execute before exit hooks
    await this.executeHooks(HookPhase.BEFORE_EXIT, {
      currentState: fromState,
      event,
      data: { transition, toState },
      timestamp: Date.now(),
    });

    // Execute transition action
    if (transition.action) {
      await transition.action(this._context, event);
    }

    // Update state
    this._currentState = toState;
    this._stateHistory.push(toState);

    // Execute after exit hooks
    await this.executeHooks(HookPhase.AFTER_EXIT, {
      currentState: toState,
      previousState: fromState,
      event,
      data: { transition },
      timestamp: Date.now(),
    });

    // Execute before enter hooks
    await this.executeHooks(HookPhase.BEFORE_ENTER, {
      currentState: toState,
      previousState: fromState,
      event,
      data: { transition },
      timestamp: Date.now(),
    });

    // Execute after enter hooks
    await this.executeHooks(HookPhase.AFTER_ENTER, {
      currentState: toState,
      previousState: fromState,
      event,
      data: { transition },
      timestamp: Date.now(),
    });

    // Execute after transition hooks
    await this.executeHooks(HookPhase.AFTER_TRANSITION, {
      currentState: toState,
      previousState: fromState,
      event,
      data: { transition },
      timestamp: Date.now(),
    });

    // Emit state change event
    await this.eventBus.emit({
      type: 'state_changed',
      payload: {
        from: fromState.id,
        to: toState.id,
        event: event.type,
        stateMachineId: this.id,
      },
      timestamp: Date.now(),
    });

    // Check if we've reached a final state
    if (toState.isFinal) {
      this._isFinished = true;
      await this.eventBus.emit({
        type: 'state_machine_finished',
        payload: {
          finalState: toState.id,
          stateMachineId: this.id,
        },
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Execute hooks for a specific phase
   */
  private async executeHooks(
    phase: HookPhase,
    context: HookContext<TState, TEvent>
  ): Promise<void> {
    const phaseHooks = this.hooks.get(phase) ?? [];

    for (const hook of phaseHooks) {
      // Check state filter
      if (hook.states && !hook.states.includes(context.currentState.id)) {
        continue;
      }

      // Check event filter
      if (
        hook.events &&
        context.event &&
        !hook.events.includes(context.event.type)
      ) {
        continue;
      }

      try {
        await hook.handler(context);

        // Remove one-time hooks
        if (hook.once) {
          this.unregisterHook(hook.id);
        }
      } catch (error) {
        console.error(
          `Error executing hook '${hook.id}' in phase '${phase}':`,
          error
        );
        // Don't let hook errors stop the state machine
      }
    }
  }
}
