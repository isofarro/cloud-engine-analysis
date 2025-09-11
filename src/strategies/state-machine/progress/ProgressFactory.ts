import { ProgressReporter } from './ProgressReporter';
import { ProgressDashboard } from './ProgressDashboard';
import { StateMachineProgressIntegration } from './StateMachineProgressIntegration';
import { ProgressConfiguration, ProgressMilestone } from './ProgressTypes';
import { StateMachineEngine } from '../../../core/project/state-machine/StateMachineEngine';
import {
  PVExplorationState,
  PVExplorationEvent,
} from '../../../core/project/state-machine/pv-exploration/types';
import { SimpleEventBus } from '../../../core/project/state-machine/EventBus';

export class ProgressFactory {
  public static createDefaultConfiguration(): ProgressConfiguration {
    return {
      updateInterval: 1000, // 1 second
      enableDetailedMetrics: true,
      enablePerformanceTracking: true,
      maxHistorySize: 100,
      milestones: [
        {
          id: 'quarter',
          name: 'Quarter Complete',
          description: '25% of positions analyzed',
          threshold: 0.25,
          achieved: false,
        },
        {
          id: 'half',
          name: 'Half Complete',
          description: '50% of positions analyzed',
          threshold: 0.5,
          achieved: false,
        },
        {
          id: 'three_quarters',
          name: 'Three Quarters Complete',
          description: '75% of positions analyzed',
          threshold: 0.75,
          achieved: false,
        },
        {
          id: 'nearly_complete',
          name: 'Nearly Complete',
          description: '90% of positions analyzed',
          threshold: 0.9,
          achieved: false,
        },
      ],
    };
  }

  public static createProgressSystem(
    stateMachine: StateMachineEngine<any, any, any>,
    config?: Partial<ProgressConfiguration>
  ) {
    const fullConfig = {
      ...this.createDefaultConfiguration(),
      ...config,
    };

    const reporter = new ProgressReporter(fullConfig);
    const eventBus = new SimpleEventBus();
    const integration = new StateMachineProgressIntegration(
      stateMachine,
      reporter,
      eventBus
    );
    const dashboard = new ProgressDashboard(reporter, {
      refreshInterval: fullConfig.updateInterval,
      showDetailedMetrics: fullConfig.enableDetailedMetrics,
      showMilestones: true,
      showHistory: false,
    });

    return {
      reporter,
      integration,
      dashboard,
      config: fullConfig,
    };
  }
}
