const G = 6.6743e-11;
const AU = 150e9;
const LY = 9.461e15;

const SUN_MASS = 1.989e30;
const SUN_RADIUS = 696340e3;

const SIMULATION_WIDTH = 2 * AU;
const SIMULATION_HEIGHT = 2 * AU;
const BODY_COLORS = ['yellow', 'blue', 'red'];

class Vector2 {
    constructor(x, y) {
        if (x == undefined) {
            this.x = 0;
        } else {
            this.x = x;
        }
        if (y == undefined) {
            this.y = 0;
        } else {
            this.y = y;
        }
    }

    plus(v) {
        return new Vector2(this.x + v.x, this.y + v.y);
    }

    minus(v) {
        return new Vector2(this.x - v.x, this.y - v.y);
    }

    times(d) {
        return new Vector2(this.x * d, this.y * d);
    }

    length() {
        return Math.sqrt(this.x ** 2 + this.y ** 2);
    }

    distanceTo(v) {
        return v.minus(this).length();
    }

    normalize() {
        let length = this.length();
        this.x /= length;
        this.y /= length;
    }
}

class Body {
    constructor(mass, massCenter, movement, color) {
        this.mass = mass;
        this.massCenter = massCenter;
        this.movement = movement;
        this.force = new Vector2();
        this.markedForRemoval = false;
        if (color == undefined) {
            let i = Math.floor(Math.random() * BODY_COLORS.length);
            this.color = BODY_COLORS[i];
        } else {
            this.color = color;
        }
    }

    distanceTo(b) {
        return this.massCenter.distanceTo(b.massCenter);
    }

    gravitationalForce(b) {
        let direction = b.massCenter.minus(this.massCenter);
        let distance = direction.length();
        direction.normalize();
        let force = (G * this.mass * b.mass) / distance ** 2;
        return direction.times(force);
    }

    move() {
        let v1 = this.force.times(1.0 / this.mass);
        let v2 = this.massCenter.plus(v1);
        let newPosition = this.movement.plus(v2);
        let newMovement = newPosition.minus(this.massCenter);
        this.massCenter = newPosition;
        this.movement = newMovement;
    }

    radius() {
        return Math.min(
            SUN_RADIUS * Math.pow(this.mass / SUN_MASS, 0.5),
            0.05 * AU
        );
    }

    collidesWith(b) {
        return this.distanceTo(b) < this.radius() + b.radius();
    }

    merge(b) {
        let newMass = this.mass + b.mass;
        let newMassCenter = this.massCenter
            .times(this.mass)
            .plus(b.massCenter.times(b.mass))
            .times(1.0 / newMass);
        let newCurrentMovement = this.movement
            .times(this.mass)
            .plus(b.movement.times(b.mass))
            .times(1.0 / newMass);
        let newColor = Math.random() < 0.5 ? this.color : b.color;
        return new Body(newMass, newMassCenter, newCurrentMovement, newColor);
    }
}

class Painter {
    constructor(canvas) {
        this.canvas = canvas;
        this.context = this.canvas.getContext('2d');
        this.fillBackground();
    }

    fillBackground() {
        this.context.fillStyle = 'black';
        this.context.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    drawBody(b) {
        let x = b.massCenter.x;
        let y = b.massCenter.y;
        let color = b.color;

        // Converted to simultation space
        let posX = (x * this.canvas.width) / SIMULATION_WIDTH;
        let posY = (y * this.canvas.height) / SIMULATION_HEIGHT;
        let radius = (this.canvas.width * b.radius()) / SIMULATION_WIDTH;

        this.context.beginPath();
        this.context.arc(posX, posY, radius, 0, Math.PI * 2, true);
        this.context.fillStyle = color;
        this.context.fill();
    }
}

class Simulation {
    constructor(canvas, numberOfBodies) {
        this.canvas = canvas;
        this.bodyCount = numberOfBodies;
        this.bodies = new Array(numberOfBodies);
        this.painter = new Painter(canvas);
        this.time = 0;
        this.interval = null;

        for (let i = 0; i < numberOfBodies; i++) {
            let mass = this.getRandomMass();
            let massCenter = this.getRandomPosition();
            let currentMovement = this.getRandomMovement();
            this.bodies[i] = new Body(mass, massCenter, currentMovement);
        }

        canvas.addEventListener(
            'click',
            (event) => {
                let xPixelSpace = event.pageX - this.canvas.offsetLeft;
                let yPixelSpace = event.pageY - this.canvas.offsetTop;
                let x = (xPixelSpace / canvas.width) * SIMULATION_WIDTH;
                let y = (yPixelSpace / canvas.height) * SIMULATION_HEIGHT;
                this.placeNewBody(x, y);
            },
            false
        );
    }

    getRandomMass() {
        return 5 * Math.random() * SUN_MASS;
    }

    getRandomPosition() {
        return new Vector2(
            Math.random() * SIMULATION_WIDTH,
            Math.random() * SIMULATION_HEIGHT
        );
    }

    getRandomMovement() {
        return new Vector2(
            (Math.random() - 0.5) * (AU / 5000),
            (Math.random() - 0.5) * (AU / 5000)
        );
    }

    start() {
        if (this.interval != null) {
            clearInterval(this.interval);
        }
        this.interval = setInterval(() => {
            this.calculateOneTick();
            this.drawAllBodies();
        }, 0);
    }

    pause() {
        if (this.interval != null) {
            clearInterval(this.interval);
        }
    }

    placeNewBody(x, y) {
        let mass = this.getRandomMass();
        let massCenter = new Vector2(x, y);
        let currentMovement = this.getRandomMovement();
        this.bodies.push(new Body(mass, massCenter, currentMovement));
    }

    drawAllBodies() {
        this.painter.fillBackground();
        this.bodies.forEach((b) => this.painter.drawBody(b));
    }

    calculateOneTick() {
        // Merge colliding bodies
        for (let i = 0; i < this.bodies.length; i++) {
            let current = this.bodies[i];
            let collidingBodies = [];
            for (let j = 0; j < this.bodies.length; j++) {
                let other = this.bodies[j];
                if (
                    i == j ||
                    current.markedForRemoval ||
                    other.markedForRemoval
                ) {
                    continue;
                }
                let body2 = this.bodies[j];
                if (current.collidesWith(body2)) {
                    body2.markedForRemoval = true;
                    collidingBodies.push(body2);
                }
            }
            if (collidingBodies.length > 0) {
                collidingBodies.forEach((b) => (current = current.merge(b)));
                this.bodies[i] = current;
            }
        }
        this.bodies = this.bodies.filter((b) => !b.markedForRemoval);

        // Calculate all forces
        for (let i = 0; i < this.bodies.length; i++) {
            let body1 = this.bodies[i];
            body1.force = new Vector2();
            for (let j = 0; j < this.bodies.length; j++) {
                if (i == j) {
                    continue;
                }
                let body2 = this.bodies[j];
                let forceToAdd = body1.gravitationalForce(body2);
                body1.force = body1.force.plus(forceToAdd);
            }
        }

        this.bodies.forEach((b) => b.move());
        this.time++;
    }
}

function pauseSimulation(simulation, paused, pauseButton) {
    paused = !paused;
    if (paused) {
        pauseButton.innerText = 'Play';
        simulation.pause();
    } else {
        pauseButton.innerText = 'Pause';
        simulation.start();
    }
    return paused;
}

function setCanvasSize(canvas, simulation) {
    size = Math.min(window.innerWidth, window.innerHeight) * 0.8;
    canvas.width = size;
    canvas.height = size;
    simulation.drawAllBodies();
}

function main() {
    let canvas = document.getElementById('simulation-canvas');
    let simulation = new Simulation(canvas, 200);
    setCanvasSize(canvas, simulation);
    simulation.bodies.push(
        new Body(1_000_000 * SUN_MASS, new Vector2(AU, AU), new Vector2())
    );
    let pauseButton = document.getElementById('pause-btn');
    let paused = true;
    simulation.drawAllBodies();
    pauseButton.addEventListener('click', () => {
        paused = pauseSimulation(simulation, paused, pauseButton);
    });
    window.addEventListener(
        'keydown',
        (event) => {
            if (event.code == 'Space') {
                paused = pauseSimulation(simulation, paused, pauseButton);
            }
        },
        true
    );
    window.addEventListener('resize', () => setCanvasSize(canvas, simulation));
}

main();
