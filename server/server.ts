import type { ServerWebSocket } from 'bun';

const players = new Set<ServerWebSocket<any>>();
const playerSessions = new Map<ServerWebSocket<any>, Session>();
const playerFloyds = new Map<ServerWebSocket<any>, Floyd>();

// Default values for non constant variables
const defaultPipeWidth = 150
const defaultPipeHeight = 390;
const defaultPipeSpeed = 32;
const defaultPipeGap = 180;
const defaultHearts = 5;
const defaultGravity = 250;
const defaultBottleChance = 0.6;
const mobilePipeSpeedMultiplier = 0.5;
const mobileGravityMultiplier = 1;

// Global constant variables (same for all players)
const passOffset = 20;
const lingerTime = 2000;
const canvasWidth = 360;
const canvasHeight = 640;
const lift = -250;
const difficultyInterval = 12000;
const speedIncrement = 0.3;
const bottlesNeededForHeart = 5;
const maxHearts = 5;
const floorHeight = 56;

let floydId = 1

enum GameState {
	BeforeStart = "start",
	Running = "running",
	Paused = "paused",
	Over = "over"
};

function incrementGlobalFent() {

}

interface IMessage {
	action:string,
	data:any
}

class Session {
	#ws: ServerWebSocket<any>
	#floyd: Floyd
	#highScore: number
	#currentGame: Game|null

	constructor(ws:ServerWebSocket<any>, floyd:Floyd) {
		this.#ws = ws
		this.#floyd = floyd
		this.#highScore = 0
		this.#currentGame = null
	}

	startGame() {
		this.#currentGame = new Game(this, this.#floyd)
	}

	updateGame(dt:number) {
		if (!this.#currentGame) {
			return;
		}

		const game = this.#currentGame
		// Update the game
		game.update(dt);

		const packet = {
			action: "updateGameState",
			data: {
				pipes: game.pipes,
				bottles: game.bottles,
				score:  game.score,
				hearts: game.hearts,
				fentStreak: game.fentStreak,
				fentMultiplier: game.fentMultiplier,
				currentMultiplier: game.currentMultiplier,
				highScore: this.#highScore
			}
		}
		this.#ws.send(JSON.stringify(packet))
	}

	// Called by the socket server when a message is received
	onMessage(data:IMessage) {
		switch (data.action) {
			case "start": {
				if (!this.#currentGame) {
					this.#currentGame = new Game(this, this.#floyd);
				}
				this.#currentGame.start();
				break;
			}
			case "jump": {
				this.#currentGame?.jump();
				break;
			}
			case "pause": {
				this.#currentGame?.pause();
				break;
			}
			case "quit": {
				this.#currentGame?.quit();
				break;
			}
		}
	}

	// Called by game when finished
	onGameOver(score:number) {
		if (score > this.#highScore) {
			this.#highScore = score
		}
		this.#currentGame = null
	}
}

interface ICollidable {
	x:number,
	y:number,
	width:number,
	height:number
}

class Pipe implements ICollidable {
	x: number
	y: number
	width: number
	height: number
	markedForDespawn: Boolean
	despawnTime: number
	
	#randomPipeY() {
		return Math.floor(Math.random() * 231) - 240;
	}

	constructor() {
		this.x = 360;
		this.y = this.#randomPipeY();
		this.width = defaultPipeWidth;
		this.height = defaultPipeHeight;
		this.markedForDespawn = false;
		this.despawnTime = 0;
	}
}

class Bottle implements ICollidable {
	x: number
	y: number
	width: number
	height: number

	constructor(spawnX: number, fentY: number, fentHeight: number) {
		this.x = spawnX
		this.y = fentY
		this.width = 60
		this.height = fentHeight
	}
}

class Floyd implements ICollidable {
	id: number
	username: string

	x: number
	y: number
	width: number
	height: number
	velocity: number

	constructor(id:number, username: string = "anon") {
		this.id = id
		this.username = username
		this.x = 50;
		this.y = 200; 
		this.width = 100
		this.height = 75
		this.velocity = 0
	}
}

// Individual game session
class Game {
	// State
	#gameState: GameState
	#session: Session

	// Map
	pipes: Pipe[]
	score: number
	fentStreak: number
	fentMultiplier: number
	currentMultiplier: number
	#pipeSpeed: number
	#gravity: number
	#nextDifficultyTime: number
	
	// Bottles
	bottles: Bottle[]
	#bottleCount: number

	// Floyd
	floyd: Floyd
	hearts: number

	constructor(session:Session, floyd:Floyd) {
		this.#session = session
		this.floyd = floyd;
		this.pipes = [];
		this.#gameState = GameState.BeforeStart
		this.score = 0
		this.fentStreak = 0
		this.fentMultiplier = 0
		this.bottles = [];
		this.#bottleCount = 0
		this.hearts = defaultHearts;
		this.score = 0;
		this.currentMultiplier = 1; 
		
		this.#pipeSpeed = defaultPipeSpeed * mobilePipeSpeedMultiplier;
		this.#gravity = defaultGravity * mobileGravityMultiplier;
		this.#nextDifficultyTime = performance.now() + difficultyInterval;
	}

	#isColliding(r1:ICollidable, r2:ICollidable) {
		return (
			r1.x < r2.x + r2.width &&
			r1.x + r1.width > r2.x &&
			r1.y < r2.y + r2.height &&
			r1.y + r1.height > r2.y
		);
	}

	#spawnPipe() {
		const pipe = new Pipe()
		this.pipes.push(pipe);
		return pipe
	}
	
	#kneeGrow(pipe: Pipe, dt: number) {
		pipe.x -= 1.0 * dt
		pipe.y -= 1.0 * dt
		pipe.width += 1.0 * dt;
		pipe.height += 1.0 * dt
	}

	#resetFentStreak() {
		this.fentStreak = 0;
		this.currentMultiplier = 1;
	}
		
	#loseOneHeart() {
		if (this.hearts > 1) {
			this.hearts--;
			this.#resetFentStreak();
		}
		else {
			this.quit();
		}
	}
	
	#spawnFentInGap(spawnX: number, pipeY: number, pipeHeight: number) {
		const offset = pipeHeight + defaultPipeGap;
		const margin = 30;
		const fentHeight = 60;
		let gapTop = pipeY + pipeHeight + margin;
		let gapBottom = (pipeY + offset) - fentHeight - margin;
	
		if (gapBottom > gapTop) {
			let fentY = Math.floor(Math.random() * (gapBottom - gapTop)) + gapTop;
			const fentBottle = { x: spawnX, y: fentY, width: 60, height: fentHeight }
			this.bottles.push(fentBottle);
		}
	}

	#incrementFentStreak() {
		this.fentStreak++;
		if (this.fentStreak >= 3) {
			this.currentMultiplier++;
			this.fentStreak = 0;
		}
	}
		
	#maybeSpawnBottle(pipeX: number, pipeY: number, pipeHeight: number) {
		if (Math.random() < defaultBottleChance) {
			this.#spawnFentInGap(pipeX, pipeY, pipeHeight);
		}
		let halfX = pipeX + (canvasWidth / 2);
		if (halfX > canvasWidth) {
			if (Math.random() < defaultBottleChance) {
				this.#spawnFentInGap(halfX, pipeY, pipeHeight);
			}
		}
	}

	update(dt:number) {
		if (this.#gameState != GameState.Running) {
			// Nothing to do
			return;
		}

		// Increase difficulty
		const now = performance.now();
		if (now >= this.#nextDifficultyTime) {
			this.#pipeSpeed += speedIncrement + 5;
			this.#nextDifficultyTime += difficultyInterval;
		}

		// Pipes
		for (let i = 0; i < this.pipes.length; i++) {
			const pipe = this.pipes[i];
			let offset = pipe.height + defaultPipeGap;
			let bottomY = pipe.y + offset;

			pipe.x -= this.#pipeSpeed * dt + 4;
			this.#kneeGrow(pipe, dt)
			if (!pipe.markedForDespawn) {
				let pipeRightEdge = pipe.x + pipe.width;

				// Last pipe just came offscreen - make a new pipe and despawn this one
				if (pipeRightEdge < (this.floyd.x + passOffset)) {
					let gained = 1 * this.currentMultiplier;
					this.score += gained;
					const newPipe = this.#spawnPipe();
					this.#maybeSpawnBottle(newPipe.x, newPipe.y, newPipe.height);

					pipe.markedForDespawn = true;
					pipe.despawnTime = performance.now() + lingerTime;
				}
			}
			else {
				if (performance.now() > pipe.despawnTime) {
					this.pipes.splice(i, 1);
					i--;
					continue;
				}
			}
		
			if (!pipe.markedForDespawn) {
				const birdRect = { x: this.floyd.x + 10, y: this.floyd.y + 10, width: this.floyd.width - 20, height: this.floyd.height - 20 };
				const topRect = { x: pipe.x, y: pipe.y, width: pipe.width, height: pipe.height };
				const bottomRect = { x: pipe.x, y: bottomY, width: pipe.width, height: pipe.height };
				if (this.#isColliding(birdRect, topRect) || this.#isColliding(birdRect, bottomRect)) {
					this.pipes.splice(i, 1);
					i--;
					this.#loseOneHeart();
					this.#spawnPipe();
					this.#maybeSpawnBottle(pipe.x, pipe.y, pipe.height);
					break;
				}
			}
		}

		// Fent bottles
		for (let b = 0; b < this.bottles.length; b++) {
			const fent = this.bottles[b];
			fent.x -= this.#pipeSpeed * dt + 5;

			const birdRect = { x: this.floyd.x + 10, y: this.floyd.y + 10, width: this.floyd.width - 20, height: this.floyd.height - 20 };
			const fentRect = { x: fent.x, y: fent.y, width: fent.width, height: fent.height };
			if (this.#isColliding(birdRect, fentRect)) {
				this.bottles.splice(b, 1);
				b--;

				let gained = 1 * this.currentMultiplier;
				this.score += gained;
				this.#incrementFentStreak();

				this.#bottleCount++;
				if (this.#bottleCount >= bottlesNeededForHeart) {
					this.#bottleCount = 0;
					if (this.hearts < maxHearts) {
						this.hearts++;
					}
				}

				incrementGlobalFent();
				continue;
			}
			if (fent.x + fent.width < 0) {
				this.bottles.splice(b, 1);
				b--;
			}
		}
		
		// Floyd
		let birdBottom = this.floyd.y + this.floyd.height;
		let floorY = canvasHeight - floorHeight;
		// Floor bounce
		if (birdBottom >= floorY) {
			if (this.hearts > 1) {
				this.hearts--;
				this.#resetFentStreak();
				this.floyd.y = this.floyd.y - this.floyd.height - 1;
				this.floyd.velocity = lift;
			}
			else {
				this.quit();
			}
		}
		this.floyd.velocity += this.#gravity * dt;
		this.floyd.y += this.floyd.velocity * dt;
		if (this.floyd.y < 0) {
			this.floyd.y = 0;
			this.floyd.velocity = 0;
		}
		// This shouldn't happen
		if (this.floyd.y > canvasHeight) {
			this.floyd.y = canvasHeight - this.floyd.height;
			this.floyd.velocity = 0;
		}
	}

	// Actions - activated by client
	start() {
		if (this.#gameState === GameState.BeforeStart) {
			this.#spawnPipe();
			this.#gameState = GameState.Running
		}
	}

	jump() {
		if (this.#gameState === GameState.Running) {
			this.floyd.velocity = lift + 100;
		}
	}

	pause()  {
		this.#gameState = GameState.Paused;
	}

	quit() {
		if (this.#gameState !== GameState.Over) {
			this.#gameState = GameState.Over;
			// Tell session we are expired
			this.#session.onGameOver(this.score)	
		}
	}
}

let lastTick = performance.now();
const ticksPerSecond = 30;
const tickInterval = 1000 / ticksPerSecond;
setInterval(() => {
	let now = performance.now();
	let dt = now - lastTick;
	lastTick = now;

	// Game state
	for (const [player, session] of playerSessions) {
		session.updateGame(dt / 1000);
	}

	// Floyds
	const updateFloydsPacket = { action: "updateFloyds", data: [...playerFloyds.values()] };
	const data = JSON.stringify(updateFloydsPacket);
	for (const ws of players) {
		ws.send(data);
	}
}, tickInterval);

const server = Bun.serve({
	fetch(req, server) {
		const success = server.upgrade(req);
		if (success) {
			return undefined;
		}
		return new Response("Flappyserver v0.01");
	},
	websocket: {
		// When player first connects
		async open(ws) {
			players.add(ws);
			const floyd = new Floyd(floydId++, "anon_" + (floydId));
			playerFloyds.set(ws, floyd)
			const session = new Session(ws, floyd);
			playerSessions.set(ws, session);
		},
		async message(ws, message) {
			// Pass it onto that session			
			const session = playerSessions.get(ws);
			if (!session) {
				console.error("No session found for player", ws);
				return;
			}
			if (typeof message !== "string") {
				return;
			}
			const parsedMessage = JSON.parse(message)
			session.onMessage(parsedMessage);
		},
		close(ws) {
			players.delete(ws);
			const session = playerSessions.get(ws);
			//session?.onGameOver(session.#currentGame?.score || 0);
			playerSessions.delete(ws);
			playerFloyds.delete(ws);
		}
	},
	port: 3000
});

console.log(`Listening on ${server.hostname}:${server.port}`);