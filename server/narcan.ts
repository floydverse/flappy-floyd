import type { Floyd } from "./floyd";
import type { Game } from "./game";
import { GameObject, type ICollidable } from "./game-object";
import { Vector2 } from "./math";

export class Narcan extends GameObject {
	x: number;
	y: number;
	width: number;
	height: number;
	rotation: number;
	velocity: Vector2;
	solid: boolean;

	speed: number;

	#game: Game
	#time: number

	constructor(game:Game, id:number) {
		super(id);
		this.#game = game;
		
		this.x = 0;
		this.y = 0;
		const scaleFactor = 0.2;
		this.width = 90 * scaleFactor;
		this.height = 128 * scaleFactor;
		this.rotation = 0;
		this.velocity = { x: 0, y: 0 };
		this.solid = false;

		this.speed = 200;
		this.#time = 0;
	}

	update(dt: number): void {
		this.#time += dt;
		if (this.#time > 3) {
			this.#game.removeObject(this);
		}

		// Handle floyd collision or locate nearest floyd
		let nearestFloyd:Floyd|null = null;
		for (const floyd of this.#game.floyds) {
			if (this.#game.isColliding(this, floyd)) {
				floyd.loseOneHeart();
				this.#game.removeObject(this);
				return;
			}
			
			if (Vector2.distance(this, floyd)) {
				if (!nearestFloyd || Vector2.distance(this, nearestFloyd) > Vector2.distance(this, floyd)) {
					nearestFloyd = floyd;
				}
			}
		}
		if (nearestFloyd == null) {
			return;
		}

		// Gravitate towards nearest floyd
		const newPosition = Vector2.moveTowards(this, nearestFloyd, this.speed * dt);
		this.x = newPosition.x;
		this.y = newPosition.y;

		// Angle to nearest floyd
		const deltaX = nearestFloyd.x - this.x;
		const deltaY = nearestFloyd.y - this.y;
		this.rotation = Math.atan2(deltaY, deltaX) + (Math.PI / 2);

		if (this.#game.isOffscreen(this)) {
			this.#game.removeObject(this);
		}
	}
}