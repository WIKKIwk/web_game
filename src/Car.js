import * as THREE from 'three';

export class Car {
    constructor(scene, controls) {
        this.scene = scene;
        this.controls = controls;

        // Physics parameters
        this.speed = 0;
        this.maxSpeed = 1.6; // Slightly faster for fun
        this.acceleration = 0.015;
        this.friction = 0.005;
        this.brakeFriction = 0.03;

        this.steeringAngle = 0;
        this.turnSpeed = 0.035;
        this.maxSteeringAngle = Math.PI / 5; // 36 degrees

        this.buildCar();
    }

    buildCar() {
        this.mesh = new THREE.Group();

        // --- Materials ---
        const carPaintMaterial = new THREE.MeshPhysicalMaterial({
            color: 0xff1020, // Sporty metallic red
            metalness: 0.6,
            roughness: 0.2,
            clearcoat: 1.0,  // Shiny clearcoat layer
            clearcoatRoughness: 0.1
        });

        const windowMaterial = new THREE.MeshPhysicalMaterial({
            color: 0x111111,
            metalness: 0.9,
            roughness: 0.1,
            envMapIntensity: 1.0,
            transparent: true,
            opacity: 0.8
        });

        const trimMaterial = new THREE.MeshStandardMaterial({
            color: 0x222222,
            metalness: 0.8,
            roughness: 0.5
        });

        const tireMaterial = new THREE.MeshStandardMaterial({
            color: 0x111111,
            roughness: 0.9,
            metalness: 0.1
        });

        const rimMaterial = new THREE.MeshStandardMaterial({
            color: 0xaaaaaa,
            metalness: 1.0,
            roughness: 0.2
        });

        // Headlight/Taillight lenses
        const headlightLensMaterial = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            emissive: 0xffddaa,
            emissiveIntensity: 0.8,
            roughness: 0.2
        });

        this.taillightMaterial = new THREE.MeshStandardMaterial({
            color: 0x440000,
            emissive: 0xff0000,
            emissiveIntensity: 0.0, // Starts off, glows when braking
            roughness: 0.2
        });

        // --- Geometry construction ---

        // 1. Lower Chassis base
        const chassisBottomGeo = new THREE.BoxGeometry(2.2, 0.4, 4.4);
        const chassisBottom = new THREE.Mesh(chassisBottomGeo, trimMaterial);
        chassisBottom.position.y = 0.7;
        chassisBottom.castShadow = true;
        this.mesh.add(chassisBottom);

        // 2. Main Body (curved sleek look)
        // We'll use a generic box but offset the vertices or just combine blocks
        const bodyGeo = new THREE.BoxGeometry(2.1, 0.6, 4.2);
        const body = new THREE.Mesh(bodyGeo, carPaintMaterial);
        body.position.y = 1.1;
        body.castShadow = true;
        body.receiveShadow = true;
        this.mesh.add(body);

        // 3. Cabin (Roof and Windows)
        // Tapered cabin
        const cabinGeo = new THREE.CylinderGeometry(0.7, 1.0, 1.8, 4, 1, false, Math.PI / 4);
        // Rotate 90 degrees to lay flat and stretch it to look like a car roof
        cabinGeo.rotateZ(Math.PI / 2);
        // Scale to fit body
        cabinGeo.scale(1, 0.8, 1.3);

        const cabin = new THREE.Mesh(cabinGeo, windowMaterial);
        cabin.position.set(0, 1.8, -0.3); // Set back slightly typical of sports cars
        cabin.castShadow = true;
        this.mesh.add(cabin);

        const roofTrimGeo = new THREE.BoxGeometry(1.6, 0.1, 1.4);
        const roofTrim = new THREE.Mesh(roofTrimGeo, carPaintMaterial);
        roofTrim.position.set(0, 2.3, -0.3);
        this.mesh.add(roofTrim);

        // 4. Spoiler (because it's a sports car)
        const spoilerStandGeo = new THREE.BoxGeometry(0.1, 0.4, 0.2);
        const slStand = new THREE.Mesh(spoilerStandGeo, trimMaterial);
        slStand.position.set(0.8, 1.5, -1.8);
        this.mesh.add(slStand);

        const srStand = new THREE.Mesh(spoilerStandGeo, trimMaterial);
        srStand.position.set(-0.8, 1.5, -1.8);
        this.mesh.add(srStand);

        const spoilerGeo = new THREE.BoxGeometry(2.2, 0.05, 0.6);
        const spoiler = new THREE.Mesh(spoilerGeo, carPaintMaterial);
        spoiler.position.set(0, 1.7, -1.9);
        spoiler.rotation.x = -0.1; // slight angle
        spoiler.castShadow = true;
        this.mesh.add(spoiler);

        // 5. Lights
        const makeLight = (x, y, z, mat, isFront) => {
            const lightGeo = new THREE.BoxGeometry(0.4, 0.2, 0.1);
            const lightMesh = new THREE.Mesh(lightGeo, mat);
            lightMesh.position.set(x, y, isFront ? z + 0.05 : z - 0.05); // slightly poke out
            this.mesh.add(lightMesh);
        };
        // Headlights
        makeLight(0.7, 1.1, 2.1, headlightLensMaterial, true);
        makeLight(-0.7, 1.1, 2.1, headlightLensMaterial, true);
        // Taillights
        makeLight(0.7, 1.1, -2.1, this.taillightMaterial, false);
        makeLight(-0.7, 1.1, -2.1, this.taillightMaterial, false);

        // Headlight SpotLights (Actual light source illuminating the road)
        const createSpotLight = (x, y, z) => {
            const spotLight = new THREE.SpotLight(0xffffee, 2.0);
            spotLight.position.set(x, y, z);
            spotLight.angle = Math.PI / 6;
            spotLight.penumbra = 0.5;
            spotLight.decay = 2;
            spotLight.distance = 100;
            spotLight.castShadow = true;

            // Set a target for the spotlight to point forward relative to car
            const target = new THREE.Object3D();
            target.position.set(x, y - 1, z + 10); // slightly down and far forward
            this.mesh.add(target);
            spotLight.target = target;

            this.mesh.add(spotLight);
        };
        createSpotLight(0.7, 1.1, 2.1);
        createSpotLight(-0.7, 1.1, 2.1);


        // 6. Wheels (Tire + Rim)
        const tireGeo = new THREE.TorusGeometry(0.4, 0.18, 12, 18);
        const rimGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.3, 16);
        rimGeo.rotateZ(Math.PI / 2);

        const createWheel = (x, y, z) => {
            const wheelGroup = new THREE.Group();

            // The Torus needs to be rotated to roll properly
            const tire = new THREE.Mesh(tireGeo, tireMaterial);
            tire.rotation.y = Math.PI / 2;
            tire.castShadow = true;
            wheelGroup.add(tire);

            const rim = new THREE.Mesh(rimGeo, rimMaterial);
            wheelGroup.add(rim);

            // Add simple spokes to see the rotation clearly
            const spokeGeo = new THREE.BoxGeometry(0.05, 0.6, 0.35);
            const spokeMat = new THREE.MeshStandardMaterial({ color: 0x555555 });
            const spoke1 = new THREE.Mesh(spokeGeo, spokeMat);
            const spoke2 = new THREE.Mesh(spokeGeo, spokeMat);
            spoke2.rotation.y = Math.PI / 2;
            wheelGroup.add(spoke1);
            wheelGroup.add(spoke2);

            wheelGroup.position.set(x, y, z);
            this.mesh.add(wheelGroup);
            return wheelGroup;
        };

        // front left, front right, back left, back right
        this.wheelFL = createWheel(1.2, 0.58, 1.3);
        this.wheelFR = createWheel(-1.2, 0.58, 1.3);
        this.wheelBL = createWheel(1.2, 0.58, -1.2);
        this.wheelBR = createWheel(-1.2, 0.58, -1.2);

        this.scene.add(this.mesh);
    }

    update() {
        let isBraking = false;

        // Handle input for acceleration/braking
        if (this.controls.keys.forward) {
            this.speed += this.acceleration;
        } else if (this.controls.keys.backward) {
            this.speed -= this.brakeFriction;
            if (this.speed > 0) isBraking = true; // Only show brake lights if actually resisting forward motion
        } else {
            // Friction slows down the car when no keys are pressed
            if (this.speed > 0) {
                this.speed -= this.friction;
                if (this.speed < 0) this.speed = 0;
            } else if (this.speed < 0) {
                this.speed += this.friction;
                if (this.speed > 0) this.speed = 0;
            }
        }

        // Apply taillight braking effect
        if (isBraking) {
            this.taillightMaterial.emissiveIntensity = 4.0; // Bright Red
        } else {
            // Dim red if headlights are conceptualized as "on", or just 0
            this.taillightMaterial.emissiveIntensity = 0.5;
        }

        // Clamp speed to max/min
        this.speed = Math.min(Math.max(this.speed, -this.maxSpeed / 2), this.maxSpeed);

        // Handle steering
        // Only allow steering when the car is moving
        if (Math.abs(this.speed) > 0.01) {
            let steerFactor = 1;
            // Reverse steering direction if going backward
            if (this.speed < 0) steerFactor = -1;

            if (this.controls.keys.left) {
                this.steeringAngle = Math.min(this.steeringAngle + this.turnSpeed, this.maxSteeringAngle);
                this.mesh.rotation.y += this.turnSpeed * steerFactor;
            } else if (this.controls.keys.right) {
                this.steeringAngle = Math.max(this.steeringAngle - this.turnSpeed, -this.maxSteeringAngle);
                this.mesh.rotation.y -= this.turnSpeed * steerFactor;
            } else {
                // Auto-center steering when keys are released
                this.steeringAngle *= 0.9;
            }
        } else {
            this.steeringAngle *= 0.9;
        }

        // Visually turn the front wheels based on steering angle
        this.wheelFL.rotation.y = this.steeringAngle;
        this.wheelFR.rotation.y = this.steeringAngle;

        // Spin wheels based on speed (circumference = 2 * PI * radius, approx based on tire turning)
        // Tire radius is ~0.58 (0.4 Torus radius + 0.18 tube)
        const wheelCircumference = 2 * Math.PI * 0.58;
        const rotationAngle = (this.speed / wheelCircumference) * Math.PI * 2;

        this.wheelFL.rotation.x += rotationAngle;
        this.wheelFR.rotation.x += rotationAngle;
        this.wheelBL.rotation.x += rotationAngle;
        this.wheelBR.rotation.x += rotationAngle;

        // Apply movement vector along the car's current forward direction
        const vector = new THREE.Vector3(0, 0, 1);
        vector.applyQuaternion(this.mesh.quaternion);
        vector.multiplyScalar(this.speed);

        this.mesh.position.add(vector);

        // Update UI
        const speedValueDisplay = document.getElementById('speed-value');
        if (speedValueDisplay) {
            speedValueDisplay.textContent = Math.round(Math.abs(this.speed) * 150);
        }
    }
}
