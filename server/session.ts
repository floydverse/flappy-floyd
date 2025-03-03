import type { ServerWebSocket } from "bun"
import { logger, onSessionQuit, type IMessage, type PlayerData } from "./server"
import { Game } from "./game"
import type { Floyd } from "./floyd"
import { defaultSessionTimeoutS } from "./defaults";

enum SessionState {
	Lobby = "Pending",
	Started = "Started"
}

export class Session {
	#players: ServerWebSocket<PlayerData>[];
	#game: Game|null;
	#createDate: number;
	#state: SessionState;
	#capacity: number;
	#minimumPlayers:number;

	constructor() {
		this.#players = [];
		this.#game = null;
		this.#createDate = Date.now();
		this.#state = SessionState.Lobby;
		this.#capacity = 8;
		this.#minimumPlayers = 1;
	}

	startGame():void {
		logger.info(`Session is starting game...`);
		this.#state = SessionState.Started;
		this.#game = new Game(this);

		// Add players to game
		for (const player of this.#players) {
			this.#game.addPlayer(player);
		}

		// Actually start game
		this.#game.start();
	}

	tryAddPlayer(ws:ServerWebSocket<PlayerData>):boolean {
		if (this.#players.length >= this.#capacity || this.#state !== SessionState.Lobby) {
			return false
		}
		
		// Add player to session
		logger.info(`Player ${ws.data.username} sucessfully joined session`);
		
		this.#players.push(ws);
		ws.data.session = this;
		for (const player of this.#players) {
			// Tell player that a new player has joined
			const message = {
				action: "sessionJoin",
				data: {
					players: this.#players.map(p => {
						return { username: p.data.username }
					}),
					capacity: this.#capacity
				}
			};
			player.send(JSON.stringify(message));
		}

		// If we have enough players, start the game
		if (this.#players.length === this.#capacity) {
			this.startGame();
		}
		return true;
	}

	update(dt:number) {
		const now = Date.now();

		if (this.#state == SessionState.Lobby) {
			// Check for timeout
			if (now - this.#createDate > 1000 * defaultSessionTimeoutS) {
				if (this.#players.length < this.#minimumPlayers) {
					for (const player of this.#players) {
						logger.info(`Session timed out`);

						// Tell player that the session has timed out
						const message = { action: "sessionQuit" };
						player.send(JSON.stringify(message));
						
						// Remove them from referencing this session
						player.data.session = null;
					}

					// Tell server to nuke this session
					onSessionQuit(this);
				}

				this.startGame();
			}
		}

		if (this.#game) {
			this.#game.update(dt);
		}
	}

	// Called by the socket server when a message is received from a player
	onMessage(ws:ServerWebSocket<PlayerData>, data:IMessage) {
		switch (data.action) {
			case "jump": {
				ws.data.floyd?.jump();
				break;
			}
		}
	}

	// Called by game when finished
	onGameOver() {
		this.#game = null;
	}
}
