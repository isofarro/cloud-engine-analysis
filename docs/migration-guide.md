# Migration Guide: Legacy PV Explorer to Project Architecture

This guide helps you migrate from the legacy `PrimaryVariationExplorerTask` usage to the new project-based architecture.

## Quick Migration

### Before (Legacy)
```typescript
import { PrimaryVariationExplorerTask } from './core/tasks';

const explorer = new PrimaryVariationExplorerTask(
  engine,
  analysisConfig,
  pvConfig
);

await explorer.explore();
```

### After (New Architecture)
```typescript
import { ProjectManager } from './core/project/ProjectManager';
import { AnalysisTaskExecutor } from './core/project/services/AnalysisTaskExecutor';
import { PVExplorationStrategy } from './core/project/strategies/PVExplorationStrategy';

// Create project
const projectManager = new ProjectManager();
const project = await projectManager.create({
  name: 'my-analysis',
  projectPath: './projects/my-analysis',
  rootPosition: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
});

// Execute analysis
const executor = new AnalysisTaskExecutor(dependencies);
const strategy = new PVExplorationStrategy(engine, analysisConfig, strategyConfig);

await executor.executeStrategy(strategy, project);
```

## Automated Migration

Use the migration utility:

```bash
# Migrate existing script
npx tsx scripts/migrate.ts path/to/legacy-script.ts --output ./projects --name my-project
```

## Benefits of New Architecture

1. **Project Management**: Organized project structure with metadata
2. **State Persistence**: Automatic saving and resuming of analysis
3. **Strategy Pattern**: Pluggable analysis strategies
4. **Better Testing**: Dependency injection for easier testing
5. **CLI Integration**: Built-in command-line interface