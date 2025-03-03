// UI
const overlay = document.getElementById("overlay");
const gameOverText = document.getElementById("gameOverText");
const startBtn = document.getElementById("startBtn");
const restartGameBtn = document.getElementById("restartGameBtn");
const gameOverImage = document.getElementById("gameOverImage");
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
	const packet = { "action": "jump" };
	ws.send(JSON.stringify(packet));
}

/* --------------------------------------------------------------------------------------------------- */
/* Rendering received game data from server                                                            */
/* --------------------------------------------------------------------------------------------------- */

function lerp(from, to, weight) {
	return from + weight * (to - from);
}
function clamp(value, min, max) {
	return Math.min(max, Math.max(min, value));c
}

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById("gameCanvas"));
const ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext("2d"));
ctx.imageSmoothingEnabled = false;

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

const gameState = {
}
let floyds = [];

function updateScoreUI(score, highScore) {
	scoreText.textContent = "Score: " + score;
	highScoreText.textContent = "Highscore: " + highScore;
	topHighscoreText.textContent = "Highscore: " + highScore;
}

function updateInGameScore(score, multiplier) {
	inGameScore.textContent = score.toString();
	if (multiplier > 1) {
		let hue = (performance.now() / 10) % 360;
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
	plusOne.textContent = amount;
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

const bgWidth = 361, bgHeight = 640;
let bgX1 = 0, bgX2 = bgWidth;
let bgScrollSpeed = 64.0;
function scrollBackground(dt) {
	bgX1 -= bgScrollSpeed * dt;
	bgX2 -= bgScrollSpeed * dt;
	let dx1 = Math.floor(bgX1), dx2 = Math.floor(bgX2);
	ctx.drawImage(bgImg, dx1, 0, bgWidth, bgHeight);
	ctx.drawImage(bgImg, dx2, 0, bgWidth, bgHeight);
	if (dx1 <= -bgWidth) bgX1 = dx2 + bgWidth;
	if (dx2 <= -bgWidth) bgX2 = dx1 + bgWidth;
}

let groundScrollSpeed = 128.0;
let groundX1 = 0, groundX2 = 360;
let floorHeight = 56;
function scrollGround(dt) {
	groundX1 -= groundScrollSpeed * dt;
	groundX2 -= groundScrollSpeed * dt;
	let gx1 = Math.floor(groundX1), gx2 = Math.floor(groundX2);
	let floorY = canvas.height - floorHeight;
	ctx.drawImage(ground, gx1, floorY, 360, floorHeight);
	ctx.drawImage(ground, gx2, floorY, 360, floorHeight);
	if (gx1 <= -360) groundX1 = gx2 + 360;
	if (gx2 <= -360) groundX2 = gx1 + 360;
}

let lastFrame = Date.now()
function mainLoop() {
	const now = Date.now()
	const state = gameState
	let dt = (now - lastFrame) / 1000
	ctx.clearRect(0, 0, canvas.width, canvas.height);

	// Draw UI
	updateScoreUI(state.score, state.highScore)
	updateInGameScore(state.score, state.currentMultiplier)
	updateHeartsUI(state.hearts)

	// Draw background
	scrollBackground(dt);

	// Draw pipes
	for (const pipe of state.pipes) {
		let offset = pipe.height + defaultPipeGap;
		let bottomY = pipe.y + offset;

		ctx.drawImage(pipeTop, pipe.x, pipe.y, pipe.width, pipe.height);
		ctx.drawImage(pipeBottom, pipe.x, bottomY, pipe.width, pipe.height);	
	}
	
	// Draw fent
	for (const fent of state.bottles) {
		ctx.drawImage(bottleImg, fent.x, fent.y, fent.width, fent.height);
	}

	// Draw ground
	scrollGround(dt);

	// Draw other floyds
	for (const floyd of floyds) {
		const info = floydInfos.get(floyd.id)

		// Client side prediction / interoplation
		if (!isNaN(floyd.velocity)) {
			floyd.y += floyd.velocity * dt;
		}

		// Floyd angle
		if (!isNaN(floyd.velocity)) {
			const targetAngle = floyd.velocity * (Math.PI / 90) / floydAngleDamping;
			info.floydAngle = clamp(lerp(info.floydAngle, targetAngle, floydAngleSpeed), -Math.PI / 2, Math.PI / 2);
		}

		// Draw floyd
		ctx.save();
		ctx.translate(floyd.x + floyd.width / 2, floyd.y + floyd.height / 2);
		ctx.rotate(info.floydAngle);
		ctx.drawImage(flappyFloyd, -floyd.width / 2, -floyd.height / 2, floyd.width, floyd.height);
		ctx.restore();

		// Draw username
		ctx.save()
		ctx.textAlign = "center"
		ctx.fillStyle = "yellow"
		ctx.fillText(floyd.username, floyd.x, floyd.y);
		ctx.restore()
	}
	
	requestAnimationFrame(mainLoop);
	lastFrame = now
}

requestAnimationFrame(mainLoop);

function updateGameState(data) {
	gameState = data;
}

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
	const packet = { "action": "joinGame" };
	ws.send(JSON.stringify(packet));
	overlay.dataset.page = "loading";
});

function sessionJoin(data) {
	overlay.dataset.page = "lobby";
	console.log(data)

	lobbyPlayers.innerHTML = "";
	for (const player of data.players) {
		let li = document.createElement("li");
		li.textContent = player.username;
		lobbyPlayers.appendChild(li);
	}
}

function gameStart(data) {
	overlay.dataset.page = "game";
	canvas.width = data.worldWidth;
	canvas.height = data.worldHeight;
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
			case "sessionJoin": {
				sessionJoin(data);
				break;
			}
			case "gameStart": {
				gameStart(data);
				break;
			}
			case "updateGameState": {
				updateGameState(data);
				break;
			}
			case "updateFloyds": {
				updateFloyds(data);
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
