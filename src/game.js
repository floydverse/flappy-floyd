"use strict";
import { bgHeight, bgWidth, debug,groundWidth, ticksPerSecond, Player, player as myPlayer, floorHeight, bgImg, ground, canvas } from "./client.js";
import { Floyd, GameObject, gameObjects } from "./game-objects.js";
import { lerp } from "./math.js";

const stats = document.getElementById("stats");
const currentlySpectatingText = /**@type {HTMLElement}*/document.getElementById("currentlySpectatingText");

/**
 * @readonly
 * @enum {string}
 */
export const gameStates = Object.freeze({
	Pending: "Pending",
	Started: "Started",
	Paused: "Paused",
	Over: "Over"
});
/**@typedef {keyof typeof gameStates} GameState*/

/** @typedef {{ state: GameState; objects: any[]; players: any[]; removedPlayerIds: number[]; removedFloydIds: number[]; removedObjectIds: number[]; timestamp: number; }} ServerGame */

/** @typedef {{ serverTimestamp: number, receivedTimetamp: number }} TickRecord */

export class Game {
	/**@type {number}*/cameraX;
	/**@type {number}*/cameraY;

	// Server properties
	/**@type {"Pending"|"Started"|"Paused"|"Over"}*/state;
	/**@type {Floyd[]}*/floyds;
	/**@type {GameObject[]}*/objects;
	/**@type {Player[]}*/players;

	// Client properties
	// - Copy of floyds for the current player
	/**@type {Floyd|null}*/serverFloyd;
	/**@type {Floyd|null}*/clientFloyd;
	/**@type {Floyd|null}*/spectatingFloyd;
	// Rolling log of server tick dates (TPS)
	/**@type {TickRecord[]}*/tickHistory;

	constructor() {
		this.cameraX = 0;
		this.cameraY = 0;

		this.state = "Pending";
		this.floyds = [];
		this.objects = [];
		this.players = [];

		this.serverFloyd = null;
		this.clientFloyd = null;
		this.spectatingFloyd = null;
		this.tickHistory = [];
	}

	/**
	 * @param {Player} player 
	 */
	addPlayer(player) {
		this.players.push(player);
	}

	/**
	 * @param {Floyd} floyd
	 */
	spectateFloyd(floyd) {
		this.spectatingFloyd = floyd;
		currentlySpectatingText.textContent = "Currently spectating: " + floyd.player.username;
	}

	/**
	 * @param {CanvasRenderingContext2D} ctx
	 * @param {number} dt
	 */
	draw(ctx, dt) {
		ctx.save();

		// Debug stats
		if (debug === true) {
			stats.innerHTML = `<u>Debug stats:</u><p>FPS: ${Math.floor(1 / dt)}</p><p>Frame delta: ${dt.toPrecision(3)}</p><p>Server TPS: ${
				ticksPerSecond.toPrecision(3)}</p><p>Received TPS: ${this.calculateReceivedTps()}</p><p>Mean recv. latency: ${
				this.calculateReceiveLatency().toPrecision(3)}ms</p><p>Player ID: ${myPlayer.id}</p><p>Camera X: ${
				this.cameraX.toFixed(2)}</p><p>Camera Y: ${this.cameraY.toFixed(2)}</p>`;
		}
		else if (stats.textContent !== "") {
			stats.textContent = "";
		}

		// Apply camera transform
		const followingFloyd = this.clientFloyd ?? this.spectatingFloyd;
		if (followingFloyd) {
			this.cameraX = lerp(this.cameraX, followingFloyd.x, 0.3);
			this.cameraY = 0;
		}
		else {
			this.cameraX = 0;
			this.cameraY = 0;
		}
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

		// Draw debug server floyd
		if (debug === true && this.serverFloyd) {
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

	/**
	 * @param {number} id
	 */
	getObjectById(id) {
		for (const object of this.objects) {
			if (object.id == id) {
				return object;
			}
		}
		return null;
	}

	/**
	 * @param {number} id
	 */
	getFloydById(id) {
		for (const floyd of this.floyds) {
			if (floyd.id == id) {
				return floyd
			}
		}
		return null;
	}

	/**
	 * @param {number} id
	 */
	getPlayerById(id) {
		for (const player of this.players) {
			if (player.id == id) {
				return player;
			}
		}
		return null;
	}


	/**
	 * @param {Floyd} floyd
	 */
	removeFloyd(floyd) {
		// Remove this floyd from the game
		const floydIdx = this.floyds.indexOf(floyd);
		if (floydIdx !== -1) {
			this.floyds.splice(floydIdx, 1);
		}

		// Kinda sus - remove all references to this floyd
		const player = floyd.player;
		if (player) {
			player.floyd = null;
		}

		// Special case when we are the ones being removed from the game
		if (floyd.player?.id === myPlayer?.id) {
			this.serverFloyd = null;
			this.clientFloyd = null;
		}
	}

	/**
	 * @param {Player} player
	 */
	removePlayer(player) {
		// Remove this player from the game
		const playerIdx = this.players.indexOf(player);
		if (playerIdx != -1) {
			this.players.splice(playerIdx, 1);
		}

		// Remove the floyd for this player
		if (player.floyd) {
			this.removeFloyd(player.floyd);
		}
	}

	update(/**@type {number}*/dt) {
		for (const object of this.objects) {
			object.update(dt);
		}

		for (const floyd of this.floyds) {
			floyd.update(dt);
		}
	}

	/**
	 * @param {ServerGame} serverGame
	 */
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
				if (serverPlayer.id == myPlayer?.id && serverPlayer.floyd) {
					this.serverFloyd = serverFloyd;
				}

				let clientFloyd = this.getFloydById(serverFloyd.id);
				// We know about this player, but don't know about their floyd - create it on our end
				if (!clientFloyd) {
					clientFloyd = new Floyd(serverFloyd.id);
					clientPlayer.floyd = clientFloyd;
					clientFloyd.player = clientPlayer;
					this.floyds.push(clientFloyd);

					// If the new floyd we just learned about was for us, then we make it our client floyd
					if (serverPlayer.id == myPlayer?.id && serverPlayer.floyd) {
						this.clientFloyd = clientFloyd;
					}
				}

				// Update clientside floyd with data from the server
				clientFloyd.serverUpdate(serverFloyd);
			}
		}

		// Remove players that are no longer in the game
		for (const removedPlayerId of serverGame.removedPlayerIds) {
			const player = this.getPlayerById(removedPlayerId);
			if (player) {
				this.removePlayer(player);
			}
		}

		// Remove floyds that have been despawned
		for (const removedFloydId of serverGame.removedFloydIds) {
			const floyd = this.getFloydById(removedFloydId);
			if (floyd) {
				this.removeFloyd(floyd);
			}
		}

		// Remove objects that have been despawned
		for (const objectId of serverGame.removedObjectIds) {
			for (let i = 0; i < this.objects.length; i++) {
				if (this.objects[i].id === objectId) {
					this.objects.splice(i, 1);
				}
			}
		}

		// Track received TPS
		this.tickHistory.push({ serverTimestamp: serverGame.timestamp, receivedTimetamp: Date.now() });
		const clearWindow = Date.now() - 10000;
		this.tickHistory = this.tickHistory.filter(tick => tick.serverTimestamp > clearWindow);		
	}

	calculateReceivedTps() {
		const lastSecond = Date.now() - 1000;
		return this.tickHistory.filter(tick => tick.receivedTimetamp > lastSecond).length;
	}

	calculateReceiveLatency() {
		const pongDeltas = this.tickHistory.map(tick => tick.receivedTimetamp - tick.serverTimestamp);
		return pongDeltas.reduce((accumulator, delta) => accumulator + delta) / pongDeltas.length;
	}
}