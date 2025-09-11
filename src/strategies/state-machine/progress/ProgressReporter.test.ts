import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ProgressReporter } from './ProgressReporter';
import { ProgressEventType, ProgressListener } from './ProgressTypes';
import {
  TestDataFactories,
  ProgressTestAssertions,
  AsyncTestHelpers,
} from '../../../test/progress-test-utils';

describe('ProgressReporter', () => {
  let progressReporter: ProgressReporter;
  let mockConfig: any;

  beforeEach(() => {
    vi.useFakeTimers();
    mockConfig = TestDataFactories.createMockProgressConfig();
    progressReporter = new ProgressReporter(mockConfig);
  });

  afterEach(() => {
    progressReporter.destroy();
    vi.useRealTimers();
  });

  describe('Event Emission', () => {
    it('should emit progress events when metrics update', () => {
      const events: any[] = [];
      const listener: ProgressListener = {
        onProgress: event => events.push(event),
      };

      progressReporter.addProgressListener(listener);
      progressReporter.updateMetric('analyzedPositions', 25);
      progressReporter.emitEvent(
        ProgressEventType.POSITION_ANALYSIS_COMPLETED,
        {}
      );

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe(
        ProgressEventType.POSITION_ANALYSIS_COMPLETED
      );
    });

    it('should emit milestone events when milestones are reached', () => {
      const milestones: any[] = [];
      const listener: ProgressListener = {
        onProgress: () => {},
        onMilestone: milestone => milestones.push(milestone),
      };

      progressReporter.addProgressListener(listener);
      progressReporter.updateMetric('totalPositions', 100);
      progressReporter.updateMetric('analyzedPositions', 50);
      // Trigger milestone check through periodic update
      vi.advanceTimersByTime(mockConfig.updateInterval);

      expect(milestones).toHaveLength(1);
      expect(milestones[0].id).toBe('test-milestone');
      expect(milestones[0].achieved).toBe(true);
    });

    it('should emit error events through EventEmitter interface', () => {
      const errors: any[] = [];

      progressReporter.on('error', (error, context) => {
        errors.push({ error, context });
      });

      const testError = new Error('Test error');
      progressReporter.emit('error', testError, { position: 'test' });

      expect(errors).toHaveLength(1);
      expect(errors[0].error).toBe(testError);
      expect(errors[0].context.position).toBe('test');
    });
  });

  describe('Metrics Tracking', () => {
    it('should correctly calculate completion percentage', () => {
      progressReporter.updateMetric('totalPositions', 100);
      progressReporter.updateMetric('analyzedPositions', 25);

      const snapshot = progressReporter.getSnapshot();
      const percentage =
        (snapshot.metrics.analyzedPositions / snapshot.metrics.totalPositions) *
        100;

      expect(percentage).toBe(25);
    });

    it('should track elapsed time accurately through periodic updates', () => {
      vi.advanceTimersByTime(5000);

      // Trigger periodic update which calls updateMetrics internally
      vi.advanceTimersByTime(mockConfig.updateInterval);
      const snapshot = progressReporter.getSnapshot();

      expect(snapshot.metrics.elapsedTime).toBeGreaterThanOrEqual(5000);
    });

    it('should update estimated time remaining through periodic updates', () => {
      progressReporter.updateMetric('totalPositions', 100);
      progressReporter.updateMetric('analyzedPositions', 25);

      // Add some history for rate calculation
      progressReporter.emitEvent(
        ProgressEventType.POSITION_ANALYSIS_COMPLETED,
        {}
      );
      vi.advanceTimersByTime(1000);
      progressReporter.updateMetric('analyzedPositions', 50);
      progressReporter.emitEvent(
        ProgressEventType.POSITION_ANALYSIS_COMPLETED,
        {}
      );

      // Trigger periodic update which calculates ETA
      vi.advanceTimersByTime(mockConfig.updateInterval);
      const snapshot = progressReporter.getSnapshot();

      expect(snapshot.metrics.estimatedTimeRemaining).toBeGreaterThanOrEqual(0);
    });

    it('should handle zero-duration operations', () => {
      progressReporter.updateMetric('totalPositions', 0);

      // Trigger periodic update
      vi.advanceTimersByTime(mockConfig.updateInterval);
      const snapshot = progressReporter.getSnapshot();

      expect(snapshot.metrics.estimatedTimeRemaining).toBe(0);
    });
  });

  describe('Listener Management', () => {
    it('should add progress listeners correctly', () => {
      const listener: ProgressListener = { onProgress: vi.fn() };

      progressReporter.addProgressListener(listener);
      progressReporter.emitEvent(
        ProgressEventType.POSITION_ANALYSIS_COMPLETED,
        {}
      );

      expect(listener.onProgress).toHaveBeenCalled();
    });

    it('should remove progress listeners correctly', () => {
      const listener: ProgressListener = { onProgress: vi.fn() };

      progressReporter.addProgressListener(listener);
      progressReporter.removeProgressListener(listener);
      progressReporter.emitEvent(
        ProgressEventType.POSITION_ANALYSIS_COMPLETED,
        {}
      );

      expect(listener.onProgress).not.toHaveBeenCalled();
    });

    it('should handle multiple listeners for same event', () => {
      const listener1: ProgressListener = { onProgress: vi.fn() };
      const listener2: ProgressListener = { onProgress: vi.fn() };

      progressReporter.addProgressListener(listener1);
      progressReporter.addProgressListener(listener2);
      progressReporter.emitEvent(
        ProgressEventType.POSITION_ANALYSIS_COMPLETED,
        {}
      );

      expect(listener1.onProgress).toHaveBeenCalled();
      expect(listener2.onProgress).toHaveBeenCalled();
    });

    it('should not crash when removing non-existent listener', () => {
      const listener: ProgressListener = { onProgress: vi.fn() };

      expect(() => {
        progressReporter.removeProgressListener(listener);
      }).not.toThrow();
    });
  });

  describe('History Management', () => {
    it('should maintain progress history within size limits', () => {
      const maxSize = mockConfig.maxHistorySize;

      // Add more snapshots than the limit by emitting events
      for (let i = 0; i < maxSize + 5; i++) {
        progressReporter.updateMetric('analyzedPositions', i);
        progressReporter.emitEvent(
          ProgressEventType.POSITION_ANALYSIS_COMPLETED,
          {}
        );
      }

      const history = progressReporter.getHistory();
      expect(history.length).toBeLessThanOrEqual(maxSize);
    });

    it('should provide accurate progress snapshots', () => {
      progressReporter.updateMetric('totalPositions', 100);
      progressReporter.updateMetric('analyzedPositions', 50);

      const snapshot = progressReporter.getSnapshot();

      expect(snapshot.metrics.totalPositions).toBe(100);
      expect(snapshot.metrics.analyzedPositions).toBe(50);
      expect(snapshot.timestamp).toBeTypeOf('number');
      ProgressTestAssertions.expectMetricsValid(snapshot.metrics);
    });

    it('should clear history when requested', () => {
      progressReporter.updateMetric('analyzedPositions', 25);
      progressReporter.emitEvent(
        ProgressEventType.POSITION_ANALYSIS_COMPLETED,
        {}
      );

      expect(progressReporter.getHistory().length).toBeGreaterThan(0);

      progressReporter.reset();
      expect(progressReporter.getHistory().length).toBe(0);
    });
  });

  describe('Configuration', () => {
    it('should respect update interval settings', () => {
      const config = TestDataFactories.createMockProgressConfig({
        updateInterval: 500,
      });
      const reporter = new ProgressReporter(config);

      const spy = vi.spyOn(reporter, 'emit');

      vi.advanceTimersByTime(500);
      expect(spy).toHaveBeenCalledWith('progress', expect.any(Object));

      reporter.destroy();
    });

    it('should handle invalid configuration gracefully', () => {
      const invalidConfig = {
        ...mockConfig,
        updateInterval: -1,
        maxHistorySize: -5,
      };

      expect(() => {
        new ProgressReporter(invalidConfig);
      }).not.toThrow();
    });

    it('should apply default values for missing config', () => {
      const partialConfig = {
        updateInterval: 1000,
        enableDetailedMetrics: true,
        milestones: [],
        maxHistorySize: 100,
        enablePerformanceTracking: true,
      } as any;

      expect(() => {
        new ProgressReporter(partialConfig);
      }).not.toThrow();
    });
  });

  describe('Edge Cases', () => {
    it('should handle rapid successive updates', () => {
      const events: any[] = [];
      const listener: ProgressListener = {
        onProgress: event => events.push(event),
      };

      progressReporter.addProgressListener(listener);

      // Rapid updates
      for (let i = 0; i < 100; i++) {
        progressReporter.updateMetric('analyzedPositions', i);
        progressReporter.emitEvent(
          ProgressEventType.POSITION_ANALYSIS_COMPLETED,
          {}
        );
      }

      expect(events.length).toBe(100);
    });

    it('should handle listener errors gracefully', () => {
      const faultyListener: ProgressListener = {
        onProgress: () => {
          throw new Error('Listener error');
        },
      };
      const goodListener: ProgressListener = {
        onProgress: vi.fn(),
      };

      progressReporter.addProgressListener(faultyListener);
      progressReporter.addProgressListener(goodListener);

      expect(() => {
        progressReporter.emitEvent(
          ProgressEventType.POSITION_ANALYSIS_COMPLETED,
          {}
        );
      }).not.toThrow();

      expect(goodListener.onProgress).toHaveBeenCalled();
    });
  });
});
