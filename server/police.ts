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

	#game: Game

	constructor(game:Game, id:number) {
		super(id);
		this.#game = game
		
		this.x = 0;
		this.y = 0;
		this.width = 0;
		this.height = 0;
		this.velocity = { x: 0, y: 0 };
		this.solid = false;	
	}

	#spawnNarcan(){

		const narcan = new Narcan(this.#game, this.#game.maxObjectId++);
		
		narcan.x = this.x
		narcan.y = this.y;

		this.#game.spawnObject(narcan);
	}

	update(): void {
		// Handle floyd collision or locate nearest floyd
		let nearestFloyd:Floyd|null = null;
		for (const floyd of this.#game.floyds) {
			if (Vector2.distance(this, floyd)) {
				if (!nearestFloyd || Vector2.distance(this, nearestFloyd) > Vector2.distance(this, floyd)) {
					
					nearestFloyd = floyd;
					if (nearestFloyd.x > this.x) {
						nearestFloyd == null
					}
				}
			}
		}
		if (nearestFloyd != null) {
			this.#spawnNarcan()
		}
		
		if (this.#game.isOffscreen(this)) {
			this.#game.removeObject(this);
		}
	}
}