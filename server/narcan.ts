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

	constructor(game:Game, id:number, angle:number) {
		super(id);
		this.#game = game;
		this.rotation = angle;
		
		this.x = 0;
		this.y = 0;
		const scaleFactor = 0.25;
		this.width = 90 * scaleFactor;
		this.height = 128 * scaleFactor;
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

		// Handle floyd collision
		for (const floyd of this.#game.floyds) {
			if (this.#game.isColliding(this, floyd)) {
				floyd.loseOneHeart();
				this.#game.removeObject(this);
				return;
			}
		}

		// Move in direction of travel
		const newPosition = Vector2.moveForward(this, this.rotation, this.speed * dt);
		this.x = newPosition.x;
		this.y = newPosition.y;

		if (this.#game.isOffscreen(this)) {
			this.#game.removeObject(this);
		}
	}
}