import type { ICollidable, Game } from "./game"
import { defaultKneeGrowth, defaultPipeGap, defaultPipeHeight, defaultPipeWidth, pipePassOffset } from "./defaults"
import type { Floyd } from "./floyd";

export class Pipe implements Object {
	id:number;
	x: number;
	y: number;
	width: number;
	height: number;
	rotation: number;
	velocity: { x: number; y: number; };
	solid: boolean;

	gap: number

	#game:Game
	#passedFloyds:Set<Floyd>
	
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
		this.rotation = 0;
		this.velocity = { x: 0, y: 0 };
		this.solid = false;

		this.gap = defaultPipeGap;
		this.#passedFloyds = new Set();
	}

	#kneeGrow(dt: number) {
		this.x -= defaultKneeGrowth * dt;
		this.y -= defaultKneeGrowth * dt;
		this.width += defaultKneeGrowth * dt;
		this.height += defaultKneeGrowth * dt;
	}

	update(dt: number): void {
		//this.#kneeGrow(dt);

		let furthestBehindFloydX = Infinity;
		let allFloydsPassed = true;
		
		for (const floyd of this.#game.floyds) {
			// Skip floyds we've already passed
			if (!this.#passedFloyds.has(floyd)) {
				allFloydsPassed = false;

				// Check collision with top & bottom knee
				const bottomPipeOffset = this.height + defaultPipeGap;
				const bottomPipeY = this.y + bottomPipeOffset;
				const bottomKneeCollidable:ICollidable = {
					x: this.x,
					y: bottomPipeY,
					width: this.width,
					height: this.height,
					rotation: 0
				};

				if (this.#game.isColliding(this, floyd) || this.#game.isColliding(bottomKneeCollidable, floyd)) {
					floyd.loseOneHeart();
					this.#game.removeObject(this);
					return; // Exit early on collision
				}
		
				// Check if this floyd has passed the pipe
				if (floyd.x > this.x + this.width + pipePassOffset) {
					floyd.incrementScore(this);
					this.#passedFloyds.add(floyd);
				}
			}
		
			furthestBehindFloydX = Math.min(furthestBehindFloydX, floyd.x);
		}
		
		// Remove the pipe if all floyds have passed and it's far enough behind
		if (allFloydsPassed && this.x < furthestBehindFloydX - this.#game.worldWidth) {
			this.#game.removeObject(this);
		}
	}
}