import type { ServerWebSocket } from "bun";
import { defaultGravity, defaultFloydSpeed, difficultyInterval, defaultBottleChance } from "./defaults"
import { Floyd } from "./floyd"
import { Pipe } from "./pipe"
import type { Session } from "./session"
import { logger, type PlayerData } from "./server";
import { Bottle } from "./bottle";

export interface ICollidable {
	id:number;
	x:number;
	y:number;
	width:number;
	height:number;
	rotation:number;
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
	worldWidth: number;
	worldHeight: number;

	// Game world
	#players: ServerWebSocket<PlayerData>[];
	objects: ICollidable[];
	#maxObjectId = 0
	floyds: Floyd[];

	constructor(session:Session) {
		this.#session = session;
		this.worldHeight = 640;
		this.worldWidth = 360;
		this.#gameState = GameState.Pending;

		this.#players = [];
		this.objects = [];
		this.floyds = [];
	}

	addPlayer(ws: ServerWebSocket<PlayerData>) {
		// Spawn in floyd for player
		const floyd = new Floyd(this, this.#maxObjectId++, ws);
		this.floyds.push(floyd);
		ws.data.floyd = floyd;

		// Add player
		this.#players.push(ws);
	}

	isColliding(r1:ICollidable, r2:ICollidable) {
		return (
			r1.x < r2.x + r2.width &&
			r1.x + r1.width > r2.x &&
			r1.y < r2.y + r2.height &&
			r1.y + r1.height > r2.y
		);
	}

	#spawnPipe() {
		// Find the rightmost existing pipe
		const pipes = this.objects.filter(obj => obj instanceof Pipe);
		const rightmostX = pipes.length > 0 
			? Math.max(...pipes.map(pipe => pipe.x + pipe.width)) 
			: this.worldWidth;

		// Spawn new pipe to the right of the rightmost existing pipe
		const pipe = new Pipe(this, this.#maxObjectId++);
		pipe.x = rightmostX + this.worldWidth / 2;
		this.spawnObject(pipe);

		// Maybe spawn fent
		if (Math.random() < defaultBottleChance) {
			this.#spawnPipeBottle(pipe);
		}
	}

	spawnObject(object:ICollidable) {
		this.objects.push(object);
		return object;
	}

	removeObject(object:ICollidable) {
		if (!object) {
			return;
		}

		const index = this.objects.indexOf(object);
		if (index !== -1) {
			this.objects.splice(index, 1);
		}
	}

	#spawnPipeBottle(pipe:Pipe) {
		const offset = pipe.height + pipe.gap;
		const margin = 30;
		const fentHeight = 60;
		let gapTop = pipe.y + pipe.height + margin;
		let gapBottom = (pipe.y + offset) - fentHeight - margin;
	
		if (gapBottom > gapTop) {
			const fentX = pipe.x + pipe.width / 2;
			const fentY = Math.floor(Math.random() * (gapBottom - gapTop)) + gapTop;
			const bottle = new Bottle(this, this.#maxObjectId++, fentX, fentY, fentHeight);
			this.spawnObject(bottle)
		}
	}

	update(dt:number) {
		if (this.#gameState != GameState.Started) {
			// Nothing to do
			return;
		}

		// Find the furthest forward Floyd
		const furthestFloydX = this.floyds.length > 0 
			? Math.max(...this.floyds.map(floyd => floyd.x))
			: this.worldWidth;

		// Check if we need to spawn a new pipe in front of the leading Floyd
		const pipes = this.objects.filter(obj => obj instanceof Pipe);
		const nextPipeX = pipes.length > 0 
			? Math.min(...pipes.map(pipe => pipe.x)) 
			: this.worldWidth;
		if (nextPipeX < furthestFloydX) {
			this.#spawnPipe();
		}
	
		// Update floyds
		for (const floyd of this.floyds) {
			floyd.update(dt);
		}

		// Update objects
		for (const object of this.objects) {
			object.update(dt);
		}

		// Update players about new game state
		const gameState = {
			action: "gameState",
			data: {
				state: this.#gameState,
				players: this.#players.map(player => {
					const floyd = player.data.floyd;
					if (!floyd) {
						// TODO: Handle this case
						return
					}

					return {
						id: player.data.id,
						username: player.data.username,
						highscore: player.data.highscore,
						floyd: floyd
					}
				}),
				objects: this.objects.map(object => {
					return {
						type: object.constructor.name,
						...object
					}
				})
			}
		}
		const gameStatePacket = JSON.stringify(gameState);
		for (const player of this.#players) {
			player.send(gameStatePacket);
		}
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
					worldWidth: this.worldWidth,
					worldHeight: this.worldHeight
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
