# CLI interface

## Commands

### Project

- `yarn project create <project-name>` - Create a new project
- `yarn project analyse <project-name> <position>` - Analyse a position in a project
- `yarn project list <project-name>` - List all positions in a project
- `yarn project delete <project-name>` - Delete a project


## Examples

Create a new project, with the local stockfish engine (configured in `engine-config.json`) to analyse the Chigorin Ruy Lopez position.

```bash
# Create a new project
yarn project create ruy-lopez-chigorin \
    --engine local-stockfish \
    --root-position "r1b2rk1/2q1bppp/p2p1n2/npp1p3/3PP3/2P2N1P/PPB2PP1/RNBQR1K1 w - - 1 12"

# Analyse the start position of the Chigorin for 60 seconds
yarn project analyse ruy-lopez-chigorin \
    "r1b2rk1/2q1bppp/p2p1n2/npp1p3/3PP3/2P2N1P/PPB2PP1/RNBQR1K1 w - - 1 12"\
    --time 60

# Analyse the position and step forward through the PV for 60 seconds each step
yarn project analyse ruy-lopez-chigorin \
    "r1b2rk1/2q1bppp/p2p1n2/npp1p3/3PP3/2P2N1P/PPB2PP1/RNBQR1K1 w - - 1 12"\
    --time 60\
    --type pv-explore
```

