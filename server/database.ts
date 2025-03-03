type User = {
	id:number
	username:string|null
	walletAddress:number|null
	createdAt:number
}

enum GameMode {
	Classic = "Classic",
	BattleRoyale = "BattleRoyale",
	Race = "Race",
	BoshRush = "BoshRush"
}

type UserStats = {
	id:number
	gameMode:GameMode
	gamesPlayed:number
	gamesWon:number
	totalFent:number
	totalDistance:number
}


type Game = {
	id:number
	gameMode:GameMode
	startedAt:number
	endedAt:number
	status:GameState
	totalPrizePool:number
	entryFee:number
}

type GameResult = {
	id:number
	gameId:number
	userId:number
	score:number
	place:number
	kneeCollisions:number
	fentCollected:number
	narcanCollected:number
}

enum TransactionType {
	WinReward = "winreward",
	EntryFee = "entryfee",
	Deposit = "deposit",
	Withdrawl = "withdrawl"
}

type WalletTransaction = {
	id:number
	userId:number
	transactionType:TransactionType
	amount:number
	gameId:number
	solanaTransactionId:number
	createdAt:number
}

export { GameMode, GameState, TransactionType }
export type { User, UserStats, Game, GameResult, WalletTransaction }
