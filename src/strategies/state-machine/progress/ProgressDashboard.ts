import { ProgressReporter } from './ProgressReporter';
import {
  ProgressEvent,
  ProgressSnapshot,
  ProgressMilestone,
} from './ProgressTypes';

export interface DashboardConfig {
  refreshInterval: number;
  showDetailedMetrics: boolean;
  showMilestones: boolean;
  showHistory: boolean;
}

export class ProgressDashboard {
  private progressReporter: ProgressReporter;
  private config: DashboardConfig;
  private isActive: boolean = false;

  constructor(progressReporter: ProgressReporter, config: DashboardConfig) {
    this.progressReporter = progressReporter;
    this.config = config;
    this.setupListeners();
  }

  private setupListeners(): void {
    this.progressReporter.addProgressListener({
      onProgress: (event: ProgressEvent) => this.handleProgressEvent(event),
      onMilestone: (milestone: ProgressMilestone) =>
        this.handleMilestone(milestone),
      onError: (error: Error, context: any) => this.handleError(error, context),
    });
  }

  private handleProgressEvent(event: ProgressEvent): void {
    if (!this.isActive) return;

    switch (event.type) {
      case 'exploration_started':
        this.displayExplorationStart(event.snapshot);
        break;
      case 'position_analysis_completed':
        this.updateProgress(event.snapshot);
        break;
      case 'exploration_completed':
        this.displayExplorationComplete(event.snapshot);
        break;
    }
  }

  private handleMilestone(milestone: ProgressMilestone): void {
    if (this.config.showMilestones) {
      console.log(
        `🎯 Milestone achieved: ${milestone.name} (${(milestone.threshold * 100).toFixed(1)}%)`
      );
    }
  }

  private handleError(error: Error, context: any): void {
    console.error(`❌ Error: ${error.message}`);
  }

  private displayExplorationStart(snapshot: ProgressSnapshot): void {
    console.log('🚀 PV Exploration Started');
    console.log(
      `   Total positions to analyze: ${snapshot.metrics.totalPositions}`
    );
    console.log(`   Max depth: ${snapshot.metrics.maxDepth}`);
  }

  private updateProgress(snapshot: ProgressSnapshot): void {
    const { metrics } = snapshot;
    const progress = (metrics.analyzedPositions / metrics.totalPositions) * 100;

    const progressBar = this.createProgressBar(progress);
    const eta = this.formatTime(metrics.estimatedTimeRemaining);
    const rate = metrics.analysisRate.toFixed(1);

    process.stdout.write(
      `\r${progressBar} ${progress.toFixed(1)}% | ${metrics.analyzedPositions}/${metrics.totalPositions} | ${rate} pos/s | ETA: ${eta}`
    );
  }

  private displayExplorationComplete(snapshot: ProgressSnapshot): void {
    console.log('\n✅ PV Exploration Completed');
    console.log(`   Analyzed: ${snapshot.metrics.analyzedPositions} positions`);
    console.log(`   Failed: ${snapshot.metrics.failedPositions} positions`);
    console.log(
      `   Total time: ${this.formatTime(snapshot.metrics.elapsedTime)}`
    );
    console.log(
      `   Graph: ${snapshot.metrics.graphNodes} nodes, ${snapshot.metrics.graphEdges} edges`
    );
  }

  private createProgressBar(progress: number, width: number = 30): string {
    const filled = Math.floor((progress / 100) * width);
    const empty = width - filled;
    return `[${'█'.repeat(filled)}${'░'.repeat(empty)}]`;
  }

  private formatTime(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  public start(): void {
    this.isActive = true;
    console.log('📊 Progress Dashboard Started');
  }

  public stop(): void {
    this.isActive = false;
    console.log('\n📊 Progress Dashboard Stopped');
  }

  public getDetailedReport(): string {
    const snapshot = this.progressReporter.getSnapshot();
    const milestones = this.progressReporter.getMilestones();

    let report = '\n=== PV Exploration Progress Report ===\n';
    report += `State: ${snapshot.state}\n`;
    report += `Progress: ${snapshot.metrics.analyzedPositions}/${snapshot.metrics.totalPositions} (${((snapshot.metrics.analyzedPositions / snapshot.metrics.totalPositions) * 100).toFixed(1)}%)\n`;
    report += `Queue: ${snapshot.metrics.queuedPositions} positions\n`;
    report += `Failed: ${snapshot.metrics.failedPositions} positions\n`;
    report += `Depth: ${snapshot.metrics.currentDepth}/${snapshot.metrics.maxDepth}\n`;
    report += `Rate: ${snapshot.metrics.analysisRate.toFixed(1)} positions/second\n`;
    report += `Elapsed: ${this.formatTime(snapshot.metrics.elapsedTime)}\n`;
    report += `ETA: ${this.formatTime(snapshot.metrics.estimatedTimeRemaining)}\n`;
    report += `Graph: ${snapshot.metrics.graphNodes} nodes, ${snapshot.metrics.graphEdges} edges\n`;

    if (this.config.showMilestones) {
      report += '\nMilestones:\n';
      milestones.forEach(milestone => {
        const status = milestone.achieved ? '✅' : '⏳';
        report += `  ${status} ${milestone.name} (${(milestone.threshold * 100).toFixed(1)}%)\n`;
      });
    }

    return report;
  }
}
