import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export class Car {
    constructor(scene, controls, gltfUrl = null) {
        this.scene = scene;
        this.controls = controls;

        // --- Advanced Physics Parameters ---
        this.speed = 0;
        this.maxSpeed = 3.0;       // Top speed (higher for more fun)
        this.acceleration = 0.025; // Base acceleration (punchier)
        this.friction = 0.004;     // Rolling resistance
        this.brakeFriction = 0.06; // Strong braking power
        this.airResistance = 0.001; // Drag increases with speed squared

        this.track = null; // Set from main.js for collision detection

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

        this.mesh = new THREE.Group();
        this.visuals = new THREE.Group(); // We separate visuals so we can pitch/roll them independently from the physics mesh
        this.mesh.add(this.visuals);
        this.scene.add(this.mesh);

        this.wheels = [];
        this.taillights = []; // Store materials to brighten on braking

        if (gltfUrl) {
            this.loadGLTFModel(gltfUrl);
        } else {
            this.buildProceduralCar();
        }
    }

    loadGLTFModel(url) {
        const loader = new GLTFLoader();

        // Add a temporary placeholder while loading
        const placeholderGeo = new THREE.BoxGeometry(2, 1, 4);
        const placeholderMat = new THREE.MeshBasicMaterial({ color: 0x555555, wireframe: true });
        const placeholder = new THREE.Mesh(placeholderGeo, placeholderMat);
        placeholder.position.y = 1;
        this.visuals.add(placeholder);

        loader.load(url, (gltf) => {
            // Remove placeholder
            this.visuals.remove(placeholder);

            const model = gltf.scene;

            // Optional: Automatically adjust scale to fit our physics parameters roughly
            // Usually, games normalize cars to be roughly 4-5 units long.
            const box = new THREE.Box3().setFromObject(model);
            const size = box.getSize(new THREE.Vector3());
            const scaleFactor = 4.5 / size.z;
            model.scale.set(scaleFactor, scaleFactor, scaleFactor);

            // Adjust to sit on ground
            box.setFromObject(model);
            const center = box.getCenter(new THREE.Vector3());
            model.position.y -= box.min.y; // Raise bottom to 0
            model.position.z -= center.z;  // Center the pivot
            model.position.x -= center.x;  // Center the pivot

            // --- Pass 1: Enable shadows and detect taillights ---
            model.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;

                    const name = child.name.toLowerCase();
                    if (name.includes('tail') || name.includes('brake') || name.includes('rear_light')) {
                        if (child.material) {
                            child.material = child.material.clone();
                            child.material.emissiveIntensity = 0;
                            this.taillights.push(child.material);
                        }
                    }
                }
            });

            // --- Pass 2: Collect all wheel/tyre/rim part nodes ---
            // In this Mercedes model, TYRE and WHEEL are SEPARATE sibling nodes.
            // We must collect them all, then group nearby ones into "assemblies".
            const wheelParts = [];
            model.traverse((child) => {
                const nodeName = child.name.toLowerCase();
                // Skip the STEERING_WHEEL (it's the interior steering wheel, not a car wheel!)
                if (nodeName.includes('steering')) return;

                if (nodeName.includes('wheel') || nodeName.includes('tyre') || nodeName.includes('tire') || nodeName.includes('rim')) {
                    // Skip if a parent already matched (avoid double-counting)
                    let parentIsWheelPart = false;
                    let p = child.parent;
                    while (p) {
                        const pName = p.name.toLowerCase();
                        if (pName.includes('wheel') || pName.includes('tyre') || pName.includes('tire') || pName.includes('rim')) {
                            if (!pName.includes('steering')) {
                                parentIsWheelPart = true;
                                break;
                            }
                        }
                        p = p.parent;
                    }

                    if (!parentIsWheelPart) {
                        const box = new THREE.Box3().setFromObject(child);
                        const center = box.getCenter(new THREE.Vector3());
                        wheelParts.push({ node: child, center: center });
                    }
                }
            });

            // --- Pass 3: Group nearby parts into wheel assemblies ---
            // Parts within ~0.5 units of each other belong to the same wheel assembly.
            const assemblies = []; // Each assembly = { parts: [...nodes], center: Vector3 }
            const used = new Set();

            for (let i = 0; i < wheelParts.length; i++) {
                if (used.has(i)) continue;
                used.add(i);

                const assembly = { parts: [wheelParts[i].node], center: wheelParts[i].center.clone() };

                for (let j = i + 1; j < wheelParts.length; j++) {
                    if (used.has(j)) continue;
                    const dist = wheelParts[i].center.distanceTo(wheelParts[j].center);
                    if (dist < 1.5) { // Close enough = same wheel
                        assembly.parts.push(wheelParts[j].node);
                        used.add(j);
                    }
                }

                assemblies.push(assembly);
            }

            // --- Pass 4: Determine front/rear by Z position ---
            if (assemblies.length > 0) {
                let totalZ = 0;
                assemblies.forEach(a => { totalZ += a.center.z; });
                const avgZ = totalZ / assemblies.length;

                assemblies.forEach(a => {
                    a.isFront = a.center.z > avgZ;
                });
            }

            // --- Pass 5: Create steering pivot groups for front wheel assemblies ---
            // For front wheels, we insert a pivot Group between the parent and the wheel parts.
            // The pivot handles Y-axis steering rotation cleanly.
            // All parts inside it spin around X for forward/backward rolling.
            assemblies.forEach(assembly => {
                if (assembly.isFront) {
                    // Create a pivot point at the wheel assembly's center
                    const pivot = new THREE.Group();
                    pivot.name = 'SteeringPivot';

                    // Set pivot position to the assembly center in parent-local space
                    const parentNode = assembly.parts[0].parent;
                    pivot.position.copy(assembly.center);

                    // Add pivot to parent
                    parentNode.add(pivot);

                    // Reparent each part into the pivot, adjusting positions
                    assembly.parts.forEach(part => {
                        const worldPos = new THREE.Vector3();
                        part.getWorldPosition(worldPos);

                        parentNode.remove(part);
                        pivot.add(part);

                        // Adjust part position relative to pivot
                        const pivotWorldPos = new THREE.Vector3();
                        pivot.getWorldPosition(pivotWorldPos);
                        part.position.sub(assembly.center);
                    });

                    this.wheels.push({
                        parts: assembly.parts,   // All meshes in this assembly (tyre + rim)
                        steeringPivot: pivot,     // We rotate THIS for steering (Y axis)
                        isFront: true
                    });
                } else {
                    this.wheels.push({
                        parts: assembly.parts,
                        steeringPivot: null,
                        isFront: false
                    });
                }
            });

            this.visuals.add(model);

            // Add Spotlights for custom car too
            this.addHeadlights();

        }, undefined, (error) => {
            console.error("Error loading GLTF car:", error);
            // Fallback
            this.visuals.remove(placeholder);
            this.buildProceduralCar();
        });
    }

    addHeadlights() {
        // SpotLights (Mounted roughly front center)
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

    buildProceduralCar() {
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

        const procTaillightMaterial = new THREE.MeshStandardMaterial({
            color: 0x440000, emissive: 0xff0000, emissiveIntensity: 0.0, roughness: 0.2
        });
        this.taillights.push(procTaillightMaterial);

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
        makeLight(0.8, 0.9, -2.15, procTaillightMaterial, false);
        makeLight(-0.8, 0.9, -2.15, procTaillightMaterial, false);

        this.addHeadlights();


        // 6. Wheels (Tire + Rim + Brake Disc)
        // INCREASED SEGMENTS FOR PERFECTLY ROUND WHEELS (e.g. 64 segments instead of 12)
        const tireGeo = new THREE.TorusGeometry(0.4, 0.18, 32, 64);
        const rimGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.3, 64);
        rimGeo.rotateZ(Math.PI / 2);

        const discGeo = new THREE.CylinderGeometry(0.25, 0.25, 0.05, 32);
        discGeo.rotateZ(Math.PI / 2);
        const caliperGeo = new THREE.BoxGeometry(0.1, 0.3, 0.15);

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

            this.wheels.push({ anchor: wheelAnchor, spinner: spinningWheel, isFront: (z > 0) }); // For procedural, we know front is +Z
            return wheelAnchor;
        };

        // Widened track for aggressive supercar stance
        this.wheelFL = createWheel(1.25, 0.58, 1.4, false);
        this.wheelFR = createWheel(-1.25, 0.58, 1.4, true);
        this.wheelBL = createWheel(1.25, 0.58, -1.3, false);
        this.wheelBR = createWheel(-1.25, 0.58, -1.3, true);
    }

    update(delta) {
        let isBraking = false;
        let accelerating = false;
        const totalMovement = new THREE.Vector3(0, 0, 0);

        // -- 0. Respawn (R key) — drop from sky --
        if (this.controls.keys.respawn) {
            this.controls.keys.respawn = false; // One-shot
            this.mesh.position.y = 50; // Lift to sky
            this.speed = 0;
            this.lateralVelocity = 0;
            this.steeringAngle = 0;
        }

        // Gravity — if car is above ground, fall down
        if (this.mesh.position.y > 0.01) {
            const drop = Math.min(0.5, this.mesh.position.y);
            totalMovement.y -= drop;
        }

        // -- 0b. Nitro (N key) — KUCHLI itarish --
        if (this.controls.keys.nitro) {
            this.speed += 0.5; // Juda kuchli tezlanish
            if (this.speed > this.maxSpeed * 3) this.speed = this.maxSpeed * 3;

            // Fizik itarish — harakat vektoriga qo'shish
            const boostDir = new THREE.Vector3(0, 0, 1);
            boostDir.applyQuaternion(this.mesh.quaternion);
            boostDir.multiplyScalar(2.0); // Har kadrda 2 unit oldinga itaradi
            totalMovement.add(boostDir);
        }

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
        this.speed = Math.min(Math.max(this.speed, -this.maxSpeed / 3), this.maxSpeed);

        // Air resistance (increases with speed squared)
        if (Math.abs(this.speed) > 0.01) {
            const drag = this.airResistance * this.speed * Math.abs(this.speed);
            this.speed -= drag;
        }

        // -- 2. Taillights --
        this.taillights.forEach(mat => {
            mat.emissiveIntensity = isBraking ? 5.0 : 0.5;
        });

        // -- 3. Steering & Drifting Kinematics --
        // Steering input is always accepted (even stationary) for visual wheel turning.
        // But the car body only rotates when there is forward/backward momentum.
        if (this.controls.keys.left) {
            this.steeringAngle = Math.min(this.steeringAngle + this.turnSpeed, this.maxSteeringAngle);
        } else if (this.controls.keys.right) {
            this.steeringAngle = Math.max(this.steeringAngle - this.turnSpeed, -this.maxSteeringAngle);
        } else {
            this.steeringAngle *= 0.85; // Faster auto-center
        }

        // Only rotate the car body if moving
        if (Math.abs(this.speed) > 0.02) {
            let steerFactor = 1;
            if (this.speed < 0) steerFactor = -1;

            // Apply steering to mesh rotation. 
            // Turning is less sharp at high speeds
            const turnRate = (this.turnSpeed * steerFactor) * (1.0 - currentSpeedRatio * 0.5);

            if (this.controls.keys.left || this.controls.keys.right) {
                this.mesh.rotation.y += (this.steeringAngle > 0 ? turnRate : -turnRate);

                // Introduce Lateral Sliding (Drift)
                // When steering hard at high speeds, add sideways velocity
                this.lateralVelocity += (this.steeringAngle > 0 ? 0.01 : -0.01) * currentSpeedRatio;
            }
        }

        // Recover grip (tires biting into road)
        this.lateralVelocity *= this.grip;

        // Visually steer the front wheels (Anchors)
        // -- 4. Wheel Spinning & Custom Steering --
        const wheelCircumference = 2 * Math.PI * 0.58;
        const rotationAngle = (this.speed / wheelCircumference) * Math.PI * 2;

        this.wheels.forEach(w => {
            // Spin ALL parts (tyre + rim) around their local X axis
            if (w.parts) {
                w.parts.forEach(part => {
                    part.rotation.x += rotationAngle;
                });
            } else if (w.spinner) {
                // Procedural car fallback
                w.spinner.rotation.x += rotationAngle;
            }

            // Steer front wheels via the pivot group (clean Y-axis rotation)
            if (w.isFront && w.steeringPivot) {
                w.steeringPivot.rotation.y = this.steeringAngle;
            }
        });

        // -- 5. Weight Transfer (Suspension Visuals) --
        // Pitch (Forward/Back)
        // Stiff sports car suspension -> smaller pitch values
        if (isBraking) this.targetPitch = -0.015; // Dive down front
        else if (accelerating) this.targetPitch = 0.01; // Squat rear
        else this.targetPitch = 0;

        // Roll (Side-to-Side) based on steering and speed
        // Less roll for sports cars
        this.targetRoll = -(this.steeringAngle * currentSpeedRatio * 0.08);

        // Smoothly interpolate current pitch/roll to target
        this.currentPitch += (this.targetPitch - this.currentPitch) * 0.1;
        this.currentRoll += (this.targetRoll - this.currentRoll) * 0.1;

        // Apply pitch/roll to the visual group only, not the main collision/logic mesh
        this.visuals.rotation.x = this.currentPitch;
        this.visuals.rotation.z = this.currentRoll;

        // -- 6. Apply Final Movement Vectors with Continuous Collision Detection --
        if (Math.abs(this.speed) > 0 || Math.abs(this.lateralVelocity) > 0) {
            // Forward Vector
            const forwardVector = new THREE.Vector3(0, 0, 1);
            forwardVector.applyQuaternion(this.mesh.quaternion);
            forwardVector.multiplyScalar(this.speed);

            // Lateral Vector (for slide/drift)
            const rightVector = new THREE.Vector3(1, 0, 0);
            rightVector.applyQuaternion(this.mesh.quaternion);
            rightVector.multiplyScalar(this.lateralVelocity);

            // Combine forces
            totalMovement.add(forwardVector);
            totalMovement.add(rightVector);
        }

        if (totalMovement.lengthSq() > 0) {
            // Anti-Tunneling: divide huge movements into small steps to prevent clipping through walls
            const STEPS = 5;
            const stepVector = totalMovement.clone().divideScalar(STEPS);

            for (let i = 0; i < STEPS; i++) {
                const prevPosition = this.mesh.position.clone();
                this.mesh.position.add(stepVector);

                if (this.track && this.track.colliders.length > 0) {
                    const carBox = new THREE.Box3().setFromObject(this.visuals);
                    // Slight padding to avoid pixel-perfect stuck logic
                    carBox.expandByScalar(-0.1);

                    if (this.track.checkCollision(carBox)) {
                        // Collision hit! Revert this micro-step
                        this.mesh.position.copy(prevPosition);

                        const impactSpeed = Math.abs(this.speed) + (this.controls.keys.nitro ? 2.0 : 0);

                        // Realistic Impact Reaction
                        if (impactSpeed > 0.5) {
                            this.currentPitch = (Math.random() - 0.5) * 0.8;
                            this.currentRoll = (Math.random() - 0.5) * 0.8;

                            const deflectionAngle = (Math.random() - 0.5) * impactSpeed * 0.8;
                            this.mesh.rotation.y += deflectionAngle;

                            this.lateralVelocity += (Math.random() - 0.5) * impactSpeed * 0.8;

                            this.speed *= -0.2; // Bounce back
                        } else {
                            this.speed *= -0.4;
                            this.lateralVelocity *= 0.2;
                        }

                        // Stop applying further steps this frame if we hit a wall
                        break;
                    }
                }
            }
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
