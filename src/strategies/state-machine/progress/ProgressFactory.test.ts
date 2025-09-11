import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ProgressFactory } from './ProgressFactory';
import { ProgressConfiguration } from './ProgressTypes';
import { StateMachineEngine } from '../../../core/project/state-machine/StateMachineEngine';
import { SimpleEventBus } from '../../../core/project/state-machine/EventBus';
import {
  PVExplorationState,
  PVExplorationEvent,
} from '../../../core/project/state-machine/pv-exploration/types';
import { ProgressReporter } from './ProgressReporter';
import { ProgressDashboard } from './ProgressDashboard';
import { StateMachineProgressIntegration } from './StateMachineProgressIntegration';

describe('ProgressFactory', () => {
  let mockStateMachine: StateMachineEngine<any, any, any>;

  beforeEach(() => {
    // Create a proper StateMachineEngine instance for testing
    mockStateMachine = new StateMachineEngine(
      {
        id: 'test-state-machine',
        initialState: PVExplorationState.IDLE,
        states: [
          { id: PVExplorationState.IDLE, name: 'Idle' },
          { id: PVExplorationState.INITIALIZING, name: 'Initializing' },
          { id: PVExplorationState.ANALYZING_ROOT, name: 'Analyzing Root' },
          { id: PVExplorationState.PROCESSING_QUEUE, name: 'Processing Queue' },
          {
            id: PVExplorationState.COMPLETED,
            name: 'Completed',
            isFinal: true,
          },
          { id: PVExplorationState.ERROR, name: 'Error', isFinal: true },
        ],
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
        ],
        context: {},
      },
      new SimpleEventBus()
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('createDefaultConfiguration', () => {
    it('should create a valid default configuration', () => {
      const config = ProgressFactory.createDefaultConfiguration();

      expect(config).toBeDefined();
      expect(config.updateInterval).toBe(1000);
      expect(config.enableDetailedMetrics).toBe(true);
      expect(config.enablePerformanceTracking).toBe(true);
      expect(config.maxHistorySize).toBe(100);
      expect(config.milestones).toHaveLength(4);
    });

    it('should include all required milestone configurations', () => {
      const config = ProgressFactory.createDefaultConfiguration();
      const milestoneIds = config.milestones.map(m => m.id);

      expect(milestoneIds).toContain('quarter');
      expect(milestoneIds).toContain('half');
      expect(milestoneIds).toContain('three_quarters');
      expect(milestoneIds).toContain('nearly_complete');
    });

    it('should have properly configured milestone thresholds', () => {
      const config = ProgressFactory.createDefaultConfiguration();

      const quarter = config.milestones.find(m => m.id === 'quarter');
      const half = config.milestones.find(m => m.id === 'half');
      const threeQuarters = config.milestones.find(
        m => m.id === 'three_quarters'
      );
      const nearlyComplete = config.milestones.find(
        m => m.id === 'nearly_complete'
      );

      expect(quarter?.threshold).toBe(0.25);
      expect(half?.threshold).toBe(0.5);
      expect(threeQuarters?.threshold).toBe(0.75);
      expect(nearlyComplete?.threshold).toBe(0.9);
    });

    it('should have all milestones initially unachieved', () => {
      const config = ProgressFactory.createDefaultConfiguration();

      config.milestones.forEach(milestone => {
        expect(milestone.achieved).toBe(false);
        expect(milestone.achievedAt).toBeUndefined();
      });
    });

    it('should have descriptive names and descriptions for milestones', () => {
      const config = ProgressFactory.createDefaultConfiguration();

      config.milestones.forEach(milestone => {
        expect(milestone.name).toBeTruthy();
        expect(milestone.description).toBeTruthy();
        expect(typeof milestone.name).toBe('string');
        expect(typeof milestone.description).toBe('string');
      });
    });
  });

  describe('createProgressSystem', () => {
    it('should create a complete progress system with default configuration', () => {
      const system = ProgressFactory.createProgressSystem(mockStateMachine);

      expect(system).toBeDefined();
      expect(system.reporter).toBeInstanceOf(ProgressReporter);
      expect(system.integration).toBeInstanceOf(
        StateMachineProgressIntegration
      );
      expect(system.dashboard).toBeInstanceOf(ProgressDashboard);
      expect(system.config).toBeDefined();
    });

    it('should use default configuration when no config provided', () => {
      const system = ProgressFactory.createProgressSystem(mockStateMachine);
      const defaultConfig = ProgressFactory.createDefaultConfiguration();

      expect(system.config).toEqual(defaultConfig);
    });

    it('should merge custom configuration with defaults', () => {
      const customConfig: Partial<ProgressConfiguration> = {
        updateInterval: 2000,
        enableDetailedMetrics: false,
        maxHistorySize: 50,
      };

      const system = ProgressFactory.createProgressSystem(
        mockStateMachine,
        customConfig
      );

      expect(system.config.updateInterval).toBe(2000);
      expect(system.config.enableDetailedMetrics).toBe(false);
      expect(system.config.maxHistorySize).toBe(50);
      // Should keep default values for unspecified properties
      expect(system.config.enablePerformanceTracking).toBe(true);
      expect(system.config.milestones).toHaveLength(4);
    });

    it('should override default milestones when custom milestones provided', () => {
      const customMilestones = [
        {
          id: 'custom',
          name: 'Custom Milestone',
          description: 'Custom milestone description',
          threshold: 0.33,
          achieved: false,
        },
      ];

      const customConfig: Partial<ProgressConfiguration> = {
        milestones: customMilestones,
      };

      const system = ProgressFactory.createProgressSystem(
        mockStateMachine,
        customConfig
      );

      expect(system.config.milestones).toEqual(customMilestones);
      expect(system.config.milestones).toHaveLength(1);
    });

    it('should create properly configured dashboard', () => {
      const customConfig: Partial<ProgressConfiguration> = {
        updateInterval: 500,
        enableDetailedMetrics: false,
      };

      const system = ProgressFactory.createProgressSystem(
        mockStateMachine,
        customConfig
      );

      // Dashboard should be configured based on the merged config
      expect(system.dashboard).toBeInstanceOf(ProgressDashboard);
      // Note: We can't directly test dashboard config as it's private,
      // but we can verify it was created successfully
    });

    it('should create integration with provided state machine', () => {
      const system = ProgressFactory.createProgressSystem(mockStateMachine);

      expect(system.integration).toBeInstanceOf(
        StateMachineProgressIntegration
      );
      // The integration should be connected to our mock state machine
    });

    it('should handle empty custom configuration', () => {
      const system = ProgressFactory.createProgressSystem(mockStateMachine, {});
      const defaultConfig = ProgressFactory.createDefaultConfiguration();

      expect(system.config).toEqual(defaultConfig);
    });

    it('should handle null/undefined custom configuration', () => {
      const system1 = ProgressFactory.createProgressSystem(
        mockStateMachine,
        undefined
      );
      const system2 = ProgressFactory.createProgressSystem(
        mockStateMachine,
        null as any
      );
      const defaultConfig = ProgressFactory.createDefaultConfiguration();

      expect(system1.config).toEqual(defaultConfig);
      expect(system2.config).toEqual(defaultConfig);
    });

    it('should create system components that are properly connected', () => {
      const system = ProgressFactory.createProgressSystem(mockStateMachine);

      // Test that components can interact (basic smoke test)
      expect(() => {
        system.reporter.updateMetric('totalPositions', 100);
        system.reporter.updateMetric('analyzedPositions', 25);
      }).not.toThrow();

      expect(system.reporter.getSnapshot()).toBeDefined();
    });

    it('should create unique instances for each call', () => {
      const system1 = ProgressFactory.createProgressSystem(mockStateMachine);
      const system2 = ProgressFactory.createProgressSystem(mockStateMachine);

      expect(system1.reporter).not.toBe(system2.reporter);
      expect(system1.integration).not.toBe(system2.integration);
      expect(system1.dashboard).not.toBe(system2.dashboard);
    });

    it('should handle complex custom configuration', () => {
      const complexConfig: Partial<ProgressConfiguration> = {
        updateInterval: 250,
        enableDetailedMetrics: true,
        enablePerformanceTracking: false,
        maxHistorySize: 200,
        milestones: [
          {
            id: 'start',
            name: 'Started',
            description: 'Analysis has begun',
            threshold: 0.01,
            achieved: false,
          },
          {
            id: 'middle',
            name: 'Halfway',
            description: 'Halfway through analysis',
            threshold: 0.5,
            achieved: false,
          },
          {
            id: 'end',
            name: 'Completed',
            description: 'Analysis completed',
            threshold: 1.0,
            achieved: false,
          },
        ],
      };

      const system = ProgressFactory.createProgressSystem(
        mockStateMachine,
        complexConfig
      );

      expect(system.config.updateInterval).toBe(250);
      expect(system.config.enableDetailedMetrics).toBe(true);
      expect(system.config.enablePerformanceTracking).toBe(false);
      expect(system.config.maxHistorySize).toBe(200);
      expect(system.config.milestones).toHaveLength(3);
      expect(system.config.milestones[0].id).toBe('start');
      expect(system.config.milestones[1].id).toBe('middle');
      expect(system.config.milestones[2].id).toBe('end');
    });
  });

  describe('Integration Tests', () => {
    it('should create a system where all components work together', () => {
      const system = ProgressFactory.createProgressSystem(mockStateMachine);

      // Test basic workflow
      system.reporter.updateMetric('totalPositions', 100);
      system.reporter.updateMetric('analyzedPositions', 25);

      const snapshot = system.reporter.getSnapshot();
      expect(snapshot.metrics.totalPositions).toBe(100);
      expect(snapshot.metrics.analyzedPositions).toBe(25);

      // Test milestone checking
      system.reporter.updateMetric('analyzedPositions', 50);
      const milestones = system.reporter.getMilestones();
      expect(milestones.some(m => m.id === 'quarter')).toBe(true);
    });

    it('should properly clean up created system', () => {
      const system = ProgressFactory.createProgressSystem(mockStateMachine);

      // Cleanup
      system.dashboard.stop();
      system.reporter.reset();
      system.reporter.destroy();
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid state machine gracefully', () => {
      const invalidStateMachine = null as any;

      expect(() => {
        ProgressFactory.createProgressSystem(invalidStateMachine);
      }).not.toThrow();
    });

    it('should handle malformed custom configuration', () => {
      const malformedConfig = {
        milestones: 'not an array' as any,
        updateInterval: 'invalid' as any,
      };

      // The factory should either throw an error or handle gracefully
      expect(() => {
        ProgressFactory.createProgressSystem(mockStateMachine, malformedConfig);
      }).toThrow('milestones.forEach is not a function');
    });
  });
});
