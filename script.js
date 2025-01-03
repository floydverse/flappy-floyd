////////////////////////////////////////////
// script.js - Single overlay + localStorage only
// No Firebase references, minimal changes
////////////////////////////////////////////

let lastTime=0;
function getDeltaFactor(currentTime){
  const msPerFrame=16.6667;
  let dt=(currentTime - lastTime)/msPerFrame;
  lastTime=currentTime;
  if(dt>0.5) dt=0.5;
  if(dt<0) dt=0;
  return dt;
}

const canvas=document.getElementById("gameCanvas");
const ctx=canvas.getContext("2d");
ctx.imageSmoothingEnabled=false;

// Bird
const flappyFloyd=new Image();
flappyFloyd.src="./assets/flappyfloyd.png";
let birdWidth=100, birdHeight=75;
let floydX=50, floydY=200, velocity=0;
let gravity=0.2, lift=-4;

function jump(){
  if(!gamePaused && gameState==="running"){
    velocity= lift;
  }
}
document.addEventListener("keydown",(e)=>{
  if(["Space","ArrowUp","KeyW"].includes(e.code)){
    jump();
  }
});
document.addEventListener("mousedown",()=>{
  jump();
  pauseBtn.blur();
  muteBtn.blur();
});
document.addEventListener("touchstart",()=>{
  jump();
});

// BG
const BG_WIDTH=361, BG_HEIGHT=640;
const bgImg=new Image();
bgImg.src="./assets/background.png";
let bgX1=0, bgX2=BG_WIDTH;
let bgScrollSpeed=0.5;
function scrollBackground(dt){
  if(!gamePaused){
    bgX1-= bgScrollSpeed* dt;
    bgX2-= bgScrollSpeed* dt;
  }
  let dx1=Math.floor(bgX1), dx2=Math.floor(bgX2);
  ctx.drawImage(bgImg, dx1,0,BG_WIDTH,BG_HEIGHT);
  ctx.drawImage(bgImg, dx2,0,BG_WIDTH,BG_HEIGHT);
  if(dx1<=-BG_WIDTH) bgX1= dx2+BG_WIDTH;
  if(dx2<=-BG_WIDTH) bgX2= dx1+BG_WIDTH;
}

// GROUND
const ground=new Image();
ground.src="./assets/ground.png";
let groundScrollSpeed=2;
let groundX1=0, groundX2=360;
let floorHeight=56;
function scrollGround(dt){
  if(!gamePaused){
    groundX1-= groundScrollSpeed* dt;
    groundX2-= groundScrollSpeed* dt;
  }
  let gx1=Math.floor(groundX1), gx2=Math.floor(groundX2);
  let floorY= canvas.height-floorHeight;
  ctx.drawImage(ground, gx1,floorY, 360,floorHeight);
  ctx.drawImage(ground, gx2,floorY, 360,floorHeight);
  if(gx1<=-360) groundX1= gx2+360;
  if(gx2<=-360) groundX2= gx1+360;
}

// PIPES
const pipeTop=new Image();
pipeTop.src="./assets/pipeTop.png";
const pipeBottom=new Image();
pipeBottom.src="./assets/pipeBottom.png";
let pipeWidth=150, pipeHeight=390, pipeGap=180;
let pipeSpeed=1.5;
let pipes=[];
function randomPipeY(){
  return Math.floor(Math.random()*231)-240;
}

// BOTTLES (Fent)
const bottleImg=new Image();
bottleImg.src="./assets/bottle.png";
const heartIcon="./assets/heart.png";
let bottles=[];
let bottleChance=0.3;
let bottleCount=0;
let bottlesNeededForHeart=5;
let hearts=5, maxHearts=5;

// MULTIPLIER
let fentStreak=0;
let currentMultiplier=1;
function isColliding(r1,r2){
  return (
    r1.x< r2.x + r2.width &&
    r1.x + r1.width> r2.x &&
    r1.y< r2.y + r2.height &&
    r1.y + r1.height> r2.y
  );
}
function spawnFentInGap(spawnX, pipeY){
  const offset= pipeHeight + pipeGap;
  const margin=30;
  const fentHeight=60;
  let gapTop= pipeY+ pipeHeight + margin;
  let gapBottom= (pipeY+offset) - fentHeight - margin;
  if(gapBottom> gapTop){
    let fenY= Math.floor(Math.random()*(gapBottom-gapTop))+ gapTop;
    bottles.push({x: spawnX, y: fenY, width:60, height:fentHeight});
  }
}
function maybeSpawnBottle(pipeX, pipeY){
  if(Math.random()< bottleChance){
    spawnFentInGap(pipeX, pipeY);
  }
  let halfX= pipeX + (canvas.width/2);
  if(halfX>canvas.width){
    if(Math.random()< bottleChance){
      spawnFentInGap(halfX, pipeY);
    }
  }
}

// OFFLINE user fent => localStorage
let offlineUserFent=0;
if(localStorage.getItem("offlineUserFent")){
  offlineUserFent= parseInt(localStorage.getItem("offlineUserFent"))|| 0;
}

// hearts
const hud=document.getElementById("hud");
const heartsDisplay=document.createElement("div");
heartsDisplay.id="heartsDisplay";
hud.appendChild(heartsDisplay);
function updateHeartsDisplay(){
  heartsDisplay.innerHTML="";
  for(let i=0; i< hearts; i++){
    let im=document.createElement("img");
    im.src= heartIcon;
    im.className="heart-img";
    heartsDisplay.appendChild(im);
  }
}
function loseOneHeart(){
  if(hearts>1){
    hearts--;
    updateHeartsDisplay();
    resetFentStreak();
    updateInGameScore();
  } else {
    gameOver();
  }
}

// SCORE
let score=0, highScore=0;
if(localStorage.getItem("flappyFloydHighScore")){
  highScore= parseInt(localStorage.getItem("flappyFloydHighScore"));
}
const scoreText=document.getElementById("scoreText");
const highScoreText=document.getElementById("highScoreText");
const inGameScore=document.getElementById("inGameScore");
const multiplierText=document.getElementById("multiplierText");
const topHighscoreText=document.getElementById("topHighscoreText");
const plusOneContainer=document.getElementById("plusOneContainer");
function updateScoreUI(){
  scoreText.textContent="Score: "+ score;
  highScoreText.textContent="Highscore: "+ highScore;
  topHighscoreText.textContent="Highscore: "+ highScore;
}
function updateInGameScore(){
  inGameScore.textContent= score.toString();
  if(currentMultiplier>1){
    let hue=(performance.now()/10)%360;
    inGameScore.style.color=`hsl(${hue},100%,50%)`;
    multiplierText.style.display="block";
    multiplierText.textContent="x"+ currentMultiplier;
  } else {
    inGameScore.style.color="#ffdb4d";
    multiplierText.style.display="none";
  }
}
function showPlusOne(amount){
  let plusOne=document.createElement("div");
  plusOne.className="plusOne";
  plusOne.textContent= amount;
  plusOneContainer.appendChild(plusOne);
  setTimeout(()=> plusOneContainer.removeChild(plusOne),1000);
}

// MULTIPLIER
function incrementFentStreak(){
  fentStreak++;
  if(fentStreak>=3){
    currentMultiplier++;
    fentStreak=0;
  }
}
function resetFentStreak(){
  fentStreak=0;
  currentMultiplier=1;
}

// State
let gamePaused=false;
let gameState="start";
let difficultyInterval=12000;
let speedIncrement=0.3;
let nextDifficultyTime= performance.now()+ difficultyInterval;

// BG music
const bgMusic=new Audio("./assets/flappyfloydonsolana.wav");
bgMusic.loop=true;

// overlay
const overlay=document.getElementById("overlay");
const gameOverText=document.getElementById("gameOverText");
const startBtn=document.getElementById("startBtn");
const restartGameBtn=document.getElementById("restartGameBtn");
const gameOverImage=document.getElementById("gameOverImage");

function initScoreboard(){
  score=0;
  fentStreak=0;
  currentMultiplier=1;
  updateScoreUI();
  updateInGameScore();
}

function resetGame(){
  floydX=50; floydY=200; velocity=0;
  pipes=[];
  bottles=[];
  hearts=5;
  updateHeartsDisplay();

  initScoreboard();
  pipeSpeed=1.5;
  nextDifficultyTime= performance.now()+ difficultyInterval;

  overlay.style.display="none";
  gameOverImage.style.display="none";
  gameOverText.style.display="none";
  restartGameBtn.style.display="none";

  bgX1=0; bgX2= BG_WIDTH;
  groundX1=0; groundX2=360;

  spawnPipe();
}
function startGame(){
  startBtn.style.display="none";
  gameState="running";
  resetGame();
  try{
    bgMusic.currentTime=0;
    bgMusic.play();
  } catch(e){
    console.warn("Audio blocked:", e);
  }
}
function gameOver(){
  gameState="over";
  overlay.style.display="flex";
  gameOverText.style.display="block";
  gameOverImage.style.display="block";
  restartGameBtn.style.display="inline-block";

  bgMusic.pause();
  if(score> highScore){
    highScore= score;
    localStorage.setItem("flappyFloydHighScore", highScore.toString());
  }
  updateScoreUI();
}
function spawnPipe(){
  pipes.push({
    x:canvas.width,
    y:randomPipeY(),
    markedForDespawn:false,
    despawnTime:0
  });
}

// MAIN LOOP
function mainLoop(currentTime){
  let dt= getDeltaFactor(currentTime);
  ctx.clearRect(0,0,canvas.width,canvas.height);

  if(gameState==="running"){
    let now= performance.now();
    if(!gamePaused && now>= nextDifficultyTime){
      pipeSpeed+= speedIncrement;
      nextDifficultyTime+= difficultyInterval;
    }
    scrollBackground(dt);

    let passOffset=20;
    let lingerTime=2000;

    // PIPES
    for(let i=0;i<pipes.length;i++){
      let p=pipes[i];
      let offset= pipeHeight+ pipeGap;
      let bottomY= p.y+ offset;

      if(!gamePaused){
        p.x-= pipeSpeed* dt;
      }
      if(!p.markedForDespawn){
        let pipeRightEdge= p.x+ pipeWidth;
        if(pipeRightEdge< (floydX+ passOffset)){
          let gained=1* currentMultiplier;
          score+= gained;
          updateScoreUI();
          updateInGameScore();
          showPlusOne("+"+ gained);

          spawnPipe();
          maybeSpawnBottle(canvas.width, p.y);

          p.markedForDespawn=true;
          p.despawnTime= performance.now()+ lingerTime;
        }
      } else {
        if(performance.now()> p.despawnTime){
          pipes.splice(i,1);
          i--;
          continue;
        }
      }

      // draw pipes
      ctx.drawImage(pipeTop, p.x,p.y, pipeWidth,pipeHeight);
      ctx.drawImage(pipeBottom, p.x,bottomY, pipeWidth,pipeHeight);

      // collision => loseOneHeart
      if(!p.markedForDespawn){
        const birdRect={ x:floydX+10, y:floydY+10, width:birdWidth-20, height:birdHeight-20 };
        const topRect={ x:p.x, y:p.y, width:pipeWidth, height:pipeHeight };
        const bottomRect={ x:p.x, y:bottomY, width:pipeWidth, height:pipeHeight };
        if(isColliding(birdRect, topRect)|| isColliding(birdRect, bottomRect)){
          pipes.splice(i,1);
          i--;
          loseOneHeart();
          updateInGameScore();
          spawnPipe();
          maybeSpawnBottle(canvas.width, p.y);
          break;
        }
      }
    }

    // BOTTLES
    for(let b=0; b<bottles.length; b++){
      let fent=bottles[b];
      if(!gamePaused){
        fent.x-= pipeSpeed* dt;
      }
      ctx.drawImage(bottleImg, fent.x,fent.y,fent.width,fent.height);

      const birdRect={ x:floydX+10, y:floydY+10, width:birdWidth-20, height:birdHeight-20 };
      const fentRect={ x:fent.x, y:fent.y, width:fent.width, height:fent.height };
      if(isColliding(birdRect, fentRect)){
        bottles.splice(b,1);
        b--;

        let gained=1* currentMultiplier;
        score+= gained;
        updateScoreUI();
        updateInGameScore();
        showPlusOne("+"+ gained);

        incrementFentStreak();

        bottleCount++;
        if(bottleCount>= bottlesNeededForHeart){
          bottleCount=0;
          if(hearts< maxHearts){
            hearts++;
            updateHeartsDisplay();
          }
        }

        // offline user => inc + store in localStorage
        offlineUserFent++;
        localStorage.setItem("offlineUserFent", offlineUserFent.toString());
        document.getElementById("userFentTotal").textContent= offlineUserFent.toString();

        // local "global" => also store in localStorage
        let oldGlobal= parseInt(localStorage.getItem("globalFentCollected")||"0");
        let newGlobal= oldGlobal+1;
        localStorage.setItem("globalFentCollected", newGlobal.toString());
        document.getElementById("globalFentTotal").textContent= newGlobal.toString();

        continue;
      }
      if(fent.x+fent.width<0){
        bottles.splice(b,1);
        b--;
      }
    }

    scrollGround(dt);

    // floor bounce
    if(!gamePaused){
      let birdBottom= floydY+ birdHeight;
      let floorY= canvas.height-floorHeight;
      if(birdBottom>=floorY){
        if(hearts>1){
          hearts--;
          updateHeartsDisplay();
          resetFentStreak();
          updateInGameScore();
          floydY=floorY- birdHeight-1;
          velocity= lift;
        } else {
          gameOver();
        }
      }
      velocity+= gravity* dt;
      floydY+= velocity* dt;
      if(floydY<0){
        floydY=0; velocity=0;
      }
    }

    // draw bird
    ctx.drawImage(flappyFloyd, floydX, floydY, birdWidth, birdHeight);

  } else {
    // not running => background only
    scrollBackground(dt);
    scrollGround(dt);
    ctx.drawImage(flappyFloyd, floydX, floydY, birdWidth, birdHeight);
  }

  requestAnimationFrame(mainLoop);
}
requestAnimationFrame(mainLoop);

// Pause & Mute
const pauseBtn=document.getElementById("pauseBtn");
const muteBtn=document.getElementById("muteBtn");
pauseBtn.addEventListener("click",()=>{
  if(gameState==="running"){
    gamePaused=!gamePaused;
    pauseBtn.textContent= gamePaused? "▶":"❚❚";
    pauseBtn.blur();
  }
});
muteBtn.addEventListener("click",()=>{
  bgMusic.muted=!bgMusic.muted;
  muteBtn.textContent= bgMusic.muted?"🔇":"🔊";
  muteBtn.blur();
});

// START
startBtn.addEventListener("click",()=>{
  if(gameState!=="running"){
    startGame();
    startBtn.blur();
  }
});

// RESTART => re-play music
restartGameBtn.addEventListener("click",()=>{
  overlay.style.display="none";
  gameOverImage.style.display="none";
  gameOverText.style.display="none";
  restartGameBtn.style.display="none";

  gameState="running";
  resetGame();
  try{
    bgMusic.currentTime=0;
    bgMusic.play();
  } catch(e){
    console.warn("Audio blocked:", e);
  }
});

// Local Leaderboard
let leaderboard=[];
const leaderboardList=document.getElementById("leaderboardList");
const playerNameInput=document.getElementById("playerName");
const shareScoreBtn=document.getElementById("shareScoreBtn");

function loadLeaderboard(){
  let stored= localStorage.getItem("localLeaderboard");
  if(stored){
    leaderboard= JSON.parse(stored);
  } else {
    leaderboard= [];
  }
  leaderboard.sort((a,b)=> b.score- a.score);
  leaderboard= leaderboard.slice(0,10);
  renderLeaderboard();
}
function renderLeaderboard(){
  leaderboardList.innerHTML="";
  leaderboard.forEach(entry=>{
    let li=document.createElement("li");
    li.textContent=`${entry.name} : ${entry.score}`;
    leaderboardList.appendChild(li);
  });
}
loadLeaderboard();

shareScoreBtn.addEventListener("click",()=>{
  let rawName= playerNameInput.value.trim();
  if(!rawName){
    alert("Please enter a name!");
    return;
  }
  let nameRegex= /^[A-Za-z0-9_ -]{1,18}$/;
  if(!nameRegex.test(rawName)){
    alert("Name must be 1–18 chars, letters/digits/underscores/dashes/spaces. No emojis!");
    return;
  }
  let newScore= highScore;
  leaderboard.push({ name: rawName, score: newScore });
  leaderboard.sort((a,b)=> b.score-a.score);
  leaderboard= leaderboard.slice(0,10);
  localStorage.setItem("localLeaderboard", JSON.stringify(leaderboard));
  renderLeaderboard();
  alert("Score shared locally!");
});

// Fent counters => local
document.getElementById("userFentTotal").textContent= offlineUserFent.toString();
let globalFent= parseInt(localStorage.getItem("globalFentCollected")|| "0");
document.getElementById("globalFentTotal").textContent= globalFent.toString();

// Contract copy
const copyContractBtn=document.getElementById("copyContractBtn");
const contractPlaceholder=document.getElementById("contractPlaceholder");
copyContractBtn.addEventListener("click",()=>{
  let text= contractPlaceholder.textContent;
  navigator.clipboard.writeText(text)
    .then(()=> alert("Contract Address Copied!"))
    .catch(err=> console.error("Copy error:", err));
});
