const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const TILE_SIZE = 40;
const COLS = canvas.width / TILE_SIZE;
const ROWS = canvas.height / TILE_SIZE;

const TILE = {
    EMPTY: 0,
    BRICK: 1,
    STEEL: 2,
    WATER: 3,
    BASE: 4
};

let gameState = {
    running: false,
    paused: false,
    score: 0,
    lives: 3,
    level: 1,
    enemiesRemaining: 0,
    enemiesKilled: 0
};

let map = [];
let player = null;
let enemies = [];
let bullets = [];
let explosions = [];
let powerUps = [];
let keys = {};

class Tank {
    constructor(x, y, color, isPlayer = false) {
        this.x = x;
        this.y = y;
        this.width = TILE_SIZE - 4;
        this.height = TILE_SIZE - 4;
        this.speed = isPlayer ? 2.5 : 1.5;
        this.direction = 'up';
        this.color = color;
        this.isPlayer = isPlayer;
        this.cooldown = 0;
        this.maxCooldown = isPlayer ? 25 : 60;
        this.bulletSpeed = isPlayer ? 6 : 4;
        this.aiTimer = 0;
        this.aiDirection = 'down';
        this.shielded = isPlayer;
        this.shieldTimer = isPlayer ? 180 : 0;
    }

    update() {
        if (this.cooldown > 0) this.cooldown--;
        if (this.shieldTimer > 0) {
            this.shieldTimer--;
            if (this.shieldTimer === 0) this.shielded = false;
        }

        if (!this.isPlayer) {
            this.updateAI();
        }
    }

    updateAI() {
        this.aiTimer--;
        if (this.aiTimer <= 0) {
            const dirs = ['up', 'down', 'left', 'right'];
            this.aiDirection = dirs[Math.floor(Math.random() * dirs.length)];
            this.aiTimer = 60 + Math.floor(Math.random() * 90);
        }

        const oldX = this.x;
        const oldY = this.y;
        this.move(this.aiDirection);

        if (this.x === oldX && this.y === oldY) {
            this.aiTimer = 0;
        }

        if (Math.random() < 0.02 && this.cooldown === 0) {
            this.shoot();
        }

        if (player && Math.random() < 0.01) {
            const dx = player.x - this.x;
            const dy = player.y - this.y;
            if (Math.abs(dx) > Math.abs(dy)) {
                this.aiDirection = dx > 0 ? 'right' : 'left';
            } else {
                this.aiDirection = dy > 0 ? 'down' : 'up';
            }
        }
    }

    move(direction) {
        this.direction = direction;
        let newX = this.x;
        let newY = this.y;

        switch (direction) {
            case 'up': newY -= this.speed; break;
            case 'down': newY += this.speed; break;
            case 'left': newX -= this.speed; break;
            case 'right': newX += this.speed; break;
        }

        if (newX < 0 || newX + this.width > canvas.width) return;
        if (newY < 0 || newY + this.height > canvas.height) return;

        if (this.checkCollision(newX, newY)) return;

        const otherTanks = this.isPlayer ? enemies : [...enemies.filter(e => e !== this), player].filter(Boolean);
        for (const other of otherTanks) {
            if (this.intersects(newX, newY, this.width, this.height,
                other.x, other.y, other.width, other.height)) {
                return;
            }
        }

        this.x = newX;
        this.y = newY;
    }

    checkCollision(newX, newY) {
        const left = Math.floor(newX / TILE_SIZE);
        const right = Math.floor((newX + this.width - 1) / TILE_SIZE);
        const top = Math.floor(newY / TILE_SIZE);
        const bottom = Math.floor((newY + this.height - 1) / TILE_SIZE);

        for (let row = top; row <= bottom; row++) {
            for (let col = left; col <= right; col++) {
                if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return true;
                const tile = map[row][col];
                if (tile === TILE.BRICK || tile === TILE.STEEL || tile === TILE.WATER || tile === TILE.BASE) {
                    return true;
                }
            }
        }
        return false;
    }

    intersects(x1, y1, w1, h1, x2, y2, w2, h2) {
        return x1 < x2 + w2 && x1 + w1 > x2 && y1 < y2 + h2 && y1 + h1 > y2;
    }

    shoot() {
        if (this.cooldown > 0) return;
        this.cooldown = this.maxCooldown;

        let bx = this.x + this.width / 2 - 3;
        let by = this.y + this.height / 2 - 3;

        switch (this.direction) {
            case 'up': by = this.y; break;
            case 'down': by = this.y + this.height; break;
            case 'left': bx = this.x; break;
            case 'right': bx = this.x + this.width; break;
        }

        bullets.push(new Bullet(bx, by, this.direction, this.bulletSpeed, this.isPlayer));
    }

    draw() {
        ctx.save();
        ctx.translate(this.x + this.width / 2, this.y + this.height / 2);

        switch (this.direction) {
            case 'up': ctx.rotate(0); break;
            case 'right': ctx.rotate(Math.PI / 2); break;
            case 'down': ctx.rotate(Math.PI); break;
            case 'left': ctx.rotate(-Math.PI / 2); break;
        }

        const w = this.width;
        const h = this.height;

        ctx.fillStyle = this.color;
        ctx.fillRect(-w / 2, -h / 2 + 4, w / 4, h - 8);
        ctx.fillRect(w / 4, -h / 2 + 4, w / 4, h - 8);

        ctx.fillStyle = this.isPlayer ? '#5c8a3a' : '#8b4513';
        ctx.fillRect(-w / 2 + 2, -h / 2 + 4, w / 4 - 4, h - 8);
        ctx.fillRect(w / 4 + 2, -h / 2 + 4, w / 4 - 4, h - 8);

        ctx.fillStyle = this.color;
        ctx.fillRect(-w / 4, -h / 2 + 6, w / 2, h - 12);

        ctx.fillStyle = '#222';
        ctx.fillRect(-3, -h / 2 - 4, 6, h / 2 + 4);

        ctx.fillStyle = this.isPlayer ? '#2d5016' : '#5c2c0c';
        ctx.beginPath();
        ctx.arc(0, 0, w / 5, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();

        if (this.shielded) {
            const t = Date.now() / 100;
            ctx.strokeStyle = `rgba(255, 255, 0, ${0.5 + Math.sin(t) * 0.3})`;
            ctx.lineWidth = 2;
            ctx.strokeRect(this.x - 2, this.y - 2, this.width + 4, this.height + 4);
        }
    }
}

class Bullet {
    constructor(x, y, direction, speed, fromPlayer) {
        this.x = x;
        this.y = y;
        this.size = 6;
        this.direction = direction;
        this.speed = speed;
        this.fromPlayer = fromPlayer;
        this.alive = true;
    }

    update() {
        switch (this.direction) {
            case 'up': this.y -= this.speed; break;
            case 'down': this.y += this.speed; break;
            case 'left': this.x -= this.speed; break;
            case 'right': this.x += this.speed; break;
        }

        if (this.x < 0 || this.x > canvas.width || this.y < 0 || this.y > canvas.height) {
            this.alive = false;
            return;
        }

        const col = Math.floor(this.x / TILE_SIZE);
        const row = Math.floor(this.y / TILE_SIZE);
        if (row >= 0 && row < ROWS && col >= 0 && col < COLS) {
            const tile = map[row][col];
            if (tile === TILE.BRICK) {
                map[row][col] = TILE.EMPTY;
                this.alive = false;
                createExplosion(this.x, this.y, 'small');
                return;
            } else if (tile === TILE.STEEL) {
                this.alive = false;
                createExplosion(this.x, this.y, 'small');
                return;
            } else if (tile === TILE.BASE) {
                gameOver();
                this.alive = false;
                return;
            }
        }

        if (this.fromPlayer) {
            for (const enemy of enemies) {
                if (this.intersectsTank(enemy)) {
                    if (!enemy.shielded) {
                        enemy.dead = true;
                        gameState.score += 100;
                        gameState.enemiesKilled++;
                        createExplosion(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2, 'big');
                    }
                    this.alive = false;
                    return;
                }
            }
        } else {
            if (player && this.intersectsTank(player)) {
                if (!player.shielded) {
                    playerHit();
                }
                this.alive = false;
                createExplosion(this.x, this.y, 'small');
                return;
            }
        }

        for (const other of bullets) {
            if (other !== this && other.alive && other.fromPlayer !== this.fromPlayer) {
                if (Math.abs(this.x - other.x) < this.size && Math.abs(this.y - other.y) < this.size) {
                    this.alive = false;
                    other.alive = false;
                    return;
                }
            }
        }
    }

    intersectsTank(tank) {
        return this.x >= tank.x && this.x <= tank.x + tank.width &&
               this.y >= tank.y && this.y <= tank.y + tank.height;
    }

    draw() {
        ctx.fillStyle = this.fromPlayer ? '#ffeb3b' : '#ff5722';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.stroke();
    }
}

class Explosion {
    constructor(x, y, size) {
        this.x = x;
        this.y = y;
        this.maxRadius = size === 'big' ? 35 : 15;
        this.radius = 5;
        this.alive = true;
        this.frame = 0;
        this.maxFrames = size === 'big' ? 20 : 10;
    }

    update() {
        this.frame++;
        this.radius = (this.frame / this.maxFrames) * this.maxRadius;
        if (this.frame >= this.maxFrames) {
            this.alive = false;
        }
    }

    draw() {
        const alpha = 1 - this.frame / this.maxFrames;
        ctx.fillStyle = `rgba(255, 200, 0, ${alpha})`;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = `rgba(255, 100, 0, ${alpha * 0.7})`;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius * 0.6, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = `rgba(255, 255, 200, ${alpha})`;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius * 0.3, 0, Math.PI * 2);
        ctx.fill();
    }
}

function createExplosion(x, y, size) {
    explosions.push(new Explosion(x, y, size));
}

function generateMap(level) {
    map = [];
    for (let r = 0; r < ROWS; r++) {
        map[r] = [];
        for (let c = 0; c < COLS; c++) {
            map[r][c] = TILE.EMPTY;
        }
    }

    const baseCol = Math.floor(COLS / 2);
    const baseRow = ROWS - 1;
    map[baseRow][baseCol] = TILE.BASE;

    map[baseRow - 1][baseCol - 1] = TILE.BRICK;
    map[baseRow - 1][baseCol] = TILE.BRICK;
    map[baseRow - 1][baseCol + 1] = TILE.BRICK;
    map[baseRow][baseCol - 1] = TILE.BRICK;
    map[baseRow][baseCol + 1] = TILE.BRICK;

    const brickCount = 60 + level * 10;
    for (let i = 0; i < brickCount; i++) {
        const r = Math.floor(Math.random() * (ROWS - 3)) + 1;
        const c = Math.floor(Math.random() * (COLS - 2)) + 1;
        if (map[r][c] === TILE.EMPTY && !isNearSpawn(r, c)) {
            map[r][c] = TILE.BRICK;
        }
    }

    const steelCount = 5 + level * 2;
    for (let i = 0; i < steelCount; i++) {
        const r = Math.floor(Math.random() * (ROWS - 4)) + 2;
        const c = Math.floor(Math.random() * (COLS - 2)) + 1;
        if (map[r][c] === TILE.EMPTY && !isNearSpawn(r, c)) {
            map[r][c] = TILE.STEEL;
        }
    }

    if (level >= 2) {
        const waterCount = 3 + level;
        for (let i = 0; i < waterCount; i++) {
            const r = Math.floor(Math.random() * (ROWS - 4)) + 2;
            const c = Math.floor(Math.random() * (COLS - 2)) + 1;
            if (map[r][c] === TILE.EMPTY && !isNearSpawn(r, c)) {
                map[r][c] = TILE.WATER;
            }
        }
    }
}

function isNearSpawn(row, col) {
    const spawns = [
        [0, 0], [0, COLS - 1],
        [ROWS - 2, Math.floor(COLS / 2) - 2],
        [ROWS - 2, Math.floor(COLS / 2) + 2]
    ];
    for (const [sr, sc] of spawns) {
        if (Math.abs(row - sr) <= 1 && Math.abs(col - sc) <= 1) return true;
    }
    return false;
}

function drawMap() {
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            const tile = map[r][c];
            const x = c * TILE_SIZE;
            const y = r * TILE_SIZE;

            switch (tile) {
                case TILE.BRICK:
                    drawBrick(x, y);
                    break;
                case TILE.STEEL:
                    drawSteel(x, y);
                    break;
                case TILE.WATER:
                    drawWater(x, y);
                    break;
                case TILE.BASE:
                    drawBase(x, y);
                    break;
            }
        }
    }
}

function drawBrick(x, y) {
    ctx.fillStyle = '#a0522d';
    ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
    ctx.strokeStyle = '#5c2c0c';
    ctx.lineWidth = 1;
    for (let i = 0; i < 4; i++) {
        const offset = (i % 2) * (TILE_SIZE / 4);
        ctx.beginPath();
        ctx.moveTo(x + offset, y + i * 10);
        ctx.lineTo(x + offset + TILE_SIZE / 2, y + i * 10);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x + offset, y + i * 10);
        ctx.lineTo(x + offset, y + (i + 1) * 10);
        ctx.stroke();
    }
    ctx.strokeRect(x, y, TILE_SIZE, TILE_SIZE);
}

function drawSteel(x, y) {
    ctx.fillStyle = '#888';
    ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
    ctx.fillStyle = '#aaa';
    ctx.fillRect(x + 2, y + 2, TILE_SIZE / 2 - 3, TILE_SIZE / 2 - 3);
    ctx.fillRect(x + TILE_SIZE / 2 + 1, y + TILE_SIZE / 2 + 1, TILE_SIZE / 2 - 3, TILE_SIZE / 2 - 3);
    ctx.fillStyle = '#666';
    ctx.fillRect(x + TILE_SIZE / 2 + 1, y + 2, TILE_SIZE / 2 - 3, TILE_SIZE / 2 - 3);
    ctx.fillRect(x + 2, y + TILE_SIZE / 2 + 1, TILE_SIZE / 2 - 3, TILE_SIZE / 2 - 3);
    ctx.strokeStyle = '#444';
    ctx.strokeRect(x, y, TILE_SIZE, TILE_SIZE);
}

function drawWater(x, y) {
    const t = Date.now() / 500;
    ctx.fillStyle = '#1976d2';
    ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
    ctx.strokeStyle = `rgba(255, 255, 255, ${0.3 + Math.sin(t) * 0.2})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + 5, y + 10);
    ctx.lineTo(x + 15, y + 10);
    ctx.moveTo(x + 20, y + 25);
    ctx.lineTo(x + 35, y + 25);
    ctx.stroke();
}

function drawBase(x, y) {
    ctx.fillStyle = '#4caf50';
    ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('★', x + TILE_SIZE / 2, y + TILE_SIZE / 2);
}

function spawnEnemy() {
    const spawnPositions = [
        { x: 0, y: 0 },
        { x: canvas.width - TILE_SIZE, y: 0 },
        { x: Math.floor(COLS / 2) * TILE_SIZE, y: 0 }
    ];
    const pos = spawnPositions[Math.floor(Math.random() * spawnPositions.length)];

    for (const enemy of enemies) {
        if (Math.abs(enemy.x - pos.x) < TILE_SIZE && Math.abs(enemy.y - pos.y) < TILE_SIZE) {
            return false;
        }
    }
    if (player && Math.abs(player.x - pos.x) < TILE_SIZE && Math.abs(player.y - pos.y) < TILE_SIZE) {
        return false;
    }

    const colors = ['#9e9e9e', '#ff5722', '#9c27b0', '#3f51b5'];
    const enemy = new Tank(pos.x + 2, pos.y + 2, colors[Math.floor(Math.random() * colors.length)]);
    enemy.maxCooldown = Math.max(40, 80 - gameState.level * 5);
    enemies.push(enemy);
    return true;
}

function startLevel() {
    generateMap(gameState.level);
    enemies = [];
    bullets = [];
    explosions = [];

    const spawnX = (Math.floor(COLS / 2) - 2) * TILE_SIZE + 2;
    const spawnY = (ROWS - 2) * TILE_SIZE + 2;
    player = new Tank(spawnX, spawnY, '#4caf50', true);

    gameState.enemiesRemaining = 8 + gameState.level * 2;
    gameState.enemiesKilled = 0;

    for (let i = 0; i < 3; i++) {
        spawnEnemy();
        gameState.enemiesRemaining--;
    }
}

function startGame() {
    document.getElementById('startScreen').style.display = 'none';
    document.getElementById('gameOver').style.display = 'none';
    gameState.running = true;
    gameState.paused = false;
    gameState.score = 0;
    gameState.lives = 3;
    gameState.level = 1;
    startLevel();
    updateUI();
}

function restartGame() {
    startGame();
}

function gameOver() {
    gameState.running = false;
    document.getElementById('finalScore').textContent = gameState.score;
    document.getElementById('gameOver').style.display = 'block';
}

function playerHit() {
    createExplosion(player.x + player.width / 2, player.y + player.height / 2, 'big');
    gameState.lives--;
    if (gameState.lives <= 0) {
        gameOver();
    } else {
        const spawnX = (Math.floor(COLS / 2) - 2) * TILE_SIZE + 2;
        const spawnY = (ROWS - 2) * TILE_SIZE + 2;
        player.x = spawnX;
        player.y = spawnY;
        player.direction = 'up';
        player.shielded = true;
        player.shieldTimer = 180;
    }
    updateUI();
}

function nextLevel() {
    gameState.level++;
    startLevel();
    updateUI();
}

function updateUI() {
    document.getElementById('lives').textContent = gameState.lives;
    document.getElementById('score').textContent = gameState.score;
    document.getElementById('level').textContent = gameState.level;
}

function update() {
    if (!gameState.running || gameState.paused) return;

    if (player) {
        if (keys['w'] || keys['W']) player.move('up');
        else if (keys['s'] || keys['S']) player.move('down');
        else if (keys['a'] || keys['A']) player.move('left');
        else if (keys['d'] || keys['D']) player.move('right');

        if (keys['j'] || keys['J']) player.shoot();
        player.update();
    }

    for (const enemy of enemies) {
        enemy.update();
    }

    for (const bullet of bullets) {
        bullet.update();
    }

    for (const explosion of explosions) {
        explosion.update();
    }

    enemies = enemies.filter(e => !e.dead);
    bullets = bullets.filter(b => b.alive);
    explosions = explosions.filter(e => e.alive);

    if (enemies.length < 4 && gameState.enemiesRemaining > 0) {
        if (Math.random() < 0.01) {
            if (spawnEnemy()) {
                gameState.enemiesRemaining--;
            }
        }
    }

    if (enemies.length === 0 && gameState.enemiesRemaining === 0) {
        nextLevel();
    }

    updateUI();
}

function render() {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    drawMap();

    if (player) player.draw();
    for (const enemy of enemies) enemy.draw();
    for (const bullet of bullets) bullet.draw();

    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            if (map[r][c] === TILE.WATER) {
                drawWater(c * TILE_SIZE, r * TILE_SIZE);
            }
        }
    }

    for (const explosion of explosions) explosion.draw();

    if (gameState.paused) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 48px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('暂停', canvas.width / 2, canvas.height / 2);
        ctx.font = '20px sans-serif';
        ctx.fillText('按 P 继续', canvas.width / 2, canvas.height / 2 + 40);
    }
}

function gameLoop() {
    update();
    render();
    requestAnimationFrame(gameLoop);
}

document.addEventListener('keydown', (e) => {
    keys[e.key] = true;
    if (e.key === 'p' || e.key === 'P') {
        if (gameState.running) {
            gameState.paused = !gameState.paused;
        }
    }
    if (['w', 'a', 's', 'd', 'W', 'A', 'S', 'D', 'j', 'J', ' '].includes(e.key)) {
        e.preventDefault();
    }
});

document.addEventListener('keyup', (e) => {
    keys[e.key] = false;
});

gameLoop();
