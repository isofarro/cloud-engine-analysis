/**
 * Event bus implementation for decoupled communication between components
 */

import { Event, EventBus, EventListener } from './types.js';

/**
 * Simple in-memory event bus implementation
 */
export class SimpleEventBus implements EventBus {
  private listeners = new Map<string, Set<EventListener>>();
  private readonly maxListeners: number;

  constructor(maxListeners = 100) {
    this.maxListeners = maxListeners;
  }

  /**
   * Subscribe to events of a specific type
   */
  subscribe<TEvent extends Event>(
    eventType: string,
    listener: EventListener<TEvent>
  ): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }

    const eventListeners = this.listeners.get(eventType)!;

    if (eventListeners.size >= this.maxListeners) {
      throw new Error(
        `Maximum listeners (${this.maxListeners}) exceeded for event type: ${eventType}`
      );
    }

    eventListeners.add(listener as EventListener);

    // Return unsubscribe function
    return () => {
      eventListeners.delete(listener as EventListener);
      if (eventListeners.size === 0) {
        this.listeners.delete(eventType);
      }
    };
  }

  /**
   * Emit an event to all subscribers
   */
  async emit<TEvent extends Event>(event: TEvent): Promise<void> {
    const listeners = this.listeners.get(event.type);
    if (!listeners || listeners.size === 0) {
      return;
    }

    // Execute all listeners in parallel
    const promises = Array.from(listeners).map(async listener => {
      try {
        await listener(event);
      } catch (error) {
        // Log error but don't stop other listeners
        console.error(`Error in event listener for ${event.type}:`, error);
      }
    });

    await Promise.all(promises);
  }

  /**
   * Remove all listeners for a specific event type or all events
   */
  clear(eventType?: string): void {
    if (eventType) {
      this.listeners.delete(eventType);
    } else {
      this.listeners.clear();
    }
  }

  /**
   * Get the number of listeners for an event type
   */
  listenerCount(eventType: string): number {
    return this.listeners.get(eventType)?.size ?? 0;
  }

  /**
   * Get all registered event types
   */
  getEventTypes(): string[] {
    return Array.from(this.listeners.keys());
  }
}
