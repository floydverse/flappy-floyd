import type { ICollidable } from "./game";

export class Bottle implements ICollidable {
	x: number
	y: number
	width: number
	height: number
	velocity: { x: number; y: number; };

	constructor(spawnX: number, fentY: number, fentHeight: number) {
		this.x = spawnX
		this.y = fentY
		this.width = 60
		this.height = fentHeight
		this.velocity = { x: 0, y: 0 }
	}

	update(dt: number): void {
	}
}