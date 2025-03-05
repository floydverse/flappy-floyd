import type { ServerWebSocket, TLSWebSocketServeOptions } from 'bun';
import { GameState } from './database';
import type { Floyd } from './floyd';
import { Session } from './session';

import winston from 'winston';

export const logger = winston.createLogger({
	level: "info",
	transports: [
		new winston.transports.Console({ format: winston.format.simple() }),
	],
});

let playerId = 1
const players = new Set<ServerWebSocket<PlayerData>>();
const sessions = new Set<Session>();

export interface IMessage {
	action:string,
	data:any
}

export type PlayerData = {
	id:number
	floyd:Floyd|null
	session:Session|null
	//user:User // TODO: Database users
	username:string|null
	highscore:number
}

// Main server global tick
let lastTick = performance.now();
const ticksPerSecond = 20;
const tickInterval = 1000 / ticksPerSecond;
setInterval(() => {
	let now = performance.now();
	let dt = (now - lastTick) / 1000;
	lastTick = now;

	// Update sessions
	for (const session of sessions) {
		session.update(dt);
	}
}, tickInterval);

export function onSessionQuit(session:Session) {
	sessions.delete(session);
}

const serverOptions:TLSWebSocketServeOptions<PlayerData> = {
	async fetch(req, server) {
		const success = server.upgrade(req);
		if (success) {
			return undefined;
		}
		return new Response("Not found", { status: 404 });
	},
	websocket: {
		// When player first connects
		async open(ws:ServerWebSocket<PlayerData>) {
			// Register player on game
			const newPlayerId = playerId++;
			const newPlayerName = "anon_" + newPlayerId;
			ws.data = { id: newPlayerId, floyd: null, session:null, username: newPlayerName, highscore: 0 };
			players.add(ws);

			// Send player initial info
			const packet = { action: "playerInfo", data: { playerId: newPlayerId, username: newPlayerName } };
			ws.send(JSON.stringify(packet));
			logger.info(`Player ${newPlayerName} connected to server`);
		},
		async message(ws: ServerWebSocket<PlayerData>, data: string | Buffer) {
			if (typeof data !== "string") {
				return;
			}
		
			const message: IMessage = JSON.parse(data);
		
			if (message.action == "joinSession") {
				if (ws.data.session) {
					// Player is already in a session
					return;
				}
		
				logger.info(`Player ${ws.data.username} requested to join game`);
		
				// Try and find a session to join
				let joined = false;
				for (const session of sessions) {
					if (session.tryAddPlayer(ws)) {
						joined = true;
						break;
					}
				}
		
				// If no session was found, create a new one and add the player
				if (!joined) {
					const newSession = new Session();
					sessions.add(newSession);
					newSession.tryAddPlayer(ws);
				}
			}
			else {
				// Pass it onto their current session
				ws.data.session?.onMessage(ws, message);
			}
		},
		close(ws:ServerWebSocket<PlayerData>) {
			players.delete(ws);
			//const session = playerSessions.get(ws);
			//session?.onGameOver(session.#currentGame?.score || 0);
			//playerSessions.delete(ws);
			//playerFloyds.delete(ws);
		}
	},
	port: 3000
}
const server = Bun.serve(serverOptions);

console.log(`Listening on ${server.hostname}:${server.port}`);