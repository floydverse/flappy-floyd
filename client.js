import { Floyd } from "./game-objects.js";
import { Game } from "./game.js";

// UI
const overlay = document.getElementById("overlay");
const startBtn = document.getElementById("startBtn");
const multiplierText = document.getElementById("multiplierText");
const scoreText = document.getElementById("scoreText");
const topHighscoreText = document.getElementById("topHighscoreText");
const highScoreText = document.getElementById("highScoreText");
const hud = document.getElementById("hud");
const heartsDisplay = document.createElement("div");
heartsDisplay.id = "heartsDisplay";
hud.appendChild(heartsDisplay);
const heartIcon = "assets/heart.png";
const lobbyPlayersLabel = document.getElementById("lobbyPlayersLabel");
const lobbyPlayers = document.getElementById("lobbyPlayers");
const gameContainer = document.getElementById("gameContainer");
const lobbyStartingMessage = document.getElementById("lobbyStartingMessage");
const gameOverText = document.getElementById("gameOverText");
const restartGameBtn = document.getElementById("restartGameBtn");
const gameOverImage = document.getElementById("gameOverImage");
const gameOverAudio = /** @type {HTMLAudioElement} */ (document.getElementById("gameOverAudio"));

/* --------------------------------------------------------------------------------------------------- */
/* Actions sent to server                                                                              */
/* --------------------------------------------------------------------------------------------------- */

document.addEventListener("keydown", (e) => {
	if ("value" in document.activeElement) {
		return;
	}
	if (["Space", "ArrowUp", "KeyW"].includes(e.code)) {
		jump();
		e.preventDefault();
	}
	if (e.code == "F3") {
		debug = !debug
		e.preventDefault();
	}
	if (e.code === "Escape") {
		if (gameState === "running") {
			toggleGamePause();
		}
		e.preventDefault();
	}
});
document.addEventListener("mousedown", () => {
	jump();
	pauseBtn.blur();
	muteBtn.blur();
});
document.addEventListener("touchstart", () => {
	jump();
});


function jump() {
	game.floyds
	if (ws?.readyState === WebSocket.OPEN) {
		game.clientFloyd.jump();
		game.clientFloyd.image = flappyFloydFlapping;
		const packet = { "action": "jump", data: {  } };
		ws.send(JSON.stringify(packet));
	}
}

startBtn.addEventListener("click", async () => {
	try {
		await connectWebSocket();
		const packet = { action: "joinSession", data: {} };
		ws.send(JSON.stringify(packet));
		overlay.dataset.page = "loading";
	}
	catch (err) {
		console.error("Failed to connect to WebSocket:", err);
	}
});


/* --------------------------------------------------------------------------------------------------- */
/* Rendering & game state management                                                                   */
/* --------------------------------------------------------------------------------------------------- */

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById("gameCanvas"));
const ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext("2d"));
ctx.imageSmoothingEnabled = false;
export let debug = false;

// BG music
const bgMusic = new Audio("assets/flappyfloydonsolana.mp3");
bgMusic.loop = true;

// Graphics
const bgImg = new Image();
bgImg.src = "assets/background.png";
const ground = new Image();
ground.src = "assets/ground.png";
const flappyFloyd = new Image();
flappyFloyd.src = "assets/flappyfloyd.png";
const flappyFloydFlapping = new Image();
flappyFloydFlapping.src = "assets/flappyfloydflapping.png";
const pipeTop = new Image();
pipeTop.src = "assets/pipetop.png";
const pipeBottom = new Image();
pipeBottom.src = "assets/pipebottom.png";


// Game UI
export function updateScoreUI(score) {
	scoreText.textContent = "Score: " + (score || 0);
}

export function updateHighScoreUI(highScore) {
	highScoreText.textContent = "Highscore: " + (highScore || 0);
	topHighscoreText.textContent = "Highscore: " + (highScore || 0);
}

export function updateInGameScore(score, multiplier) {
	inGameScore.textContent = (score || 0).toString();
	if (multiplier > 1) {
		const hue = (performance.now() / 10) % 360;
		inGameScore.style.color = `hsl(${hue},100%,50%)`;
		multiplierText.style.display = "block";
		multiplierText.textContent = "x" + multiplier;
	}
	else {
		inGameScore.style.color = "#ffdb4d";
		multiplierText.style.display = "none";
	}
}

export function showPlusOne(amount) {
	let plusOne = document.createElement("div");
	plusOne.className = "plusOne";
	plusOne.textContent = "+" + amount;
	plusOneContainer.appendChild(plusOne);
	setTimeout(() => plusOneContainer.removeChild(plusOne), 1000);
}

export function updateHeartsUI(hearts) {
	heartsDisplay.innerHTML = "";
	for (let i = 0; i < hearts; i++) {
		let im = document.createElement("img");
		im.src = heartIcon;
		im.className = "heart-img";
		heartsDisplay.appendChild(im);
	}
}

export const bgWidth = 360, bgHeight = 640, bgScrollSpeed = 64.0;
let bgX1 = 0, bgX2 = bgWidth;
function scrollBackground(dt) {
	bgX1 -= bgScrollSpeed * dt;
	bgX2 -= bgScrollSpeed * dt;
	let dx1 = Math.floor(bgX1), dx2 = Math.floor(bgX2);
	ctx.drawImage(bgImg, dx1, 0, bgWidth, bgHeight);
	ctx.drawImage(bgImg, dx2, 0, bgWidth, bgHeight);
	if (dx1 <= -bgWidth) bgX1 = dx2 + bgWidth;
	if (dx2 <= -bgWidth) bgX2 = dx1 + bgWidth;
}

export const groundWidth = 360, groundScrollSpeed = 150, floorHeight = 56;
let groundX1 = 0, groundX2 = groundWidth;
function scrollGround(dt) {
	groundX1 -= groundScrollSpeed * dt;
	groundX2 -= groundScrollSpeed * dt;
	let gx1 = Math.floor(groundX1), gx2 = Math.floor(groundX2);
	let floorY = canvas.height - floorHeight;
	ctx.drawImage(ground, gx1, floorY, groundWidth, floorHeight);
	ctx.drawImage(ground, gx2, floorY, groundWidth, floorHeight);
	if (gx1 <= -groundWidth) groundX1 = gx2 + groundWidth;
	if (gx2 <= -groundWidth) groundX2 = gx1 + groundWidth;
}

const gameStates = {
	Pending: "Pending",
	Started: "Started"
}

let gameState = gameStates.Pending;
const game = new Game();

let lastFrame = performance.now();
function mainLoop() {
	const now = performance.now()
	const dt = (now - lastFrame) / 1000
	ctx.clearRect(0, 0, canvas.width, canvas.height);

	if (gameState !== gameStates.Started) {
		// Draw background
		scrollBackground(dt);
		// Draw ground
		scrollGround(dt);
	}
	else {
		game.draw();
	}

	requestAnimationFrame(mainLoop);
	lastFrame = now
}
requestAnimationFrame(mainLoop);


/* --------------------------------------------------------------------------------------------------- */
/* Packet handling                                                                                     */
/* --------------------------------------------------------------------------------------------------- */
export class Player {
	/**@type {string}*/id;
	/**@type {string}*/username;
	/**@type {Floyd|null}*/floyd;

	/**
	 * @param {string} id
	 * @param {string} username
	 */
	constructor(id, username) {
		this.id = id;
		this.username = username;
		this.floyd = null;
	}
}
export let player = null;
export let ticksPerSecond = 0;

// @ts-ignore
let sessionStateInterval = -1;
export let packetHandlers = {
	serverInfo(data) {
		ticksPerSecond = data.ticksPerSecond
	},
	playerInfo(data) {
		player = new Player(data.playerId, data.username);
	},
	sessionJoin(data) {
		overlay.dataset.page = "lobby";
	},
	sessionState(data) {
		lobbyPlayersLabel.textContent = `Players (${data.players.length}/${data.capacity}):`;
		lobbyPlayers.innerHTML = "";
		for (const player of data.players) {
			let li = document.createElement("li");
			li.textContent = player.username;
			lobbyPlayers.appendChild(li);
		}
	
		if (sessionStateInterval > 0) {
			clearInterval(sessionStateInterval);
		}
		// @ts-ignore
		sessionStateInterval = setInterval(() => {
			const now = Date.now();
			const remaining = data.timeout - now;
			if (remaining <= 0) {
				clearInterval(sessionStateInterval);
				return;
			}
			lobbyStartingMessage.textContent = data.players.length >= data.minimumPlayers
				? `Game auto-starting in ${(Math.round(remaining / 100) / 10)} seconds`
				: `Waiting for players...`;
		}, 100);
	},
	gameStart(data) {
		overlay.dataset.page = "game";
		gameContainer.style.width = data.worldWidth + "px";
		gameContainer.style.height = data.worldHeight + "px";
		canvas.width = data.worldWidth;
		canvas.height = data.worldHeight;
		bgMusic.play();	
	},
	gameState(data) {
		gameState = data;
	},
	scoreIncrement(data) {
		showPlusOne(data.gained);
		updateScoreUI(data.score);	
	}
};

/* --------------------------------------------------------------------------------------------------- */
/* Websocket connection                                                                                */
/* --------------------------------------------------------------------------------------------------- */

let ws = null;
const maxRetries = 5;
let retryCount = 0;

function connectWebSocket() {
	return new Promise((resolve, reject) => {
		if (ws && ws.readyState === WebSocket.OPEN) {
			return resolve(ws);
		}

		ws = new WebSocket("ws://localhost:3000");

		ws.addEventListener("open", () => {
			console.log("Connected to WebSocket");
			retryCount = 0;
			resolve(ws);
		});

		ws.addEventListener("message", function(e) {
			if (typeof e.data !== "string") {
				return;
			}
			try {
				const packet = JSON.parse(e.data);
				if (packetHandlers[packet.action]) {
					packetHandlers[packet.action](packet.data);
				}
			}
			catch(e) {
				console.error(e)
			}
		});

		ws.addEventListener("close", () => {
			console.log("WebSocket closed");

			// Exponential backoff
			if (retryCount < maxRetries) {
				retryCount++;
				setTimeout(() => {
					connectWebSocket().then(resolve).catch(reject);
				}, 1000 * retryCount); 
			}
			else {
				reject(new Error("Max retries reached, giving up."));
			}
		});

		ws.addEventListener("error", (err) => {
			console.error("WebSocket error:", err);
			// Ensure socket is closed before retrying
			ws.close(); 
		});
	});
}
