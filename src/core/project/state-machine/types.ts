/**
 * Core state machine types and interfaces for analysis strategies
 *
 * This module provides the foundational types for implementing analysis strategies
 * as state machines with events and hooks for extensibility.
 */

// ============================================================================
// Core State Machine Types
// ============================================================================

/**
 * Represents a state in the state machine
 * @template TData - The type of data associated with this state
 */
export interface State<TData = any> {
  /** Unique identifier for this state */
  readonly id: string;

  /** Human-readable name for this state */
  readonly name: string;

  /** Optional data associated with this state */
  readonly data?: TData;

  /** Whether this state can be entered */
  readonly canEnter?: boolean;

  /** Whether this state is a terminal/final state */
  readonly isFinal?: boolean;
}

/**
 * Represents an event that can trigger state transitions
 * @template TPayload - The type of data carried by this event
 */
export interface Event<TPayload = any> {
  /** Unique identifier for this event type */
  readonly type: string;

  /** Optional payload data for this event */
  readonly payload?: TPayload;

  /** Timestamp when the event was created */
  readonly timestamp: number;

  /** Optional metadata for the event */
  readonly metadata?: Record<string, any>;
}

/**
 * Guard function that determines if a transition should occur
 * @template TContext - The type of context available to the guard
 * @template TEvent - The type of event being evaluated
 */
export type TransitionGuard<TContext = any, TEvent extends Event = Event> = (
  context: TContext,
  event: TEvent
) => boolean | Promise<boolean>;

/**
 * Action function executed during state transitions
 * @template TContext - The type of context available to the action
 * @template TEvent - The type of event triggering the action
 */
export type TransitionAction<TContext = any, TEvent extends Event = Event> = (
  context: TContext,
  event: TEvent
) => void | Promise<void>;

/**
 * Represents a transition between states
 * @template TContext - The type of context available during transition
 * @template TEvent - The type of event that triggers this transition
 */
export interface Transition<TContext = any, TEvent extends Event = Event> {
  /** The state this transition originates from */
  readonly from: string;

  /** The state this transition leads to */
  readonly to: string;

  /** The event type that triggers this transition */
  readonly on: string;

  /** Optional guard function to conditionally allow the transition */
  readonly guard?: TransitionGuard<TContext, TEvent>;

  /** Optional action to execute during the transition */
  readonly action?: TransitionAction<TContext, TEvent>;

  /** Optional description of what this transition does */
  readonly description?: string;
}

// ============================================================================
// Hook System Types
// ============================================================================

/**
 * Hook execution phases
 */
export enum HookPhase {
  /** Before entering a state */
  BEFORE_ENTER = 'before_enter',

  /** After entering a state */
  AFTER_ENTER = 'after_enter',

  /** Before exiting a state */
  BEFORE_EXIT = 'before_exit',

  /** After exiting a state */
  AFTER_EXIT = 'after_exit',

  /** Before executing a transition */
  BEFORE_TRANSITION = 'before_transition',

  /** After executing a transition */
  AFTER_TRANSITION = 'after_transition',

  /** When an error occurs */
  ON_ERROR = 'on_error',
}

/**
 * Context provided to hook functions
 * @template TState - The type of state data
 * @template TEvent - The type of event data
 */
export interface HookContext<TState = any, TEvent extends Event = Event> {
  /** Current state */
  readonly currentState: State<TState>;

  /** Previous state (if any) */
  readonly previousState?: State<TState>;

  /** Event that triggered this hook (if any) */
  readonly event?: TEvent;

  /** Additional context data */
  readonly data: Record<string, any>;

  /** Timestamp when hook was triggered */
  readonly timestamp: number;
}

/**
 * Hook function signature
 * @template TContext - The type of hook context
 */
export type HookFunction<TContext extends HookContext = HookContext> = (
  context: TContext
) => void | Promise<void>;

/**
 * Hook registration interface
 */
export interface Hook<TContext extends HookContext = HookContext> {
  /** Unique identifier for this hook */
  readonly id: string;

  /** Phase when this hook should execute */
  readonly phase: HookPhase;

  /** Optional state filter - only execute for these states */
  readonly states?: string[];

  /** Optional event filter - only execute for these events */
  readonly events?: string[];

  /** The hook function to execute */
  readonly handler: HookFunction<TContext>;

  /** Priority for hook execution (higher = earlier) */
  readonly priority?: number;

  /** Whether this hook should only execute once */
  readonly once?: boolean;
}

// ============================================================================
// State Machine Interface
// ============================================================================

/**
 * Configuration for creating a state machine
 * @template TState - The type of state data
 * @template TEvent - The type of events
 * @template TContext - The type of execution context
 */
export interface StateMachineConfig<
  TState = any,
  TEvent extends Event = Event,
  TContext = any,
> {
  /** Unique identifier for this state machine */
  readonly id: string;

  /** Initial state ID */
  readonly initialState: string;

  /** All possible states */
  readonly states: State<TState>[];

  /** All possible transitions */
  readonly transitions: Transition<TContext, TEvent>[];

  /** Initial context data */
  readonly context?: TContext;

  /** Whether to enable strict mode (throw on invalid transitions) */
  readonly strict?: boolean;
}

/**
 * Main state machine interface
 * @template TState - The type of state data
 * @template TEvent - The type of events
 * @template TContext - The type of execution context
 */
export interface StateMachine<
  TState = any,
  TEvent extends Event = Event,
  TContext = any,
> {
  /** Unique identifier for this state machine */
  readonly id: string;

  /** Current state */
  readonly currentState: State<TState>;

  /** Current context */
  readonly context: TContext;

  /** Whether the state machine is in a final state */
  readonly isFinished: boolean;

  /** Whether the state machine has encountered an error */
  readonly hasError: boolean;

  /** Last error (if any) */
  readonly lastError?: Error;

  /**
   * Send an event to the state machine
   * @param event - The event to send
   * @returns Promise that resolves when the event is processed
   */
  send(event: TEvent): Promise<void>;

  /**
   * Check if a transition is possible from current state
   * @param eventType - The event type to check
   * @returns Whether the transition is possible
   */
  canTransition(eventType: string): boolean;

  /**
   * Get all possible transitions from current state
   * @returns Array of possible transitions
   */
  getPossibleTransitions(): Transition<TContext, TEvent>[];

  /**
   * Register a hook
   * @param hook - The hook to register
   */
  registerHook(hook: Hook<HookContext<TState, TEvent>>): void;

  /**
   * Unregister a hook
   * @param hookId - ID of the hook to unregister
   */
  unregisterHook(hookId: string): void;

  /**
   * Reset the state machine to its initial state
   * @param newContext - Optional new context
   */
  reset(newContext?: TContext): Promise<void>;

  /**
   * Get the current state history
   * @returns Array of states visited
   */
  getStateHistory(): State<TState>[];
}

// ============================================================================
// Event Bus Types
// ============================================================================

/**
 * Event listener function
 * @template TEvent - The type of event
 */
export type EventListener<TEvent extends Event = Event> = (
  event: TEvent
) => void | Promise<void>;

/**
 * Event bus interface for decoupled communication
 */
export interface EventBus {
  /**
   * Subscribe to events of a specific type
   * @param eventType - The event type to listen for
   * @param listener - The listener function
   * @returns Unsubscribe function
   */
  subscribe<TEvent extends Event>(
    eventType: string,
    listener: EventListener<TEvent>
  ): () => void;

  /**
   * Emit an event
   * @param event - The event to emit
   */
  emit<TEvent extends Event>(event: TEvent): Promise<void>;

  /**
   * Remove all listeners for a specific event type
   * @param eventType - The event type to clear
   */
  clear(eventType?: string): void;

  /**
   * Get the number of listeners for an event type
   * @param eventType - The event type to check
   */
  listenerCount(eventType: string): number;
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Helper type to extract event payload type
 */
export type EventPayload<T extends Event> =
  T extends Event<infer P> ? P : never;

/**
 * Helper type to extract state data type
 */
export type StateData<T extends State> = T extends State<infer D> ? D : never;

/**
 * Helper type for creating typed events
 */
export type TypedEvent<
  TType extends string,
  TPayload = void,
> = Event<TPayload> & {
  readonly type: TType;
};

/**
 * Helper type for creating typed states
 */
export type TypedState<TId extends string, TData = void> = State<TData> & {
  readonly id: TId;
};
