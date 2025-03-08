import { bgHeight, bgWidth, debug,groundWidth, ticksPerSecond, Player, player as myPlayer } from "./client.js";
import { Floyd, GameObject, gameObjects } from "./game-objects.js";

const stats = document.getElementById("stats");

export class Game {
	/**@type {number}*/ cameraX;
	/**@type {number}*/ cameraY;

	// Server properties
	/**@type {"Pending"|"Started"|"Paused"|"Over"}*/state;
	/**@type {Floyd[]}*/ floyds;
	/**@type {GameObject[]}*/ objects;
	/**@type {Player[]}*/ players;

	// Client properties
	// - Copy of floyds for the current player
	/**@type {Floyd|null}*/ serverFloyd;
	/**@type {Floyd|null}*/ clientFloyd;

	constructor() {
		this.cameraX = 0;
		this.cameraY = 0;

		this.state = "Pending";
		this.floyds = [];
		this.objects = [];
		this.players = [];

		this.serverFloyd = null;
		this.clientFloyd = null;
	}

	draw(dt) {
		ctx.save();

		// Debug stats
		if (debug === true) {
			stats.innerHTML = `<u>Debug stats:</u><p>FPS: ${Math.floor(1 / dt)}</p><p>Frame delta: ${dt.toPrecision(3)}</p><p>Server TPS: ${
				ticksPerSecond.toPrecision(3)}</p><p>Player ID: ${myPlayer.id}</p><p>Camera X: ${this.cameraX.toFixed(2)}</p><p>Camera Y: ${this.cameraY.toFixed(2)}</p>`;
		}
		else if (stats.textContent !== "") {
			stats.textContent = "";
		}

		// Apply camera transform
		this.cameraX = lerp(this.cameraX, this.clientFloyd.x, 0.3);
		this.cameraY = 0;
		ctx.translate(-this.cameraX, -this.cameraY);
		
		// Draw sky
		{
			const parallaxSpeed = 0.5;
			const offsetX = this.cameraX * parallaxSpeed;
			const chunkI = Math.floor(this.cameraX / bgWidth);
			const beforeChunkX = (chunkI - 1) * bgWidth;
			const chunkX = chunkI * bgWidth;
			const afterChunkX = (chunkI + 1) * bgWidth;	

			// Tends from stationary relative to camera to same speed as ground
			ctx.drawImage(bgImg, beforeChunkX + (offsetX % bgWidth), 0, bgWidth, bgHeight);
			ctx.drawImage(bgImg, chunkX + (offsetX % bgWidth), 0, bgWidth, bgHeight);
			ctx.drawImage(bgImg, afterChunkX + (offsetX % bgWidth), 0, bgWidth, bgHeight);
		}

		// Draw objects
		for (const object of this.objects) {
			object.draw(ctx);
		}

		// Draw ground
		{
			const chunkI = Math.floor(this.cameraX / groundWidth);
			const firstChunkX = chunkI * groundWidth;
			const secondChunkX = (chunkI + 1) * groundWidth;	
			const floorY = canvas.height - floorHeight;

			ctx.drawImage(ground, firstChunkX, floorY, 360, floorHeight);
			ctx.drawImage(ground, secondChunkX, floorY, 360, floorHeight);
		}

		// Draw floyds
		for (const floyd of this.floyds) {
			floyd.draw(ctx);
		}

		ctx.restore();
	}

	getObjectById(id) {
		for (const object of this.objects) {
			if (object.id == id) {
				return object;
			}
		}
		return null;
	}

	getFloydById(id) {
		for (const floyd of this.floyds) {
			if (floyd.id == id) {
				return floyd
			}
		}
		return null;
	}

	getPlayerById(id) {
		for (const player of this.players) {
			if (player.id == id) {
				return player;
			}
		}
		return null;
	}

	serverUpdate(serverGame) {
		this.state = serverGame.state;

		for (const serverObject of serverGame.objects) {
			// Try and find the clientside version of the game object for the given server object
			let clientObject = this.getObjectById(serverObject.id);
			if (!clientObject) {
				if (!gameObjects[serverObject.type]) {
					console.error("Couldn't construct gameObject", serverObject, "no clientside implementation found");
					continue;
				}
				// If the client has not seen this object before, create it on the clientside
				clientObject = gameObjects[serverObject.type](serverObject.id);
				this.objects.push(clientObject);
			}

			// Tell the clientside version of the object to update itself with the data from the server
			clientObject.serverUpdate(serverObject);
		}

		for (const serverPlayer of serverGame.players) {
			// Try and find the clientside version for this floyd
			let clientPlayer = this.getPlayerById(serverPlayer.id);
			if (!clientPlayer) {
				// This player has not been seen by the client before - add them
				clientPlayer = new Player(serverPlayer.id, serverPlayer.username);
				this.players.push(clientPlayer);
			}

			// Tell serverside player's floyd to update itself with data from the server
			if (serverPlayer.floyd) {
				const serverFloyd = serverPlayer.floyd;

				// If the serverFloyd was for us, then we make it our server floyd
				if (serverPlayer.id == myPlayer.id && serverPlayer.floyd) {
					this.serverFloyd = serverFloyd;
				}


				let clientFloyd = this.getFloydById(serverFloyd.id);
				// We know about this player, but don't know about their floyd - create it on our end
				if (!clientFloyd) {
					clientFloyd = new Floyd(serverFloyd.id);
					this.floyds.push(clientFloyd);

					// If the new floyd we just learned about was for us, then we make it our client floyd
					if (serverPlayer.id == myPlayer.id && serverPlayer.floyd) {
						this.clientFloyd = clientFloyd;
					}
				}

				// Update clientside floyd with data from the server
				clientFloyd.update(this.serverFloyd);
			}
		}
	}
}