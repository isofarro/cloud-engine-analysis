# PV Exploration State Machine Documentation
## Overview
The PV (Principal Variation) Exploration State Machine is a sophisticated chess analysis system that systematically explores and analyzes chess positions using engine analysis. It builds a graph of positions and their relationships while managing resources and providing resilient error handling.

## Architecture Components
### Core Files
- StateMachineEngine.ts : Base state machine implementation
- ResilientStateMachineEngine.ts : Error handling and recovery wrapper
- PVStateMachineIntegration.ts : Main state machine configuration
- PVStateMachineFactory.ts : Factory for creating state machine instances
### State Definitions 1. IDLE State
Purpose : Initial waiting state before exploration begins

What it does :

- Waits for exploration initialization
- Validates initial context and configuration
- Ensures all required services are available
Services needed :

- None (validation only)
Transitions :

- Incoming : Initial state, ERROR → IDLE (after recovery)
- Outgoing : IDLE → INITIALIZING (on START_EXPLORATION event) 2. INITIALIZING State
Purpose : Sets up exploration context and validates configuration

What it does :

- Initializes exploration queue with root position
- Sets up tracking data structures (processedPositions, stats)
- Validates engine configuration and service availability
- Prepares context for analysis
Services needed :

- IEngineService : Validates engine readiness
- IProgressService : Reports initialization progress
Transitions :

- Incoming : IDLE → INITIALIZING
- Outgoing : INITIALIZING → ANALYZING_ROOT (on INITIALIZATION_COMPLETE) 3. ANALYZING_ROOT State
Purpose : Performs deep analysis of the starting position

What it does :

- Analyzes root position with configured depth/time
- Extracts principal variation for exploration
- Determines actual exploration depth based on PV length
- Populates initial exploration queue with PV positions
Services needed :

- IEngineService : Performs position analysis via analyzePosition()
- IProgressService : Reports analysis progress
- IGraphService : Begins graph construction
Transitions :

- Incoming : INITIALIZING → ANALYZING_ROOT
- Outgoing : ANALYZING_ROOT → EXPLORING_POSITIONS (on ROOT_ANALYSIS_COMPLETE) 4. EXPLORING_POSITIONS State
Purpose : Systematically analyzes positions from the exploration queue

What it does :

- Processes positions from exploration queue in order
- Analyzes each position with engine
- Extracts new positions from analysis results
- Adds analyzed positions to graph structure
- Manages depth and node limits
Services needed :

- IEngineService : Analyzes each queued position
- IGraphService : Adds moves and positions to graph via addMove()
- IProgressService : Reports exploration progress
- IStorageService : Optionally caches analysis results
Transitions :

- Incoming : ANALYZING_ROOT → EXPLORING_POSITIONS, EXPLORING_POSITIONS → EXPLORING_POSITIONS (loop)
- Outgoing : EXPLORING_POSITIONS → BUILDING_GRAPH (on EXPLORATION_COMPLETE) 5. BUILDING_GRAPH State
Purpose : Constructs final graph structure from analyzed positions

What it does :

- Consolidates all analyzed positions into coherent graph
- Establishes parent-child relationships between positions
- Calculates graph statistics and metadata
- Optimizes graph structure for querying
Services needed :

- IGraphService : Finalizes graph structure, calculates paths via getPrimaryVariation()
- IProgressService : Reports graph building progress
Transitions :

- Incoming : EXPLORING_POSITIONS → BUILDING_GRAPH
- Outgoing : BUILDING_GRAPH → STORING_RESULTS (on GRAPH_UPDATE_COMPLETE) 6. STORING_RESULTS State
Purpose : Persists analysis results and graph data

What it does :

- Saves analysis results to storage
- Persists graph structure for future use
- Stores exploration metadata and statistics
- Creates recovery checkpoints
Services needed :

- IStorageService : Stores analysis results via storeAnalysis()
- IPersistenceService : Saves state for recovery via saveState()
- IGraphService : Persists graph data via save()
Transitions :

- Incoming : BUILDING_GRAPH → STORING_RESULTS
- Outgoing : STORING_RESULTS → COMPLETED (on STORAGE_COMPLETE) 7. COMPLETED State
Purpose : Final state indicating successful exploration completion

What it does :

- Reports final statistics and results
- Triggers completion hooks and callbacks
- Cleans up resources
- Provides access to final graph and analysis data
Services needed :

- IProgressService : Reports completion status
Transitions :

- Incoming : STORING_RESULTS → COMPLETED
- Outgoing : Terminal state (can transition to IDLE for new exploration) 8. ERROR State
Purpose : Handles errors and manages recovery strategies

What it does :

- Captures and logs error information
- Determines appropriate recovery strategy
- Manages retry attempts with exponential backoff
- Saves error state for debugging
Services needed :

- IPersistenceService : Saves error state for recovery
- IProgressService : Reports error status
- All services (for recovery validation)
Transitions :

- Incoming : Any state → ERROR (on ERROR_OCCURRED)
- Outgoing : ERROR → IDLE (after recovery), ERROR → previous state (on retry)
## Service Dependencies
### IEngineService
Used by : ANALYZING_ROOT, EXPLORING_POSITIONS

- analyzePosition() : Core analysis functionality
- isReady() : Engine availability checks
- getEngineInfo() : Engine metadata
### IGraphService
Used by : ANALYZING_ROOT, EXPLORING_POSITIONS, BUILDING_GRAPH, STORING_RESULTS

- addMove() : Adds positions and moves to graph
- getPrimaryVariation() : Extracts main lines
- save() : Persists graph structure
- getStats() : Graph statistics
### IStorageService
Used by : EXPLORING_POSITIONS, STORING_RESULTS

- storeAnalysis() : Caches analysis results
- getAnalysis() : Retrieves cached results
- hasAnalysis() : Checks for existing analysis
### IPersistenceService
Used by : STORING_RESULTS, ERROR

- saveState() : Creates recovery checkpoints
- loadState() : Restores from checkpoints
- findResumableStates() : Finds recovery points
### IProgressService
Used by : All states

- reportProgress() : Progress updates
- log() : Logging and debugging
- startSession() / endSession() : Session management
## State Flow Diagram

```
┌─────────┐    START_EXPLORATION     ┌──────────────┐
│  IDLE   │ ────────────────────────▶│ INITIALIZING │
└─────────┘                          └──────────────┘
     ▲                                        │
     │                                        │ INITIALIZATION_COMPLETE
     │                                        ▼
     │                               ┌─────────────────┐
     │                               │ ANALYZING_ROOT  │
     │                               └─────────────────┘
     │                                        │
     │                                        │ ROOT_ANALYSIS_COMPLETE
     │                                        ▼
     │                               ┌─────────────────────┐
     │                               │ EXPLORING_POSITIONS │◀─┐
     │                               └─────────────────────┘  │
     │                                        │               │
     │                                        │ EXPLORATION_COMPLETE
     │                                        ▼               │
     │                               ┌─────────────────┐      │
     │                               │ BUILDING_GRAPH  │      │
     │                               └─────────────────┘      │
     │                                        │               │
     │                                        │ GRAPH_UPDATE_COMPLETE
     │                                        ▼               │
     │                               ┌─────────────────┐      │
     │                               │ STORING_RESULTS │      │
     │                               └─────────────────┘      │
     │                                        │               │
     │                                        │ STORAGE_COMPLETE
     │                                        ▼               │
     │                               ┌─────────────────┐      │
     │                               │   COMPLETED     │      │
     │                               └─────────────────┘      │
     │                                                        │
     │                               ┌─────────────────┐      │
     └───────────────────────────────│     ERROR       │      │
                                     └─────────────────┘      │
                                              │               │
                                              │ CONTINUE_EXPLORATION
                                              └───────────────┘
```




## Error Handling and Recovery
The state machine includes sophisticated error handling through the ResilientStateMachineEngine :

### Recovery Strategies
1. 1.
   Engine Recovery : Restarts engine on analysis failures
2. 2.
   Network Recovery : Handles connection issues for remote engines
3. 3.
   Storage Recovery : Manages storage failures and retries
4. 4.
   State Recovery : Restores from checkpoints on critical failures
### Circuit Breaker Pattern
- Prevents cascading failures
- Automatically opens on repeated failures
- Half-open state for testing recovery
- Configurable thresholds and timeouts
### Checkpointing
- Automatic state persistence every 30 seconds
- Recovery from last known good state
- Supports resuming long-running explorations
## Configuration
The state machine is highly configurable through:

- Engine settings : Depth, time limits, multi-PV
- Exploration limits : Max nodes, max depth
- Error handling : Retry counts, timeouts
- Service configuration : Storage types, persistence options
This architecture provides a robust, scalable system for chess position analysis with comprehensive error handling and recovery capabilities.