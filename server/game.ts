import type { ServerWebSocket } from "bun";
import { defaultGravity, defaultFloydSpeed, difficultyInterval, defaultBottleChance, defaultPipeGap, defaultPipeWidth, floorHeight } from "./defaults"
import { Floyd } from "./floyd";
import { Pipe } from "./pipe";
import { Bottle } from "./bottle";
import type { Session } from "./session"
import { logger, type PlayerData } from "./server";
import { clampToZero, Vector2 } from "./math";
import type { GameObject, ICollidable } from "./game-object";
import { Narcan } from "./narcan";
import { Police } from "./police";

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
	floyds: Floyd[];
	maxObjectId: number;
	#pipeSeparation: number;
	#frontPipeX: number;
	#chunkI: number;
	#policeSpawnChance: number;
	furthestForwardFloyd: Floyd|null;
	furthestBehindFloyd: Floyd|null;
	removedPlayerIds: number[];
	removedObjectIds: number[];

	constructor(session:Session) {
		this.#session = session;
		this.worldHeight = 640;
		this.worldWidth = 360;
		this.#gameState = GameState.Pending;

		this.#players = [];
		this.objects = [];
		this.floyds = [];
		this.maxObjectId = 0;
		this.#pipeSeparation = defaultPipeWidth * 2;
		this.#frontPipeX = 0;
		this.#chunkI = 0;
		this.#policeSpawnChance = 1.0;
		this.furthestForwardFloyd = null;
		this.furthestBehindFloyd = null;
		this.removedPlayerIds = []
		this.removedObjectIds = []
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

	getRotatedVerticies(r1:ICollidable):Vector2[] {
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

	getEdges(verticies:Vector2[]):Vector2[] {
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
			Vector2.normalise(perpendicular);
			edgeNormals.add(perpendicular);
		}

		return edgeNormals;
	}

	getMinMaxProjection(r1:ICollidable, axis:Vector2) {
		const verticies = this.getRotatedVerticies(r1);
		
		let projection = Vector2.dot(verticies[0], axis);

		let max = projection;
		let min = projection;
		for (let i = 1; i < verticies.length; i++) {
			projection = Vector2.dot(verticies[i], axis);
			max = Math.max(projection, max);
			min = Math.min(projection, min);
		}

		return { min, max }
	}

	isColliding(r1:ICollidable, r2:ICollidable):boolean {
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
		const floyd = new Floyd(this, this.maxObjectId++, ws);
		this.floyds.push(floyd);
		ws.data.floyd = floyd;

		// Add player
		this.#players.push(ws);
	}

	removePlayer(ws:ServerWebSocket<PlayerData>) {
		// TODO: Implement this
		this.removedPlayerIds.push(ws.data.id);
	}

	#getRandomPipeY(pipeHeight:number, pipeGap:number) {
		const minY = -pipeHeight;
		const maxY = this.worldHeight - pipeHeight - pipeGap;
		return Math.floor(Math.random() * (maxY - minY + 1)) + minY;
	}

	#spawnPipe() {
		const pipeX = this.#frontPipeX + this.#pipeSeparation;

		// Create and position the new pipe
		const pipe = new Pipe(this, this.maxObjectId++);
		pipe.x = pipeX;
		pipe.y = this.#getRandomPipeY(pipe.height, pipe.gap);
		this.spawnObject(pipe);
	
		this.#frontPipeX = pipeX;
	
		// Maybe spawn fent bottle`
		if (Math.random() < defaultBottleChance) {
			this.#spawnPipeBottle(pipe);
		}
	}

	#spawnPolice() {
		const police = new Police(this, this.maxObjectId++)
		police.x = ((this.#chunkI + 1) * this.worldWidth) + 400;
		police.y = this.worldHeight - floorHeight - police.height + 20;
		this.spawnObject(police);
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
			this.removedObjectIds.push(object.id);
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
			const bottle = new Bottle(this, this.maxObjectId++, fentX, fentY, fentHeight);
			this.spawnObject(bottle)
		}
	}

	isOffscreen(object:GameObject):boolean {
		if (object.x < (this.furthestBehindFloyd?.x || -Infinity) - this.worldWidth) {
			return true;
		}

		return false;
	}

	update(dt:number) {
		if (this.#gameState != GameState.Started) {
			// Nothing to do
			return;
		}

		// Find furthest forward and behind floyds
		for (const floyd of this.floyds) {
			if (!this.furthestBehindFloyd || floyd.x < this.furthestBehindFloyd.x) {
				this.furthestBehindFloyd = floyd;
			}
			if (!this.furthestForwardFloyd || floyd.x > this.furthestForwardFloyd.x) {
				this.furthestForwardFloyd = floyd;
			}
		}

		// Pipe spawning & world generation
		const furthestVisibleX = (this.furthestForwardFloyd?.x || 0) + this.worldWidth;
		while (this.#frontPipeX < furthestVisibleX + this.#pipeSeparation) {
			this.#spawnPipe();
			this.#frontPipeX += this.#pipeSeparation;
		}
		const frontChunkI = Math.floor((this.furthestForwardFloyd?.x || 0) / this.worldWidth);
		while (this.#chunkI < frontChunkI) {
			if (Math.random() < this.#policeSpawnChance) {
				this.#spawnPolice();
			}
			this.#chunkI = frontChunkI;
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
				}),
				removedPlayerIds: this.removedPlayerIds,
				removedObjectIds: this.removedObjectIds
			}
		}
		this.removedPlayerIds = [];
		this.removedObjectIds = [];
		const gameStatePacket = JSON.stringify(gameState);
		for (const player of this.#players) {
			player.send(gameStatePacket);
		}
	}

	// Actions - activated by client
	start() {
		logger.info(`Game started`);
		if (this.#gameState === GameState.Pending) {
			this.#gameState = GameState.Started
			
			// Tell players that the game has started
			const gameStart = {
				action: "gameStart",
				data: {
					worldWidth: this.worldWidth,
					worldHeight: this.worldHeight,
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
