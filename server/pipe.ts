import type { ICollidable, Game } from "./game"
import { defaultKneeGrowth, defaultPipeHeight, defaultPipeWidth } from "./defaults"

export class Pipe implements ICollidable {
	id:number
	x: number
	y: number
	width: number
	height: number
	markedForDespawn: Boolean
	despawnTime: number
	velocity: { x: number; y: number; };

	game:Game
	
	#randomPipeY() {
		return Math.floor(Math.random() * 231) - 240;
	}

	constructor(game:Game, id:number) {
		this.game = game;
		this.id = id;

		this.x = 360;
		this.y = this.#randomPipeY();
		this.width = defaultPipeWidth;
		this.height = defaultPipeHeight;
		this.markedForDespawn = false;
		this.despawnTime = 0;
		this.velocity = { x: 0, y: 0 }
	}

	#kneeGrow(dt: number) {
		this.x -= defaultKneeGrowth * dt
		this.y -= defaultKneeGrowth * dt
		this.width += defaultKneeGrowth * dt;
		this.height += defaultKneeGrowth * dt
	}

	update(dt: number): void {
		this.#kneeGrow(dt);
	}
}