const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// Charecter state
let character = "stickman";
let coins = 0;
let timer = 120;
let gravity = 0.5;
let velocityY = 0;
let velocetyX = 0;
let isJumping = false;
let keys = {};
let position = { x: 100, y: 400 };

//Backround 
con

document.querySelectorAll(".character-btn").forEach(btn => {
btn.addEventListener("click", () => {
character = btn.dataset.char;
resetGame();
});
});

function resetGame() {
position = { x: 100, y: 400 };
coins = 0;
timer = 120;
// Add logic to reset level objects, etc.
}

function drawCharacter() {
ctx.fillStyle = character === "stickman" ? "red" : "white";
ctx.fillRect(position.x, position.y, 30, 50);
}

function gameLoop() {
ctx.clearRect(0, 0, canvas.width, canvas.height);

// Draw ground
ctx.fillStyle = "black";
ctx.fillRect(0, 450, canvas.width, 50);

// Gravity
velocityY += gravity;
position.y += velocityY;

// Collision with ground
if (position.y >= 400) {
position.y = 400;
isJumping = false;
velocityY = 0;
}

drawCharacter();

requestAnimationFrame(gameLoop);
}

document.addEventListener("keydown", (e) => {
if (e.code === "Space" && !isJumping) {
velocityY = -10;
isJumping = true;
}
});

gameLoop();
