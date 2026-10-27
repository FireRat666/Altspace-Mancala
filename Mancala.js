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
        resetPosition: [0, 0, 1.5],
        resetRotation: [0, 0, 0],
        resetScale: [1, 1, 1],
        instance: window.location.href.split('?')[0],
        hideUI: false,
        turnCooldown: 5, // Seconds before the same person can move for the other side; 0 = off
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
                hideBoard: ['hide-board'],
                useCustomModels: ['use-custom-models'],
                addLights: ['add-lights'],
                useAOBaking: ['use-ao-baking'],
                boardSize: ['board-size'],
                piecesOpacity: ['pieces-opacity'],
                scoreboardPosition: ['scoreboard-position'],
                scoreboardRotation: ['scoreboard-rotation'],
                scoreboardScale: ['scoreboard-scale'],
                resetPosition: ['reset-position'],
                resetRotation: ['reset-rotation'],
                resetScale: ['reset-scale'],
                passPosition: ['pass-position'],
                passRotation: ['pass-rotation'],
                passScale: ['pass-scale']
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

        config.resetPosition = parseVector3(getParam('resetPosition'), config.resetPosition);
        config.resetRotation = parseVector3(getParam('resetRotation'), config.resetRotation);
        config.resetScale = parseVector3(getParam('resetScale'), config.resetScale);
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
        statusTexts: [],   // [facing player 1's side, facing player 2's side]
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
        // With hideUI the reset button is invisible but still clickable, with its label showing (as in Go)
        await createResetButton();

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

        state.statusTexts = await makeTwoSidedSign(labels, new BS.Vector3(0, 0.62, 0), 1.9, 0.26, 1.2);
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

    function statusFor(side) {
        const game = state.game;
        const me = side + 1;
        const mine = game.pits[me === 1 ? 6 : 13];
        const theirs = game.pits[me === 1 ? 13 : 6];
        if (game.gameOver) {
            if (game.winner === 'draw') return `Draw  ${mine} - ${theirs}`;
            return game.winner === me ? `You win!  ${mine} - ${theirs}` : `Other side wins  ${mine} - ${theirs}`;
        }
        return game.currentPlayer === me ? "Your turn" : "Other side's turn";
    }

    // Puts a text label on a button's face (same approach as Go's buttons). `w` and `h` are the
    // face size in metres; text is sized to fit it. `pos`/`rot` place the label on that face.
    async function addButtonLabel(btn, text, w, h, pos, rot) {
        const label = await new BS.GameObject("Label").Async();
        await label.SetParent(btn, false);
        const lt = await label.AddComponent(new BS.Transform());
        lt.localPosition = pos;
        lt.localEulerAngles = rot;
        await label.AddComponent(new BS.BanterText(
            text, new BS.Vector4(1, 1, 1, 1), BS.HorizontalAlignment.Center, BS.VerticalAlignment.Center,
            h * 5, false, false, new BS.Vector2(w * 10, h * 10)
        ));
    }

    async function createResetButton() {
        const btn = await new BS.GameObject("ResetButton").Async();
        await btn.SetParent(state.boardRoot, false);

        let trans = await btn.AddComponent(new BS.Transform());
        trans.localPosition = config.resetPosition;
        trans.localEulerAngles = config.resetRotation;
        trans.localScale = config.resetScale;

        await btn.AddComponent(new BS.BanterGeometry(
            BS.GeometryType.BoxGeometry, null,
            0.6, 0.15, 0.3
        ));

        const redColor = new BS.Vector4(0.8, 0.2, 0.2, config.hideUI ? 0 : 1);
        await btn.AddComponent(new BS.BanterMaterial(shaderFor(config.hideUI), "", redColor, BS.MaterialSide.Front, false));

        await btn.AddComponent(new BS.BoxCollider(true, new BS.Vector3(0, 0, 0), new BS.Vector3(0.6, 0.15, 0.3)));
        await btn.SetLayer(5);
        await addButtonLabel(btn, "RESET", 0.6, 0.3, new BS.Vector3(0, 0.080, 0), new BS.Vector3(90, 180, 0));

        btn.On('click', () => {
            console.log("Mancala: Resetting game...");
            state.game.reset();
            syncState();
        });
    }

    // --- Turn cooldown ---
    // Stops one person from taking both sides' turns by accident (a double click, or moving again
    // before the other player has had a chance). After you move, if it is now the other side's
    // turn, you must wait `turnCooldown` seconds before you can move for them. Someone playing on
    // their own can still play both sides; they just wait. Extra turns for the same side are not
    // affected. The time is only ever compared on the mover's own clock.
    const turnGuard = { lastMove: null, notice: '', noticeTimer: null };

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

    function showTurnNotice(text) {
        turnGuard.notice = text;
        clearTimeout(turnGuard.noticeTimer);
        turnGuard.noticeTimer = setTimeout(() => {
            turnGuard.notice = '';
            updateTurnBoard();
        }, 2500);
        updateTurnBoard();
    }

    function updateTurnBoard() {
        state.statusTexts.forEach((t, side) => { t.text = turnGuard.notice || statusFor(side); });
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
        BS.BanterScene.GetInstance().SetPublicSpaceProps({ [key]: JSON.stringify(data) });
        syncVisuals();
    }

    // Redraws can be requested while one is still running (our own move, then the server's
    // echo of it). Run one at a time, and redraw once more if asked mid-run, or two redraws
    // add stones to the same pit at once and the counts drift.
    let redrawing = null;
    let redrawAgain = false;
    function syncVisuals() {
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
                console.log("Mancala: Loaded existing state");
            } catch (e) {
                console.error("Failed to parse mancala state", e);
            }
        }
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
                        syncVisuals();
                    } catch (e) {
                        console.error(e);
                    }
                }
            }
        });
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
        config.resetPosition = new BS.Vector3(...config.resetPosition);
        config.resetRotation = new BS.Vector3(...config.resetRotation);
        config.resetScale = new BS.Vector3(...config.resetScale);

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