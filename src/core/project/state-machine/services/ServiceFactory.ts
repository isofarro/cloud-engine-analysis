import { IServiceFactory, IServiceContainer, ServiceConfig } from './types';
import { ServiceContainer } from './ServiceContainer';
import { EngineService } from './EngineService';
import { GraphService } from './GraphService';
import { StorageService } from './StorageService';
import { PersistenceService } from './PersistenceService';
import { ProgressService } from './ProgressService';
import { AnalysisStoreService } from '../../../analysis-store/AnalysisStoreService';
import { AnalysisRepo } from '../../../analysis-store/AnalysisRepo';
import { StatePersistenceService } from '../../persistence/StatePersistenceService';
import sqlite3 from 'sqlite3';

export class ServiceFactory implements IServiceFactory {
  async createServices(config: ServiceConfig): Promise<IServiceContainer> {
    const container = new ServiceContainer();

    // Register engine service
    const engineService = await this.createEngineService(config.engine);
    container.register('engine', engineService);

    // Register graph service
    const graphService = await this.createGraphService(config.graph);
    container.register('graph', graphService);

    // Register storage service
    const storageService = await this.createStorageService(config.storage);
    container.register('storage', storageService);

    // Register persistence service
    const persistenceService = await this.createPersistenceService(
      config.persistence
    );
    container.register('persistence', persistenceService);

    // Register progress service
    const progressService = await this.createProgressService(config.progress);
    container.register('progress', progressService);

    return container;
  }

  async createEngineService(
    config?: ServiceConfig['engine']
  ): Promise<EngineService> {
    const engineService = new EngineService();

    // If an engine instance is provided, register it directly instead of creating a new one
    if (config?.options?.engine) {
      // Check if it's already a LocalChessEngine instance
      if (config.options.engine.constructor.name === 'LocalChessEngine') {
        // Ensure the engine is connected before registering
        if (config.options.engine.getStatus() === 'disconnected') {
          await config.options.engine.connect();
        }
        // Register the existing engine instance using the proper public method
        engineService.registerExistingEngine(config.options.engine, 'default');
      } else {
        // It's a config object, create new engine
        await engineService.initializeEngine(config.options.engine, 'default');
      }
    }

    return engineService;
  }

  async createGraphService(
    config?: ServiceConfig['graph']
  ): Promise<GraphService> {
    return new GraphService();
  }

  async createStorageService(
    config?: ServiceConfig['storage']
  ): Promise<StorageService> {
    // Create sqlite3 Database instance
    const dbPath = config?.options?.dbPath || ':memory:';
    const db = new sqlite3.Database(dbPath);

    // Create AnalysisRepo with the Database instance
    const repo = new AnalysisRepo(db);
    await repo.initializeSchema();

    // Create AnalysisStoreService with the repo
    const store = new AnalysisStoreService(repo);
    return new StorageService(store);
  }

  async createPersistenceService(
    config?: ServiceConfig['persistence']
  ): Promise<PersistenceService> {
    const persistenceConfig = {
      stateDirectory: config?.options?.stateDirectory || './tmp/state',
      autoSaveIntervalMs: config?.options?.autoSaveIntervalMs || 30000,
      maxSnapshots: config?.options?.maxSnapshots || 10,
      compress: config?.options?.compress || false,
    };

    // Ensure the stateDirectory is always a valid string
    if (
      !persistenceConfig.stateDirectory ||
      typeof persistenceConfig.stateDirectory !== 'string'
    ) {
      persistenceConfig.stateDirectory = './tmp/state';
    }

    const service = new StatePersistenceService(persistenceConfig);
    return new PersistenceService(service);
  }

  async createProgressService(
    config?: ServiceConfig['progress']
  ): Promise<ProgressService> {
    return new ProgressService();
  }
}
