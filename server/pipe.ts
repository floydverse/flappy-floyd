import type { ICollidable, Game } from "./game"
import { defaultKneeGrowth, defaultPipeGap, defaultPipeHeight, defaultPipeWidth } from "./defaults"

export class Pipe implements ICollidable {
	id:number
	x: number
	y: number
	width: number
	height: number

	gap: number
	velocity: { x: number; y: number; };

	#game:Game
	
	#randomPipeY() {
		return Math.floor(Math.random() * 231) - 240;
	}

	constructor(game:Game, id:number) {
		this.#game = game;
		this.id = id;

		this.x = 360;
		this.y = this.#randomPipeY();
		this.width = defaultPipeWidth;
		this.height = defaultPipeHeight;
		this.gap = defaultPipeGap;
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

		// Detect collision with floyds
		for (const floyd of this.#game.floyds) {
			// Check collision with top & bottom knee
			const bottomPipeOffset = this.height + defaultPipeGap;
			const bottomPipeY = this.y + bottomPipeOffset;		
			if (
				(this.x < floyd.x + floyd.width &&
				this.x + this.width > floyd.x &&
				this.y < floyd.y + floyd.height &&
				this.y + this.height > floyd.y)	
				||
				(this.x < floyd.x + floyd.width &&
				this.x + this.width > floyd.x &&
				bottomPipeY < floyd.y + floyd.height &&
				bottomPipeY + this.height > floyd.y	)
			) {
				floyd.loseOneHeart();
				this.#game.removeObject(this);
			}
		}
	}
}