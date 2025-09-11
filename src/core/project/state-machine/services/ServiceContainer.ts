import {
  IServiceContainer,
  IEngineService,
  IGraphService,
  IStorageService,
  IPersistenceService,
  IProgressService,
} from './types';

export class ServiceContainer implements IServiceContainer {
  private services = new Map<string, any>();

  // Required readonly properties from IServiceContainer interface
  get engine(): IEngineService {
    return this.get<IEngineService>('engine');
  }

  get graph(): IGraphService {
    return this.get<IGraphService>('graph');
  }

  get storage(): IStorageService {
    return this.get<IStorageService>('storage');
  }

  get persistence(): IPersistenceService {
    return this.get<IPersistenceService>('persistence');
  }

  get progress(): IProgressService {
    return this.get<IProgressService>('progress');
  }

  register<T>(name: string, service: T): void {
    this.services.set(name, service);
  }

  get<T>(name: string): T {
    const service = this.services.get(name);
    if (!service) {
      throw new Error(`Service '${name}' not found in container`);
    }
    return service as T;
  }

  has(name: string): boolean {
    return this.services.has(name);
  }

  remove(name: string): boolean {
    return this.services.delete(name);
  }

  clear(): void {
    this.services.clear();
  }

  getServiceNames(): string[] {
    return Array.from(this.services.keys());
  }

  // Convenience methods for common services
  getEngineService(): IEngineService {
    return this.get<IEngineService>('engine');
  }

  getGraphService(): IGraphService {
    return this.get<IGraphService>('graph');
  }

  getStorageService(): IStorageService {
    return this.get<IStorageService>('storage');
  }

  getPersistenceService(): IPersistenceService {
    return this.get<IPersistenceService>('persistence');
  }

  getProgressService(): IProgressService {
    return this.get<IProgressService>('progress');
  }
}
