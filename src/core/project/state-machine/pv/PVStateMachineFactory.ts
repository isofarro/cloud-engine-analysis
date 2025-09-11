import { StateMachineEngine, SimpleEventBus } from '../index';
import {
  PVExplorationContext,
  PV_STATES,
  PVState,
  PV_TRANSITIONS,
} from './PVStateMachine';
import { IServiceContainer } from '../services';
import { EventBus } from '../types';

export class PVStateMachineFactory {
  static create(
    context: PVExplorationContext,
    eventBus: EventBus
  ): StateMachineEngine<any, any, PVExplorationContext> {
    return new StateMachineEngine(
      {
        id: 'pv-exploration',
        initialState: PVState.IDLE,
        states: Object.values(PV_STATES),
        transitions: PV_TRANSITIONS,
        context,
      },
      eventBus
    );
  }

  static createWithServices(
    config: {
      rootFen: string;
      maxDepth: number;
      maxNodes: number;
      timePerPosition: number;
      engineConfig: any;
      maxRetries?: number;
    },
    services: IServiceContainer
  ): {
    stateMachine: StateMachineEngine<any, any, PVExplorationContext>;
    eventBus: EventBus;
    context: PVExplorationContext;
  } {
    const context: PVExplorationContext = {
      rootFen: config.rootFen,
      maxDepth: config.maxDepth,
      maxNodes: config.maxNodes,
      timePerPosition: config.timePerPosition,
      engineConfig: config.engineConfig,
      explorationQueue: [],
      processedPositions: new Set(),
      totalPositions: 0,
      analyzedPositions: 0,
      startTime: 0,
      graphNodeCount: 0,
      retryCount: 0,
      maxRetries: config.maxRetries || 3,
      services,
    };

    const eventBus = new SimpleEventBus();
    const stateMachine = PVStateMachineFactory.create(context, eventBus);

    return { stateMachine, eventBus, context };
  }
}
