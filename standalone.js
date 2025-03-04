////////////////////////////////////////////
// script.js - Single overlay + localStorage offline user Fent
// and re-play BG music after "Restart"
////////////////////////////////////////////

////////////////////////////
// 1) Firebase init v8
////////////////////////////
const firebaseConfig = {
	apiKey: "AIzaSyB...",
	authDomain: "flappyfloyd-cd39e.firebaseapp.com",
	databaseURL: "https://flappyfloyd-cd39e-default-rtdb.firebaseio.com",
	projectId: "flappyfloyd-cd39e",
	storageBucket: "flappyfloyd-cd39e.appspot.com",
	messagingSenderId: "615218680466",
	appId: "1:615218680466:web:aa757395bc4c30ebc68c4b",
	measurementId: "G-YJYT90MKRB"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

////////////////////////////
// 2) incrementGlobalFent => bridging function
////////////////////////////
function incrementGlobalFent() {
	console.log("incrementGlobalFent() => reading 'globalFentCollected'...");

	db.ref("globalFentCollected").once("value")
		.then(snap => {
			let oldVal = snap.val() || 0;
			console.log("oldVal from globalFentCollected =", oldVal);
			let newVal = oldVal + 1;
			console.log("Setting newVal =", newVal);
			return db.ref("globalFentCollected").set(newVal);
		})
		.then(() => {
			console.log("Success updating globalFentCollected => check DB for increment!");
		})
		.catch(err => {
			console.error("Global Fent update error:", err);
		});
}

////////////////////////////
// 3) displayLeaderboard => orderByChild("score")
////////////////////////////
function displayLeaderboard(containerId) {
	const container = document.getElementById(containerId);
	if (!container) return;

	container.innerHTML = "";

	const wrapper = document.createElement("div");
	wrapper.style = `
		font-family: Arial, sans-serif;
		background-color: #121212;
		color: #fff;
		margin: 0 auto;
		padding: 20px;
		border: 1px solid #333;
		border-radius: 5px;
		box-shadow: 0 4px 10px rgba(0,0,0,0.3);
		width: 100%;
		max-width: 400px;
	`;

	const title = document.createElement("h3");
	title.textContent = "Leaderboard";
	title.style.color = "#ff6347";
	title.style.textAlign = "center";

	const list = document.createElement("ul");
	list.style.listStyle = "none";
	list.style.padding = "0";
	list.style.margin = "10px 0";

	wrapper.appendChild(title);
	wrapper.appendChild(list);
	container.appendChild(wrapper);

	// fetch top 10 => by "score"
	db.ref("leaderboard")
		.orderByChild("score")
		.limitToLast(10)
		.once("value", (snapshot) => {
			list.innerHTML = "";
			snapshot.forEach(child => {
				let li = document.createElement("li");
				li.style.padding = "5px";
				li.style.borderBottom = "1px solid #333";

				// child.key => typedName
				// child.val().score => numeric score
				li.textContent = `${child.key}: ${child.val().score}`;
				// prepend => highest on top
				list.prepend(li);
			});
		});
}


////////////////////////////
// 4) Main Game Logic
////////////////////////////

let lastTime = 0;
function getDeltaFactor(currentTime) {
	const msPerFrame = 16.6667;
	let dt = (currentTime - lastTime) / msPerFrame;
	lastTime = currentTime;
	if (dt > 0.5) dt = 0.5;
	if (dt < 0) dt = 0;
	return dt;
}

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById("gameCanvas"));
const ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext("2d"));
ctx.imageSmoothingEnabled = false;

// Bird
const flappyFloyd = new Image();
flappyFloyd.src = "assets/flappyfloyd.png";
const defaultGravity = 2;
let floydWidth = 100, floydHeight = 75;
let floydAngle = 20, floydX = 50, floydY = 200, velocity = 0;
let gravity = defaultGravity;
let lift = -15;

// phone => faster
const isMobile = /Mobi|Android|iPhone|iPad|iPod|webOS/i.test(navigator.userAgent);
let mobilePipeSpeedMultiplier = isMobile ? 2.0 : 1.0;
let mobileGravityMultiplier = isMobile ? 2.0 : 1.0;

function lerp(from, to, weight) {
	return from + weight * (to - from)
}

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

// BG
const BG_WIDTH = 361, BG_HEIGHT = 640;
const bgImg = new Image();
bgImg.src = "assets/background.png";
let bgX1 = 0, bgX2 = BG_WIDTH;
let bgScrollSpeed = 0.5;
function scrollBackground(dt) {
	if (!gamePaused) {
		bgX1 -= bgScrollSpeed * dt;
		bgX2 -= bgScrollSpeed * dt;
	}
	let dx1 = Math.floor(bgX1), dx2 = Math.floor(bgX2);
	ctx.drawImage(bgImg, dx1, 0, BG_WIDTH, BG_HEIGHT);
	ctx.drawImage(bgImg, dx2, 0, BG_WIDTH, BG_HEIGHT);
	if (dx1 <= -BG_WIDTH) bgX1 = dx2 + BG_WIDTH;
	if (dx2 <= -BG_WIDTH) bgX2 = dx1 + BG_WIDTH;
}

// GROUND
const ground = new Image();
ground.src = "assets/ground.png";
let groundScrollSpeed = 5;
let groundX1 = 0, groundX2 = 360;
let floorHeight = 56;
function scrollGround(dt) {
	if (!gamePaused) {
		groundX1 -= groundScrollSpeed * dt;
		groundX2 -= groundScrollSpeed * dt;
	}
	let gx1 = Math.floor(groundX1), gx2 = Math.floor(groundX2);
	let floorY = canvas.height - floorHeight;
	ctx.drawImage(ground, gx1, floorY, 360, floorHeight);
	ctx.drawImage(ground, gx2, floorY, 360, floorHeight);
	if (gx1 <= -360) groundX1 = gx2 + 360;
	if (gx2 <= -360) groundX2 = gx1 + 360;
}

// PIPES
const pipeTop = new Image();
pipeTop.src = "assets/pipetop.png";
const pipeBottom = new Image();
pipeBottom.src = "assets/pipebottom.png";
const defaultPipeWidth = 150
const defaultPipeHeight = 390;
const defaultPipeSpeed = 7;
const defaultPipeGap = 180;
let pipeSpeed = defaultPipeSpeed * mobilePipeSpeedMultiplier;
let pipes = [];
function randomPipeY() {
	return Math.floor(Math.random() * 231) - 240;
}

// BOTTLES (Fent)
const bottleImg = new Image();
bottleImg.src = "assets/bottle.png";
const heartIcon = "assets/heart.png";
let bottles = [];
let bottleChance = 0.6;
let bottleCount = 0;
let bottlesNeededForHeart = 5;
const defaultHearts = 5;
let hearts = defaultHearts
let maxHearts = 5;

// MULTIPLIER
let fentStreak = 0;
let currentMultiplier = 1;
function isColliding(r1, r2) {
	return (
		r1.x < r2.x + r2.width &&
		r1.x + r1.width > r2.x &&
		r1.y < r2.y + r2.height &&
		r1.y + r1.height > r2.y
	);
}
function spawnFentInGap(spawnX, pipeY, pipeHeight) {
	const offset = pipeHeight + defaultPipeGap;
	const margin = 30;
	const fentHeight = 60;
	let gapTop = pipeY + pipeHeight + margin;
	let gapBottom = (pipeY + offset) - fentHeight - margin;

	if (gapBottom > gapTop) {
		let fentY = Math.floor(Math.random() * (gapBottom - gapTop)) + gapTop;
		const fentBottle = { x: spawnX, y: fentY, width: 60, height: fentHeight }
		bottles.push(fentBottle);
	}
}
function maybeSpawnBottle(pipeX, pipeY, pipeHeight) {
	if (Math.random() < bottleChance) {
		spawnFentInGap(pipeX, pipeY, pipeHeight);
	}
	let halfX = pipeX + (canvas.width / 2);
	if (halfX > canvas.width) {
		if (Math.random() < bottleChance) {
			spawnFentInGap(halfX, pipeY, pipeHeight);
		}
	}
}

// offline user fent => localStorage
let offlineUserFent = 0;
if (localStorage.getItem("offlineUserFent")) {
	offlineUserFent = parseInt(localStorage.getItem("offlineUserFent")) || 0;
}

// hearts
const hud = document.getElementById("hud");
const heartsDisplay = document.createElement("div");
heartsDisplay.id = "heartsDisplay";
hud.appendChild(heartsDisplay);
function updateHeartsDisplay() {
	heartsDisplay.innerHTML = "";
	for (let i = 0; i < hearts; i++) {
		let im = document.createElement("img");
		im.src = heartIcon;
		im.className = "heart-img";
		heartsDisplay.appendChild(im);
	}
}
function loseOneHeart() {
	if (hearts > 1) {
		hearts--;
		updateHeartsDisplay();
		resetFentStreak();
		updateInGameScore();
	} else {
		gameOver();
	}
}

// Score
let score = 0, highScore = 0;
if (localStorage.getItem("flappyFloydHighScore")) {
	highScore = parseInt(localStorage.getItem("flappyFloydHighScore"));
}
const scoreText = document.getElementById("scoreText");
const highScoreText = document.getElementById("highScoreText");
const inGameScore = document.getElementById("inGameScore");
const multiplierText = document.getElementById("multiplierText");
const topHighscoreText = document.getElementById("topHighscoreText");
const plusOneContainer = document.getElementById("plusOneContainer");

function updateScoreUI() {
	scoreText.textContent = "Score: " + score;
	highScoreText.textContent = "Highscore: " + highScore;
	topHighscoreText.textContent = "Highscore: " + highScore;
}
function updateInGameScore() {
	inGameScore.textContent = score.toString();
	if (currentMultiplier > 1) {
		let hue = (performance.now() / 10) % 360;
		inGameScore.style.color = `hsl(${hue},100%,50%)`;
		multiplierText.style.display = "block";
		multiplierText.textContent = "x" + currentMultiplier;
	} else {
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

// multiplier
function incrementFentStreak() {
	fentStreak++;
	if (fentStreak >= 3) {
		currentMultiplier++;
		fentStreak = 0;
	}
}
function resetFentStreak() {
	fentStreak = 0;
	currentMultiplier = 1;
}

// state
let gamePaused = false;
let gameState = "start";
let difficultyInterval = 12000;
let speedIncrement = 0.3;
let nextDifficultyTime = performance.now() + difficultyInterval;

// BG music
const bgMusic = new Audio("assets/flappyfloydonsolana.mp3");
bgMusic.loop = true;

// overlay
const overlay = document.getElementById("overlay");
const gameOverText = document.getElementById("gameOverText");
const startBtn = document.getElementById("startBtn");
const restartGameBtn = document.getElementById("restartGameBtn");
const gameOverImage = document.getElementById("gameOverImage");
const gameOverAudio = /** @type {HTMLAudioElement} */ (document.getElementById("gameOverAudio"));

function initScoreboard() {
	score = 0;
	fentStreak = 0;
	currentMultiplier = 1;
	updateScoreUI();
	updateInGameScore();
}

// Game state
function toggleGamePause() {
	gamePaused = !gamePaused;
	pauseBtn.textContent = gamePaused ? "▶" : "❚❚";
	pauseBtn.blur();
}
function resetGame() {
	floydX = 50; floydY = 200; velocity = 0;
	pipes = [];
	bottles = [];
	hearts = defaultHearts;
	updateHeartsDisplay();

	initScoreboard();
	pipeSpeed = defaultPipeSpeed * mobilePipeSpeedMultiplier;
	gravity = defaultGravity * mobileGravityMultiplier;
	nextDifficultyTime = performance.now() + difficultyInterval;

	overlay.style.display = "none";
	gameOverImage.style.display = "none";
	gameOverAudio.pause();
	gameOverAudio.currentTime = 0;
	gameOverText.style.display = "none";
	restartGameBtn.style.display = "none";

	bgX1 = 0; bgX2 = BG_WIDTH;
	groundX1 = 0; groundX2 = 360;

	spawnPipe();
}
function startGame() {
	startBtn.style.display = "none";
	gameState = "running";
	resetGame();
	try {
		bgMusic.currentTime = 0;
		bgMusic.play();
	} catch (e) {
		console.warn("Audio blocked:", e);
	}
}
function gameOver() {
	gameState = "over";
	overlay.style.display = "flex";
	gameOverText.style.display = "block";
	gameOverImage.style.display = "block";
	restartGameBtn.style.display = "inline-block";

	bgMusic.pause();
	try {
		gameOverAudio.currentTime = 0;
		gameOverAudio.play();
	} catch (e) {
		console.warn("Audio blocked:", e);
	}
	if (score > highScore) {
		highScore = score;
		localStorage.setItem("flappyFloydHighScore", highScore.toString());
	}
	updateScoreUI();
}
function spawnPipe() {
	const pipe = {
		x: canvas.width,
		y: randomPipeY(),
		width: defaultPipeWidth,
		height: defaultPipeHeight,
		markedForDespawn: false,
		despawnTime: 0
	}
	pipes.push(pipe);
	return pipe
}

function kneeGrow(pipe, dt) {
	pipe.x -= 1.0 * dt
	pipe.y -= 1.0 * dt
	pipe.width += 1.0 * dt
	pipe.height += 1.0 * dt
}

// MAIN LOOP
function mainLoop(currentTime) {
	let dt = getDeltaFactor(currentTime);
	ctx.clearRect(0, 0, canvas.width, canvas.height);

	if (gameState === "running") {
		let now = performance.now();
		if (!gamePaused && now >= nextDifficultyTime) {
			pipeSpeed += speedIncrement + 0.05;
			nextDifficultyTime += difficultyInterval;
		}
		scrollBackground(dt);

		let passOffset = 20;
		let lingerTime = 2000;

		// PIPES
		for (let i = 0; i < pipes.length; i++) {
			const pipe = pipes[i];
			let offset = pipe.height + defaultPipeGap;
			let bottomY = pipe.y + offset;

			if (!gamePaused) {
				pipe.x -= pipeSpeed * dt + 0.25;
				kneeGrow(pipe, dt)
			}
			if (!pipe.markedForDespawn) {
				let pipeRightEdge = pipe.x + pipe.width;

				// Last pipe just came offscreen - make a new pipe and despawn this one
				if (pipeRightEdge < (floydX + passOffset)) {
					let gained = 1 * currentMultiplier;
					score += gained;
					updateScoreUI();
					updateInGameScore();
					showPlusOne("+" + gained);

					const newPipe = spawnPipe();
					maybeSpawnBottle(newPipe.x, newPipe.y, newPipe.height);

					pipe.markedForDespawn = true;
					pipe.despawnTime = performance.now() + lingerTime;
				}
			} else {
				if (performance.now() > pipe.despawnTime) {
					pipes.splice(i, 1);
					i--;
					continue;
				}
			}

			// Draw pipes
			ctx.drawImage(pipeTop, pipe.x, pipe.y, pipe.width, pipe.height);
			ctx.drawImage(pipeBottom, pipe.x, bottomY, pipe.width, pipe.height);

			if (!pipe.markedForDespawn) {
				const birdRect = { x: floydX + 10, y: floydY + 10, width: floydWidth - 20, height: floydHeight - 20 };
				const topRect = { x: pipe.x, y: pipe.y, width: pipe.width, height: pipe.height };
				const bottomRect = { x: pipe.x, y: bottomY, width: pipe.width, height: pipe.height };
				if (isColliding(birdRect, topRect) || isColliding(birdRect, bottomRect)) {
					pipes.splice(i, 1);
					i--;
					loseOneHeart();
					updateInGameScore();
					spawnPipe();
					maybeSpawnBottle(pipe.x, pipe.y, pipe.height);
					break;
				}
			}
		}

		// Fent bottles
		for (let b = 0; b < bottles.length; b++) {
			const fent = bottles[b];
			if (!gamePaused) {
				fent.x -= pipeSpeed * dt + 0.5;
			}
			ctx.drawImage(bottleImg, fent.x, fent.y, fent.width, fent.height);

			const birdRect = { x: floydX + 10, y: floydY + 10, width: floydWidth - 20, height: floydHeight - 20 };
			const fentRect = { x: fent.x, y: fent.y, width: fent.width, height: fent.height };
			if (isColliding(birdRect, fentRect)) {
				bottles.splice(b, 1);
				b--;

				let gained = 1 * currentMultiplier;
				score += gained;
				updateScoreUI();
				updateInGameScore();
				showPlusOne("+" + gained);

				incrementFentStreak();

				bottleCount++;
				if (bottleCount >= bottlesNeededForHeart) {
					bottleCount = 0;
					if (hearts < maxHearts) {
						hearts++;
						updateHeartsDisplay();
					}
				}

				offlineUserFent++;
				localStorage.setItem("offlineUserFent", offlineUserFent.toString());
				userFentTotal.textContent = offlineUserFent.toString();

				// increment global fent bridging
				incrementGlobalFent();
				continue;
			}
			if (fent.x + fent.width < 0) {
				bottles.splice(b, 1);
				b--;
			}
		}

		scrollGround(dt);

		if (!gamePaused) {
			let birdBottom = floydY + floydHeight;
			let floorY = canvas.height - floorHeight;
			// Floor bounce
			if (birdBottom >= floorY) {
				if (hearts > 1) {
					hearts--;
					updateHeartsDisplay();
					resetFentStreak();
					updateInGameScore();
					floydY = floorY - floydHeight - 1;
					velocity = lift;
				} else {
					gameOver();
				}
			}
			velocity += gravity * dt;
			floydY += velocity * dt;
			if (floydY < 0) {
				floydY = 0; velocity = 0;
			}
		}

		// Draw floyd
		floydAngle = lerp(floydAngle, velocity * Math.PI / 90, 0.1);
		ctx.save();
		ctx.translate(floydX + floydWidth / 2, floydY + floydHeight / 2);
		ctx.rotate(floydAngle);
		ctx.drawImage(flappyFloyd, -floydWidth / 2, -floydHeight / 2, floydWidth, floydHeight);
		ctx.restore();
	}
	else {
		// Not running => background only
		scrollBackground(dt);
		scrollGround(dt);
		ctx.drawImage(flappyFloyd, floydX, floydY, floydWidth, floydHeight);
	}

	requestAnimationFrame(mainLoop);
}
requestAnimationFrame(mainLoop);

// Pause & Mute
const pauseBtn = document.getElementById("pauseBtn");
const muteBtn = document.getElementById("muteBtn");
pauseBtn.addEventListener("click", () => {
	if (gameState === "running") {
		toggleGamePause();
	}
});
muteBtn.addEventListener("click", () => {
	bgMusic.muted = !bgMusic.muted;
	muteBtn.textContent = bgMusic.muted ? "🔇" : "🔊";
	muteBtn.blur();
});

// START
startBtn.addEventListener("click", () => {
	if (gameState !== "running") {
		startGame();
		startBtn.blur();
	}
});

// RESTART => re-play music
restartGameBtn.addEventListener("click", () => {
	overlay.style.display = "none";
	gameOverImage.style.display = "none";
	gameOverAudio.pause();
	gameOverAudio.currentTime = 0;
	gameOverText.style.display = "none";
	restartGameBtn.style.display = "none";

	gameState = "running";
	resetGame();
	try {
		bgMusic.currentTime = 0;
		bgMusic.play();
	} catch (e) {
		console.warn("Audio blocked:", e);
	}
});


////////////////////////////
// 5) Leaderboard + Fent
////////////////////////////
const playerNameInput = /** @type {HTMLInputElement} */ (document.getElementById("playerName"));
const shareScoreBtn = document.getElementById("shareScoreBtn");
const embeddedLeaderboardContainer = document.getElementById("embeddedLeaderboardContainer");
const userFentTotal = document.getElementById("userFentTotal");
const globalFentTotal = document.getElementById("globalFentTotal");

// show global in real-time
db.ref("globalFentCollected").on("value", (snap) => {
	let val = snap.val() || 0;
	globalFentTotal.textContent = val.toString();
});

// on page load => scoreboard
window.addEventListener("DOMContentLoaded", () => {
	displayLeaderboard("embeddedLeaderboardContainer");
});

// anti-spam
let lastSubmissionTime = 0;
const MIN_SUBMISSION_INTERVAL = 5000;

// typed name => localStorage
let submittedName = localStorage.getItem("submittedLeaderboardName") || null;

shareScoreBtn.addEventListener("click", () => {
	let typedName = playerNameInput.value.trim() || "Anonymous";

	if (submittedName && typedName !== submittedName) {
		alert(`You already used name "${submittedName}". Can't use a different name.`);
		return;
	}

	let currentTime = Date.now();
	if (currentTime - lastSubmissionTime < MIN_SUBMISSION_INTERVAL) {
		alert("Wait before submitting again!");
		return;
	}
	lastSubmissionTime = currentTime;

	// *** parse the highscore => store numeric
	let sharedScore = parseInt("" + highScore, 10) || 0;

	db.ref("leaderboard/" + typedName).once("value", (snap) => {
		let oldVal = snap.val();
		if (!oldVal) {
			// create => store numeric score
			db.ref("leaderboard/" + typedName).set({
				score: sharedScore
			}, (err) => {
				if (err) {
					alert("Error: " + err);
				} else {
					alert("Score submitted for name: " + typedName);
					localStorage.setItem("submittedLeaderboardName", typedName);
					submittedName = typedName;
					// refresh scoreboard
					displayLeaderboard("embeddedLeaderboardContainer");
				}
			});
		} else {
			let oldScore = parseInt(oldVal.score, 10) || 0;
			if (sharedScore > oldScore) {
				db.ref("leaderboard/" + typedName).update({
					score: sharedScore
				}, (err2) => {
					if (err2) {
						alert("Error: " + err2);
					} else {
						alert(`New highscore! (${sharedScore}) for ${typedName}`);
						displayLeaderboard("embeddedLeaderboardContainer");
					}
				});
			} else {
				alert("Your new score is not higher. No update.");
			}
		}
	});
});


// Contract copy
const copyContractBtn = document.getElementById("copyContractBtn");
const contractPlaceholder = document.getElementById("contractPlaceholder");
copyContractBtn.addEventListener("click", () => {
	let text = contractPlaceholder.textContent;
	navigator.clipboard.writeText(text)
		.then(() => alert("Contract Address Copied!"))
		.catch(err => console.error("Copy error:", err));
});
