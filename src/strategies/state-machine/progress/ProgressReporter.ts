import { EventEmitter } from 'events';
import {
  ProgressEvent,
  ProgressEventType,
  ProgressMetrics,
  ProgressSnapshot,
  ProgressListener,
  ProgressMilestone,
  ProgressConfiguration,
} from './ProgressTypes';

export class ProgressReporter extends EventEmitter {
  private metrics: ProgressMetrics;
  private history: ProgressSnapshot[];
  private progressListeners: Set<ProgressListener>;
  private milestones: Map<string, ProgressMilestone>;
  private config: ProgressConfiguration;
  private startTime: number;
  private lastUpdateTime: number;
  private updateTimer?: NodeJS.Timeout;

  constructor(config: ProgressConfiguration) {
    super();
    this.config = config;
    this.progressListeners = new Set();
    this.milestones = new Map();
    this.history = [];
    this.startTime = Date.now();
    this.lastUpdateTime = this.startTime;

    this.metrics = {
      totalPositions: 0,
      analyzedPositions: 0,
      queuedPositions: 0,
      failedPositions: 0,
      currentDepth: 0,
      maxDepth: 0,
      elapsedTime: 0,
      estimatedTimeRemaining: 0,
      analysisRate: 0,
      memoryUsage: 0,
      graphNodes: 0,
      graphEdges: 0,
    };

    this.initializeMilestones();
    this.startPeriodicUpdates();
  }

  private initializeMilestones(): void {
    this.config.milestones.forEach(milestone => {
      this.milestones.set(milestone.id, { ...milestone });
    });
  }

  private startPeriodicUpdates(): void {
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
    }

    this.updateTimer = setInterval(() => {
      this.updateMetrics();
      this.emitProgressUpdate();
    }, this.config.updateInterval);
  }

  private updateMetrics(): void {
    const now = Date.now();
    this.metrics.elapsedTime = now - this.startTime;

    if (this.config.enablePerformanceTracking) {
      const timeDelta = now - this.lastUpdateTime;
      if (timeDelta > 0) {
        this.metrics.analysisRate = this.calculateAnalysisRate(timeDelta);
        this.metrics.estimatedTimeRemaining = this.calculateETA();
      }
    }

    this.lastUpdateTime = now;
    this.checkMilestones();
  }

  private calculateAnalysisRate(timeDelta: number): number {
    const recentSnapshots = this.history.slice(-5);
    if (recentSnapshots.length < 2) return 0;

    const oldest = recentSnapshots[0];
    const newest = recentSnapshots[recentSnapshots.length - 1];

    const positionsDelta =
      newest.metrics.analyzedPositions - oldest.metrics.analyzedPositions;
    const timeDeltaSeconds = (newest.timestamp - oldest.timestamp) / 1000;

    return timeDeltaSeconds > 0 ? positionsDelta / timeDeltaSeconds : 0;
  }

  private calculateETA(): number {
    const remaining =
      this.metrics.totalPositions - this.metrics.analyzedPositions;
    return this.metrics.analysisRate > 0
      ? (remaining / this.metrics.analysisRate) * 1000
      : 0;
  }

  private checkMilestones(): void {
    this.milestones.forEach(milestone => {
      if (!milestone.achieved) {
        const progress =
          this.metrics.analyzedPositions / this.metrics.totalPositions;
        if (progress >= milestone.threshold) {
          milestone.achieved = true;
          milestone.achievedAt = Date.now();
          this.emitMilestone(milestone);
        }
      }
    });
  }

  public addProgressListener(listener: ProgressListener): void {
    this.progressListeners.add(listener);
  }

  public removeProgressListener(listener: ProgressListener): void {
    this.progressListeners.delete(listener);
  }

  public updateMetric(key: keyof ProgressMetrics, value: number): void {
    this.metrics[key] = value;
  }

  public incrementMetric(key: keyof ProgressMetrics, delta: number = 1): void {
    this.metrics[key] += delta;
  }

  public emitEvent(type: ProgressEventType, data: any = {}): void {
    const snapshot = this.createSnapshot();
    const event: ProgressEvent = {
      type,
      timestamp: Date.now(),
      data,
      snapshot,
    };

    this.addToHistory(snapshot);
    this.notifyListeners(event);
    this.emit('progress', event);
  }

  private emitProgressUpdate(): void {
    this.emitEvent(ProgressEventType.PERFORMANCE_UPDATE, {
      rate: this.metrics.analysisRate,
      eta: this.metrics.estimatedTimeRemaining,
    });
  }

  private emitMilestone(milestone: ProgressMilestone): void {
    this.progressListeners.forEach(listener => {
      if (listener.onMilestone) {
        listener.onMilestone(milestone);
      }
    });

    this.emit('milestone', milestone);
  }

  private createSnapshot(): ProgressSnapshot {
    return {
      timestamp: Date.now(),
      state: 'current', // Will be set by state machine
      metrics: { ...this.metrics },
      recentErrors: [], // Will be populated by error handler
    };
  }

  private addToHistory(snapshot: ProgressSnapshot): void {
    this.history.push(snapshot);
    if (this.history.length > this.config.maxHistorySize) {
      this.history.shift();
    }
  }

  private notifyListeners(event: ProgressEvent): void {
    this.progressListeners.forEach(listener => {
      try {
        listener.onProgress(event);
      } catch (error) {
        console.error('Error in progress listener:', error);
      }
    });
  }

  public getSnapshot(): ProgressSnapshot {
    return this.createSnapshot();
  }

  public getHistory(): ProgressSnapshot[] {
    return [...this.history];
  }

  public getMilestones(): ProgressMilestone[] {
    return Array.from(this.milestones.values());
  }

  public reset(): void {
    this.startTime = Date.now();
    this.lastUpdateTime = this.startTime;
    this.history = [];

    this.metrics = {
      totalPositions: 0,
      analyzedPositions: 0,
      queuedPositions: 0,
      failedPositions: 0,
      currentDepth: 0,
      maxDepth: 0,
      elapsedTime: 0,
      estimatedTimeRemaining: 0,
      analysisRate: 0,
      memoryUsage: 0,
      graphNodes: 0,
      graphEdges: 0,
    };

    this.milestones.forEach(milestone => {
      milestone.achieved = false;
      milestone.achievedAt = undefined;
    });
  }

  public destroy(): void {
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
    }
    this.progressListeners.clear();
    this.removeAllListeners();
  }
}
