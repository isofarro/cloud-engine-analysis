import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SimpleEventBus } from './EventBus';
import { Event, EventListener } from './types';

describe('SimpleEventBus', () => {
  let eventBus: SimpleEventBus;
  let mockListener: EventListener;
  let mockListener2: EventListener;
  let consoleErrorSpy: any;

  beforeEach(() => {
    eventBus = new SimpleEventBus();
    mockListener = vi.fn();
    mockListener2 = vi.fn();
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.clearAllMocks();
    consoleErrorSpy.mockRestore();
  });

  describe('Constructor', () => {
    it('should create event bus with default max listeners', () => {
      const bus = new SimpleEventBus();
      expect(bus).toBeInstanceOf(SimpleEventBus);
      expect(bus.getEventTypes()).toEqual([]);
    });

    it('should create event bus with custom max listeners', () => {
      const bus = new SimpleEventBus(50);
      expect(bus).toBeInstanceOf(SimpleEventBus);
    });
  });

  describe('Event Subscription', () => {
    it('should subscribe to events and return unsubscribe function', () => {
      const unsubscribe = eventBus.subscribe('test-event', mockListener);

      expect(typeof unsubscribe).toBe('function');
      expect(eventBus.listenerCount('test-event')).toBe(1);
      expect(eventBus.getEventTypes()).toContain('test-event');
    });

    it('should allow multiple listeners for the same event type', () => {
      eventBus.subscribe('test-event', mockListener);
      eventBus.subscribe('test-event', mockListener2);

      expect(eventBus.listenerCount('test-event')).toBe(2);
    });

    it('should allow same listener to subscribe to different event types', () => {
      eventBus.subscribe('event-1', mockListener);
      eventBus.subscribe('event-2', mockListener);

      expect(eventBus.listenerCount('event-1')).toBe(1);
      expect(eventBus.listenerCount('event-2')).toBe(1);
      expect(eventBus.getEventTypes()).toEqual(['event-1', 'event-2']);
    });

    it('should throw error when max listeners exceeded', () => {
      const smallBus = new SimpleEventBus(2);

      smallBus.subscribe('test-event', mockListener);
      smallBus.subscribe('test-event', mockListener2);

      expect(() => {
        smallBus.subscribe('test-event', vi.fn());
      }).toThrow('Maximum listeners (2) exceeded for event type: test-event');
    });
  });

  describe('Event Unsubscription', () => {
    it('should unsubscribe listener using returned function', () => {
      const unsubscribe = eventBus.subscribe('test-event', mockListener);

      expect(eventBus.listenerCount('test-event')).toBe(1);

      unsubscribe();

      expect(eventBus.listenerCount('test-event')).toBe(0);
      expect(eventBus.getEventTypes()).not.toContain('test-event');
    });

    it('should only unsubscribe specific listener', () => {
      const unsubscribe1 = eventBus.subscribe('test-event', mockListener);
      eventBus.subscribe('test-event', mockListener2);

      expect(eventBus.listenerCount('test-event')).toBe(2);

      unsubscribe1();

      expect(eventBus.listenerCount('test-event')).toBe(1);
      expect(eventBus.getEventTypes()).toContain('test-event');
    });

    it('should handle multiple unsubscribe calls gracefully', () => {
      const unsubscribe = eventBus.subscribe('test-event', mockListener);

      unsubscribe();
      expect(() => unsubscribe()).not.toThrow();

      expect(eventBus.listenerCount('test-event')).toBe(0);
    });
  });

  describe('Event Emission', () => {
    it('should emit events to subscribed listeners', async () => {
      eventBus.subscribe('test-event', mockListener);

      const testEvent: Event = {
        type: 'test-event',
        payload: { data: 'test' },
        timestamp: Date.now(),
      };

      await eventBus.emit(testEvent);

      expect(mockListener).toHaveBeenCalledTimes(1);
      expect(mockListener).toHaveBeenCalledWith(testEvent);
    });

    it('should emit events to all subscribed listeners', async () => {
      eventBus.subscribe('test-event', mockListener);
      eventBus.subscribe('test-event', mockListener2);

      const testEvent: Event = {
        type: 'test-event',
        payload: { data: 'test' },
        timestamp: Date.now(),
      };

      await eventBus.emit(testEvent);

      expect(mockListener).toHaveBeenCalledWith(testEvent);
      expect(mockListener2).toHaveBeenCalledWith(testEvent);
    });

    it('should not emit to listeners of different event types', async () => {
      eventBus.subscribe('event-1', mockListener);
      eventBus.subscribe('event-2', mockListener2);

      const testEvent: Event = {
        type: 'event-1',
        payload: { data: 'test' },
        timestamp: Date.now(),
      };

      await eventBus.emit(testEvent);

      expect(mockListener).toHaveBeenCalledWith(testEvent);
      expect(mockListener2).not.toHaveBeenCalled();
    });

    it('should handle emission to non-existent event type gracefully', async () => {
      const testEvent: Event = {
        type: 'non-existent-event',
        payload: { data: 'test' },
        timestamp: Date.now(),
      };

      await expect(eventBus.emit(testEvent)).resolves.toBeUndefined();
    });

    it('should handle async listeners', async () => {
      const asyncListener = vi.fn().mockImplementation(async event => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return event;
      });

      eventBus.subscribe('async-event', asyncListener);

      const testEvent: Event = {
        type: 'async-event',
        payload: { data: 'async-test' },
        timestamp: Date.now(),
      };

      await eventBus.emit(testEvent);

      expect(asyncListener).toHaveBeenCalledWith(testEvent);
    });
  });

  describe('Error Handling', () => {
    it('should catch and log listener errors without stopping other listeners', async () => {
      const errorListener = vi.fn().mockImplementation(() => {
        throw new Error('Listener error');
      });

      eventBus.subscribe('test-event', errorListener);
      eventBus.subscribe('test-event', mockListener);

      const testEvent: Event = {
        type: 'test-event',
        payload: { data: 'test' },
        timestamp: Date.now(),
      };

      await eventBus.emit(testEvent);

      expect(errorListener).toHaveBeenCalled();
      expect(mockListener).toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error in event listener for test-event:',
        expect.any(Error)
      );
    });

    it('should handle async listener errors', async () => {
      const asyncErrorListener = vi.fn().mockImplementation(async () => {
        throw new Error('Async listener error');
      });

      eventBus.subscribe('test-event', asyncErrorListener);
      eventBus.subscribe('test-event', mockListener);

      const testEvent: Event = {
        type: 'test-event',
        payload: { data: 'test' },
        timestamp: Date.now(),
      };

      await eventBus.emit(testEvent);

      expect(asyncErrorListener).toHaveBeenCalled();
      expect(mockListener).toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error in event listener for test-event:',
        expect.any(Error)
      );
    });
  });

  describe('Utility Methods', () => {
    describe('clear', () => {
      beforeEach(() => {
        eventBus.subscribe('event-1', mockListener);
        eventBus.subscribe('event-2', mockListener2);
      });

      it('should clear all listeners for specific event type', () => {
        expect(eventBus.listenerCount('event-1')).toBe(1);
        expect(eventBus.listenerCount('event-2')).toBe(1);

        eventBus.clear('event-1');

        expect(eventBus.listenerCount('event-1')).toBe(0);
        expect(eventBus.listenerCount('event-2')).toBe(1);
        expect(eventBus.getEventTypes()).toEqual(['event-2']);
      });

      it('should clear all listeners when no event type specified', () => {
        expect(eventBus.getEventTypes()).toHaveLength(2);

        eventBus.clear();

        expect(eventBus.listenerCount('event-1')).toBe(0);
        expect(eventBus.listenerCount('event-2')).toBe(0);
        expect(eventBus.getEventTypes()).toEqual([]);
      });

      it('should handle clearing non-existent event type', () => {
        expect(() => eventBus.clear('non-existent')).not.toThrow();
        expect(eventBus.getEventTypes()).toHaveLength(2);
      });
    });

    describe('listenerCount', () => {
      it('should return correct listener count for event type', () => {
        expect(eventBus.listenerCount('test-event')).toBe(0);

        eventBus.subscribe('test-event', mockListener);
        expect(eventBus.listenerCount('test-event')).toBe(1);

        eventBus.subscribe('test-event', mockListener2);
        expect(eventBus.listenerCount('test-event')).toBe(2);
      });

      it('should return 0 for non-existent event type', () => {
        expect(eventBus.listenerCount('non-existent')).toBe(0);
      });
    });

    describe('getEventTypes', () => {
      it('should return empty array when no events registered', () => {
        expect(eventBus.getEventTypes()).toEqual([]);
      });

      it('should return all registered event types', () => {
        eventBus.subscribe('event-1', mockListener);
        eventBus.subscribe('event-2', mockListener2);
        eventBus.subscribe('event-3', mockListener);

        const eventTypes = eventBus.getEventTypes();
        expect(eventTypes).toHaveLength(3);
        expect(eventTypes).toContain('event-1');
        expect(eventTypes).toContain('event-2');
        expect(eventTypes).toContain('event-3');
      });

      it('should not include event types with no listeners', () => {
        const unsubscribe = eventBus.subscribe('test-event', mockListener);
        expect(eventBus.getEventTypes()).toContain('test-event');

        unsubscribe();
        expect(eventBus.getEventTypes()).not.toContain('test-event');
      });
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle complex subscription and emission patterns', async () => {
      const results: string[] = [];

      const listener1 = vi.fn().mockImplementation(event => {
        results.push(`listener1-${event.payload.id}`);
      });

      const listener2 = vi.fn().mockImplementation(event => {
        results.push(`listener2-${event.payload.id}`);
      });

      // Subscribe to multiple events
      eventBus.subscribe('event-a', listener1);
      eventBus.subscribe('event-b', listener2);
      eventBus.subscribe('event-a', listener2); // listener2 on both events

      // Emit events
      await eventBus.emit({
        type: 'event-a',
        payload: { id: '1' },
        timestamp: Date.now(),
      });

      await eventBus.emit({
        type: 'event-b',
        payload: { id: '2' },
        timestamp: Date.now(),
      });

      expect(results).toContain('listener1-1');
      expect(results).toContain('listener2-1');
      expect(results).toContain('listener2-2');
      expect(results).not.toContain('listener1-2');
    });

    it('should handle rapid subscription and unsubscription', () => {
      const unsubscribers: (() => void)[] = [];

      // Subscribe many listeners
      for (let i = 0; i < 10; i++) {
        const listener = vi.fn();
        const unsubscribe = eventBus.subscribe('rapid-test', listener);
        unsubscribers.push(unsubscribe);
      }

      expect(eventBus.listenerCount('rapid-test')).toBe(10);

      // Unsubscribe half
      for (let i = 0; i < 5; i++) {
        unsubscribers[i]();
      }

      expect(eventBus.listenerCount('rapid-test')).toBe(5);

      // Unsubscribe remaining
      for (let i = 5; i < 10; i++) {
        unsubscribers[i]();
      }

      expect(eventBus.listenerCount('rapid-test')).toBe(0);
      expect(eventBus.getEventTypes()).not.toContain('rapid-test');
    });
  });
});
