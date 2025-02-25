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

function hideStartUI() {
	overlay.style.display = "none";
	gameOverImage.style.display = "none";
	gameOverAudio.pause();
	gameOverAudio.currentTime = 0;
	gameOverText.style.display = "none";
	restartGameBtn.style.display = "none";
}

startBtn.addEventListener("click", () => {
	startBtn.blur();
	startBtn.style.display = "none";
	hideStartUI();
	try {
		bgMusic.currentTime = 0;
		bgMusic.play();
	} catch (e) {
		console.warn("Audio blocked:", e);
	}

	const packet = { "action": "start" };
	ws.send(JSON.stringify(packet));
});

/* --------------------------------------------------------------------------------------------------- */
/* Rendering received game data from server                                                            */
/* --------------------------------------------------------------------------------------------------- */

function lerp(from, to, weight) {
	return from + weight * (to - from);
}

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById("gameCanvas"));
const ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext("2d"));
ctx.imageSmoothingEnabled = false;

// BG music
const bgMusic = new Audio("assets/flappyfloydsolana.wav");
bgMusic.loop = true;

// Graphics
const bgImg = new Image();
bgImg.src = "assets/background.png";
const ground = new Image();
ground.src = "assets/ground.png";
const flappyFloyd = new Image();
flappyFloyd.src = "assets/flappyfloyd.png";
const pipeTop = new Image();
pipeTop.src = "assets/pipeTop.png";
const pipeBottom = new Image();
pipeBottom.src = "assets/pipeBottom.png";

// Floyd
let floydInfos = new Map() // id : { floydAngle, isMe }

// Pipe
const defaultPipeGap = 180;

const gameState = {
	action: "setGameState",
	data: {
		pipes: [],
		bottles: [],
		score:  0,
		hearts: 5,
		fentStreak: 0,
		fentMultiplier: 0,
		currentMultiplier: 0,
		highScore: 0,
		floyd: {
			x: 50,
			y: 200,
			width: 100,
			height: 75
		}
	}
}
let floyds = [];

function updateScoreUI(score, highScore) {
	scoreText.textContent = "Score: " + score;
	highScoreText.textContent = "Highscore: " + highScore;
	topHighscoreText.textContent = "Highscore: " + highScore;
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

function updateInGameScore() {
	inGameScore.textContent = score.toString();
	if (currentMultiplier > 1) {
		let hue = (performance.now() / 10) % 360;
		inGameScore.style.color = `hsl(${hue},100%,50%)`;
		multiplierText.style.display = "block";
		multiplierText.textContent = "x" + currentMultiplier;
	}
	else {
		inGameScore.style.color = "#ffdb4d";
		multiplierText.style.display = "none";
	}
}

const BG_WIDTH = 361, BG_HEIGHT = 640;
let bgX1 = 0, bgX2 = BG_WIDTH;
let bgScrollSpeed = 0.1;
function scrollBackground(dt) {
	bgX1 -= bgScrollSpeed * dt;
	bgX2 -= bgScrollSpeed * dt;
	let dx1 = Math.floor(bgX1), dx2 = Math.floor(bgX2);
	ctx.drawImage(bgImg, dx1, 0, BG_WIDTH, BG_HEIGHT);
	ctx.drawImage(bgImg, dx2, 0, BG_WIDTH, BG_HEIGHT);
	if (dx1 <= -BG_WIDTH) bgX1 = dx2 + BG_WIDTH;
	if (dx2 <= -BG_WIDTH) bgX2 = dx1 + BG_WIDTH;
}

let groundScrollSpeed = 0.2;
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
	const state = gameState.data
	let dt = now - lastFrame
	ctx.clearRect(0, 0, canvas.width, canvas.height);

	// Draw UI
	updateScoreUI(state.score, state.highScore)
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
		if (!isNaN(floyd.velocity)) {
			info.floydAngle = Math.min(Math.max(Math.PI/2), lerp(info.floydAngle, floyd.velocity * Math.PI / 90, 0.05));
		}

		// Draw floyd
		ctx.save();
		ctx.translate(floyd.x + floyd.width / 2, floyd.y + floyd.height / 2);
		ctx.rotate(info.floydAngle);
		ctx.drawImage(flappyFloyd, -floyd.width / 2, -floyd.height / 2, floyd.width, floyd.height);
		ctx.restore();
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
	gameState.data = data;
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

const ws = new WebSocket("ws://localhost:3000");

ws.addEventListener("open", function(e) {
	console.log("Socket connected")
});

ws.addEventListener("message", function(e) {
	if (typeof e.data !== "string") {
		return;
	}
	try {
		const packet = JSON.parse(e.data)
		switch (packet.action) {
			case "updateGameState": {
				updateGameState(packet.data);
				break;
			}
			case "updateFloyds": {
				updateFloyds(packet.data);
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
