import type { ServerWebSocket } from "bun"
import { defaultGravity, defaultHearts, defaultFloydSpeed as defaultFloydSpeed, lift } from "./defaults"
import type { Game, ICollidable } from "./game"
import type { PlayerData } from "./server"

export class Floyd implements ICollidable {
	id: number

	x: number
	y: number
	width: number
	height: number
	velocity: { x:number, y:number }

	score: number
	hearts: number
	fentCount: number
	fentStreak: number
	fentMultiplier: number
	currentMultiplier: number

	#game: Game
	#ws: ServerWebSocket<PlayerData>

	constructor(ws:ServerWebSocket<PlayerData>, game:Game, id:number) {
		this.#ws = ws
		this.#game = game
		this.id = id
		
		this.x = 50;
		this.y = 200; 
		this.width = 100
		this.height = 75
		this.velocity = { x: 0, y: 0 }

        this.score = 0
        this.hearts = defaultHearts
		this.fentCount = 0
		this.fentStreak = 0
		this.fentMultiplier = 1
		this.currentMultiplier = 1
	}

	update(dt: number): void {
		this.velocity.y += defaultGravity * dt;
		this.y += this.velocity.y * dt;
		this.x += defaultFloydSpeed * dt;

		// Clamp Y position
		if (this.y > this.#game.worldHeight) {
			this.y = this.#game.worldHeight;
			this.velocity.y = 0;
		}		
	}

	jump() {
		this.velocity.y = lift;
	}

	incrementScore() {
		let gained = 1 * this.currentMultiplier;
		this.score += gained;
	}

	incrementFentStreak() {
		this.fentStreak++;
		if (this.fentStreak >= 3) {
			this.currentMultiplier++;
			this.fentStreak = 0;
		}
	}

	resetFentStreak() {
		this.fentStreak = 0;
		this.currentMultiplier = 1;
	}
		
	loseOneHeart() {
		if (this.hearts > 0) {
			this.hearts--;
			this.resetFentStreak();
		}
		else {
			//this.quit();
		}
	}
}

