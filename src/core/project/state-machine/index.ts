/**
 * State machine module exports
 */

export * from './types.js';
export { SimpleEventBus } from './EventBus.js';
export { StateMachineEngine } from './StateMachineEngine.js';

// Convenience factory functions
import { StateMachineEngine } from './StateMachineEngine.js';
import { SimpleEventBus } from './EventBus.js';
import { StateMachineConfig, EventBus, Event } from './types.js';

/**
 * Create a new state machine with default event bus
 */
export function createStateMachine<
  TState = any,
  TEvent extends Event = Event,
  TContext = any,
>(
  config: StateMachineConfig<TState, TEvent, TContext>,
  eventBus?: EventBus
): StateMachineEngine<TState, TEvent, TContext> {
  return new StateMachineEngine(config, eventBus ?? new SimpleEventBus());
}

/**
 * Create a new event bus
 */
export function createEventBus(maxListeners = 100): SimpleEventBus {
  return new SimpleEventBus(maxListeners);
}
