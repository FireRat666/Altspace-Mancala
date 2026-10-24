# Banter Mancala

A fully synced multiplayer Mancala game for Banter using Space State Properties.

## Quick Start

Add to your Banter world HTML:

```html
<script src="https://banter-mancala.firer.at/Mancala.js"></script>
```

## SideQuest / Altspace Creator SDK (Snippet)

In a SideQuest/Altspace Creator SDK world, add an empty GameObject at the origin, click **Add Component > BS > Snippet** and type `mancala`. Or paste it into `Assets/WebRoot/index.html` between the snippet section comments:

```html
<!-- snippet section -->
<bs-snippet name="mancala" title="Mancala"
  description="Synced multiplayer Mancala board with a reset button."
  script="https://mancala.firer.at/snippet.js"
  room=""
  position="0 1 2"
  rotation="0 0 0"
  scale="0.5"
  lighting="unlit"
  add-lights="true"
  hide-ui="false"
  hide-board="false"
  reset-position="0 0 1.5">
  <bs-gizmo type="position" attribute="position"/>
  <bs-gizmo type="box" attribute="position" size="2 0.1 0.6"/>
</bs-snippet>
<!-- end snippet section -->
```

- Settings are the same as the script attributes above. `position` and `rotation` are Unity world values, and `scale` can be a single number.
- Each placement is its own game. Its sync id is `room`, or the placement's own id when `room` is empty. Give placements the same `room` to share one game.
- An empty setting uses the game's default.
- The Scene-view gizmo shows the board at its default size; it does not follow `scale`.
- Unity reads the snippet section as XML: quote every attribute, close every element, and write `&` as `&amp;`.

## Configuration

Pass parameters via URL query string on the script src:

```html
<script src="https://banter-mancala.firer.at/Mancala.js?boardPosition=0%201.5%20-2&lighting=lit"></script>
```

### Available Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| `boardPosition` | `0 1.1 -2` | Position of the game board (x y z) |
| `boardRotation` | `0 0 0` | Rotation of the game board (euler angles) |
| `boardScale` | `1 1 1` | Scale of the game board |
| `resetPosition` | `0 0 1.5` | Position of the reset button |
| `resetRotation` | `0 0 0` | Rotation of the reset button |
| `resetScale` | `1 1 1` | Scale of the reset button |
| `instance` | Page URL | Unique instance ID for multiple boards |
| `hideUI` | `false` | Hide the reset button |
| `hideBoard` | `false` | Make board transparent (for custom boards) |
| `useCustomModels` | `false` | Use GLB models instead of geometry |
| `lighting` | `unlit` | `lit` or `unlit` shader mode |
| `addLights` | `true` | Add directional light when using lit mode |

## Custom GLB Models

When `useCustomModels=true`, place these files in `Models/` relative to the script:

- `MancalaPit.glb` - The pit/hole geometry
- `MancalaStore.glb` - The larger store/mancala geometry
- `MancalaStone.glb` - Individual stone/seed

## Game Rules

Standard Mancala (Kalah) rules:
- 2 players, 6 pits each + 1 store
- 4 stones per pit at start
- Pick up all stones from a pit, distribute counter-clockwise
- Skip opponent's store when distributing
- Land in your store = extra turn
- Land in empty pit on your side = capture opposite pit's stones
- Game ends when one side is empty; most stones wins

## Board Layout

```
    [12] [11] [10] [9] [8] [7]    ← Player 2's pits
[13]                          [6] ← Stores
    [0]  [1]  [2]  [3] [4] [5]    ← Player 1's pits
```

## Sync

Uses Banter Space State Properties with key `mancala_game_{instance}` for real-time multiplayer sync.
