"use strict";
import { debug, player as myPlayer, Player, updateHeartsUI, updateInGameScore } from "./client.js";
import { clamp, lerp } from "./math.js";

export let gameObjects = {};
export class GameObject {
	/**@type {number}*/id;
	/**@type {number}*/x;
	/**@type {number}*/y;
	/**@type {number}*/width;
	/**@type {number}*/height;
	/**@type {number}*/rotation;
	/** @type {{x:number, y:number}}*/velocity;

	/**@type {string}*/static type = "GameObject";
	/**@type {HTMLImageElement}*/static defaultImage;

	static {
		const image = new Image();
		this.defaultImage = image;
	}

	/**
	 * @param {number} id 
	 */
	constructor(id) {
		this.id = id;
		this.x = 0;
		this.y = 0;
		this.width = 0;
		this.height = 0;
		this.rotation = 0;
		this.velocity = { x: 0, y: 0 };

		// Additional state
		this.image = /** @type {typeof GameObject}*/(this.constructor).defaultImage;
		this.debugFillStyle = "#00FF0080";
	}

	drawDebug(ctx, dt) {
		ctx.fillStyle = this.debugFillStyle;
		ctx.fillRect(-this.width / 2, -this.height / 2, this.width, this.height);
	}

	drawSprite(ctx, dt) {
		// @ts-ignore
		ctx.drawImage(this.image, -this.width / 2, -this.height / 2, this.width, this.height);
	}

	/**
	 * Render the object to the game screen 
	 * @param {CanvasRenderingContext2D} ctx 
	 * @param {number} dt
	 */
	draw(ctx, dt) {
		ctx.save();
		ctx.translate(this.x + this.width / 2, this.y + this.height / 2);
		ctx.rotate(this.rotation);
		if (debug === true) {
			this.drawDebug(ctx, dt);
		}
		this.drawSprite(ctx, dt);
		ctx.restore();
	}

	/**
	 * Perform client side updates for the object
	 * @param {number} dt 
	 */
	update(dt) { }

	/**
	 * @param {any} serverThis
	 */
	serverUpdate(serverThis) {
		this.x = serverThis.x;
		this.y = serverThis.y;
		this.width = serverThis.width;
		this.height = serverThis.height;
		this.rotation = serverThis.rotation;
		this.velocity = serverThis.velocity;
	}
}

// Client side prediction
const defaultGravity = 980;
const defaultFloydSpeed = 150;
const defaultFloydLift = -400;
const defaultFloydAngleSpeed = 0.22;
const defaultFloydAngleMaxVelocity = 600;

export class Floyd extends GameObject {
	// Client properties
	/**@type {string}*/static type = "Floyd";
	/**@type {HTMLImageElement}*/static defaultImage;
	/**@type {HTMLImageElement}*/static flappingImage;
	/**@type {Player|null}*/ player;

	// Server properties
	/**@type {number}*/hearts;
	/**@type {number}*/score;
	/**@type {number}*/currentMultiplier;

	static {
		const image = new Image();
		image.src = "assets/flappyfloyd.png";
		this.defaultImage = image;
		const flappingImage = new Image();
		flappingImage.src = "assets/flappyfloydflapping.png";
		this.flappingImage = flappingImage;
	}

	constructor(id) {
		super(id);
		this.x = 50;
		this.y = 200;
		const scaleFactor = 1.35;
		this.width = 53 * scaleFactor;
		this.height = 46 * scaleFactor;
		this.rotation = 0;
		this.velocity = { x: defaultFloydSpeed, y: 0 };

		this.player = null;

		// Server state
		this.hearts = 5;
		this.score = 0;
		this.currentMultiplier = 1;
	}

	update(dt) {
		// Apply gravity to the predicted velocity (y-axis)
		this.velocity.y += defaultGravity * dt;

		// Update predicted position based on velocity
		this.x += this.velocity.x * dt;
		this.y += this.velocity.y * dt;

		// Smooth rotation based on predicted vertical velocity
		const targetAngle = (this.velocity.y / defaultFloydAngleMaxVelocity) * (Math.PI / 2); // ±90° range
		this.rotation = clamp(lerp(this.rotation, targetAngle, defaultFloydAngleSpeed), -Math.PI / 2, Math.PI / 2);
	}

	// Update client-side prediction
	draw(ctx, dt) {
		// Draw floyd
		if (this.velocity.y > 0) {
			this.image = /**@type {typeof Floyd}*/(this.constructor).defaultImage;
		}
		super.draw(ctx, dt);

		// Draw username
		ctx.save();
		ctx.textAlign = "center";
		ctx.fillStyle = "black";
		ctx.fillText(this.player?.username, this.x + this.width / 2 + 1, this.y + 1);
		ctx.fillStyle = this.player?.id === myPlayer?.id ? "yellow" : "white";
		ctx.fillText(this.player?.username, this.x + this.width / 2, this.y);
		ctx.restore()

		// Draw UI
		if (this.player?.id === myPlayer?.id) {
			updateHeartsUI(this.hearts);
			updateInGameScore(this.score, this.currentMultiplier);
		}
	}

	// Simulate a jump (client-side)
	jump() {
		this.velocity.y = defaultFloydLift;
		this.image = /**@type {typeof Floyd}*/(this.constructor).flappingImage;
	}

	// Correct the predicted position with the server's position data
	serverUpdate(serverFloyd) {
		this.currentMultiplier = serverFloyd.currentMultiplier;
		this.score = serverFloyd.score;
		this.hearts = serverFloyd.hearts;
		this.width = serverFloyd.width;
		this.height = serverFloyd.height;

		// Correct position based on server's position
		const positionErrorX = serverFloyd.x - this.x;
		const positionErrorY = serverFloyd.y - this.y;
		const rotationError = serverFloyd.rotation - this.rotation;

		// Apply server position correction with damping
		const correctionFactor = 0.3;
		this.x += positionErrorX * correctionFactor;
		this.y += positionErrorY * correctionFactor;
		this.rotation += rotationError * correctionFactor;

		// Correct the predicted velocity based on server velocity
		this.velocity.x = serverFloyd.velocity.x;
		this.velocity.y = serverFloyd.velocity.y;
	}
}
gameObjects.Floyd = Floyd;

export class Pipe extends GameObject {
	/**@type {string}*/static type = "Pipe";
	/**@type {HTMLImageElement}*/static defaultImage;
	/**@type {HTMLImageElement}*/static bottomImage;

	/**@type {number}*/gap;

	static {
		const image = new Image();
		image.src = "assets/pipetop.png";
		this.defaultImage = image;

		const bottomImage = new Image();
		bottomImage.src = "assets/pipebottom.png";
		this.bottomImage = bottomImage;
	}

	constructor(id) {
		super(id);
		this.gap = 0;
	}

	draw(ctx, dt) {
		// Top pipe can be drawn with generic method
		super.draw(ctx, dt);

		// Custom logic to draw bottom pipe
		ctx.save();
		ctx.translate(this.x + this.width / 2, this.y + this.height / 2);
		ctx.rotate(this.rotation);
		if (debug === true) {
			ctx.fillStyle = "#00FF0080";
			ctx.fillRect(-this.width / 2, -this.height / 2, this.width, this.height);
		}
		//@ts-ignore
		ctx.drawImage(this.constructor.bottomImage, -this.width / 2, -this.height / 2 + this.height + this.gap, this.width, this.height);
		ctx.restore();
	}

	serverUpdate(serverPipe) {
		super.serverUpdate(serverPipe);
		this.gap = serverPipe.gap;
	}
}
gameObjects.Pipe = Pipe;

export class Bottle extends GameObject {
	/**@type {string}*/static type = "Bottle";

	static {
		const image = new Image();
		image.src = "assets/bottle.png";
		this.defaultImage = image;
	}

	constructor(id) {
		super(id);
	}
}
gameObjects.Bottle = Bottle;

export class Narcan extends GameObject {
	/**@type {string}*/static type = "Narcan";

	static {
		const image = new Image();
		image.src = "assets/narcan.png";
		this.defaultImage = image;
	}

	constructor(id) {
		super(id);
	}

	drawSprite(ctx, dt) {
		// Account for misaligned rotation of narcan texture
		ctx.rotate(Math.PI / 2);
		super.drawSprite(ctx, dt);
	}
}
gameObjects.Narcan = Narcan;

export class Police extends GameObject {
	/**@type {string}*/static type = "Police";
	/**@type {HTMLImageElement}*/static reloadingImage;
	/**@type {HTMLImageElement}*/static shootingImage;
	/**@type {"Searching"|"Reloading"|"Shooting"}*/state;

	static {
		const image = new Image();
		image.src = "assets/police.png";
		this.defaultImage = image;

		const reloadingImage = new Image();
		reloadingImage.src = "assets/policereloading.png";
		this.reloadingImage = reloadingImage;

		const shootingImage = new Image();
		shootingImage.src = "assets/policeshooting.png";
		this.shootingImage = shootingImage;
	}

	constructor(id) {
		super(id);
	}

	serverUpdate(serverPolice) {
		super.serverUpdate(serverPolice);

		this.state = serverPolice.state;
		switch (this.state) {
			case "Reloading": {
				this.image = /**@type {typeof Police}*/(this.constructor).reloadingImage;
				break;
			}
			case "Shooting": {
				this.image = /**@type {typeof Police}*/(this.constructor).shootingImage;
				break;
			}
			default: {
				this.image = /**@type {typeof Police}*/(this.constructor).defaultImage;
				break;
			}
		}
	}
}
gameObjects.Police = Police;
