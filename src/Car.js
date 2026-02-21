import * as THREE from 'three';
export class Car {
    constructor(scene, controls) {
        this.scene = scene;
        this.controls = controls;
        this.speed = 0;
        this.maxSpeed = 1.0;
        this.acceleration = 0.01;
        this.friction = 0.005;
        this.brakeFriction = 0.02;
        this.steeringAngle = 0;
        this.turnSpeed = 0.03;
        this.maxSteeringAngle = Math.PI / 6;
        this.buildCar();
    }
    buildCar() {
        this.mesh = new THREE.Group();
        const bodyGeo = new THREE.BoxGeometry(2, 1, 4);
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0x0099ff, roughness: 0.5, metalness: 0.8 });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.position.y = 1; body.castShadow = true; body.receiveShadow = true;
        this.mesh.add(body);

        const roofGeo = new THREE.BoxGeometry(1.5, 0.8, 2);
        const roofMat = new THREE.MeshStandardMaterial({ color: 0x222222 });
        const roof = new THREE.Mesh(roofGeo, roofMat);
        roof.position.set(0, 1.9, -0.2);
        this.mesh.add(roof);

        const wheelGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.4, 16);
        wheelGeo.rotateZ(Math.PI / 2);
        const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111 });

        const createWheel = (x, y, z) => {
            const wheel = new THREE.Mesh(wheelGeo, wheelMat);
            wheel.position.set(x, y, z);
            wheel.castShadow = true;
            this.mesh.add(wheel);
            return wheel;
        };

        this.wheelFL = createWheel(1.2, 0.5, 1.2);
        this.wheelFR = createWheel(-1.2, 0.5, 1.2);
        this.wheelBL = createWheel(1.2, 0.5, -1.2);
        this.wheelBR = createWheel(-1.2, 0.5, -1.2);

        this.scene.add(this.mesh);
    }
    update() {
        if (this.controls.keys.forward) this.speed += this.acceleration;
        else if (this.controls.keys.backward) this.speed -= this.brakeFriction;
        else {
            if (this.speed > 0) { this.speed -= this.friction; if (this.speed < 0) this.speed = 0; }
            else if (this.speed < 0) { this.speed += this.friction; if (this.speed > 0) this.speed = 0; }
        }
        this.speed = Math.min(Math.max(this.speed, -this.maxSpeed / 2), this.maxSpeed);

        if (Math.abs(this.speed) > 0.01) {
            let steerFactor = this.speed < 0 ? -1 : 1;
            if (this.controls.keys.left) {
                this.steeringAngle = Math.min(this.steeringAngle + this.turnSpeed, this.maxSteeringAngle);
                this.mesh.rotation.y += this.turnSpeed * steerFactor;
            } else if (this.controls.keys.right) {
                this.steeringAngle = Math.max(this.steeringAngle - this.turnSpeed, -this.maxSteeringAngle);
                this.mesh.rotation.y -= this.turnSpeed * steerFactor;
            } else {
                this.steeringAngle *= 0.9;
            }
        } else {
            this.steeringAngle *= 0.9;
        }

        this.wheelFL.rotation.y = this.steeringAngle;
        this.wheelFR.rotation.y = this.steeringAngle;

        const spinForce = this.speed * 2;
        this.wheelFL.rotation.x += spinForce;
        this.wheelFR.rotation.x += spinForce;
        this.wheelBL.rotation.x += spinForce;
        this.wheelBR.rotation.x += spinForce;

        const vector = new THREE.Vector3(0, 0, 1);
        vector.applyQuaternion(this.mesh.quaternion);
        vector.multiplyScalar(this.speed);
        this.mesh.position.add(vector);

        const speedValueDisplay = document.getElementById('speed-value');
        if (speedValueDisplay) speedValueDisplay.textContent = Math.round(Math.abs(this.speed) * 150);
    }
}
