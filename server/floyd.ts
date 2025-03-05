import type { ServerWebSocket } from "bun"
import { defaultGravity, defaultHearts, defaultFloydSpeed, defaultFloydLift, defaultFloydAngleSpeed, defaultFloydAngleMaxVelocity, floorHeight, bottlesNeededForHeart, maxHearts } from "./defaults"
import type { Game, ICollidable } from "./game"
import type { PlayerData } from "./server"
import { clamp, lerp } from "./math";

export class Floyd implements ICollidable {
	id: number;

	x: number;
	y: number;
	width: number
	height: number;
	rotation: number;
	velocity: { x:number, y:number };

	score: number;
	hearts: number;
	fentCount: number;
	fentStreak: number;
	fentMultiplier: number;
	bottleCount: number;
	currentMultiplier: number;

	#game: Game;
	#ws: ServerWebSocket<PlayerData>;

	constructor(game:Game, id:number, ws:ServerWebSocket<PlayerData>) {
		this.#game = game;
		this.id = id;
		this.#ws = ws;
		
		this.x = 50;
		this.y = 200; 
		this.width = 100;
		this.height = 75;
		this.rotation = 0;
		this.velocity = { x: 0, y: 0 };

        this.score = 0;
        this.hearts = defaultHearts;
		this.fentCount = 0;
		this.fentStreak = 0;
		this.fentMultiplier = 1;
		this.bottleCount = 0;
		this.currentMultiplier = 1;
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

		// Ground collision
		const bottom = this.y + this.height;
		const floorY = this.#game.worldHeight - floorHeight;
		if (bottom >= floorY) {
			this.loseOneHeart();
			this.y = floorY - this.height - 1;
			this.velocity.y = defaultFloydLift;
		}

		const targetAngle = (this.velocity.y / defaultFloydAngleMaxVelocity) * (Math.PI / 2); // ±90° range
		this.rotation = clamp(lerp(this.rotation, targetAngle, defaultFloydAngleSpeed), -Math.PI / 2, Math.PI / 2);		
	}

	jump() {
		this.velocity.y = defaultFloydLift;
	}

	incrementScore(from:ICollidable|null=null) {
		let gained = 1 * this.currentMultiplier;
		this.score += gained;

		// Send score update to client
		const scoreIncrement = { action:"scoreIncrement", data: { from: from?.id, gained: gained } };
		this.#ws.send(JSON.stringify(scoreIncrement));
	}

	incrementFentStreak() {
		this.fentStreak++;
		if (this.fentStreak >= 3) {
			this.currentMultiplier++;
			this.fentStreak = 0;
		}
	}

	incrementBottleCount() {
		this.bottleCount++;
		if (this.bottleCount >= bottlesNeededForHeart) {
			this.bottleCount = 0;
			if (this.hearts < maxHearts) {
				this.hearts++;
			}
		}
}

	resetFentStreak() {
		this.fentStreak = 0;
		this.currentMultiplier = 1;
	}

	quit() {

	}

	loseOneHeart() {
		if (this.hearts > 0) {
			this.hearts--;
			this.resetFentStreak();
		}
		else {
			this.quit();
		}
	}
}

