import type { ServerWebSocket } from "bun";
import { defaultGravity, defaultFloydSpeed, difficultyInterval } from "./defaults"
import { Floyd } from "./floyd"
import { Pipe } from "./pipe"
import type { Session } from "./session"
import { logger, type PlayerData } from "./server";

export interface ICollidable {
	id:number;
	x:number;
	y:number;
	width:number;
	height:number;
	velocity: { x:number, y:number };

	update(dt:number): void;
}

export enum GameState {
	Pending = "Pending",
	Started = "Started",
	Paused = "Paused",
	Over = "Over"
};

export class Game {
	// State
	#gameState: GameState;
	#session: Session;
	#worldWidth: number;
	#worldHeight: number;

	// Map
	#players: ServerWebSocket<PlayerData>[];
	#floyds: Floyd[];
	#objects: ICollidable[];

	#maxFloydId = 0
	#maxObjectId = 0

	constructor(session:Session) {
		this.#session = session;
		this.#worldHeight = 640;
		this.#worldWidth = 360;
		this.#gameState = GameState.Pending;
		this.#maxFloydId = 0;

		this.#players = [];
		this.#objects = [];
		this.#floyds = [];
	}

	addPlayer(ws: ServerWebSocket<PlayerData>) {
		this.#players.push(ws);

		const floyd = new Floyd(ws, this, this.#maxFloydId++);
		this.#floyds.push(floyd);
		ws.data.floyd = floyd;
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
		const pipe = new Pipe(this, this.#maxObjectId++);
		this.#objects.push(pipe);
		return pipe;
	}
	
	/*#spawnFentInGap(spawnX: number, pipeY: number, pipeHeight: number) {
		const offset = pipeHeight + defaultPipeGap;
		const margin = 30;
		const fentHeight = 60;
		let gapTop = pipeY + pipeHeight + margin;
		let gapBottom = (pipeY + offset) - fentHeight - margin;
	
		if (gapBottom > gapTop) {
			let fentY = Math.floor(Math.random() * (gapBottom - gapTop)) + gapTop;
			const fentBottle = { x: spawnX, y: fentY, width: 60, height: fentHeight, velocity: { x: 0, y: 0 } };
			this.bottles.push(fentBottle);
		}
	}
		
	#maybeSpawnBottle(pipeX: number, pipeY: number, pipeHeight: number) {
		if (Math.random() < defaultBottleChance) {
			this.#spawnFentInGap(pipeX, pipeY, pipeHeight);
		}
		let halfX = pipeX + (this.#worldWidth / 2);
		if (halfX > this.#worldWidth) {
			if (Math.random() < defaultBottleChance) {
				this.#spawnFentInGap(halfX, pipeY, pipeHeight);
			}
		}
	}*/

	update(dt:number) {
		if (this.#gameState != GameState.Started) {
			// Nothing to do
			return;
		}

		// Tell floyds to update
		for (const floyd of this.#floyds) {
			floyd.update(dt);
		}

		// Update objects
		for (const object of this.#objects) {
			object.update(dt);
		}

		// Update players about new game state
		const gameState = {
			action: "gameState",
			data: {
				state: this.#gameState,
				players: this.#floyds.map(floyd => ({
					id: floyd.id,
					x: floyd.x,
					y: floyd.y,
					velocity: floyd.velocity,
					hearts: floyd.hearts
				})),
				objects: this.#objects
			}
		}
		const gameStatePacket = JSON.stringify(gameState);
		for (const player of this.#players) {
			player.send(gameStatePacket);
		}

		// Increase difficulty
		/*const now = performance.now();
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
					this.#incrementScore();
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
				const birdRect = {
					x: this.floyd.x + 10, 
					y: this.floyd.y + 10,
					width: this.floyd.width - 20,
					height: this.floyd.height - 20
				};
				const topRect = { 
					x: pipe.x, 
					y: pipe.y,
					width: pipe.width,
					height: pipe.height
				};
				const bottomRect = {
					x: pipe.x,
					y: bottomY,
					width: pipe.width,
					height: pipe.height
				};
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

				this.#incrementScore();
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
			this.#loseOneHeart();
			this.floyd.y = this.floyd.y - this.floyd.height - 1;
			this.floyd.velocity = lift;
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
		}*/
	}

	// Actions - activated by client
	start() {
		logger.info(`Game started`);
		if (this.#gameState === GameState.Pending) {
			this.#spawnPipe();
			this.#gameState = GameState.Started
			
			// Tell players that the game has started
			const gameStart = {
				action: "gameStart",
				data: {
					worldWidth: this.#worldWidth,
					worldHeight: this.#worldHeight
				}
			}
			const gameStartPacket = JSON.stringify(gameStart);
			for (const player of this.#players) {
				player.send(gameStartPacket);
			}
		}
	}

	pause()  {
		this.#gameState = GameState.Paused;
	}

	quit() {
		if (this.#gameState !== GameState.Over) {
			this.#gameState = GameState.Over;
			// Tell session we are expired
			this.#session.onGameOver()	
			
			// Delete all floyds for players
			for (const player of this.#players) {
				player.data.floyd = null;
			}
		}
	}
}
