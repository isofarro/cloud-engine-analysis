# Project CLI

A command-line interface to set-up and manage projects

## Create a new project

Create a new project, optionally setting a root position

```
project <project-name> create  --root-position <FEN>
```

## Add engine configuration

Use a specific engine configuration in the project. The available engine name and configurations are defined in `engine-config.json`

```
project <project-name> engine <engine-name>
```

## Add a position

Adds a position to the move graph

```
project <project-name> add "<FEN>"
```

## Add move

Adds a move to the project chess graph

```
project <project-name> move <fromFEN> <move> <toFEN>
```

## Analyze a position

Add and analyse the position in a project

```
project <project-name> analyze "<FEN>"
```

Optional arguments:

* `--type` - The type of analysis to perform. Defaults to `position`. Other types
    * `pv-explore` -- Explore the principal variation by going forwards through the graph
    * `explore` -- breadth MultiPV from the current position
* 


