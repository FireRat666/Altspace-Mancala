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
        hideBoard: false,
        useCustomModels: false,
        lighting: 'unlit',
        addLights: true
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
        config.hideBoard = getParam('hideBoard', String(config.hideBoard)) === 'true';
        config.instance = getParam('instance', config.instance);
        config.useCustomModels = getParam('useCustomModels', String(config.useCustomModels)) === 'true';
        config.lighting = getParam('lighting', config.lighting);
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
        board: '#8B4513',      // Saddle brown (wood)
        pit: '#654321',        // Dark brown
        store: '#4A3520',      // Darker brown for stores
        stoneP1: '#E8DCC4',    // Light beige stones
        stoneP2: '#2F2F2F',    // Dark grey stones  
        highlight: '#76F250',  // Green highlight for valid moves
        inactive: '#888888'    // Grey for opponent's pits
    };

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
        game: new MancalaGame()
    };

    // Layout constants
    const LAYOUT = {
        pitRadius: 0.2,
        pitDepth: 0.15,
        storeRadius: 0.25,
        storeDepth: 0.2,
        pitSpacing: 0.5,
        rowSpacing: 0.6,
        stoneRadius: 0.05
    };

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

        // Create reset button
        if (!config.hideUI) {
            await createResetButton();
        }

        // Setup sync listeners
        setupListeners();

        // Check for existing state
        await checkForExistingState();

        // Initial visual sync
        await syncVisuals();

        console.log("Mancala: Setup Scene Complete");
    }

    async function createBoardBase() {
        const boardWidth = LAYOUT.pitSpacing * 7 + LAYOUT.storeRadius * 2;
        const boardDepth = LAYOUT.rowSpacing + LAYOUT.pitRadius * 2 + 0.2;

        const base = await new BS.GameObject("BoardBase").Async();
        await base.SetParent(state.boardRoot, false);
        let bt = await base.AddComponent(new BS.Transform());
        bt.localPosition = new BS.Vector3(0, -0.05, 0);

        const shader = config.lighting === 'lit' ? "Standard" : "Unlit/Diffuse";
        const color = hexToVector4(COLORS.board, config.hideBoard ? 0 : 1);

        await base.AddComponent(new BS.BanterGeometry(
            BS.GeometryType.BoxGeometry, null,
            boardWidth, 0.1, boardDepth
        ));
        await base.AddComponent(new BS.BanterMaterial(
            config.hideBoard ? "Unlit/DiffuseTransparent" : shader,
            "", color, BS.MaterialSide.Front, false
        ));
    }

    async function createPitsAndStores() {
        // Player 1's pits (bottom row, left to right): indices 0-5
        for (let i = 0; i < 6; i++) {
            const x = (i - 2.5) * LAYOUT.pitSpacing;
            const z = LAYOUT.rowSpacing / 2;
            const pit = await createPit(i, new BS.Vector3(x, 0, z), false);
            state.pitObjects[i] = pit;
        }

        // Player 1's store (right side): index 6
        const store1 = await createPit(6, new BS.Vector3(3 * LAYOUT.pitSpacing, 0, 0), true);
        state.pitObjects[6] = store1;

        // Player 2's pits (top row, left to right visually = indices 12 down to 7)
        // Index 7 is rightmost from P2's view, which is left from the shared view
        for (let i = 0; i < 6; i++) {
            const pitIndex = 7 + i;
            const x = (2.5 - i) * LAYOUT.pitSpacing; // Reverse order for top row
            const z = -LAYOUT.rowSpacing / 2;
            const pit = await createPit(pitIndex, new BS.Vector3(x, 0, z), false);
            state.pitObjects[pitIndex] = pit;
        }

        // Player 2's store (left side): index 13
        const store2 = await createPit(13, new BS.Vector3(-3 * LAYOUT.pitSpacing, 0, 0), true);
        state.pitObjects[13] = store2;
    }

    async function createPit(index, position, isStore) {
        const pit = await new BS.GameObject(`Pit_${index}`).Async();
        await pit.SetParent(state.pitsRoot, false);

        let pt = await pit.AddComponent(new BS.Transform());
        pt.localPosition = position;

        const radius = isStore ? LAYOUT.storeRadius : LAYOUT.pitRadius;
        const depth = isStore ? LAYOUT.storeDepth : LAYOUT.pitDepth;
        const colorHex = isStore ? COLORS.store : COLORS.pit;

        const shader = config.lighting === 'lit' ? "Standard" : "Unlit/Diffuse";
        let color = hexToVector4(colorHex);

        if (config.hideBoard) {
            color.w = 0.3;
        }

        if (config.useCustomModels) {
            const modelName = isStore ? PIECE_MODELS.store : PIECE_MODELS.pit;
            const url = getModelUrl(modelName);
            await pit.AddComponent(new BS.BanterGLTF(url, false, false, false, false, false, false));
            pt.localScale = new BS.Vector3(radius * 2, depth, radius * 2);
        } else {
            // Create cylinder for pit
            await pit.AddComponent(new BS.BanterGeometry(
                BS.GeometryType.CylinderGeometry, null,
                1, depth, 1, 1, 1, 1,
                radius, 24, 0, 6.283185, 0, 6.283185, 8, false,
                radius, radius
            ));
        }

        // Pit/store needs unique material for dynamic highlighting
        await pit.AddComponent(new BS.BanterMaterial(
            config.hideBoard ? "Unlit/DiffuseTransparent" : shader,
            "", color, BS.MaterialSide.Front, false, `pit_${index}`
        ));

        // Add collider for clicks (only on playable pits, not stores)
        if (!isStore) {
            await pit.AddComponent(new BS.BoxCollider(
                true,
                new BS.Vector3(0, 0, 0),
                new BS.Vector3(radius * 2, depth + 0.1, radius * 2)
            ));
            await pit.SetLayer(5);

            pit.On('click', () => handlePitClick(index));
        }

        // Initialize stone array for this pit
        state.stoneObjects[index] = [];

        return pit;
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

        const redColor = new BS.Vector4(0.8, 0.2, 0.2, 1);
        await btn.AddComponent(new BS.BanterMaterial("Unlit/Diffuse", "", redColor, BS.MaterialSide.Front, false));

        await btn.AddComponent(new BS.BoxCollider(true, new BS.Vector3(0, 0, 0), new BS.Vector3(0.6, 0.15, 0.3)));
        await btn.SetLayer(5);

        btn.On('click', () => {
            console.log("Mancala: Resetting game...");
            state.game.reset();
            syncState();
        });
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

        console.log(`Mancala: Player ${state.game.currentPlayer} clicked pit ${pitIndex}`);

        if (state.game.makeMove(pitIndex)) {
            syncState();
        }
    }

    function syncState() {
        const key = `mancala_game_${config.instance}`;
        const data = state.game.getState();
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

        // Update stones in each pit
        for (let i = 0; i < 14; i++) {
            const stoneCount = game.pits[i];
            await updatePitStones(i, stoneCount);

            // Update pit highlighting (only for playable pits)
            if (i !== 6 && i !== 13) {
                const pitObj = state.pitObjects[i];
                if (pitObj) {
                    const mat = pitObj.GetComponent(materialType());
                    if (mat) {
                        const isOwnPit = game.isOwnPit(game.currentPlayer, i);
                        const hasStones = game.pits[i] > 0;
                        const isValid = !game.gameOver && isOwnPit && hasStones;

                        let colorHex = COLORS.pit;
                        if (isValid) {
                            colorHex = COLORS.highlight;
                        } else if (!isOwnPit) {
                            colorHex = COLORS.inactive;
                        }

                        const color = hexToVector4(colorHex, config.hideBoard ? 0.3 : 1.0);
                        mat.color = color;
                    }
                }
            }
        }
    }

    async function updatePitStones(pitIndex, targetCount) {
        const currentStones = state.stoneObjects[pitIndex];
        const currentCount = currentStones.length;

        // Remove excess stones
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
        const pitObj = state.pitObjects[pitIndex];
        if (!pitObj) return null;

        const pitTrans = pitObj.GetComponent(BS.ComponentType.Transform);
        const pitPos = pitTrans.localPosition;

        const stone = await new BS.GameObject(`Stone_${pitIndex}_${stoneIndex}`).Async();
        await stone.SetParent(state.stonesRoot, false);

        let st = await stone.AddComponent(new BS.Transform());

        // Arrange stones in a nice pattern within the pit
        const isStore = pitIndex === 6 || pitIndex === 13;
        const pitRadius = isStore ? LAYOUT.storeRadius : LAYOUT.pitRadius;
        const maxPerRing = isStore ? 8 : 5;

        // Calculate position within pit
        const ring = Math.floor(stoneIndex / maxPerRing);
        const indexInRing = stoneIndex % maxPerRing;
        const ringRadius = (ring + 1) * LAYOUT.stoneRadius * 2.5;
        const angle = (indexInRing / maxPerRing) * Math.PI * 2 + ring * 0.5;

        const offsetX = Math.cos(angle) * Math.min(ringRadius, pitRadius - LAYOUT.stoneRadius);
        const offsetZ = Math.sin(angle) * Math.min(ringRadius, pitRadius - LAYOUT.stoneRadius);
        const offsetY = LAYOUT.pitDepth / 2 + LAYOUT.stoneRadius + ring * LAYOUT.stoneRadius * 1.5;

        st.localPosition = new BS.Vector3(
            pitPos.x + offsetX,
            offsetY,
            pitPos.z + offsetZ
        );

        st.localScale = new BS.Vector3(1, 1, 1);

        // Determine stone color based on which side of the board
        const isP1Side = pitIndex <= 6;
        const colorHex = isP1Side ? COLORS.stoneP1 : COLORS.stoneP2;
        const color = hexToVector4(colorHex);
        const shader = config.lighting === 'lit' ? "Standard" : "Unlit/Diffuse";

        if (config.useCustomModels) {
            const url = getModelUrl(PIECE_MODELS.stone);
            await stone.AddComponent(new BS.BanterGLTF(url, false, false, false, false, false, false));
            st.localScale = new BS.Vector3(LAYOUT.stoneRadius * 2, LAYOUT.stoneRadius * 2, LAYOUT.stoneRadius * 2);
        } else {
            await stone.AddComponent(new BS.BanterGeometry(
                BS.GeometryType.SphereGeometry, null,
                1, 1, 1, 24, 16, 1,
                LAYOUT.stoneRadius, 24, 0, 6.283185, 0, 6.283185, 8, false,
                LAYOUT.stoneRadius, LAYOUT.stoneRadius
            ));
        }

        // Stones need unique material instance
        await stone.AddComponent(new BS.BanterMaterial(shader, "", color, BS.MaterialSide.Front, false, `stone_${pitIndex}_${stoneIndex}`));

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