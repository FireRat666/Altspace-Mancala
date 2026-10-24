# Mancala

A synced multiplayer Mancala (Kalah) board. Made for **SideQuest / AltspaceVR** worlds, and it also works in **Banter**.

There is no server: players stay in sync through the space's shared state, and the game is plain static files served from <https://mancala.firer.at>.

To try it, open <https://mancala.firer.at> in Altspace or Banter.

## Features

- Standard Kalah rules, with captures and extra turns
- Reset button
- Several independent boards in one world

## Add it to an Altspace world (snippet)

In a Creator SDK world, add an empty GameObject at the origin, click **Add Component > BS > Snippet** and type `mancala`. Or paste this into `Assets/WebRoot/index.html`, between the snippet section comments:

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

- Each placement is its own game. Its sync id is `room`, or the placement's own id when `room` is empty. Give placements the same `room` to share one game.
- `position` and `rotation` are Unity world values, and `scale` can be a single number. The other settings are listed under [Settings](#settings). An empty setting uses the default.
- The Scene-view gizmo shows the board at its default size; it does not follow `scale`.
- Unity reads the snippet section as XML: quote every attribute, close every element, and write `&` as `&amp;`.

## Add it with a script tag

This works in an Altspace world's `Assets/WebRoot/index.html` (outside the snippet section) and in a Banter space's HTML:

```html
<script src="https://mancala.firer.at/Mancala.js" position="0 1.1 -2" lighting="lit"></script>
```

For more than one board in a space, give each one its own `instance`:

```html
<script src="https://mancala.firer.at/Mancala.js" instance="board1" position="-2 1.1 -2"></script>
<script src="https://mancala.firer.at/Mancala.js" instance="board2" position="2 1.1 -2"></script>
```

Settings can also go in the URL, as in older setups: `https://mancala.firer.at/Mancala.js?boardPosition=0+1.1+-2&boardScale=0.8`.

## Settings

| Setting | Also accepted | Default | Description |
| :--- | :--- | :--- | :--- |
| `instance` |  | page URL | Sync id. Boards with the same id share one game. In a snippet, use `room` instead. |
| `boardPosition` | `position`, `board-position` | `0 1.1 -2` | Board position (x y z). |
| `boardRotation` | `rotation`, `board-rotation` | `0 0 0` | Board rotation in degrees (x y z). |
| `boardScale` | `scale`, `board-scale` | `1` | Board scale: one number, or x y z. |
| `resetPosition` | `reset-position` | `0 0 1.5` | Reset button position, relative to the board. |
| `resetRotation` | `reset-rotation` | `0 0 0` | Reset button rotation, relative to the board. |
| `resetScale` | `reset-scale` | `1` | Reset button scale. |
| `hideUI` | `hide-ui` | `false` | `true` hides the buttons. |
| `hideBoard` | `hide-board` | `false` | `true` hides the board, e.g. to use your own. |
| `useCustomModels` | `use-custom-models` | `false` | `true` uses the GLB models in `Models/` for the pieces instead of built-in shapes. |
| `lighting` |  | `unlit` | `lit` uses materials that react to scene lights. |
| `addLights` | `add-lights` | `true` | With `lighting="lit"`, adds a directional light. Set `false` if the world has its own. |

Settings can be written as `boardPosition` or `board-position`; the snippet uses the hyphenated form.

## How to play

Two players, 6 pits each plus a store, 4 stones per pit.

1. Click one of your pits to pick up its stones and sow them one per pit, counter-clockwise, skipping your opponent's store.
2. Last stone in your store: take another turn.
3. Last stone in an empty pit on your side: capture it and the stones in the opposite pit.
4. The game ends when one side is empty. Most stones wins.

```
    [12] [11] [10] [9] [8] [7]    ← Player 2's pits
[13]                          [6] ← Stores
    [0]  [1]  [2]  [3] [4] [5]    ← Player 1's pits
```

## Files

- `Mancala.js`: the game.

`use-custom-models` needs `Models/MancalaPit.glb`, `Models/MancalaStore.glb` and `Models/MancalaStone.glb` next to `Mancala.js`. They are not included, so it only works on your own copy of the game with those files added.
- `snippet.js`, `snippet.html`: the Creator SDK snippet and its definition.
- `index.html`: a test page with a floor and the game.
