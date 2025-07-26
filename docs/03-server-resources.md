# Server Resource Management

The Server Resource Management layer provides intelligent allocation and monitoring of computational resources across multiple servers for optimal chess engine performance.

## Overview

This system manages:
- **Multi-server coordination** for distributed analysis
- **Resource utilization monitoring** with 50% target utilization
- **Intelligent load balancing** based on real-time metrics
- **Health monitoring and recovery** for robust operation
- **Dynamic server configuration** for scalable deployments

## Key Components

### ServerPool
Manages the pool of available servers and handles server selection logic.

```typescript
interface ServerPool {
    addServer(config: ServerConfig): Promise<void>;
    removeServer(serverId: string): Promise<void>;
    getOptimalServer(requirements: ResourceRequirements): Promise<ServerResource>;
    getServerHealth(): ServerHealthStatus[];
    shutdown(): Promise<void>;
}
```

### ServerResource
Tracks individual server resource utilization and capabilities.

```typescript
interface ServerResource {
    id: string;
    host: string;
    capabilities: ServerCapabilities;
    currentUtilization: ResourceUtilization;
    healthStatus: HealthStatus;
    lastHealthCheck: Date;
}
```

### ResourceManager
Enforces resource allocation policies and utilization constraints.

```typescript
interface ResourceManager {
    allocateResources(requirements: ResourceRequirements): Promise<ResourceAllocation>;
    releaseResources(allocation: ResourceAllocation): Promise<void>;
    getUtilizationMetrics(): UtilizationMetrics;
    enforceRestPeriods(): Promise<void>;
}
```

## Resource Monitoring & Tracking

### CPU Utilization Monitoring
- **Real-time tracking** of CPU usage per server
- **Target 50% average utilization** with configurable thresholds
- **Historical data collection** for trend analysis
- **Load spike detection** and automatic load balancing

### Memory Usage Tracking
- **RAM allocation monitoring** for engine processes
- **Hash table memory tracking** per engine instance
- **Memory leak detection** and automatic cleanup
- **Available memory calculation** for new allocations

### Performance Metrics
```typescript
interface ResourceUtilization {
    cpuUsage: number;           // Current CPU percentage (0-100)
    memoryUsage: number;        // Current RAM usage in MB
    availableCores: number;     // Free CPU cores
    availableMemory: number;    // Free RAM in MB
    engineCount: number;        // Active engine instances
    lastUpdated: Date;
}
```

## Server Configuration Management

### Multi-Server Configuration
```json
{
  "servers": [
    {
      "id": "chess-server-1",
      "host": "chess-server-1.example.com",
      "port": 22,
      "username": "chess",
      "keyPath": "/path/to/ssh/key",
      "capabilities": {
        "totalCPU": 16,
        "totalRAM": 32768,
        "engines": ["stockfish", "komodo", "leela"]
      },
      "limits": {
        "maxUtilization": 0.5,
        "maxEngines": 8,
        "restPeriodMinutes": 10
      }
    }
  ],
  "globalSettings": {
    "healthCheckInterval": 30000,
    "utilizationWindow": 300000,
    "autoRebalance": true
  }
}
```

### Dynamic Configuration
- **Hot-reload capability** for server configuration changes
- **Runtime server addition/removal** without service restart
- **Configuration validation** with schema enforcement
- **Backup configuration** for disaster recovery

## Intelligent Load Balancing

### Resource-Aware Allocation
The system selects optimal servers based on:
- **Current resource utilization** vs. target thresholds
- **Engine-specific requirements** (CPU cores, memory)
- **Server capabilities** and available engines
- **Network latency** and connection health

### Engine Affinity Considerations
```typescript
interface ResourceRequirements {
    engineType: string;         // Required engine (stockfish, komodo, etc.)
    cpuCores: number;          // Minimum CPU cores needed
    memoryMB: number;          // Minimum RAM required
    analysisType: 'quick' | 'deep' | 'tournament';
    priority: 'low' | 'normal' | 'high';
}
```

### Failover Logic
- **Automatic server failover** when servers become unavailable
- **Graceful task migration** to healthy servers
- **Connection retry logic** with exponential backoff
- **Partial failure handling** without complete service disruption

## Health Monitoring & Recovery

### Server Health Checks
```typescript
interface HealthCheck {
    connectivity: boolean;      // SSH connection status
    responseTime: number;       // Connection latency (ms)
    cpuHealth: boolean;         // CPU not overloaded
    memoryHealth: boolean;      // Sufficient available memory
    engineHealth: boolean;      // All engines responding
    lastCheck: Date;
}
```

### Automatic Recovery
- **Failed engine restart** with configurable retry limits
- **Server reconnection** with connection pooling
- **Resource cleanup** for orphaned processes
- **Health status reporting** for monitoring systems

### Monitoring Integration
- **Metrics export** for Prometheus/Grafana
- **Alert generation** for critical resource conditions
- **Performance dashboards** for operational visibility
- **Log aggregation** for troubleshooting

## Resource Optimization

### Rest Period Enforcement
- **Mandatory rest periods** to prevent server overload
- **Configurable rest duration** based on utilization history
- **Intelligent scheduling** to minimize impact on analysis throughput
- **Load redistribution** during rest periods

### Engine Instance Management
- **Engine process reuse** for hash table benefits
- **Intelligent engine placement** based on analysis patterns
- **Resource reservation** for high-priority tasks
- **Cleanup scheduling** for idle engines

### Connection Optimization
- **SSH connection pooling** with configurable limits
- **Keep-alive management** for persistent connections
- **Connection multiplexing** for efficient resource usage
- **Bandwidth monitoring** and optimization

## Integration with EngineService

### Enhanced Engine Allocation
The EngineService will be enhanced to support resource-aware allocation:

```typescript
// Current implementation
await engineService.getEngine('stockfish-local');

// Future resource-aware implementation
await engineService.getEngine({
    engineType: 'stockfish',
    requirements: {
        cpuCores: 4,
        memoryMB: 2048,
        analysisType: 'deep'
    }
});
```

### Resource Allocation Flow
1. **Analyze requirements** from analysis configuration
2. **Query ResourceManager** for optimal server selection
3. **Allocate resources** on selected server
4. **Create/reuse engine instance** with allocated resources
5. **Monitor utilization** during analysis
6. **Release resources** after analysis completion

## Performance Considerations

### Monitoring Overhead
- **Lightweight metrics collection** with minimal CPU impact
- **Batched metric updates** to reduce network overhead
- **Configurable monitoring intervals** based on system load
- **Efficient data structures** for real-time queries

### Scalability Design
- **Horizontal scaling** support for adding servers
- **Distributed state management** for multi-instance deployments
- **Event-driven architecture** for responsive resource allocation
- **Caching strategies** for frequently accessed data

## Security Considerations

### SSH Key Management
- **Secure key storage** with proper file permissions
- **Key rotation support** for enhanced security
- **Connection encryption** for all server communications
- **Access logging** for security auditing

### Resource Isolation
- **Process isolation** between different analysis tasks
- **Resource quotas** to prevent resource exhaustion
- **User-based resource allocation** for multi-tenant scenarios
- **Audit trails** for resource usage tracking

This resource management layer provides the foundation for building a scalable, reliable, and efficient distributed chess analysis system.

