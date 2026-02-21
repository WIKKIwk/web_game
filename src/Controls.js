export class Controls {
    constructor() {
        this.keys = { forward: false, backward: false, left: false, right: false };
        window.addEventListener('keydown', (e) => this.onKeyDown(e), false);
        window.addEventListener('keyup', (e) => this.onKeyUp(e), false);
    }
    onKeyDown(event) {
        switch (event.code) {
            case 'ArrowUp': case 'KeyW': this.keys.forward = true; break;
            case 'ArrowLeft': case 'KeyA': this.keys.left = true; break;
            case 'ArrowDown': case 'KeyS': this.keys.backward = true; break;
            case 'ArrowRight': case 'KeyD': this.keys.right = true; break;
        }
    }
    onKeyUp(event) {
        switch (event.code) {
            case 'ArrowUp': case 'KeyW': this.keys.forward = false; break;
            case 'ArrowLeft': case 'KeyA': this.keys.left = false; break;
            case 'ArrowDown': case 'KeyS': this.keys.backward = false; break;
            case 'ArrowRight': case 'KeyD': this.keys.right = false; break;
        }
    }
}
