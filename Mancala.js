(function () {
    /**
     * Banter Mancala Embed Script
     * A fully synced multiplayer Mancala game for Banter.
     * 
     * Board Layout:
     *     [12] [11] [10] [9] [8] [7]    ← Player 2's pits (top row, right-to-left visually)
     * [13]                          [6] ← Stores (P2 left, P1 right)
     *     [0]  [1]  [2]  [3] [4] [5]    ← Player 1's pits (bottom row, left-to-right)
     * 
     * Index 6 = Player 1's store, Index 13 = Player 2's store
     */

    // --- Configuration ---
    const config = {
        boardPosition: [0, 1.1, -2],
        boardRotation: [0, 0, 0],
        boardScale: [1, 1, 1],
        instance: window.location.href.split('?')[0],
        hideUI: false,
        turnCooldown: 5, // Seconds before the same person can move for the other side; 0 = off
        lockTimeout: 90, // Seconds a seated player can leave their turn before others can take the seat; 0 = off
        cullDistance: 20, // Metres from the game beyond which it switches itself off; 0 = always on
        volume: 0.4, // Sound effect volume, 0-1; 0 = no sounds
        soundNear: 2.5, // Metres from the game where sounds are at full volume
        soundFar: 10, // Metres from the game where sounds fade out completely
        hideBoard: false,
        useCustomModels: false,
        lighting: 'lit',
        addLights: false
    };

    // Helper to parse Vector3 from string
    const parseVector3 = (str, defaultVal) => {
        if (!str) return defaultVal;
        const s = str.trim();
        if (s.includes(' ')) {
            const parts = s.split(' ').map(Number);
            if (parts.length === 3) return [parts[0], parts[1], parts[2]];
        } else {
            const val = parseFloat(s);
            if (!isNaN(val)) return [val, val, val];
        }
        return defaultVal;
    };

    // Parse URL params or script attributes from this script tag immediately
    const currentScript = document.currentScript;
    const scriptSrc = currentScript ? currentScript.src : null;

    if (currentScript) {
        const getParam = (name, defaultValue) => {
            if (!currentScript) return defaultValue;
            
            const getFromURL = (key) => {
                try {
                    const base = typeof window !== 'undefined' ? window.location.href : 'http://localhost';
                    const url = new URL(currentScript.src, base);
                    const params = new URLSearchParams(url.search);
                    if (params.has(key)) return params.get(key);
                    const lowerKey = key.toLowerCase();
                    for (const [pKey, pVal] of params.entries()) {
                        if (pKey.toLowerCase() === lowerKey) {
                            return pVal;
                        }
                    }
                } catch (e) {}
                return null;
            };

            const getFromScriptTag = (key) => {
                try {
                    if (currentScript.hasAttribute(key)) {
                        return currentScript.getAttribute(key);
                    }
                    const lowerKey = key.toLowerCase();
                    if (currentScript.hasAttribute(lowerKey)) {
                        return currentScript.getAttribute(lowerKey);
                    }
                    const datasetKey = key.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
                    if (currentScript.dataset && currentScript.dataset[datasetKey] !== undefined) {
                        return currentScript.dataset[datasetKey];
                    }
                } catch (e) {}
                return null;
            };

            const keys = [name];
            const aliases = {
                boardPosition: ['position', 'board-position'],
                boardRotation: ['rotation', 'board-rotation'],
                boardScale: ['scale', 'board-scale'],
                hideUI: ['hide-ui'],
                turnCooldown: ['turn-cooldown'],
                lockTimeout: ['lock-timeout', 'seat-timeout', 'idle-timeout'],
                cullDistance: ['cull-distance', 'render-distance'],
                volume: ['sound-volume'],
                soundNear: ['sound-near'],
                soundFar: ['sound-far'],
                hideBoard: ['hide-board'],
                useCustomModels: ['use-custom-models'],
                addLights: ['add-lights'],
                useAOBaking: ['use-ao-baking'],
                boardSize: ['board-size'],
                piecesOpacity: ['pieces-opacity'],
                scoreboardPosition: ['scoreboard-position'],
                scoreboardRotation: ['scoreboard-rotation'],
                scoreboardScale: ['scoreboard-scale']
            };

            if (aliases[name]) {
                aliases[name].forEach(alias => {
                    if (!keys.includes(alias)) keys.push(alias);
                });
            }

            for (const key of keys) {
                const val = getFromURL(key);
                if (val !== null) return val;
            }
            for (const key of keys) {
                const val = getFromScriptTag(key);
                if (val !== null) return val;
            }

            return defaultValue;
        };

        config.hideUI = getParam('hideUI', String(config.hideUI)) === 'true';
        config.turnCooldown = parseFloat(getParam('turnCooldown', String(config.turnCooldown)));
        if (isNaN(config.turnCooldown)) config.turnCooldown = 5;
        config.lockTimeout = parseFloat(getParam('lockTimeout', String(config.lockTimeout)));
        if (isNaN(config.lockTimeout)) config.lockTimeout = 90;
        config.cullDistance = parseFloat(getParam('cullDistance', String(config.cullDistance)));
        if (isNaN(config.cullDistance)) config.cullDistance = 20;
        config.scoreboardPosition = parseVector3(getParam('scoreboardPosition'), null);
        config.scoreboardRotation = parseVector3(getParam('scoreboardRotation'), null);
        config.scoreboardScale = parseVector3(getParam('scoreboardScale'), null);
        config.volume = parseFloat(getParam('volume', String(config.volume)));
        if (isNaN(config.volume)) config.volume = 0.4;
        config.soundNear = parseFloat(getParam('soundNear', String(config.soundNear)));
        if (isNaN(config.soundNear)) config.soundNear = 2.5;
        config.soundFar = parseFloat(getParam('soundFar', String(config.soundFar)));
        if (isNaN(config.soundFar)) config.soundFar = 10;
        config.hideBoard = getParam('hideBoard', String(config.hideBoard)) === 'true';
        config.instance = getParam('instance', config.instance);
        config.useCustomModels = getParam('useCustomModels', String(config.useCustomModels)) === 'true';
        config.lighting = getParam('lighting', config.lighting);
        // 'lit' is a true/false switch (a checkbox in the snippet editor); it overrides 'lighting'.
        const litParam = getParam('lit', null);
        if (litParam !== null) config.lighting = litParam === 'true' ? 'lit' : 'unlit';
        config.addLights = getParam('addLights', String(config.addLights)) !== 'false';

        config.boardScale = parseVector3(getParam('boardScale'), config.boardScale);
        config.boardPosition = parseVector3(getParam('boardPosition'), config.boardPosition);
        config.boardRotation = parseVector3(getParam('boardRotation'), config.boardRotation);

    }

    // Model URLs for custom pieces
    const PIECE_MODELS = {
        pit: 'MancalaPit.glb',
        store: 'MancalaStore.glb',
        stone: 'MancalaStone.glb'
    };

    function getModelUrl(modelName) {
        try {
            if (scriptSrc) {
                return new URL(`Models/${modelName}`, scriptSrc).href;
            }
        } catch (e) { console.error("Error resolving model URL:", e); }
        return `Models/${modelName}`;
    }

    // --- Mancala Game Logic ---
    class MancalaGame {
        constructor() {
            this.reset();
        }

        reset() {
            // 14 pits: 0-5 = P1 pits, 6 = P1 store, 7-12 = P2 pits, 13 = P2 store
            this.pits = [4, 4, 4, 4, 4, 4, 0, 4, 4, 4, 4, 4, 4, 0];
            this.currentPlayer = 1; // Player 1 starts
            this.winner = null;
            this.gameOver = false;
        }

        getPlayerPits(player) {
            return player === 1 ? [0, 1, 2, 3, 4, 5] : [7, 8, 9, 10, 11, 12];
        }

        getPlayerStore(player) {
            return player === 1 ? 6 : 13;
        }

        getOpponentStore(player) {
            return player === 1 ? 13 : 6;
        }

        // Get the opposite pit index (for captures)
        getOppositePit(index) {
            return 12 - index;
        }

        isOwnPit(player, index) {
            if (player === 1) return index >= 0 && index <= 5;
            return index >= 7 && index <= 12;
        }

        makeMove(pitIndex) {
            if (this.gameOver) return false;

            // Validate it's the current player's pit
            if (!this.isOwnPit(this.currentPlayer, pitIndex)) return false;

            // Pit must have stones
            const stones = this.pits[pitIndex];
            if (stones === 0) return false;

            // Pick up all stones from the pit
            this.pits[pitIndex] = 0;
            let currentIndex = pitIndex;
            let stonesInHand = stones;
            const opponentStore = this.getOpponentStore(this.currentPlayer);

            // Distribute stones counter-clockwise
            while (stonesInHand > 0) {
                currentIndex = (currentIndex + 1) % 14;

                // Skip opponent's store
                if (currentIndex === opponentStore) continue;

                this.pits[currentIndex]++;
                stonesInHand--;
            }

            // Check for capture: landed in own empty pit with stones across
            const ownStore = this.getPlayerStore(this.currentPlayer);
            if (this.isOwnPit(this.currentPlayer, currentIndex) && this.pits[currentIndex] === 1) {
                const oppositeIndex = this.getOppositePit(currentIndex);
                if (this.pits[oppositeIndex] > 0) {
                    // Capture!
                    const captured = this.pits[oppositeIndex] + 1; // +1 for the stone that landed
                    this.pits[ownStore] += captured;
                    this.pits[currentIndex] = 0;
                    this.pits[oppositeIndex] = 0;
                    console.log(`Mancala: Capture! ${captured} stones captured.`);
                }
            }

            // Check if landed in own store (free turn)
            const extraTurn = currentIndex === ownStore;
            if (extraTurn) {
                console.log(`Mancala: Player ${this.currentPlayer} gets another turn!`);
            }

            // Check for game end (one side is empty)
            this.checkGameEnd();

            // Switch player if no extra turn and game not over
            if (!extraTurn && !this.gameOver) {
                this.currentPlayer = this.currentPlayer === 1 ? 2 : 1;
            }

            return true;
        }

        checkGameEnd() {
            const p1Pits = this.getPlayerPits(1);
            const p2Pits = this.getPlayerPits(2);

            const p1Empty = p1Pits.every(i => this.pits[i] === 0);
            const p2Empty = p2Pits.every(i => this.pits[i] === 0);

            if (p1Empty || p2Empty) {
                this.gameOver = true;

                // Move remaining stones to respective stores
                for (const i of p1Pits) {
                    this.pits[6] += this.pits[i];
                    this.pits[i] = 0;
                }
                for (const i of p2Pits) {
                    this.pits[13] += this.pits[i];
                    this.pits[i] = 0;
                }

                // Determine winner
                if (this.pits[6] > this.pits[13]) {
                    this.winner = 1;
                } else if (this.pits[13] > this.pits[6]) {
                    this.winner = 2;
                } else {
                    this.winner = 'draw';
                }
                console.log(`Mancala: Game Over! P1: ${this.pits[6]}, P2: ${this.pits[13]}. Winner: ${this.winner}`);
            }
        }

        getState() {
            return {
                pits: [...this.pits],
                currentPlayer: this.currentPlayer,
                winner: this.winner,
                gameOver: this.gameOver
            };
        }

        loadState(state) {
            this.pits = [...state.pits];
            this.currentPlayer = state.currentPlayer;
            this.winner = state.winner;
            this.gameOver = state.gameOver;
        }
    }

    // --- Banter Visuals ---
    const COLORS = {
        board: '#9A6234',      // Warm wood top
        trim: '#5A3418',       // Darker wood edge
        pit: '#3A2414',        // Dark hollow
        store: '#33200F',      // Store tray
        rim: '#7A4A24',        // Ring around each pit
        highlight: '#4F7A32',  // Pits the current player can pick
        text: '#F5E6C8'
    };

    // Glass-gem colours, as on real Mancala sets. Stones move between pits, so colour is just decoration.
    const STONE_COLORS = ['#3FA7D6', '#59CD90', '#F79D84', '#FAC05E', '#EE6352', '#B07BE0', '#5BC0BE'];

    // The SideQuest Creator SDK renamed ComponentType.BanterMaterial to Material.
    const materialType = () => BS.ComponentType.Material ?? BS.ComponentType.BanterMaterial;

    function hexToVector4(hex, alpha = 1.0) {
        let c = hex.substring(1);
        if (c.length === 3) c = c.split('').map(x => x + x).join('');
        const num = parseInt(c, 16);
        return new BS.Vector4(((num >> 16) & 255) / 255, ((num >> 8) & 255) / 255, (num & 255) / 255, alpha);
    }

    const state = {
        boardRoot: null,
        pitsRoot: null,
        stonesRoot: null,
        pitObjects: [],    // Array of pit GameObjects (indices 0-13)
        stoneObjects: [],  // Array of arrays - stones per pit
        stoneSpots: [],    // Per pit: where each stone rests
        countTexts: [],    // Per pit: BanterText components showing the stone count
        game: new MancalaGame()
    };

    // Layout constants (board space, before boardScale). The board top is at y = 0.
    // Player 1's row is on the +z side (where the reset button is), player 2's on the -z side.
    const LAYOUT = {
        pitRadius: 0.21,
        pitSpacing: 0.5,
        rowSpacing: 0.6,
        storeHalfX: 0.22,
        storeHalfZ: 0.5,
        storeX: 1.8,
        floorY: 0.012,      // Top of the pit/store floor discs
        stoneRadius: 0.042
    };
    const BOARD_HALF_X = LAYOUT.storeX + LAYOUT.storeHalfX + 0.09;
    const BOARD_HALF_Z = LAYOUT.rowSpacing / 2 + LAYOUT.pitRadius + 0.13;

    function shaderFor(transparent) {
        if (transparent) return "Unlit/DiffuseTransparent";
        return config.lighting === 'lit' ? "Standard" : "Unlit/Diffuse";
    }

    function pitCenter(index) {
        if (index === 6) return { x: LAYOUT.storeX, z: 0 };
        if (index === 13) return { x: -LAYOUT.storeX, z: 0 };
        if (index < 6) return { x: (index - 2.5) * LAYOUT.pitSpacing, z: LAYOUT.rowSpacing / 2 };
        return { x: (2.5 - (index - 7)) * LAYOUT.pitSpacing, z: -LAYOUT.rowSpacing / 2 };
    }

    // Resting spots for stones in a pit (circle) or store (oval), in fill order. Each layer is
    // hex-packed and the next one sits in the gaps of the one below, a little smaller each
    // time, so stones always rest on something and piles look like heaps.
    function buildStoneSpots(halfX, halfZ, count) {
        const r = LAYOUT.stoneRadius;
        const d = r * 2.05;
        const rowH = d * 0.866;
        const layerH = d * 0.8165;
        const layerSpotsFor = (layer, shrink) => {
            const y = LAYOUT.floorY + r + layer * layerH;
            const ax = halfX - r - 0.01 - shrink;
            const az = halfZ - r - 0.01 - shrink;
            const ox = (layer % 2) ? d / 2 : 0;
            const oz = (layer % 2) ? rowH / 3 : 0;
            const out = [];
            if (ax <= 0 || az <= 0) return out;
            const n = Math.ceil(Math.max(ax, az) / rowH) + 2;
            for (let j = -n; j <= n; j++) {
                for (let i = -n; i <= n; i++) {
                    const x = i * d + ((j & 1) ? d / 2 : 0) + ox;
                    const z = j * rowH + oz;
                    if ((x * x) / (ax * ax) + (z * z) / (az * az) <= 1) out.push({ x, y, z });
                }
            }
            // Fill from the middle outwards
            out.sort((a, b) => (a.x * a.x + a.z * a.z) - (b.x * b.x + b.z * b.z));
            return out;
        };
        const spots = [];
        let shrink = 0;
        for (let layer = 0; spots.length < count; layer++) {
            // Each layer is a bit narrower, but never fewer than 3 stones, so tall piles
            // stay a stable heap instead of a single column
            let s = layer === 0 ? 0 : shrink + d * 0.3;
            let layerSpots = layerSpotsFor(layer, s);
            while (layerSpots.length < 3 && s > 0) {
                s = Math.max(0, s - d * 0.1);
                layerSpots = layerSpotsFor(layer, s);
            }
            shrink = s;
            spots.push(...layerSpots);
        }
        return spots;
    }

    async function makeText(parent, text, pos, rot, fontSize, w, h) {
        const obj = await new BS.GameObject("Text").Async();
        await obj.SetParent(parent, false);
        const t = await obj.AddComponent(new BS.Transform());
        t.localPosition = pos;
        t.localEulerAngles = rot;
        return obj.AddComponent(new BS.BanterText(
            text, hexToVector4(COLORS.text), BS.HorizontalAlignment.Center, BS.VerticalAlignment.Center,
            fontSize, false, false, new BS.Vector2(w, h)
        ));
    }

    async function setupScene() {
        console.log("Mancala: Setup Scene Started");

        state.boardRoot = await new BS.GameObject("Mancala_Root").Async();
        let t = await state.boardRoot.AddComponent(new BS.Transform());
        t.position = config.boardPosition;
        t.localEulerAngles = config.boardRotation;
        t.localScale = config.boardScale;

        // Add lights if lit mode
        if (config.lighting === 'lit' && config.addLights) {
            const lightGO = await new BS.GameObject("Mancala_DirectionalLight").Async();
            await lightGO.SetParent(state.boardRoot, false);
            let lightTrans = await lightGO.AddComponent(new BS.Transform());
            lightTrans.localPosition = new BS.Vector3(0, 3, -2);
            lightTrans.localEulerAngles = new BS.Vector3(45, 0, 0);
            await lightGO.AddComponent(new BS.Light(1, new BS.Vector4(1, 1, 1, 1), 1, 0.1));
        }

        // Create board base (optional)
        if (!config.hideBoard) {
            await createBoardBase();
        }

        // Create pits container
        state.pitsRoot = await new BS.GameObject("Pits_Root").Async();
        await state.pitsRoot.SetParent(state.boardRoot, false);
        await state.pitsRoot.AddComponent(new BS.Transform());

        // Create stones container
        state.stonesRoot = await new BS.GameObject("Stones_Root").Async();
        await state.stonesRoot.SetParent(state.boardRoot, false);
        await state.stonesRoot.AddComponent(new BS.Transform());

        // Create all pits and stores
        await createPitsAndStores();

        if (!config.hideUI) {
            await createLabels();
        }
        panel = createGamePanel({
            title: "Mancala",
            key: `mancala_game_${config.instance}`,
            root: state.boardRoot,
            centre: config.boardPosition,
            sides: [
                { id: 1, label: 'PLAYER 1', bg: '#6d4c41', fg: '#ffffff' },
                { id: 2, label: 'PLAYER 2', bg: '#d7ccc8', fg: '#111111' }
            ],
            turn: () => state.game.gameOver ? null : state.game.currentPlayer,
            status: turnStatusText,
            resetFreely: () => state.game.gameOver || state.game.pits.every((n, i) => n === (i === 6 || i === 13 ? 0 : 4)),
            reset: () => { state.game.reset(); syncState(); },
            getState: () => state.game.getState(),
            position: [0, 0.75, 0],
            scale: 0.14
        });
        await panel.build();

        // Setup sync listeners
        setupListeners();

        // Check for existing state
        await checkForExistingState();

        // Initial visual sync
        await syncVisuals();

        console.log("Mancala: Setup Scene Complete");
    }

    async function addBox(name, pos, w, h, d, colorHex) {
        const obj = await new BS.GameObject(name).Async();
        await obj.SetParent(state.boardRoot, false);
        const t = await obj.AddComponent(new BS.Transform());
        t.localPosition = pos;
        await obj.AddComponent(new BS.BanterGeometry(BS.GeometryType.BoxGeometry, null, w, h, d));
        await obj.AddComponent(new BS.BanterMaterial(shaderFor(false), "", hexToVector4(colorHex), BS.MaterialSide.Front, false));
        return obj;
    }

    async function createBoardBase() {
        const w = BOARD_HALF_X * 2;
        const d = BOARD_HALF_Z * 2;
        // Dark trim slab, with a lighter top set slightly inside it
        await addBox("BoardTrim", new BS.Vector3(0, -0.06, 0), w + 0.08, 0.1, d + 0.08, COLORS.trim);
        await addBox("BoardTop", new BS.Vector3(0, -0.015, 0), w, 0.03, d, COLORS.board);
    }

    async function createPitsAndStores() {
        for (let i = 0; i < 14; i++) {
            const isStore = i === 6 || i === 13;
            const c = pitCenter(i);
            state.pitObjects[i] = await createPit(i, new BS.Vector3(c.x, 0, c.z), isStore);
            state.stoneSpots[i] = isStore
                ? buildStoneSpots(LAYOUT.storeHalfX, LAYOUT.storeHalfZ, 48)
                : buildStoneSpots(LAYOUT.pitRadius, LAYOUT.pitRadius, 48);
        }
    }

    // A flat disc; for stores it is stretched along z into an oval.
    function discGeometry(radius, height) {
        return new BS.BanterGeometry(
            BS.GeometryType.CylinderGeometry, null,
            1, height, 1, 1, 1, 1,
            radius, 32, 0, 6.283185, 0, 6.283185, 8, false,
            radius, radius
        );
    }

    async function createPit(index, position, isStore) {
        const pit = await new BS.GameObject(`Pit_${index}`).Async();
        await pit.SetParent(state.pitsRoot, false);

        let pt = await pit.AddComponent(new BS.Transform());
        pt.localPosition = position;

        const radius = isStore ? LAYOUT.storeHalfX : LAYOUT.pitRadius;
        const stretchZ = isStore ? LAYOUT.storeHalfZ / LAYOUT.storeHalfX : 1;
        const color = hexToVector4(isStore ? COLORS.store : COLORS.pit, config.hideBoard ? 0.3 : 1);

        if (config.useCustomModels) {
            const url = getModelUrl(isStore ? PIECE_MODELS.store : PIECE_MODELS.pit);
            await pit.AddComponent(new BS.BanterGLTF(url, false, false, false, false, false, false));
            pt.localScale = new BS.Vector3(radius * 2, 0.15, radius * 2 * stretchZ);
        } else {
            // Lighter rim, then the dark floor of the hollow on top of it
            if (!config.hideBoard) {
                const rim = await new BS.GameObject(`PitRim_${index}`).Async();
                await rim.SetParent(pit, false);
                const rt = await rim.AddComponent(new BS.Transform());
                // Sits just under the floor disc. Its parent is already stretched along z, so
                // undo that here to keep the rim the same width all round.
                rt.localPosition = new BS.Vector3(0, -0.003, 0);
                rt.localScale = new BS.Vector3(1, 1, (radius * stretchZ + 0.025) / ((radius + 0.025) * stretchZ));
                await rim.AddComponent(discGeometry(radius + 0.025, 0.006));
                await rim.AddComponent(new BS.BanterMaterial(shaderFor(false), "", hexToVector4(COLORS.rim), BS.MaterialSide.Front, false));
            }
            pt.localScale = new BS.Vector3(1, 1, stretchZ);
            pt.localPosition = new BS.Vector3(position.x, LAYOUT.floorY / 2, position.z);
            await pit.AddComponent(discGeometry(radius, LAYOUT.floorY));
        }

        // Pit/store needs unique material for dynamic highlighting
        await pit.AddComponent(new BS.BanterMaterial(
            shaderFor(config.hideBoard), "", color, BS.MaterialSide.Front, false, `pit_${index}`
        ));

        // Clickable pits: the box covers the whole heap of stones too
        if (!isStore) {
            await pit.AddComponent(new BS.BoxCollider(
                true,
                new BS.Vector3(0, 0.12, 0),
                new BS.Vector3(radius * 2, 0.26, radius * 2)
            ));
            await pit.SetLayer(5);

            pit.On('click', () => handlePitClick(index));
        }

        // Initialize stone array for this pit
        state.stoneObjects[index] = [];

        return pit;
    }

    // Stone counts next to every pit and store, and a turn sign facing each player.
    async function createLabels() {
        const labels = await new BS.GameObject("Labels").Async();
        await labels.SetParent(state.boardRoot, false);
        await labels.AddComponent(new BS.Transform());

        // Facing player 1 (on +z) or player 2 (on -z)
        const flat = [new BS.Vector3(90, 180, 0), new BS.Vector3(90, 0, 0)];
        const edgeZ = LAYOUT.rowSpacing / 2 + LAYOUT.pitRadius + 0.07;

        for (let i = 0; i < 14; i++) {
            const c = pitCenter(i);
            if (i === 6 || i === 13) {
                // Stores: count on a small sign above, readable from both sides
                state.countTexts[i] = await makeTwoSidedSign(labels, new BS.Vector3(c.x, 0.32, 0), 0.3, 0.2, 1.2);
            } else {
                // Pits: count lies on the board at the owner's edge, readable by the owner
                const owner = i < 6 ? 0 : 1;
                const z = owner === 0 ? edgeZ : -edgeZ;
                state.countTexts[i] = [await makeText(labels, "0",
                    new BS.Vector3(c.x, 0.002, z), flat[owner], 0.8, 3, 1)];
            }
        }

    }

    // A thin wooden sign with text on both faces. The sign sits between the two texts so each
    // side only sees its own (otherwise the back text shows through, mirrored).
    // Returns [text facing player 1 (+z), text facing player 2 (-z)].
    async function makeTwoSidedSign(parent, pos, w, h, fontSize) {
        const sign = await new BS.GameObject("Sign").Async();
        await sign.SetParent(parent, false);
        const t = await sign.AddComponent(new BS.Transform());
        t.localPosition = pos;
        await sign.AddComponent(new BS.BanterGeometry(BS.GeometryType.BoxGeometry, null, w, h, 0.01));
        await sign.AddComponent(new BS.BanterMaterial(shaderFor(false), "", hexToVector4(COLORS.trim), BS.MaterialSide.Front, false));
        return [
            await makeText(sign, "", new BS.Vector3(0, 0, 0.007), new BS.Vector3(0, 180, 0), fontSize, w * 10, h * 10),
            await makeText(sign, "", new BS.Vector3(0, 0, -0.007), new BS.Vector3(0, 0, 0), fontSize, w * 10, h * 10)
        ];
    }

    const SOUND_FILES = { seed: 4, capture: 1, bonus: 1, win: 1, draw: 1, reset: 1 }; // name: number of takes

    // --- Sounds ---
    // Short sound effects for moves, captures, wins and resets. Each client works out what changed
    // between two game states and plays the matching sound, so everyone hears every move. Joining is
    // silent, and our own move echoed back by the space only plays once. The files are in Sounds/
    // next to this script (made by sound-tools/make_sounds.py). `volume` (0-1) sets the level;
    // 0 turns sounds off.
    const MUTE_KEY = 'banterGames_muted_mancala';
    const sounds = { files: SOUND_FILES, cache: {}, live: false, prev: null, prevKey: null, muted: false };
    try { sounds.muted = localStorage.getItem(MUTE_KEY) === '1'; } catch (e) { }

    function soundAudio(file) {
        let a = sounds.cache[file];
        if (!a) {
            a = sounds.cache[file] = new Audio(new URL(`Sounds/${file}.ogg`, scriptSrc || window.location.href).href);
            a.preload = 'auto';
        }
        return a;
    }

    // `name` is a key of SOUND_FILES; ones with several takes pick one at random.
    function playSound(name, delayMs = 0) {
        if (!(config.volume > 0) || sounds.muted) return;
        const volume = config.volume * distanceGain(config.boardPosition, config.soundNear, config.soundFar);
        if (volume < 0.005) return; // too far away to hear
        const takes = sounds.files[name] || 1;
        const file = takes > 1 ? name + (1 + Math.floor(Math.random() * takes)) : name;
        setTimeout(() => {
            try {
                const audio = soundAudio(file).cloneNode();
                audio.volume = Math.min(1, volume);
                audio.play().catch(() => {});
            } catch (e) { }
        }, delayMs);
    }

    // Call after every state change; repeats of the same state are ignored.
    function soundForState() {
        let next;
        try { next = soundSnapshot(); } catch (e) { return; }
        if (!next) return;
        const key = JSON.stringify(next);
        if (key === sounds.prevKey) return;
        const prev = sounds.prev;
        sounds.prev = JSON.parse(key);
        sounds.prevKey = key;
        if (sounds.live && prev) {
            try { chooseSounds(prev, sounds.prev); } catch (e) { console.warn("Sound error", e); }
        }
    }

    // Call once the saved game (if any) has loaded; sounds play from then on.
    function startSounds() {
        soundForState();
        sounds.live = true;
        headTracker();
        if (config.volume > 0) {
            for (const [name, takes] of Object.entries(sounds.files)) {
                if (takes > 1) for (let i = 1; i <= takes; i++) soundAudio(name + i);
                else soundAudio(name);
            }
        }
    }

    // --- Hearing distance ---
    // Sounds fade with the local player's distance from the game: full volume within `near` metres,
    // silent from `far` metres, so people elsewhere in the world aren't disturbed. The head position
    // comes from an empty object attached to the player's head (Unity reports where it is), or from
    // pose-update until that works. All the games on a page share one tracker.
    function headTracker() {
        if (window.BanterGamesHead) return window.BanterGamesHead;
        const head = window.BanterGamesHead = { marker: null, attaching: false, markerPos: null, posePos: null };
        const scene = BS.BanterScene.GetInstance();
        scene.On('pose-update', e => {
            const h = e && e.detail && e.detail.head;
            if (h && h.position) head.posePos = h.position;
        });
        const attach = async () => {
            const uid = scene.localUser && scene.localUser.uid;
            if (!uid || head.marker || head.attaching) return;
            head.attaching = true;
            try {
                const go = await new BS.GameObject("GameSoundsHead").Async();
                head.marker = go;
                if (typeof BS.AttachedObject === 'function') {
                    const point = BS.AvatarBoneName ? BS.AvatarBoneName.HEAD : 0;
                    const attached = await go.AddComponent(new BS.AttachedObject({ uid, avatarAttachmentPoint: point }));
                    await attached.Attach(uid);
                } else if (typeof scene.LegacyAttachObject === 'function' && BS.LegacyAttachmentPosition) {
                    await scene.LegacyAttachObject(go, uid, BS.LegacyAttachmentPosition.HEAD);
                } else {
                    return; // no way to attach here: pose-update only
                }
                const PN = BS.PN || BS.PropertyName;
                if (typeof go.WatchTransform === 'function' && PN) {
                    await go.WatchTransform([PN.position], t => {
                        if (head.marker === go && t && t.position) head.markerPos = t.position;
                    });
                }
            } finally {
                head.attaching = false;
            }
        };
        const tryAttach = () => attach().catch(e => console.warn("Game sounds: could not follow the head", e));
        // The SDK drops attachments when the player leaves, so the marker is made again when they
        // come back (a moment later, so the SDK is ready).
        scene.On('user-left', e => {
            if (!(e && e.detail && e.detail.isLocal)) return;
            try { if (head.marker) head.marker.Destroy(); } catch (err) { }
            head.marker = null;
            head.markerPos = null;
        });
        scene.On('user-joined', e => {
            if (e && e.detail && e.detail.isLocal && !head.marker) setTimeout(tryAttach, 5000);
        });
        (async () => {
            while (!scene.localUser || scene.localUser.uid === undefined) await new Promise(r => setTimeout(r, 500));
            await tryAttach();
        })();
        return head;
    }

    // 0-1: how loud a sound from `centre` (a world position) is for the local player.
    function distanceGain(centre, near, far) {
        const head = headTracker();
        const p = head.markerPos || head.posePos;
        if (!p || !centre) return 1; // not known yet, so play it
        const d = Math.hypot(p.x - centre.x, p.y - centre.y, p.z - centre.z);
        if (d <= near) return 1;
        if (!(far > near) || d >= far) return 0;
        const f = 1 - (d - near) / (far - near);
        return f * f;
    }

    // Cells (of a 2D board) that differ between two boards.
    function boardDiff(a, b) {
        const out = [];
        for (let r = 0; r < b.length; r++) {
            for (let c = 0; c < b[r].length; c++) {
                const was = a[r] ? a[r][c] : undefined;
                if (was !== b[r][c]) out.push({ r, c, was, now: b[r][c] });
            }
        }
        return out;
    }

    function soundSnapshot() {
        const g = state.game;
        return { pits: g.pits, currentPlayer: g.currentPlayer, winner: g.winner || null, gameOver: !!g.gameOver };
    }

    function chooseSounds(prev, next) {
        const start = [4, 4, 4, 4, 4, 4, 0, 4, 4, 4, 4, 4, 4, 0];
        if (next.pits.every((n, i) => n === start[i])) return playSound('reset');
        // Work out which pit was played by replaying each possible move on the previous state.
        const mover = prev.currentPlayer;
        const own = mover === 1 ? [0, 1, 2, 3, 4, 5] : [7, 8, 9, 10, 11, 12];
        const pit = own.find(i => {
            if (!prev.pits[i]) return false;
            const g = new MancalaGame();
            g.loadState(prev);
            return g.makeMove(i) && g.pits.every((n, j) => n === next.pits[j]);
        });
        if (pit === undefined) return;
        // One click per seed dropped, so you can hear the sowing go round
        const seeds = prev.pits[pit];
        const gap = Math.max(55, Math.min(120, 900 / seeds));
        for (let i = 0; i < seeds; i++) playSound('seed', i * gap);
        let t = seeds * gap + 150;
        // Where the last seed landed (the opponent's store is skipped)
        let at = pit;
        for (let left = seeds; left > 0;) {
            at = (at + 1) % 14;
            if (at !== (mover === 1 ? 13 : 6)) left--;
        }
        if (next.gameOver && !prev.gameOver) {
            playSound(next.winner === 'draw' ? 'draw' : 'win', t);
        } else if (own.includes(at) && next.pits[at] === 0) {
            playSound('capture', t); // landed in an empty pit and took the seeds opposite
        } else if (at === (mover === 1 ? 6 : 13)) {
            playSound('bonus', t); // landed in own store: another turn
        }
    }

    // --- Turn cooldown ---
    // Stops one person from taking both sides' turns by accident (a double click, or moving again
    // before the other player has had a chance). After you move, if it is now the other side's
    // turn, you must wait `turnCooldown` seconds before you can move for them. Someone playing on
    // their own can still play both sides; they just wait. Extra turns for the same side are not
    // affected. The time is only ever compared on the mover's own clock.
    const turnGuard = { lastMove: null };

    function localUid() {
        const user = BS.BanterScene.GetInstance().localUser;
        return user && user.uid !== undefined ? String(user.uid) : null;
    }

    // True (and shows a notice) if the local user has to wait before moving for `side`.
    function turnOnCooldown(side) {
        const m = turnGuard.lastMove;
        const uid = localUid();
        if (!m || !uid || !(config.turnCooldown > 0) || m.uid !== uid || m.side === side) return false;
        const left = config.turnCooldown * 1000 - (Date.now() - m.at);
        if (left <= 0) return false;
        showTurnNotice(`Other player's turn (${Math.ceil(left / 1000)}s)`);
        return true;
    }

    // Marks outgoing state as a move by the local user for `side`.
    function stampMove(data, side) {
        turnGuard.lastMove = { uid: localUid(), side, at: Date.now() };
        data.lastMove = turnGuard.lastMove;
        return data;
    }

    // Call with every state loaded from the space. A reset has no lastMove, which clears it.
    function loadLastMove(data) {
        turnGuard.lastMove = (data && data.lastMove) || null;
    }

    function turnStatusText() {
        const g = state.game;
        const score = `${g.pits[6]} - ${g.pits[13]}`;
        if (g.gameOver) return g.winner === 'draw' ? `Draw!  ${score}` : `Player ${g.winner} wins!  ${score}`;
        return `Player ${g.currentPlayer}'s turn  ${score}`;
    }

    function handlePitClick(pitIndex) {
        if (state.game.gameOver) {
            console.log("Mancala: Game is over");
            return;
        }

        // Check if it's a valid pit for current player
        if (!state.game.isOwnPit(state.game.currentPlayer, pitIndex)) {
            console.log("Mancala: Not your pit!");
            return;
        }

        if (state.game.pits[pitIndex] === 0) {
            console.log("Mancala: Pit is empty!");
            return;
        }

        if (!panel.mayMove(state.game.currentPlayer)) return;
        if (turnOnCooldown(state.game.currentPlayer)) return;
        const side = state.game.currentPlayer;

        console.log(`Mancala: Player ${side} clicked pit ${pitIndex}`);

        if (state.game.makeMove(pitIndex)) {
            syncState(side);
        }
    }

    // `side` is the player who just moved; leave it out for a reset.
    function syncState(side) {
        const key = `mancala_game_${config.instance}`;
        const data = state.game.getState();
        if (side !== undefined) stampMove(data, side);
        panel.stamp(data);
        BS.BanterScene.GetInstance().SetPublicSpaceProps({ [key]: JSON.stringify(data) });
        syncVisuals();
    }

    // Redraws can be requested while one is still running (our own move, then the server's
    // echo of it). Run one at a time, and redraw once more if asked mid-run, or two redraws
    // add stones to the same pit at once and the counts drift.
    let redrawing = null;
    let redrawAgain = false;
    function syncVisuals() {
        soundForState();
        redrawAgain = true;
        if (!redrawing) {
            redrawing = (async () => {
                try {
                    while (redrawAgain) {
                        redrawAgain = false;
                        await renderVisuals();
                    }
                } finally {
                    redrawing = null;
                }
            })();
        }
        return redrawing;
    }

    async function renderVisuals() {
        const game = state.game;

        for (let i = 0; i < 14; i++) {
            await updatePitStones(i, game.pits[i]);

            const texts = state.countTexts[i];
            if (texts) texts.forEach(t => { t.text = String(game.pits[i]); });

            // Highlight the pits the current player can pick from
            if (i !== 6 && i !== 13) {
                const mat = state.pitObjects[i]?.GetComponent(materialType());
                if (mat) {
                    const isValid = !game.gameOver && game.isOwnPit(game.currentPlayer, i) && game.pits[i] > 0;
                    mat.color = hexToVector4(isValid ? COLORS.highlight : COLORS.pit, config.hideBoard ? 0.3 : 1.0);
                }
            }
        }

        updateTurnBoard();
    }

    async function updatePitStones(pitIndex, targetCount) {
        const currentStones = state.stoneObjects[pitIndex];

        // Remove excess stones (from the top of the heap)
        while (currentStones.length > targetCount) {
            const stone = currentStones.pop();
            if (stone && !stone.destroyed) {
                stone.Destroy();
            }
        }

        // Add missing stones
        while (currentStones.length < targetCount) {
            const stone = await createStone(pitIndex, currentStones.length);
            if (stone) {
                currentStones.push(stone);
            }
        }
    }

    async function createStone(pitIndex, stoneIndex) {
        const spots = state.stoneSpots[pitIndex];
        const c = pitCenter(pitIndex);
        if (!spots) return null;
        const spot = spots[Math.min(stoneIndex, spots.length - 1)];
        const r = LAYOUT.stoneRadius;

        const stone = await new BS.GameObject(`Stone_${pitIndex}_${stoneIndex}`).Async();
        await stone.SetParent(state.stonesRoot, false);

        const st = await stone.AddComponent(new BS.Transform());
        st.localPosition = new BS.Vector3(c.x + spot.x, spot.y, c.z + spot.z);

        const colorHex = STONE_COLORS[(pitIndex * 3 + stoneIndex) % STONE_COLORS.length];

        if (config.useCustomModels) {
            const url = getModelUrl(PIECE_MODELS.stone);
            await stone.AddComponent(new BS.BanterGLTF(url, false, false, false, false, false, false));
            st.localScale = new BS.Vector3(r * 2, r * 2, r * 2);
        } else {
            await stone.AddComponent(new BS.BanterGeometry(
                BS.GeometryType.SphereGeometry, null,
                1, 1, 1, 24, 16, 1,
                r, 24, 0, 6.283185, 0, 6.283185, 8, false,
                r, r
            ));
        }

        // Stones need unique material instance
        await stone.AddComponent(new BS.BanterMaterial(shaderFor(false), "", hexToVector4(colorHex), BS.MaterialSide.Front, false, `stone_${pitIndex}_${stoneIndex}`));

        return stone;
    }

    async function checkForExistingState() {
        const key = `mancala_game_${config.instance}`;
        const scene = BS.BanterScene.GetInstance();

        // Wait for user to be ready
        while (!scene.localUser || scene.localUser.uid === undefined) {
            await new Promise(resolve => setTimeout(resolve, 200));
        }

        const s = scene.spaceState;
        const val = (s.public && s.public[key]) || (s.protected && s.protected[key]);

        if (val) {
            try {
                const data = JSON.parse(val);
                loadLastMove(data);
                state.game.loadState(data);
                panel.load(data);
                console.log("Mancala: Loaded existing state");
            } catch (e) {
                console.error("Failed to parse mancala state", e);
            }
        }
        startSounds();
    }

    function setupListeners() {
        const key = `mancala_game_${config.instance}`;
        BS.BanterScene.GetInstance().On("space-state-changed", e => {
            const changes = e.detail.changes;
            if (changes && changes.find(c => c.property === key)) {
                console.log("Mancala: Received state change from server");

                const s = BS.BanterScene.GetInstance().spaceState;
                const val = (s.public && s.public[key]) || (s.protected && s.protected[key]);

                if (val) {
                    try {
                        const data = JSON.parse(val);
                        loadLastMove(data);
                        state.game.loadState(data);
                        panel.load(data);
                        syncVisuals();
                    } catch (e) {
                        console.error(e);
                    }
                }
            }
        });
    }

    function showTurnNotice(text) { if (panel) panel.notice(text); }
    function updateTurnBoard() { if (panel) panel.update(); }

    let panel = null;
    // --- Game panel: turn, seats, Reset and Mute, seat locking, and switching off when far away ---
    // The same code is in each of the two-player board games (it started in Chess). It uses the
    // game's own `config`, `sounds`, `MUTE_KEY`, `headTracker` and `localUid`.
    //
    // Seats: each side can be claimed by one player, and then only they can move for it. A seat can
    // be taken over when its player has left the space, or has left their turn untouched for
    // `lockTimeout` seconds. Unclaimed sides can be moved by anyone. While a game is under way only
    // its seated players (or the space host) can reset it, unless a seat is empty or idle.
    //
    // Switching off: beyond `cullDistance` metres the game's root object is switched off and the
    // panel removed (a BanterUI panel loses its contents when switched off, so it is built again on
    // the way back). Moves made meanwhile still arrive and show when the player returns.
    //
    // opts: {
    //   title, key (space state key), root (GameObject), centre (world Vector3),
    //   sides: [{ id, label, bg, fg }]   id = the side value the game uses for turns,
    //   turn(): side id whose turn it is, or null when the game is over,
    //   status(): text for the header,
    //   resetFreely(): true when anyone may reset (nothing played yet, or the game is over),
    //   reset(): resets the game (and syncs it),
    //   getState(): the game's current state object, used when only the seats change,
    //   buttons: [{ text, color, onClick }]   extra buttons beside Reset,
    //   position: [x, y, z] default panel position relative to the root,
    //   scale: default panel scale (multiplied by config.scoreboardScale)
    // }
    function createGamePanel(opts) {
        const scene = BS.BanterScene.GetInstance();
        const P = { seats: {}, lastActionTime: 0, data: null, ui: null, building: null, culled: false, notice: '', noticeTimer: null };
        const v3 = a => Array.isArray(a) ? new BS.Vector3(...a) : a;

        const me = () => {
            const u = scene.localUser;
            return u && u.uid !== undefined ? { uid: String(u.uid), name: u.name || 'Player' } : null;
        };
        const present = uid => !!uid && ((scene.localUser && String(scene.localUser.uid) === String(uid)) || !!(scene.users && scene.users[uid]));
        // Idle: it is that side's turn and nothing has happened for lockTimeout seconds.
        const idle = side => {
            if (!(config.lockTimeout > 0) || opts.turn() !== side || !P.lastActionTime) return false;
            return Date.now() - P.lastActionTime > config.lockTimeout * 1000;
        };
        const free = side => { const s = P.seats[side]; return !s || !present(s.uid) || idle(side); };
        const isHost = () => {
            const m = me();
            if (!m) return false;
            if (scene.space && scene.space.owner && String(scene.space.owner.uid) === m.uid) return true;
            const uids = Object.keys(scene.users || {}).map(String).sort();
            return uids.length > 0 && uids[0] === m.uid;
        };

        // --- State ---
        // Adds the seats to an outgoing game state. Call for every state the game writes.
        function stamp(data) {
            data.seats = { ...P.seats };
            data.lastActionTime = Date.now();
            P.data = data;
            P.lastActionTime = data.lastActionTime;
            return data;
        }
        // Call with every game state loaded from the space.
        function load(data) {
            P.data = data || null;
            P.seats = (data && data.seats) || {};
            P.lastActionTime = (data && data.lastActionTime) || 0;
            update();
        }
        function writeSeats(seats) {
            P.seats = seats;
            const base = P.data || opts.getState();
            const data = stamp({ ...base, seats });
            scene.SetPublicSpaceProps({ [opts.key]: JSON.stringify(data) });
            update();
        }

        // --- Rules ---
        // True if the local player may move for `side`. Takes over an abandoned seat; otherwise
        // shows a notice and returns false when someone else holds it.
        function mayMove(side) {
            const seat = P.seats[side];
            if (!seat) return true;
            const m = me();
            if (m && String(seat.uid) === m.uid) return true;
            if (m && free(side)) {
                const label = (opts.sides.find(s => s.id === side) || {}).label || side;
                notice(`${label} was ${present(seat.uid) ? 'idle' : 'empty'} - seat taken`);
                const seats = { ...P.seats, [side]: { uid: m.uid, name: m.name } };
                for (const s of opts.sides) if (s.id !== side && seats[s.id] && String(seats[s.id].uid) === m.uid) seats[s.id] = null;
                P.seats = seats; // the move that follows writes them
                return true;
            }
            notice(`It is ${seat.name}'s turn`);
            return false;
        }
        function mayReset() {
            if (opts.resetFreely()) return true;
            const claimed = opts.sides.filter(s => P.seats[s.id]);
            if (claimed.length === 0) return true;
            const m = me();
            if (m && claimed.some(s => String(P.seats[s.id].uid) === m.uid)) return true;
            if (isHost()) return true;
            if (opts.sides.some(s => P.seats[s.id] && free(s.id))) return true;
            notice("Only the seated players can reset a game in progress");
            return false;
        }
        function clickSeat(side) {
            const m = me();
            if (!m) return notice("Could not find your user id");
            const seat = P.seats[side];
            const label = (opts.sides.find(s => s.id === side) || {}).label || side;
            if (seat && String(seat.uid) === m.uid) {
                writeSeats({ ...P.seats, [side]: null });
                notice(`You left ${label}`);
            } else if (!seat || free(side)) {
                const seats = { ...P.seats, [side]: { uid: m.uid, name: m.name } };
                for (const s of opts.sides) if (s.id !== side && seats[s.id] && String(seats[s.id].uid) === m.uid) seats[s.id] = null;
                writeSeats(seats);
                notice(`You took ${label}`);
            } else {
                notice(`${label} is taken by ${seat.name}`);
            }
        }
        function clickReset() {
            if (!mayReset()) return;
            opts.reset();
            notice("Game reset");
        }

        // --- Panel ---
        function notice(text) {
            P.notice = text;
            clearTimeout(P.noticeTimer);
            P.noticeTimer = setTimeout(() => { P.notice = ''; update(); }, 3000);
            update();
        }
        function seatText(side) {
            const seat = P.seats[side.id];
            const m = me();
            if (!seat) return `${side.label}: [CLAIM]`;
            if (m && String(seat.uid) === m.uid) return `${side.label}: YOU [LEAVE]`;
            if (!present(seat.uid)) return `${side.label}: Left [TAKE]`;
            if (idle(side.id)) return `${side.label}: ${seat.name} (idle) [TAKE]`;
            return `${side.label}: ${seat.name}`;
        }
        function update() {
            const ui = P.ui;
            if (!ui || P.culled) return;
            try {
                ui.status.text = opts.status();
                ui.notice.text = P.notice;
                if (ui.mute) ui.mute.text = sounds.muted ? "UNMUTE" : "MUTE";
                const turn = opts.turn();
                const m = me();
                for (const side of opts.sides) {
                    const btn = ui.seatBtns[side.id];
                    const seat = P.seats[side.id];
                    btn.text = seatText(side);
                    let border = '#666666';
                    if (seat && !present(seat.uid)) border = '#e57373';
                    else if (seat && idle(side.id)) border = '#ffb300';
                    else if (turn === side.id) border = '#4CAF50';
                    else if (seat && m && String(seat.uid) === m.uid) border = '#2e7d32';
                    btn.SetStyles({ borderColor: border, borderWidth: turn === side.id ? '4px' : '2px' });
                }
            } catch (e) { }
        }

        async function build() {
            if (config.hideUI || P.ui || P.building) return;
            P.building = (async () => {
                const pos = config.scoreboardPosition && !config.scoreboardPosition.every(n => n === 0) ? config.scoreboardPosition : opts.position;
                const mul = config.scoreboardScale || [1, 1, 1];
                const base = opts.scale || 0.24;
                const obj = await new BS.GameObject({
                    name: opts.title + "_Panel",
                    parent: opts.root,
                    localPosition: v3(pos),
                    localEulerAngles: v3(config.scoreboardRotation || [0, 0, 0]),
                    localScale: new BS.Vector3(base * mul[0], base * mul[1], base * mul[2])
                }).Async();
                const bb = await obj.AddComponent(new BS.BanterBillboard({ smoothing: 1, enableXAxis: false, enableYAxis: true }));
                bb.enableXAxis = false;
                const panel = await obj.AddComponent(new BS.BanterUI(new BS.Vector2(650, 270), false));
                const clear = { backgroundColor: 'rgba(0,0,0,0)' };
                const rootEl = panel.CreateVisualElement();
                await rootEl.Async();
                rootEl.SetStyles({
                    backgroundColor: 'rgba(15, 18, 26, 0.94)', display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'space-between',
                    paddingTop: '14px', paddingBottom: '14px', paddingLeft: '18px', paddingRight: '18px',
                    borderRadius: '16px', borderWidth: '3px', borderColor: 'rgba(80, 95, 125, 0.85)',
                    width: '100%', height: '100%'
                });
                if (rootEl.parent && rootEl.parent.SetStyles) rootEl.parent.SetStyles(clear);
                const row = async (extra) => {
                    const r = panel.CreateVisualElement(rootEl);
                    await r.Async();
                    r.SetStyles({ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', ...clear, ...extra });
                    return r;
                };
                const label = async (parent, text, styles) => {
                    const l = panel.CreateLabel(undefined, parent);
                    await l.Async();
                    l.text = text;
                    l.SetStyles({ ...clear, ...styles });
                    return l;
                };
                const button = async (parent, text, styles, onClick) => {
                    const b = panel.CreateButton(parent);
                    await b.Async();
                    if (b.parent && b.parent.SetStyles) b.parent.SetStyles({ ...clear, backgroundImage: 'none' });
                    b.text = text;
                    b.SetStyles({ color: 'white', fontWeight: 'bold', borderRadius: '8px', borderWidth: '0px', backgroundImage: 'none', ...styles });
                    b.OnClick(() => { try { onClick(); } catch (e) { console.error(opts.title + ": button error", e); } });
                    return b;
                };

                const header = await row({ marginBottom: '4px' });
                await label(header, opts.title.toUpperCase(), { color: '#f0f0f0', fontSize: '26px', fontWeight: 'bold', marginRight: '10px' });
                const status = await label(header, '', { color: '#ffcc00', fontSize: '24px', fontWeight: 'bold', textAlign: 'center', flexGrow: '1' });

                const seatsRow = await row({ marginTop: '6px', marginBottom: '6px' });
                const seatBtns = {};
                for (const side of opts.sides) {
                    seatBtns[side.id] = await button(seatsRow, '', {
                        backgroundColor: side.bg, color: side.fg, fontSize: '20px',
                        paddingTop: '10px', paddingBottom: '10px', paddingLeft: '10px', paddingRight: '10px',
                        borderWidth: '2px', borderColor: '#666666', flexGrow: '1', flexBasis: '0', marginLeft: '6px', marginRight: '6px'
                    }, () => clickSeat(side.id));
                }

                const actions = await row({});
                const small = { fontSize: '18px', paddingTop: '8px', paddingBottom: '8px', paddingLeft: '18px', paddingRight: '18px', marginRight: '10px' };
                await button(actions, "RESET", { backgroundColor: '#c62828', ...small }, clickReset);
                for (const extra of (opts.buttons || [])) await button(actions, extra.text, { backgroundColor: extra.color || '#1565c0', ...small }, extra.onClick);
                const mute = await button(actions, sounds.muted ? "UNMUTE" : "MUTE", { backgroundColor: '#37474f', ...small }, () => {
                    sounds.muted = !sounds.muted;
                    try { localStorage.setItem(MUTE_KEY, sounds.muted ? '1' : '0'); } catch (e) { }
                    update();
                });
                const noticeLabel = await label(actions, '', { color: '#ff7043', fontSize: '16px', textAlign: 'right', flexGrow: '1' });

                P.ui = { obj, status, seatBtns, mute, notice: noticeLabel };
                update();
            })().catch(e => console.warn(opts.title + ": could not build the panel", e)).finally(() => {
                P.building = null;
                if (P.culled) destroyUI(); // went out of range while it was being built
            });
            return P.building;
        }
        function destroyUI() {
            if (!P.ui) return;
            const obj = P.ui.obj;
            P.ui = null;
            try { obj.Destroy(); } catch (e) { }
        }

        // --- Switching off when far away ---
        function setCulled(culled) {
            P.culled = culled;
            if (culled) destroyUI();
            try { opts.root.SetActive(!culled); } catch (e) { console.warn(opts.title + ": could not switch the game on/off", e); }
            if (!culled) build();
        }
        function checkDistance() {
            const head = headTracker();
            const p = head.markerPos || head.posePos;
            const c = opts.centre;
            if (!p || !c) return; // position not known yet (it arrives once the player moves)
            const d = Math.hypot(p.x - c.x, p.y - c.y, p.z - c.z);
            // Off past cullDistance, on again a metre inside it, so it doesn't flicker at the edge.
            const off = P.culled ? d > config.cullDistance - 1 : d > config.cullDistance;
            if (off !== P.culled) setCulled(off);
        }

        // --- Start ---
        if (config.cullDistance > 0) setInterval(checkDistance, 1000);
        setInterval(update, 10000); // so idle and departed players show up
        scene.On("user-joined", () => update());
        // Frees the seats of a player who leaves. Only one player still here (the lowest uid) writes it.
        scene.On("user-left", e => {
            const u = e && e.detail;
            const left = u && (u.uid ?? (u.user && u.user.uid));
            const m = me();
            if (!left || !m || m.uid === String(left)) return;
            const held = opts.sides.filter(s => P.seats[s.id] && String(P.seats[s.id].uid) === String(left));
            if (held.length === 0) return update();
            const others = Object.keys(scene.users || {}).map(String).filter(x => x !== String(left));
            if (!others.includes(m.uid)) others.push(m.uid);
            if (others.sort()[0] !== m.uid) return update();
            const seats = { ...P.seats };
            for (const s of held) seats[s.id] = null;
            writeSeats(seats);
        });

        const api = { build, stamp, load, mayMove, notice, update, clickSeat, clickReset };
        // For debugging from the browser console: window.__gamePanels[key].debug()
        (window.__gamePanels = window.__gamePanels || {})[opts.key] = {
            ...api,
            debug: () => ({ culled: P.culled, seats: P.seats, lastActionTime: P.lastActionTime, turn: opts.turn(),
                ui: P.ui && { status: P.ui.status.text, notice: P.ui.notice.text, seats: Object.fromEntries(Object.entries(P.ui.seatBtns).map(([k, b]) => [k, b.text])) } })
        };
        return api;
    }

    // --- Main Initializer ---
    let initialized = false;
    const initGame = async () => {
        if (initialized) return;
        initialized = true;
        console.log("Mancala: Initializing Game...");

        // Convert config arrays to BS.Vector3 now that BS is available
        config.boardPosition = new BS.Vector3(...config.boardPosition);
        config.boardRotation = new BS.Vector3(...config.boardRotation);
        config.boardScale = new BS.Vector3(...config.boardScale);

        await setupScene();
    };

    // --- Check for BS availability ---
    if (window.BS) {
        initGame();
    } else {
        window.addEventListener("unity-loaded", initGame);
        window.addEventListener("bs-loaded", initGame);
    }

})();