import type { ServerWebSocket } from "bun";
import { defaultGravity, defaultFloydSpeed, difficultyInterval, defaultBottleChance } from "./defaults"
import { Floyd } from "./floyd"
import { Pipe } from "./pipe"
import type { Session } from "./session"
import { logger, type PlayerData } from "./server";
import { Bottle } from "./bottle";
import { clampToZero, dot, normalise } from "./math";

export interface ICollidable {
	x:number;
	y:number;
	width:number;
	height:number;
	rotation:number;
}

export type GameObject = ICollidable & {
	id:number;
	velocity: { x:number, y:number };
	solid: boolean;

	update(dt:number): void;
}

export type Vector2 = {
	x:number
	y:number
};

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
	objects: GameObject[];
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

	// Physics - reference:
	// https://textbooks.cs.ksu.edu/cis580/04-collisions/04-separating-axis-theorem/
	// https://www.youtube.com/watch?v=MvlhMEE9zuc
	getRectVerticies(r1:ICollidable) {
		return [
			{ x: r1.x + r1.width, y: r1.y }, // 1. Top right
			{ x: r1.x + r1.width, y: r1.y + r1.height }, // 2. Bottom right
			{ x: r1.x, y: r1.y + r1.height }, // 3. Bottom left
			{ x: r1.x, y: r1.y }, // 4. Top left
		];
	}

	getRotatedVerticies(r1:ICollidable) {
		const r1Verticies = this.getRectVerticies(r1);

		let ox = r1.x + r1.width / 2;
		let oy = r1.y + r1.height / 2;

		const rotatedVerticies = [];

		for (const vertex of r1Verticies) {
			const vx = vertex.x, vy = vertex.y;
			let dx = vx - ox
			let dy = vy - oy;

			let distance = Math.sqrt(dx * dx + dy * dy);
			let originalAngle = Math.atan2(dy, dx);

			let rotatedX = ox + distance * Math.cos(originalAngle + r1.rotation);
			let rotatedY = oy + distance * Math.sin(originalAngle + r1.rotation);

			rotatedVerticies.push({
				x: clampToZero(rotatedX),
				y: clampToZero(rotatedY),
			});
		}

		return rotatedVerticies;
	}

	getEdges(verticies:Vector2[]) {
		const edges = [];
		for (let i = 0; i < verticies.length; i++) {
			const vertex = verticies[i];
			const nextVertex = verticies[(i + 1) % verticies.length];

			edges.push({
				x: nextVertex.x - vertex.x,
				y: nextVertex.y - vertex.y
			});
		}
		return edges;
	}

	getEdgeNormals(edges:Vector2[]):Set<Vector2> {		
		const edgeNormals = new Set<Vector2>();

		for (const edge of edges) {
			const perpendicular = { x: edge.y, y: -edge.x };
			normalise(perpendicular);
			edgeNormals.add(perpendicular);
		}

		return edgeNormals;
	}

	getMinMaxProjection(r1:ICollidable, axis:Vector2) {
		const verticies = this.getRotatedVerticies(r1);
		
		let projection = dot(verticies[0], axis);

		let max = projection;
		let min = projection;
		for (let i = 1; i < verticies.length; i++) {
			projection = dot(verticies[i], axis);
			max = Math.max(projection, max);
			min = Math.min(projection, min);
		}

		return { min, max }
	}

	isColliding(r1:ICollidable, r2:ICollidable) {
		const r1Verticies = this.getRotatedVerticies(r1);
		const r1Edges = this.getEdges(r1Verticies);
		const r1Normals = this.getEdgeNormals(r1Edges);

		for (const normal of r1Normals) {
			const r1MinMaxProjection = this.getMinMaxProjection(r1, normal);
			const r2MinMaxProjection = this.getMinMaxProjection(r2, normal);

			// Test for separation between projections (no collision possible if so)
			if (r1MinMaxProjection.max < r2MinMaxProjection.min || r2MinMaxProjection.max < r1MinMaxProjection.min) {
				return false;
			}
		}

		const r2Verticies = this.getRotatedVerticies(r2);
		const r2Edges = this.getEdges(r2Verticies);
		const r2Normals = this.getEdgeNormals(r2Edges);
		for (const normal of (r2Normals)) {
			const r1MinMaxProjection = this.getMinMaxProjection(r1, normal);
			const r2MinMaxProjection = this.getMinMaxProjection(r2, normal);
			// Test for separation between projections (no collision possible if so)
			if (r1MinMaxProjection.max < r2MinMaxProjection.min || r2MinMaxProjection.max < r1MinMaxProjection.min) {
				return false;
			}
		}

		return true;
	}

	// Players
	addPlayer(ws: ServerWebSocket<PlayerData>) {
		// Spawn in floyd for player
		const floyd = new Floyd(this, this.#maxObjectId++, ws);
		this.floyds.push(floyd);
		ws.data.floyd = floyd;

		// Add player
		this.#players.push(ws);
	}

	removePlayer(ws:ServerWebSocket<PlayerData>) {
		// TODO: Implement this
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

	spawnObject(object:GameObject) {
		this.objects.push(object);
		return object;
	}

	removeObject(object:GameObject) {
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
