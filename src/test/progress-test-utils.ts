import { vi } from 'vitest';
import { EventEmitter } from 'events';
import {
  ProgressConfiguration,
  ProgressEvent,
  ProgressEventType,
  ProgressMetrics,
  ProgressSnapshot,
  ProgressMilestone,
} from '../strategies/state-machine/progress/ProgressTypes';
import {
  PVExplorationState,
  PVExplorationEvent,
} from '../core/project/state-machine/pv-exploration/types';
import {
  StateMachine,
  Event,
  State,
  Transition,
  Hook,
  HookContext,
} from '../core/project/state-machine/types';
import { EventBus, EventListener } from '../core/project/state-machine/types';

/**
 * Mock StateMachine for testing
 */
export class MockStateMachine
  extends EventEmitter
  implements StateMachine<any, any, any>
{
  public id = 'mock-state-machine';
  private _currentState: any = PVExplorationState.IDLE;
  private _context: any = {};
  private _isFinished = false;
  private _hasError = false;
  private _lastError?: Error;
  private _stateHistory: any[] = [];
  private _hooks: Map<string, Hook> = new Map();

  get currentState() {
    return this._currentState;
  }
  get context() {
    return this._context;
  }
  get isFinished() {
    return this._isFinished;
  }
  get hasError() {
    return this._hasError;
  }
  get lastError() {
    return this._lastError;
  }
  get stateHistory() {
    return [...this._stateHistory];
  }

  send(event: Event): Promise<void> {
    return Promise.resolve();
  }

  canTransition(eventType: string): boolean {
    // Mock implementation - always return true for testing
    return true;
  }

  getPossibleTransitions(): Transition<any, any>[] {
    // Mock implementation - return empty array for testing
    return [];
  }

  registerHook(hook: Hook<HookContext<any, any>>): void {
    this._hooks.set(hook.id, hook);
  }

  unregisterHook(hookId: string): void {
    this._hooks.delete(hookId);
  }

  async reset(newContext?: any): Promise<void> {
    this._currentState = PVExplorationState.IDLE;
    this._context = newContext || {};
    this._isFinished = false;
    this._hasError = false;
    this._lastError = undefined;
    this._stateHistory = [];
  }

  getStateHistory(): State<any>[] {
    return this._stateHistory.map(state => ({
      id: state,
      name: state,
    }));
  }

  // Test helper methods
  emitStateEvent(event: PVExplorationEvent, data?: any): void {
    this.emit('event', { type: event, data, timestamp: Date.now() });
  }

  transitionTo(state: PVExplorationState): void {
    this._stateHistory.push(this._currentState);
    this._currentState = state;
    this.emit('stateChange', {
      from: this._stateHistory[this._stateHistory.length - 1],
      to: state,
    });
  }

  simulateError(error: Error): void {
    this._hasError = true;
    this._lastError = error;
    this.emitStateEvent(PVExplorationEvent.ERROR_OCCURRED, { error });
  }

  finish(): void {
    this._isFinished = true;
    this.emitStateEvent(PVExplorationEvent.ROOT_ANALYSIS_COMPLETE);
  }
}

/**
 * Mock EventBus for testing
 */
export class MockEventBus implements EventBus {
  private listeners = new Map<string, Set<EventListener>>();
  private emittedEvents: Array<{
    event: string;
    data: any;
    timestamp: number;
  }> = [];

  subscribe<TEvent extends Event>(
    eventType: string,
    listener: EventListener<TEvent>
  ): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    this.listeners.get(eventType)!.add(listener as EventListener);

    return () => {
      this.listeners.get(eventType)?.delete(listener as EventListener);
    };
  }

  async emit<TEvent extends Event>(event: TEvent): Promise<void> {
    const eventType = typeof event === 'string' ? event : event.type;
    const eventData = typeof event === 'string' ? undefined : event;

    this.emittedEvents.push({
      event: eventType,
      data: eventData,
      timestamp: Date.now(),
    });
    const listeners = this.listeners.get(eventType);
    if (listeners) {
      for (const listener of listeners) {
        try {
          await listener(eventData as any);
        } catch (error) {
          console.error('Error in event listener:', error);
        }
      }
    }
  }

  clear(eventType?: string): void {
    if (eventType) {
      this.listeners.delete(eventType);
    } else {
      this.listeners.clear();
    }
    this.emittedEvents = [];
  }

  listenerCount(eventType: string): number {
    return this.listeners.get(eventType)?.size || 0;
  }

  // Test helper methods - keep the original emit for testing convenience
  emitSync(event: string, data?: any): void {
    this.emittedEvents.push({ event, data, timestamp: Date.now() });
    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(data as any);
        } catch (error) {
          console.error('Error in event listener:', error);
        }
      });
    }
  }

  // Test helper methods
  getEmittedEvents(): Array<{ event: string; data: any; timestamp: number }> {
    return [...this.emittedEvents];
  }

  clearEmittedEvents(): void {
    this.emittedEvents = [];
  }

  getListenerCount(eventType: string): number {
    return this.listeners.get(eventType)?.size || 0;
  }
}

/**
 * Progress-specific test assertions
 */
export class ProgressTestAssertions {
  static expectProgressBetween(actual: number, min: number, max: number): void {
    if (actual < min || actual > max) {
      throw new Error(
        `Expected progress ${actual} to be between ${min} and ${max}`
      );
    }
  }

  static expectMilestoneReached(
    milestones: ProgressMilestone[],
    milestoneId: string
  ): void {
    const milestone = milestones.find(m => m.id === milestoneId);
    if (!milestone) {
      throw new Error(`Milestone ${milestoneId} not found`);
    }
    if (!milestone.achieved) {
      throw new Error(`Expected milestone ${milestoneId} to be achieved`);
    }
  }

  static expectEventEmitted(
    events: any[],
    eventType: ProgressEventType,
    times?: number
  ): void {
    const matchingEvents = events.filter(e => e.type === eventType);
    if (times !== undefined && matchingEvents.length !== times) {
      throw new Error(
        `Expected ${eventType} to be emitted ${times} times, but was emitted ${matchingEvents.length} times`
      );
    }
    if (times === undefined && matchingEvents.length === 0) {
      throw new Error(`Expected ${eventType} to be emitted at least once`);
    }
  }

  static expectMetricsValid(metrics: ProgressMetrics): void {
    if (metrics.analyzedPositions > metrics.totalPositions) {
      throw new Error('Analyzed positions cannot exceed total positions');
    }
    if (metrics.currentDepth > metrics.maxDepth) {
      throw new Error('Current depth cannot exceed max depth');
    }
    if (metrics.analysisRate < 0) {
      throw new Error('Analysis rate cannot be negative');
    }
  }
}

/**
 * Async test helpers for timing-sensitive operations
 */
export class AsyncTestHelpers {
  static async waitForProgressUpdate(
    progressReporter: any,
    timeout = 5000
  ): Promise<ProgressEvent> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(
          new Error(`Timeout waiting for progress update after ${timeout}ms`)
        );
      }, timeout);

      const listener = (event: ProgressEvent) => {
        clearTimeout(timer);
        resolve(event);
      };

      progressReporter.addProgressListener({ onProgress: listener });
    });
  }

  static async waitForMilestone(
    progressReporter: any,
    milestoneId: string,
    timeout = 5000
  ): Promise<ProgressMilestone> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(
          new Error(
            `Timeout waiting for milestone ${milestoneId} after ${timeout}ms`
          )
        );
      }, timeout);

      const listener = (milestone: ProgressMilestone) => {
        if (milestone.id === milestoneId) {
          clearTimeout(timer);
          resolve(milestone);
        }
      };

      progressReporter.addProgressListener({
        onProgress: () => {},
        onMilestone: listener,
      });
    });
  }

  static async waitForEventEmission(
    eventBus: MockEventBus,
    eventType: string,
    timeout = 5000
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(
          new Error(`Timeout waiting for event ${eventType} after ${timeout}ms`)
        );
      }, timeout);

      const unsubscribe = eventBus.subscribe(eventType, (data: any) => {
        clearTimeout(timer);
        unsubscribe();
        resolve(data);
      });
    });
  }

  static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Test data factories
 */
export const TestDataFactories = {
  createMockProgressConfig(
    overrides?: Partial<ProgressConfiguration>
  ): ProgressConfiguration {
    return {
      updateInterval: 100, // Faster for tests
      enableDetailedMetrics: true,
      enablePerformanceTracking: true,
      maxHistorySize: 10,
      milestones: [
        {
          id: 'test-milestone',
          name: 'Test Milestone',
          description: 'Test milestone for unit tests',
          threshold: 0.5,
          achieved: false,
        },
      ],
      ...overrides,
    };
  },

  createMockProgressEvent(type: ProgressEventType, data?: any): ProgressEvent {
    return {
      type,
      timestamp: Date.now(),
      data: data || {},
      snapshot: this.createMockProgressSnapshot(),
    };
  },

  createMockProgressSnapshot(
    overrides?: Partial<ProgressSnapshot>
  ): ProgressSnapshot {
    return {
      timestamp: Date.now(),
      state: 'testing',
      metrics: this.createMockProgressMetrics(),
      currentPosition:
        'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      recentErrors: [],
      ...overrides,
    };
  },

  createMockProgressMetrics(
    overrides?: Partial<ProgressMetrics>
  ): ProgressMetrics {
    return {
      totalPositions: 100,
      analyzedPositions: 50,
      queuedPositions: 25,
      failedPositions: 0,
      currentDepth: 5,
      maxDepth: 10,
      elapsedTime: 5000,
      estimatedTimeRemaining: 5000,
      analysisRate: 10,
      memoryUsage: 1024,
      graphNodes: 75,
      graphEdges: 150,
      ...overrides,
    };
  },

  createMockStateMachineEvent(event: PVExplorationEvent, data?: any): any {
    return {
      type: event,
      data: data || {},
      timestamp: Date.now(),
    };
  },
};

/**
 * Console output capture for testing dashboard output
 */
export class ConsoleCapture {
  private originalLog: typeof console.log;
  private originalWrite: typeof process.stdout.write;
  private logs: string[] = [];
  private writes: string[] = [];

  constructor() {
    this.originalLog = console.log;
    this.originalWrite = process.stdout.write;
  }

  start(): void {
    this.logs = [];
    this.writes = [];

    console.log = vi.fn((...args: any[]) => {
      this.logs.push(args.join(' '));
    });

    process.stdout.write = vi.fn((chunk: any) => {
      this.writes.push(chunk.toString());
      return true;
    }) as any;
  }

  stop(): void {
    console.log = this.originalLog;
    process.stdout.write = this.originalWrite;
  }

  getLogs(): string[] {
    return [...this.logs];
  }

  getWrites(): string[] {
    return [...this.writes];
  }

  clear(): void {
    this.logs = [];
    this.writes = [];
  }
}
