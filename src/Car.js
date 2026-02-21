import * as THREE from 'three';

export class Car {
    constructor(scene, controls) {
        this.scene = scene;
        this.controls = controls;

        // --- Advanced Physics Parameters ---
        this.speed = 0;
        this.maxSpeed = 2.0;       // Top theoretical speed
        this.acceleration = 0.02;  // Base acceleration
        this.friction = 0.005;     // Rolling resistance
        this.brakeFriction = 0.04; // Braking power

        // Steering
        this.steeringAngle = 0;
        this.turnSpeed = 0.04;
        this.maxSteeringAngle = Math.PI / 4;

        // Kinematics & Weight Transfer
        this.lateralVelocity = 0;  // For Drifting/Sliding
        this.grip = 0.85;          // How much the car resists sliding (1.0 = perfect grip)

        // Visual suspension parameters target variables
        this.targetPitch = 0;
        this.targetRoll = 0;
        this.currentPitch = 0;
        this.currentRoll = 0;

        this.buildCar();
    }

    // --- Procedural Canvas Textures ---
    createRacingStripesTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');

        // Base red
        ctx.fillStyle = '#ff1020';
        ctx.fillRect(0, 0, 512, 512);

        // White racing stripes in the middle
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(200, 0, 40, 512);
        ctx.fillRect(272, 0, 40, 512);

        const tex = new THREE.CanvasTexture(canvas);
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        return tex;
    }

    createCarbonFiberTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');

        // Simple checkerboard gradient pattern for carbon fiber look
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(0, 0, 64, 64);
        ctx.fillStyle = '#222222';
        ctx.fillRect(0, 0, 32, 32);
        ctx.fillRect(32, 32, 32, 32);
        ctx.fillStyle = '#2a2a2a';
        ctx.fillRect(0, 32, 32, 32);
        ctx.fillRect(32, 0, 32, 32);

        const tex = new THREE.CanvasTexture(canvas);
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(8, 8); // Tile it
        return tex;
    }

    createGrillTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = '#050505';
        ctx.fillRect(0, 0, 128, 128);
        ctx.strokeStyle = '#333333';
        ctx.lineWidth = 4;

        // Honeycomb or grid lines
        for (let i = 0; i < 128; i += 16) {
            ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 128); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(128, i); ctx.stroke();
        }

        const tex = new THREE.CanvasTexture(canvas);
        return tex;
    }

    buildCar() {
        // Container for all visual car parts
        this.mesh = new THREE.Group();
        this.visuals = new THREE.Group(); // We separate visuals so we can pitch/roll them independently from the physics mesh
        this.mesh.add(this.visuals);

        // --- Materials ---
        const stripeTexture = this.createRacingStripesTexture();
        const carPaintMaterial = new THREE.MeshPhysicalMaterial({
            map: stripeTexture,
            color: 0xffffff, // White base so texture color shows 
            metalness: 0.6,
            roughness: 0.2,
            clearcoat: 1.0,
            clearcoatRoughness: 0.1
        });

        const carbonTexture = this.createCarbonFiberTexture();
        const carbonMaterial = new THREE.MeshStandardMaterial({
            map: carbonTexture,
            roughness: 0.6,
            metalness: 0.8
        });

        const windowMaterial = new THREE.MeshPhysicalMaterial({
            color: 0x050505,
            metalness: 0.9,
            roughness: 0.05,
            envMapIntensity: 1.0,
            transparent: true,
            opacity: 0.85
        });

        const trimMaterial = new THREE.MeshStandardMaterial({
            color: 0x111111,
            metalness: 0.8,
            roughness: 0.5
        });

        const tireMaterial = new THREE.MeshStandardMaterial({
            color: 0x111111,
            roughness: 0.9,
            metalness: 0.1
        });

        const rimMaterial = new THREE.MeshStandardMaterial({
            color: 0xcccccc,
            metalness: 1.0,
            roughness: 0.2
        });

        const brakeDiscMaterial = new THREE.MeshStandardMaterial({
            color: 0x666666,
            metalness: 0.9,
            roughness: 0.4
        });
        const brakeCaliperMaterial = new THREE.MeshStandardMaterial({
            color: 0xff0000, // Red racing calipers
            roughness: 0.4
        });

        // 1. Lower Chassis base (Carbon fiber) - Wide & Low
        const chassisBottomGeo = new THREE.BoxGeometry(2.4, 0.2, 4.6);
        const chassisBottom = new THREE.Mesh(chassisBottomGeo, carbonMaterial);
        chassisBottom.position.y = 0.5;
        chassisBottom.castShadow = true;
        this.visuals.add(chassisBottom);

        // Front Grill (Aggressive wide stance)
        const grillGeo = new THREE.BoxGeometry(1.6, 0.3, 0.1);
        const grillMat = new THREE.MeshStandardMaterial({ map: this.createGrillTexture(), roughness: 0.8, metalness: 0.5 });
        const grill = new THREE.Mesh(grillGeo, grillMat);
        grill.position.set(0, 0.65, 2.3);
        this.visuals.add(grill);

        // Exhaust pipes (Quad exhaust)
        const pipeGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.3, 16);
        pipeGeo.rotateX(Math.PI / 2);
        const pipeMat = new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.9, roughness: 0.3 });
        const makeExhaust = (x) => {
            const p = new THREE.Mesh(pipeGeo, pipeMat);
            p.position.set(x, 0.6, -2.35);
            this.visuals.add(p);
        };
        makeExhaust(0.6); makeExhaust(0.8); makeExhaust(-0.6); makeExhaust(-0.8);

        // 2. Main Body (Wider, sleeker sport lines)
        const bodyGeo = new THREE.BoxGeometry(2.2, 0.5, 4.3);
        const body = new THREE.Mesh(bodyGeo, carPaintMaterial);
        body.position.y = 0.85;
        body.castShadow = true;
        body.receiveShadow = true;
        this.visuals.add(body);

        // 3. Cabin (Aero-shaped, swept back)
        // More segments for smoother roofline
        const cabinGeo = new THREE.CylinderGeometry(0.6, 1.1, 2.0, 16, 1, false, 0, Math.PI);
        cabinGeo.rotateZ(Math.PI / 2);
        cabinGeo.scale(1, 0.6, 1.25); // Sloped long roof

        const cabin = new THREE.Mesh(cabinGeo, windowMaterial);
        cabin.position.set(0, 1.4, -0.2);
        cabin.castShadow = true;
        this.visuals.add(cabin);

        const roofTrimGeo = new THREE.BoxGeometry(1.4, 0.05, 1.6);
        const roofTrim = new THREE.Mesh(roofTrimGeo, carbonMaterial);
        roofTrim.position.set(0, 1.7, -0.3);
        this.visuals.add(roofTrim);

        // Side Mirrors (Aero-wing style)
        const mirrorGeo = new THREE.BoxGeometry(0.4, 0.1, 0.15);
        const mirrorL = new THREE.Mesh(mirrorGeo, carPaintMaterial);
        mirrorL.position.set(1.2, 1.2, 0.6);
        mirrorL.rotation.z = 0.2;
        const mirrorR = new THREE.Mesh(mirrorGeo, carPaintMaterial);
        mirrorR.position.set(-1.2, 1.2, 0.6);
        mirrorR.rotation.z = -0.2;
        this.visuals.add(mirrorL);
        this.visuals.add(mirrorR);

        // 4. Spoiler (GT Racing Style Wide Wing)
        const spoilerStandGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.4, 8);
        const slStand = new THREE.Mesh(spoilerStandGeo, trimMaterial);
        slStand.position.set(0.8, 1.2, -2.0);
        this.visuals.add(slStand);

        const srStand = new THREE.Mesh(spoilerStandGeo, trimMaterial);
        srStand.position.set(-0.8, 1.2, -2.0);
        this.visuals.add(srStand);

        const spoilerGeo = new THREE.BoxGeometry(2.4, 0.05, 0.4);
        const spoiler = new THREE.Mesh(spoilerGeo, carbonMaterial);
        spoiler.position.set(0, 1.4, -2.1);
        spoiler.rotation.x = -0.15;
        spoiler.castShadow = true;
        this.visuals.add(spoiler);

        // 5. Lights (Sleek aggressive eyes)
        const headlightLensMaterial = new THREE.MeshStandardMaterial({
            color: 0xffffff, emissive: 0xffddaa, emissiveIntensity: 0.8, roughness: 0.2, transparent: true, opacity: 0.9
        });
        const headlightHousingMat = new THREE.MeshStandardMaterial({ color: 0x111111 }); // Inner dark housing

        this.taillightMaterial = new THREE.MeshStandardMaterial({
            color: 0x440000, emissive: 0xff0000, emissiveIntensity: 0.0, roughness: 0.2
        });

        const makeLight = (x, y, z, mat, isFront) => {
            // Add a housing behind the lens
            if (isFront) {
                const housing = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.22, 0.05), headlightHousingMat);
                housing.position.set(x, y, z);
                this.visuals.add(housing);
            }

            const lightGeo = new THREE.BoxGeometry(0.4, 0.2, 0.05);
            const lightMesh = new THREE.Mesh(lightGeo, mat);
            lightMesh.position.set(x, y, isFront ? z + 0.05 : z - 0.05);
            this.visuals.add(lightMesh);
        };
        // Headlights
        makeLight(0.8, 0.9, 2.15, headlightLensMaterial, true);
        makeLight(-0.8, 0.9, 2.15, headlightLensMaterial, true);
        // Taillights
        makeLight(0.8, 0.9, -2.15, this.taillightMaterial, false);
        makeLight(-0.8, 0.9, -2.15, this.taillightMaterial, false);

        // SpotLights (Mounted lower now)
        const createSpotLight = (x, y, z) => {
            const spotLight = new THREE.SpotLight(0xffffee, 3.0);
            spotLight.position.set(x, y, z);
            spotLight.angle = Math.PI / 4;
            spotLight.penumbra = 0.5;
            spotLight.decay = 1.5;
            spotLight.distance = 150;
            spotLight.castShadow = true;

            const target = new THREE.Object3D();
            target.position.set(x, y - 1, z + 10);
            this.visuals.add(target);
            spotLight.target = target;

            this.visuals.add(spotLight);
        };
        createSpotLight(0.8, 0.9, 2.15);
        createSpotLight(-0.8, 0.9, 2.15);

        // 6. Wheels (Tire + Rim + Brake Disc)
        // INCREASED SEGMENTS FOR PERFECTLY ROUND WHEELS (e.g. 64 segments instead of 12)
        const tireGeo = new THREE.TorusGeometry(0.4, 0.18, 32, 64);
        const rimGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.3, 64);
        rimGeo.rotateZ(Math.PI / 2);

        const discGeo = new THREE.CylinderGeometry(0.25, 0.25, 0.05, 32);
        discGeo.rotateZ(Math.PI / 2);
        const caliperGeo = new THREE.BoxGeometry(0.1, 0.3, 0.15);

        this.wheels = [];

        const createWheel = (x, y, z, isRightSide) => {
            const wheelAnchor = new THREE.Group();
            const spinningWheel = new THREE.Group();

            // Stationary Brake Assembly
            const brakeGroup = new THREE.Group();
            const brakeDisc = new THREE.Mesh(discGeo, brakeDiscMaterial);
            const caliper = new THREE.Mesh(caliperGeo, brakeCaliperMaterial);
            caliper.position.set(isRightSide ? -0.05 : 0.05, 0.1, 0.15);
            brakeGroup.add(brakeDisc);
            brakeGroup.add(caliper);
            wheelAnchor.add(brakeGroup);

            // Spinning Components
            const tire = new THREE.Mesh(tireGeo, tireMaterial);
            tire.rotation.y = Math.PI / 2;
            tire.castShadow = true;
            spinningWheel.add(tire);

            const rim = new THREE.Mesh(rimGeo, rimMaterial);
            spinningWheel.add(rim);

            // Modern star spokes
            const spokeGeo = new THREE.BoxGeometry(0.04, 0.65, 0.35);
            const spokeMat = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.9, roughness: 0.1 });
            for (let i = 0; i < 6; i++) {
                const spoke = new THREE.Mesh(spokeGeo, spokeMat);
                spoke.rotation.x = (i * Math.PI * 2) / 6;
                spinningWheel.add(spoke);
            }

            wheelAnchor.add(spinningWheel);
            wheelAnchor.position.set(x, y, z);
            this.visuals.add(wheelAnchor);

            this.wheels.push({ anchor: wheelAnchor, spinner: spinningWheel });
            return wheelAnchor;
        };

        // Widened track for aggressive supercar stance
        this.wheelFL = createWheel(1.25, 0.58, 1.4, false);
        this.wheelFR = createWheel(-1.25, 0.58, 1.4, true);
        this.wheelBL = createWheel(1.25, 0.58, -1.3, false);
        this.wheelBR = createWheel(-1.25, 0.58, -1.3, true);

        this.scene.add(this.mesh);
    }

    update(delta) {
        let isBraking = false;
        let accelerating = false;

        // -- 1. Engine & Torque --
        // Torque decreases at higher speeds (simulating gear ratios/air resistance)
        const currentSpeedRatio = Math.abs(this.speed) / this.maxSpeed;
        const pushingForce = this.acceleration * (1.0 - currentSpeedRatio * 0.8); // 80% torque loss at top speed

        // Handle forward/backward input
        if (this.controls.keys.forward) {
            this.speed += pushingForce;
            accelerating = true;
        } else if (this.controls.keys.backward) {
            this.speed -= this.brakeFriction;
            if (this.speed > 0) isBraking = true;
        } else {
            // Rolling friction
            if (this.speed > 0) {
                this.speed -= this.friction;
                if (this.speed < 0) this.speed = 0;
            } else if (this.speed < 0) {
                this.speed += this.friction;
                if (this.speed > 0) this.speed = 0;
            }
        }

        // Clamp Speed
        this.speed = Math.min(Math.max(this.speed, -this.maxSpeed / 2), this.maxSpeed);

        // -- 2. Taillights --
        this.taillightMaterial.emissiveIntensity = isBraking ? 5.0 : 0.5;

        // -- 3. Steering & Drifting Kinematics --
        // To turn, we need forward momentum.
        if (Math.abs(this.speed) > 0.02) {
            let steerFactor = 1;
            if (this.speed < 0) steerFactor = -1;

            if (this.controls.keys.left) {
                this.steeringAngle = Math.min(this.steeringAngle + this.turnSpeed, this.maxSteeringAngle);
            } else if (this.controls.keys.right) {
                this.steeringAngle = Math.max(this.steeringAngle - this.turnSpeed, -this.maxSteeringAngle);
            } else {
                this.steeringAngle *= 0.85; // Faster auto-center
            }

            // Apply steering to mesh rotation. 
            // Turning is less sharp at high speeds
            const turnRate = (this.turnSpeed * steerFactor) * (1.0 - currentSpeedRatio * 0.5);

            if (this.controls.keys.left || this.controls.keys.right) {
                this.mesh.rotation.y += (this.steeringAngle > 0 ? turnRate : -turnRate);

                // Introduce Lateral Sliding (Drift)
                // When steering hard at high speeds, add sideways velocity
                this.lateralVelocity += (this.steeringAngle > 0 ? 0.01 : -0.01) * currentSpeedRatio;
            }
        } else {
            this.steeringAngle *= 0.85;
        }

        // Recover grip (tires biting into road)
        this.lateralVelocity *= this.grip;

        // Visually steer the front wheels (Anchors)
        // Wheel array indices: 0=FL, 1=FR
        this.wheels[0].anchor.rotation.y = this.steeringAngle;
        this.wheels[1].anchor.rotation.y = this.steeringAngle;

        // -- 4. Wheel Spinning --
        const wheelCircumference = 2 * Math.PI * 0.58;
        const rotationAngle = (this.speed / wheelCircumference) * Math.PI * 2;

        this.wheels.forEach(w => {
            w.spinner.rotation.x += rotationAngle;
        });

        // -- 5. Weight Transfer (Suspension Visuals) --
        // Pitch (Forward/Back)
        if (isBraking) this.targetPitch = -0.05; // Dive down front
        else if (accelerating) this.targetPitch = 0.03; // Squat rear
        else this.targetPitch = 0;

        // Roll (Side-to-Side) based on steering and speed
        this.targetRoll = -(this.steeringAngle * currentSpeedRatio * 0.2);

        // Smoothly interpolate current pitch/roll to target
        this.currentPitch += (this.targetPitch - this.currentPitch) * 0.1;
        this.currentRoll += (this.targetRoll - this.currentRoll) * 0.1;

        // Apply pitch/roll to the visual group only, not the main collision/logic mesh
        this.visuals.rotation.x = this.currentPitch;
        this.visuals.rotation.z = this.currentRoll;

        // -- 6. Apply Final Movement Vectors --
        if (Math.abs(this.speed) > 0 || Math.abs(this.lateralVelocity) > 0) {
            // Forward Vector
            const forwardVector = new THREE.Vector3(0, 0, 1);
            forwardVector.applyQuaternion(this.mesh.quaternion);
            forwardVector.multiplyScalar(this.speed);

            // Lateral Vector (for slide/drift)
            const rightVector = new THREE.Vector3(1, 0, 0);
            rightVector.applyQuaternion(this.mesh.quaternion);
            rightVector.multiplyScalar(this.lateralVelocity);

            // Add forces together
            this.mesh.position.add(forwardVector);
            this.mesh.position.add(rightVector);
        }

        // Update UI
        const speedValueDisplay = document.getElementById('speed-value');
        if (speedValueDisplay) {
            // Add lateral velocity to display speed calculation for fun drifting numbers
            const totalSpeed = Math.sqrt(this.speed * this.speed + this.lateralVelocity * this.lateralVelocity);
            speedValueDisplay.textContent = Math.round(totalSpeed * 150);
        }
    }
}
