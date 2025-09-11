import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ProgressDashboard, DashboardConfig } from './ProgressDashboard';
import { ProgressReporter } from './ProgressReporter';
import {
  ProgressEventType,
  ProgressEvent,
  ProgressMilestone,
} from './ProgressTypes';
import { TestDataFactories } from '../../../test/progress-test-utils';

describe('ProgressDashboard', () => {
  let dashboard: ProgressDashboard;
  let mockProgressReporter: ProgressReporter;
  let mockConfig: DashboardConfig;
  let consoleSpy: any;
  let processStdoutSpy: any;

  beforeEach(() => {
    vi.useFakeTimers();

    // Create mock progress reporter
    const reporterConfig = TestDataFactories.createMockProgressConfig();
    mockProgressReporter = new ProgressReporter(reporterConfig);

    // Create dashboard config
    mockConfig = {
      refreshInterval: 1000,
      showDetailedMetrics: true,
      showMilestones: true,
      showHistory: false,
    };

    // Spy on console methods
    consoleSpy = {
      log: vi.spyOn(console, 'log').mockImplementation(() => {}),
      error: vi.spyOn(console, 'error').mockImplementation(() => {}),
    };

    // Spy on process.stdout.write
    processStdoutSpy = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true);

    // Mock progress reporter methods
    vi.spyOn(mockProgressReporter, 'getSnapshot').mockReturnValue({
      timestamp: Date.now(),
      state: 'analyzing',
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

    vi.spyOn(mockProgressReporter, 'getMilestones').mockReturnValue([
      {
        id: 'quarter',
        name: 'Quarter Complete',
        description: '25% analyzed',
        threshold: 0.25,
        achieved: true,
        achievedAt: Date.now() - 1000,
      },
      {
        id: 'half',
        name: 'Half Complete',
        description: '50% analyzed',
        threshold: 0.5,
        achieved: false,
      },
    ]);

    dashboard = new ProgressDashboard(mockProgressReporter, mockConfig);
  });

  afterEach(() => {
    dashboard.stop();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('Constructor and Setup', () => {
    it('should initialize with provided config and progress reporter', () => {
      expect(dashboard).toBeInstanceOf(ProgressDashboard);
    });

    it('should setup progress listeners during construction', () => {
      const addListenerSpy = vi.spyOn(
        mockProgressReporter,
        'addProgressListener'
      );

      new ProgressDashboard(mockProgressReporter, mockConfig);

      expect(addListenerSpy).toHaveBeenCalledWith({
        onProgress: expect.any(Function),
        onMilestone: expect.any(Function),
        onError: expect.any(Function),
      });
    });

    it('should start in inactive state', () => {
      // Dashboard should not display events when inactive
      const mockEvent: ProgressEvent = {
        type: ProgressEventType.EXPLORATION_STARTED,
        timestamp: Date.now(),
        snapshot: mockProgressReporter.getSnapshot(),
        data: {},
      };

      // Simulate event handling (dashboard is inactive by default)
      dashboard['handleProgressEvent'](mockEvent);

      expect(consoleSpy.log).not.toHaveBeenCalled();
    });
  });

  describe('Dashboard State Management', () => {
    it('should start dashboard and display start message', () => {
      dashboard.start();

      expect(consoleSpy.log).toHaveBeenCalledWith(
        '📊 Progress Dashboard Started'
      );
    });

    it('should stop dashboard and display stop message', () => {
      dashboard.start();
      dashboard.stop();

      expect(consoleSpy.log).toHaveBeenCalledWith(
        '\n📊 Progress Dashboard Stopped'
      );
    });

    it('should handle events only when active', () => {
      const mockEvent: ProgressEvent = {
        type: ProgressEventType.EXPLORATION_STARTED,
        timestamp: Date.now(),
        snapshot: mockProgressReporter.getSnapshot(),
        data: {},
      };

      // Event should be ignored when inactive
      dashboard['handleProgressEvent'](mockEvent);
      expect(consoleSpy.log).not.toHaveBeenCalledWith(
        expect.stringContaining('🚀 PV Exploration Started')
      );

      // Event should be handled when active
      dashboard.start();
      dashboard['handleProgressEvent'](mockEvent);
      expect(consoleSpy.log).toHaveBeenCalledWith('🚀 PV Exploration Started');
    });
  });

  describe('Progress Event Handling', () => {
    beforeEach(() => {
      dashboard.start();
    });

    it('should display exploration start information', () => {
      const mockEvent: ProgressEvent = {
        type: ProgressEventType.EXPLORATION_STARTED,
        timestamp: Date.now(),
        snapshot: mockProgressReporter.getSnapshot(),
        data: {},
      };

      dashboard['handleProgressEvent'](mockEvent);

      expect(consoleSpy.log).toHaveBeenCalledWith('🚀 PV Exploration Started');
      expect(consoleSpy.log).toHaveBeenCalledWith(
        '   Total positions to analyze: 100'
      );
      expect(consoleSpy.log).toHaveBeenCalledWith('   Max depth: 8');
    });

    it('should update progress with progress bar and metrics', () => {
      const mockEvent: ProgressEvent = {
        type: ProgressEventType.POSITION_ANALYSIS_COMPLETED,
        timestamp: Date.now(),
        snapshot: mockProgressReporter.getSnapshot(),
        data: {},
      };

      dashboard['handleProgressEvent'](mockEvent);

      expect(processStdoutSpy).toHaveBeenCalledWith(
        expect.stringContaining('25.0% | 25/100 | 5.2 pos/s | ETA:')
      );
    });

    it('should display exploration completion summary', () => {
      const mockEvent: ProgressEvent = {
        type: ProgressEventType.EXPLORATION_COMPLETED,
        timestamp: Date.now(),
        snapshot: mockProgressReporter.getSnapshot(),
        data: {},
      };

      dashboard['handleProgressEvent'](mockEvent);

      expect(consoleSpy.log).toHaveBeenCalledWith(
        '\n✅ PV Exploration Completed'
      );
      expect(consoleSpy.log).toHaveBeenCalledWith('   Analyzed: 25 positions');
      expect(consoleSpy.log).toHaveBeenCalledWith('   Failed: 2 positions');
      expect(consoleSpy.log).toHaveBeenCalledWith('   Total time: 5s');
      expect(consoleSpy.log).toHaveBeenCalledWith(
        '   Graph: 50 nodes, 75 edges'
      );
    });
  });

  describe('Milestone Handling', () => {
    beforeEach(() => {
      dashboard.start();
    });

    it('should display milestone achievements when enabled', () => {
      const mockMilestone: ProgressMilestone = {
        id: 'quarter',
        name: 'Quarter Complete',
        description: '25% analyzed',
        threshold: 0.25,
        achieved: true,
        achievedAt: Date.now(),
      };

      dashboard['handleMilestone'](mockMilestone);

      expect(consoleSpy.log).toHaveBeenCalledWith(
        '🎯 Milestone achieved: Quarter Complete (25.0%)'
      );
    });

    it('should not display milestones when disabled in config', () => {
      const configWithoutMilestones = { ...mockConfig, showMilestones: false };
      const dashboardWithoutMilestones = new ProgressDashboard(
        mockProgressReporter,
        configWithoutMilestones
      );
      dashboardWithoutMilestones.start();

      const mockMilestone: ProgressMilestone = {
        id: 'quarter',
        name: 'Quarter Complete',
        description: '25% analyzed',
        threshold: 0.25,
        achieved: true,
        achievedAt: Date.now(),
      };

      dashboardWithoutMilestones['handleMilestone'](mockMilestone);

      expect(consoleSpy.log).not.toHaveBeenCalledWith(
        expect.stringContaining('🎯 Milestone achieved')
      );
    });
  });

  describe('Error Handling', () => {
    it('should display error messages', () => {
      const testError = new Error('Test error message');
      const context = { position: 'test-position' };

      dashboard['handleError'](testError, context);

      expect(consoleSpy.error).toHaveBeenCalledWith(
        '❌ Error: Test error message'
      );
    });
  });

  describe('Progress Bar Creation', () => {
    it('should create progress bar with correct fill ratio', () => {
      const progressBar25 = dashboard['createProgressBar'](25, 10);
      const progressBar50 = dashboard['createProgressBar'](50, 10);
      const progressBar100 = dashboard['createProgressBar'](100, 10);

      expect(progressBar25).toBe('[██░░░░░░░░]'); // 2.5 filled, rounded to 2
      expect(progressBar50).toBe('[█████░░░░░]'); // 5 filled
      expect(progressBar100).toBe('[██████████]'); // 10 filled
    });

    it('should handle edge cases for progress bar', () => {
      const progressBar0 = dashboard['createProgressBar'](0, 5);
      const progressBar1 = dashboard['createProgressBar'](1, 5);

      expect(progressBar0).toBe('[░░░░░]');
      expect(progressBar1).toBe('[░░░░░]'); // 0.05 filled, rounded to 0
    });
  });

  describe('Time Formatting', () => {
    it('should format time correctly for different durations', () => {
      expect(dashboard['formatTime'](5000)).toBe('5s');
      expect(dashboard['formatTime'](65000)).toBe('1m 5s');
      expect(dashboard['formatTime'](3665000)).toBe('1h 1m 5s');
      expect(dashboard['formatTime'](7265000)).toBe('2h 1m 5s');
    });

    it('should handle zero and small values', () => {
      expect(dashboard['formatTime'](0)).toBe('0s');
      expect(dashboard['formatTime'](999)).toBe('0s');
      expect(dashboard['formatTime'](1000)).toBe('1s');
    });
  });

  describe('Detailed Report Generation', () => {
    it('should generate comprehensive progress report', () => {
      const report = dashboard.getDetailedReport();

      expect(report).toContain('=== PV Exploration Progress Report ===');
      expect(report).toContain('State: analyzing');
      expect(report).toContain('Progress: 25/100 (25.0%)');
      expect(report).toContain('Queue: 10 positions');
      expect(report).toContain('Failed: 2 positions');
      expect(report).toContain('Depth: 3/8');
      expect(report).toContain('Rate: 5.2 positions/second');
      expect(report).toContain('Elapsed: 5s');
      expect(report).toContain('ETA: 15s');
      expect(report).toContain('Graph: 50 nodes, 75 edges');
    });

    it('should include milestones in report when enabled', () => {
      const report = dashboard.getDetailedReport();

      expect(report).toContain('Milestones:');
      expect(report).toContain('✅ Quarter Complete (25.0%)');
      expect(report).toContain('⏳ Half Complete (50.0%)');
    });

    it('should exclude milestones from report when disabled', () => {
      const configWithoutMilestones = { ...mockConfig, showMilestones: false };
      const dashboardWithoutMilestones = new ProgressDashboard(
        mockProgressReporter,
        configWithoutMilestones
      );

      const report = dashboardWithoutMilestones.getDetailedReport();

      expect(report).not.toContain('Milestones:');
      expect(report).not.toContain('✅ Quarter Complete');
    });
  });

  describe('Integration with ProgressReporter', () => {
    it('should call progress reporter methods for data', () => {
      const getSnapshotSpy = vi.spyOn(mockProgressReporter, 'getSnapshot');
      const getMilestonesSpy = vi.spyOn(mockProgressReporter, 'getMilestones');

      dashboard.getDetailedReport();

      expect(getSnapshotSpy).toHaveBeenCalled();
      expect(getMilestonesSpy).toHaveBeenCalled();
    });

    it('should handle different progress reporter states', () => {
      // Mock different states
      vi.spyOn(mockProgressReporter, 'getSnapshot').mockReturnValue({
        timestamp: Date.now(),
        state: 'completed',
        metrics: {
          totalPositions: 50,
          analyzedPositions: 50,
          queuedPositions: 0,
          failedPositions: 0,
          currentDepth: 5,
          maxDepth: 5,
          elapsedTime: 10000,
          estimatedTimeRemaining: 0,
          analysisRate: 5.0,
          memoryUsage: 512,
          graphNodes: 25,
          graphEdges: 40,
        },
        currentPosition:
          'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        recentErrors: [],
      });

      const report = dashboard.getDetailedReport();

      expect(report).toContain('State: completed');
      expect(report).toContain('Progress: 50/50 (100.0%)');
      expect(report).toContain('ETA: 0s');
    });
  });
});
