import	 { Vector2 } from "./math";

export interface ICollidable {
	x:number;
	y:number;
	width:number;
	height:number;
	rotation:number;
}

export class GameObject implements ICollidable, Vector2 {
	id:number;
	x: number;
	y: number;
	width: number;
	height: number;
	rotation: number;
	velocity: Vector2;
	solid: boolean;

	constructor(id:number) {
		this.id = id;
		this.x = 0;
		this.y = 0;
		this.width = 0;
		this.height = 0;
		this.rotation = 0;
		this.velocity = { x: 0, y: 0 };
		this.solid = false;
	}

	update(dt:number):void { }
}