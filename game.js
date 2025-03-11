"use strict";
import { bgHeight, bgWidth, debug,groundWidth, ticksPerSecond, Player, player as myPlayer, floorHeight, bgImg, ground, canvas } from "./client.js";
import { Floyd, GameObject, gameObjects } from "./game-objects.js";
import { lerp } from "./math.js";

const stats = document.getElementById("stats");

export const gameStates = {
	Pending: "Pending",
	Started: "Started",
	Paused: "Paused",
	Over: "Over"
};

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

	draw(ctx, dt) {
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
			object.draw(ctx, dt);
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

		// Draw debug
		if (debug === true) {
			const debugServerFloyd = new GameObject(0);
			debugServerFloyd.debugFillStyle = "#FF000080";
			debugServerFloyd.serverUpdate(this.serverFloyd);
			debugServerFloyd.draw(ctx, dt);
		}

		// Draw floyds
		for (const floyd of this.floyds) {
			floyd.draw(ctx, dt);
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

	update(dt) {
		for (const object of this.objects) {
			object.update(dt);
		}

		for (const floyd of this.floyds) {
			floyd.update(dt);
		}
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
				clientObject = new gameObjects[serverObject.type](serverObject.id);
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
					clientFloyd.player = clientPlayer;
					this.floyds.push(clientFloyd);

					// If the new floyd we just learned about was for us, then we make it our client floyd
					if (serverPlayer.id == myPlayer.id && serverPlayer.floyd) {
						this.clientFloyd = clientFloyd;
					}
				}

				// Update clientside floyd with data from the server
				clientFloyd.serverUpdate(serverFloyd);
			}
		}

		for (const playerId of serverGame.removedPlayerIds) {
			for (let i = 0; i < this.players.length; i++) {
				if (this.players[i].id === playerId) {
					this.players.splice(i, 1);
				}
			}
		}

		for (const objectId of serverGame.removedObjectIds) {
			for (let i = 0; i < this.objects.length; i++) {
				if (this.objects[i].id === objectId) {
					this.objects.splice(i, 1);
				}
			}
		}
	}
}