// UI
const overlay = document.getElementById("overlay");
const gameOverText = document.getElementById("gameOverText");
const startBtn = document.getElementById("startBtn");
const restartGameBtn = document.getElementById("restartGameBtn");
const gameOverImage = document.getElementById("gameOverImage");
const multiplierText = document.getElementById("multiplierText");
const stats = document.getElementById("stats");
const scoreText = document.getElementById("scoreText");
const topHighscoreText = document.getElementById("topHighscoreText");
const highScoreText = document.getElementById("highScoreText");
const gameOverAudio = /** @type {HTMLAudioElement} */ (document.getElementById("gameOverAudio"));
const hud = document.getElementById("hud");
const heartsDisplay = document.createElement("div");
const bottleImg = new Image();
bottleImg.src = "assets/bottle.png";
const heartIcon = "assets/heart.png";
heartsDisplay.id = "heartsDisplay";
hud.appendChild(heartsDisplay);

/* --------------------------------------------------------------------------------------------------- */
/* Actions sent to server                                                                              */
/* --------------------------------------------------------------------------------------------------- */

// Actions sent to server
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
	if (ws.readyState === WebSocket.OPEN) {
		predictedFloyd.jump();
		const packet = { "action": "jump", data: {  } };
		ws.send(JSON.stringify(packet));	
	}
}

/* --------------------------------------------------------------------------------------------------- */
/* Rendering received game data from server                                                            */
/* --------------------------------------------------------------------------------------------------- */

function lerp(from, to, weight) {
	return from + weight * (to - from);
}
function clamp(value, min, max) {
	return Math.min(max, Math.max(min, value));
}

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById("gameCanvas"));
const ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext("2d"));
ctx.imageSmoothingEnabled = false;

let debug = false;

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
const pipeTop = new Image();
pipeTop.src = "assets/pipetop.png";
const pipeBottom = new Image();
pipeBottom.src = "assets/pipebottom.png";

// Floyd
let floydInfos = new Map() // id : { floydAngle, isMe }
const floydAngleDamping = 6;
const floydAngleSpeed = 0.22;

// Pipe
const defaultPipeGap = 180;

// State from server
let cameraX = 0;
let cameraY = 0;
let myPlayerId = null;
let myUsername = null;
let gameState = { state: "Pending", objects: [], players: [] };
let floyds = [];

// Client side prediction
const defaultGravity = 900;
const defaultFloydSpeed = 180;
const defaultFloydLift = -420;
const defaultFloydAngleSpeed = 0.22;
const defaultFloydAngleMaxVelocity = 600;
class Floyd {
	constructor() {
		this.x = 50;
		this.y = 200;
		this.rotation = 0;
		this.velocity = { x: 0, y: 0 };
	}

	// Update client-side prediction
	update(dt) {
		// Apply gravity to the predicted velocity (y-axis)
		this.velocity.y += defaultGravity * dt;

		// Update predicted position based on velocity
		this.x += this.velocity.x * dt;
		this.y += this.velocity.y * dt;

		// Smooth rotation based on predicted vertical velocity
		const targetAngle = (this.velocity.y / defaultFloydAngleMaxVelocity) * (Math.PI / 2); // ±90° range
		this.rotation = clamp(lerp(this.rotation, targetAngle, defaultFloydAngleSpeed), -Math.PI / 2, Math.PI / 2);		
	}

	// Simulate a jump (client-side)
	jump() {
		this.velocity.y = defaultFloydLift;
	}

	// Correct the predicted position with the server's position data
	correctPrediction(serverFloyd) {
		// Correct position based on server's position
		const positionErrorX = serverFloyd.x - this.x;
		const positionErrorY = serverFloyd.y - this.y;
		const rotationError = serverFloyd.rotation - this.rotation;

		// Apply server position correction with damping
		const correctionFactor = 0.3; 
		this.x += positionErrorX * correctionFactor;
		this.y += positionErrorY * correctionFactor;
		this.rotation += rotationError * correctionFactor;

		// Correct the predicted velocity based on server velocity
		this.velocity.x = serverFloyd.velocity.x;
		this.velocity.y = serverFloyd.velocity.y;
	}
}
const predictedFloyd = new Floyd();

// Game UI
function updateScoreUI(score) {
	scoreText.textContent = "Score: " + (score || 0);
}

function updateHighScoreUI(highScore) {
	highScoreText.textContent = "Highscore: " + (highScore || 0);
	topHighscoreText.textContent = "Highscore: " + (highScore || 0);
}

function updateInGameScore(score, multiplier) {
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

function showPlusOne(amount) {
	let plusOne = document.createElement("div");
	plusOne.className = "plusOne";
	plusOne.textContent = "+" + amount;
	plusOneContainer.appendChild(plusOne);
	setTimeout(() => plusOneContainer.removeChild(plusOne), 1000);
}

function updateHeartsUI(hearts) {
	heartsDisplay.innerHTML = "";
	for (let i = 0; i < hearts; i++) {
		let im = document.createElement("img");
		im.src = heartIcon;
		im.className = "heart-img";
		heartsDisplay.appendChild(im);
	}
}

const bgWidth = 360, bgHeight = 640, bgScrollSpeed = 64.0;
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

const groundWidth = 360, groundScrollSpeed = 150, floorHeight = 56;
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

let lastFrame = performance.now()
function mainLoop() {
	const now = performance.now()
	const state = gameState
	const dt = (now - lastFrame) / 1000
	ctx.clearRect(0, 0, canvas.width, canvas.height);

	if (gameState.state !== "Started") {
		// Draw background
		scrollBackground(dt);
		// Draw ground
		scrollGround(dt);
	}
	else {
		ctx.save();

		// Debug stats
		if (debug === true) {
			stats.innerHTML = `<u>Debug stats:</u><p>FPS: ${Math.floor(1 / dt)}</p><p>Frame delta: ${dt.toPrecision(3)}</p><p>Server TPS: ${
				ticksPerSecond.toPrecision(3)}</p><p>Player ID: ${myPlayerId}</p><p>Camera X: ${cameraX.toFixed(2)}</p><p>Camera Y: ${cameraY.toFixed(2)}</p>`;
		}
		else if (stats.textContent !== "") {
			stats.textContent = "";
		}

		// Apply camera transform
		cameraX = lerp(cameraX, predictedFloyd.x, 0.3);
		cameraY = 0;
		ctx.translate(-cameraX, -cameraY);
		
		// Draw sky
		{
			const parallaxSpeed = 0.5;
			const offsetX = cameraX * parallaxSpeed;
			const chunkI = Math.floor(cameraX / bgWidth);
			const beforeChunkX = (chunkI - 1) * bgWidth;
			const chunkX = chunkI * bgWidth;
			const afterChunkX = (chunkI + 1) * bgWidth;	

			// Tends from stationary relative to camera to same speed as ground
			ctx.drawImage(bgImg, beforeChunkX + (offsetX % bgWidth), 0, bgWidth, bgHeight);
			ctx.drawImage(bgImg, chunkX + (offsetX % bgWidth), 0, bgWidth, bgHeight);
			ctx.drawImage(bgImg, afterChunkX + (offsetX % bgWidth), 0, bgWidth, bgHeight);
		}

		// Draw objects
		for (const object of state.objects) {
			switch (object.type) {
				case "Pipe": {
					ctx.drawImage(pipeTop, object.x, object.y, object.width, object.height);
					ctx.drawImage(pipeBottom, object.x, object.y + object.height + object.gap, object.width, object.height);	
					break;
				}
				case "Bottle": {
					ctx.save();
					ctx.translate(object.x + object.width / 2, object.y + object.height/2);
					ctx.rotate(object.rotation);
					ctx.drawImage(bottleImg, -object.width/2, -object.height/2, object.width, object.height);
					if (debug === true) {
						ctx.fillStyle = "#00FF0080";
						ctx.fillRect(-object.width / 2, -object.height / 2, object.width, object.height);	
					}
					ctx.restore();
					break;
				}
			}
		}

		// Draw ground
		{
			const chunkI = Math.floor(cameraX / groundWidth);
			const firstChunkX = chunkI * groundWidth;
			const secondChunkX = (chunkI + 1) * groundWidth;	
			const floorY = canvas.height - floorHeight;

			ctx.drawImage(ground, firstChunkX, floorY, 360, floorHeight);
			ctx.drawImage(ground, secondChunkX, floorY, 360, floorHeight);
		}

		// Draw floyds
		for (const player of state.players) {
			const floyd = player.floyd;
			if (!floyd) {
				continue;
			}

			// Handle updates for our own player
			let floydX = floyd.x, floydY = floyd.y, floydRotation = floyd.rotation;
			if (player.id === myPlayerId) {
				// Client-side prediction
				predictedFloyd.update(dt);
				floydX = predictedFloyd.x;
				floydY = predictedFloyd.y;
				floydRotation = predictedFloyd.rotation;

				// Draw UI
				updateHeartsUI(floyd.hearts);
				updateInGameScore(floyd.score, floyd.currentMultiplier);
				
			}

			// Draw floyd
			if (debug === true) {
				ctx.save();
				ctx.translate(floyd.x + floyd.width / 2, floyd.y + floyd.height / 2);
				ctx.rotate(floyd.rotation);
				ctx.fillStyle = "#FF000080";
				ctx.fillRect(-floyd.width / 2, -floyd.height / 2, floyd.width, floyd.height);	
				ctx.restore();
			}
			ctx.save();
			ctx.translate(floydX + floyd.width / 2, floydY + floyd.height / 2);
			ctx.rotate(floydRotation);
			if (debug === true) {
				ctx.fillStyle = "#00FF0080";
				ctx.fillRect(-floyd.width / 2, -floyd.height / 2, floyd.width, floyd.height);
			}
			ctx.drawImage(flappyFloyd, -floyd.width / 2, -floyd.height / 2, floyd.width, floyd.height);
			ctx.restore();

			// Draw username
			ctx.save();
			ctx.textAlign = "center";
			ctx.fillStyle = "black";
			ctx.fillText(player.username, floydX + floyd.width / 2 + 1, floydY + 1);
			ctx.fillStyle = player.id === myPlayerId ? "yellow" : "white";
			ctx.fillText(player.username, floydX + floyd.width / 2, floydY);
			ctx.restore()			
		}

		ctx.restore();
	}

	requestAnimationFrame(mainLoop);
	lastFrame = now
}
requestAnimationFrame(mainLoop);

function updateFloyds(data) {
	floyds = data;
	for (const floyd of floyds) {
		if (!floydInfos.get(floyd.id)) {
			// Make an info
			floydInfos.set(floyd.id, {
				floydAngle: 20,
				isMe: false
			});
		}
	}
}

startBtn.addEventListener("click", () => {
	const packet = { "action": "joinSession", data: {} };
	ws.send(JSON.stringify(packet));
	overlay.dataset.page = "loading";
});

function serverInfo(data) {
	ticksPerSecond = data.ticksPerSecond
	myPlayerId = data.playerId
	myUsername = data.username
}

function sessionJoin(data) {
	overlay.dataset.page = "lobby";
}

let sessionStateInterval = -1;
function sessionState(data) {
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
}

function gameStart(data) {
	overlay.dataset.page = "game";
	gameContainer.style.width = data.worldWidth + "px";
	gameContainer.style.height = data.worldHeight + "px";
	canvas.width = data.worldWidth;
	canvas.height = data.worldHeight;
	bgMusic.play();
}

function updateGameState(data) {
	gameState = data;
	
	for (const player of gameState.players) {
		if (player.id == myPlayerId && player.floyd) {
			serverFloyd = player.floyd;
			predictedFloyd.correctPrediction(serverFloyd);
		}
	}

}

function scoreIncrement(data) {
	showPlusOne(data.gained);
	updateScoreUI(data.score);
}

/* --------------------------------------------------------------------------------------------------- */
/* Websocket connection                                                                                */
/* --------------------------------------------------------------------------------------------------- */

const ws = new WebSocket("ws://localhost:3000");

ws.addEventListener("open", function(e) {
	console.log("Socket connected")
});

ws.addEventListener("message", function(e) {
	if (typeof e.data !== "string") {
		return;
	}
	try {
		const packet = JSON.parse(e.data);
		const data = packet.data;
		switch (packet.action) {
			case "serverInfo": {
				serverInfo(data);
				break;
			}
			case "sessionJoin": {
				sessionJoin(data);
				break
			}
			case "sessionState": {
				sessionState(data);
				break;
			}
			case "gameStart": {
				gameStart(data);
				break;
			}
			case "gameState": {
				updateGameState(data);
				break;
			}
			case "scoreIncrement": {
				scoreIncrement(data);
				break;
			}
		}
	}
	catch(e) {
		console.error(e)
	}
});

ws.addEventListener("error", function(e) {
	console.error("Websocket error", e);
});

ws.addEventListener("close", function(e) {
	console.error("Websocket closed", e);
});
