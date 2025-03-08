import type { Game } from "./game";
import { GameObject, type ICollidable } from "./game-object";
import { Vector2 } from "./math";

export class Bottle extends GameObject {
	x: number;
	y: number;
	width: number;
	height: number;
	rotation: number;
	velocity: Vector2;
	solid: boolean;

	#game: Game
	#time: number

	constructor(game:Game, id:number, spawnX: number, fentY: number, fentHeight: number) {
		super(id);
		this.#game = game;
		
		this.x = spawnX;
		this.y = fentY;
		this.width = 60;
		this.height = fentHeight;
		this.rotation = 0;
		this.velocity = { x: 0, y: 0 };
		this.solid = false;

		this.#time = 0;
	}

	update(dt: number): void {
		this.#time += dt;
	
		for (const floyd of this.#game.floyds) {
			if (this.#game.isColliding(this, floyd)) {
				floyd.incrementScore(this);
				floyd.incrementFentStreak();
				floyd.incrementBottleCount();
				this.#game.removeObject(this);
			}
		}

		this.rotation = Math.sin(this.#time * 8);

		if (this.#game.isOffscreen(this)) {
			this.#game.removeObject(this);
		}
	}
}