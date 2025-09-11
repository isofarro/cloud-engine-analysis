import { StateMachineEngine } from '../../../core/project/state-machine/StateMachineEngine';
import { ProgressReporter } from './ProgressReporter';
import { ProgressEventType } from './ProgressTypes';
import {
  PVExplorationState,
  PVExplorationEvent,
} from '../../../core/project/state-machine/pv-exploration/types';
import { SimpleEventBus } from '../../../core/project/state-machine/EventBus';

export class StateMachineProgressIntegration {
  private stateMachine: StateMachineEngine<any, any, any>;
  private progressReporter: ProgressReporter;
  private eventBus: SimpleEventBus;

  constructor(
    stateMachine: StateMachineEngine<any, any, any>,
    progressReporter: ProgressReporter,
    eventBus: SimpleEventBus
  ) {
    this.stateMachine = stateMachine;
    this.progressReporter = progressReporter;
    this.eventBus = eventBus;
    this.setupIntegration();
  }

  private setupIntegration(): void {
    // Listen to state changes via event bus
    this.eventBus.subscribe('stateChanged', (event: any) => {
      this.handleStateChange(
        event.payload.from,
        event.payload.to,
        event.payload.event
      );
    });

    // Listen to events via event bus
    this.eventBus.subscribe('eventProcessed', (event: any) => {
      this.handleEventProcessed(event.payload.event, event.payload.state);
    });

    // Listen to errors via event bus
    this.eventBus.subscribe('error', (event: any) => {
      this.handleError(event.payload.error, event.payload.context);
    });
  }

  private handleStateChange(
    from: PVExplorationState,
    to: PVExplorationState,
    event: PVExplorationEvent
  ): void {
    switch (to) {
      case PVExplorationState.INITIALIZING:
        this.progressReporter.emitEvent(ProgressEventType.EXPLORATION_STARTED);
        break;

      case PVExplorationState.ANALYZING_ROOT:
        this.progressReporter.emitEvent(
          ProgressEventType.ROOT_ANALYSIS_STARTED
        );
        break;

      case PVExplorationState.PROCESSING_QUEUE:
        this.progressReporter.emitEvent(ProgressEventType.QUEUE_UPDATED, {
          queueSize:
            this.progressReporter.getSnapshot().metrics.queuedPositions,
        });
        break;

      case PVExplorationState.COMPLETED:
        this.progressReporter.emitEvent(
          ProgressEventType.EXPLORATION_COMPLETED
        );
        break;

      case PVExplorationState.PAUSED:
        this.progressReporter.emitEvent(ProgressEventType.EXPLORATION_PAUSED);
        break;

      case PVExplorationState.ERROR:
        this.progressReporter.emitEvent(ProgressEventType.ERROR_OCCURRED);
        break;
    }
  }

  private handleEventProcessed(
    event: PVExplorationEvent,
    state: PVExplorationState
  ): void {
    switch (event) {
      case PVExplorationEvent.ROOT_ANALYSIS_COMPLETE:
        this.progressReporter.emitEvent(
          ProgressEventType.ROOT_ANALYSIS_COMPLETED
        );
        break;

      case PVExplorationEvent.POSITION_ANALYSIS_COMPLETE:
        this.progressReporter.incrementMetric('analyzedPositions');
        this.progressReporter.emitEvent(
          ProgressEventType.POSITION_ANALYSIS_COMPLETED
        );
        break;

      case PVExplorationEvent.ERROR_OCCURRED:
        this.progressReporter.incrementMetric('failedPositions');
        this.progressReporter.emitEvent(
          ProgressEventType.POSITION_ANALYSIS_FAILED
        );
        break;

      case PVExplorationEvent.GRAPH_UPDATE_COMPLETE:
        this.progressReporter.emitEvent(ProgressEventType.GRAPH_UPDATED);
        break;
    }
  }

  private handleError(error: Error, context: any): void {
    this.progressReporter.emitEvent(ProgressEventType.ERROR_OCCURRED, {
      error: error.message,
      context,
    });
  }
}
