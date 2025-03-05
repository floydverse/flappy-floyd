import type { Game, ICollidable } from "./game";

export class Bottle implements ICollidable {
	id: number;
	x: number;
	y: number;
	width: number;
	height: number;
	rotation: number;
	velocity: { x: number; y: number; };

	#game: Game

	constructor(game:Game, id:number, spawnX: number, fentY: number, fentHeight: number) {
		this.#game = game
		this.id = id
		
		this.x = spawnX
		this.y = fentY
		this.width = 60
		this.height = fentHeight
		this.rotation = 0;
		this.velocity = { x: 0, y: 0 }
	}

	update(dt: number): void {
		for (const floyd of this.#game.floyds) {
			if (this.#game.isColliding(this, floyd)) {
				floyd.incrementScore(this);
				floyd.incrementFentStreak();
				floyd.incrementBottleCount();
				this.#game.removeObject(this);
			}
		}
	}
}