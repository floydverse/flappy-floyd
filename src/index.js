////////////////////////////
// 5) Leaderboard + Fent
////////////////////////////
/*const playerNameInput = document.getElementById("playerName");
const shareScoreBtn = document.getElementById("shareScoreBtn");
const embeddedLeaderboardContainer = document.getElementById("embeddedLeaderboardContainer");
const userFentTotal = document.getElementById("userFentTotal");
const globalFentTotal = document.getElementById("globalFentTotal");

// show global in real-time
db.ref("globalFentCollected").on("value", (snap) => {
	let val = snap.val() || 0;
	globalFentTotal.textContent = val.toString();
});

// on page load => scoreboard
window.addEventListener("DOMContentLoaded", () => {
	displayLeaderboard("embeddedLeaderboardContainer");
});

// anti-spam
let lastSubmissionTime = 0;
const MIN_SUBMISSION_INTERVAL = 5000;

// typed name => localStorage
let submittedName = localStorage.getItem("submittedLeaderboardName") || null;

shareScoreBtn.addEventListener("click", () => {
	let typedName = playerNameInput.value.trim() || "Anonymous";

	if (submittedName && typedName !== submittedName) {
		alert(`You already used name "${submittedName}". Can't use a different name.`);
		return;
	}

	let currentTime = Date.now();
	if (currentTime - lastSubmissionTime < MIN_SUBMISSION_INTERVAL) {
		alert("Wait before submitting again!");
		return;
	}
	lastSubmissionTime = currentTime;

	// *** parse the highscore => store numeric
	let sharedScore = parseInt("" + highScore, 10) || 0;

	db.ref("leaderboard/" + typedName).once("value", (snap) => {
		let oldVal = snap.val();
		if (!oldVal) {
			// create => store numeric score
			db.ref("leaderboard/" + typedName).set({
				score: sharedScore
			}, (err) => {
				if (err) {
					alert("Error: " + err);
				} else {
					alert("Score submitted for name: " + typedName);
					localStorage.setItem("submittedLeaderboardName", typedName);
					submittedName = typedName;
					// refresh scoreboard
					displayLeaderboard("embeddedLeaderboardContainer");
				}
			});
		} else {
			let oldScore = parseInt(oldVal.score, 10) || 0;
			if (sharedScore > oldScore) {
				db.ref("leaderboard/" + typedName).update({
					score: sharedScore
				}, (err2) => {
					if (err2) {
						alert("Error: " + err2);
					} else {
						alert(`New highscore! (${sharedScore}) for ${typedName}`);
						displayLeaderboard("embeddedLeaderboardContainer");
					}
				});
			} else {
				alert("Your new score is not higher. No update.");
			}
		}
	});
});


// Contract copy
const copyContractBtn = document.getElementById("copyContractBtn");
const contractPlaceholder = document.getElementById("contractPlaceholder");
copyContractBtn.addEventListener("click", () => {
	let text = contractPlaceholder.textContent;
	navigator.clipboard.writeText(text)
		.then(() => alert("Contract Address Copied!"))
		.catch(err => console.error("Copy error:", err));
});
*/