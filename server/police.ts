import { GameObject } from "./game-object";
import type { Pipe } from "./pipe";
import { Narcan } from "./narcan";
import type { Game } from "./game";
import { Vector2 } from "./math";
import type { Floyd } from "./floyd";

export class Police extends GameObject {
	x: number;
	y: number;
	width: number;
	height: number;
	velocity: Vector2;
	solid: boolean;
	
	state:"Searching"|"Shooting"|"Reloading";

	#game: Game
	#lastNarcanSpawn:number;
	#maxSearchRadius:number;
	#reloadTimeMs:number;
	#shotDelayMs:number;

	constructor(game:Game, id:number) {
		super(id);
		this.#game = game
		
		this.x = 0;
		this.y = 0;
		const scaleFactor = 0.6;
		this.width = 128 * scaleFactor;
		this.height = 200 * scaleFactor;
		this.velocity = { x: 0, y: 0 };
		this.solid = false;	

		this.state = "Searching"
		this.#lastNarcanSpawn = 0;
		this.#maxSearchRadius = 360;
		this.#reloadTimeMs = 1500;
		this.#shotDelayMs = 300;
	}

	#spawnNarcan(angle:number):void {
		const narcan = new Narcan(this.#game, this.#game.maxObjectId++, angle);
		narcan.x = this.x
		narcan.y = this.y;
		this.#game.spawnObject(narcan);
	}

	update(): void {
		// Locate nearest floyd
		let nearestFloyd:Floyd|null = null;
		for (const floyd of this.#game.floyds) {
			if (!nearestFloyd || Vector2.distance(this, nearestFloyd) > Vector2.distance(this, floyd)) {	
				nearestFloyd = floyd;
			}
		}
		if (nearestFloyd == null || Vector2.distance(this, nearestFloyd) > this.#maxSearchRadius) {
			this.state = "Searching";
			return;
		}
		if (Date.now() - this.#lastNarcanSpawn < this.#reloadTimeMs) {
			this.state = "Reloading";
			return;
		}

		// Change state to shooting
		this.state = "Shooting";
		// Delay shot to give player time to react
		setTimeout(() => {
			if (this.state !== "Shooting") {
				return; // Ensure it hasn't changed
			}
			const deltaX = nearestFloyd!.x - this.x;
			const deltaY = nearestFloyd!.y - this.y;
			let narcanAngle = Math.atan2(deltaY, deltaX);
			this.#spawnNarcan(narcanAngle);
			this.#lastNarcanSpawn = Date.now();
		}, this.#shotDelayMs);

		if (this.#game.isOffscreen(this)) {
			this.#game.removeObject(this);
		}
	}
}