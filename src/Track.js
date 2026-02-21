import * as THREE from 'three';

export class Track {
    constructor(scene) {
        this.scene = scene;
        this.colliders = []; // Store bounding boxes for collision detection
        this.buildCityGrid();
    }

    buildCityGrid() {
        // Materials
        const groundMat = new THREE.MeshStandardMaterial({ color: 0x4a7c59, roughness: 1.0 }); // Grass green
        const roadMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.9 }); // Dark asphalt
        const buildingMats = [
            new THREE.MeshStandardMaterial({ color: 0xeaeaea, roughness: 0.8 }), // White
            new THREE.MeshStandardMaterial({ color: 0xcc5544, roughness: 0.8 }), // Brick red
            new THREE.MeshStandardMaterial({ color: 0x5588cc, roughness: 0.8 }), // Blue
            new THREE.MeshStandardMaterial({ color: 0xddaa55, roughness: 0.8 }), // Ochre
            new THREE.MeshStandardMaterial({ color: 0x88aabb, roughness: 0.4, metalness: 0.6 }) // Glassy
        ];

        // 1. Ground Plane (Grass)
        const groundGeo = new THREE.PlaneGeometry(2000, 2000);
        const ground = new THREE.Mesh(groundGeo, groundMat);
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        this.scene.add(ground);

        // 2. City Grid Parameters
        const blockSize = 100; // Size of one block including the road
        const roadWidth = 30; // Width of the roads
        const gridSize = 8; // 8x8 blocks total
        const offset = (gridSize * blockSize) / 2;

        // Build grid of roads
        const roadGeo = new THREE.PlaneGeometry(blockSize * gridSize, roadWidth);

        for (let i = 0; i <= gridSize; i++) {
            const pos = -offset + i * blockSize;

            // Horizontal roads
            const hRoad = new THREE.Mesh(roadGeo, roadMat);
            hRoad.rotation.x = -Math.PI / 2;
            hRoad.position.set(0, 0.05, pos); // Slightly above ground to avoid z-fighting
            hRoad.receiveShadow = true;
            this.scene.add(hRoad);

            // Vertical roads
            const vRoad = new THREE.Mesh(roadGeo, roadMat);
            vRoad.rotation.x = -Math.PI / 2;
            vRoad.rotation.z = Math.PI / 2;
            vRoad.position.set(pos, 0.05, 0);
            vRoad.receiveShadow = true;
            this.scene.add(vRoad);
        }

        // 3. Populate Blocks with Buildings
        const buildArea = blockSize - roadWidth; // Playable area inside a block
        const halfBuildArea = buildArea / 2;

        // Loop through each block area
        for (let x = 0; x < gridSize; x++) {
            for (let z = 0; z < gridSize; z++) {
                // Center of the current block
                const cx = -offset + (x * blockSize) + (blockSize / 2);
                const cz = -offset + (z * blockSize) + (blockSize / 2);

                // Decide how many buildings in this block (1 to 4)
                const numBuildings = Math.floor(Math.random() * 4) + 1;

                // Central park / empty block chance (10%)
                if (Math.random() < 0.1) continue;

                for (let b = 0; b < numBuildings; b++) {
                    // Random building dimensions
                    const bWidth = 10 + Math.random() * 20;
                    const bDepth = 10 + Math.random() * 20;
                    const bHeight = 15 + Math.random() * 80;

                    // Random position inside the block
                    const bx = cx + (Math.random() * buildArea - halfBuildArea) * 0.6;
                    const bz = cz + (Math.random() * buildArea - halfBuildArea) * 0.6;

                    const bGeo = new THREE.BoxGeometry(bWidth, bHeight, bDepth);
                    const bMat = buildingMats[Math.floor(Math.random() * buildingMats.length)];
                    const building = new THREE.Mesh(bGeo, bMat);

                    building.position.set(bx, bHeight / 2, bz);
                    building.castShadow = true;
                    building.receiveShadow = true;

                    this.scene.add(building);

                    // Add to colliders!
                    const box = new THREE.Box3().setFromObject(building);
                    this.colliders.push(box);
                }
            }
        }

        console.log(`Procedural city built! ${this.colliders.length} buildings to crash into.`);
    }

    // Check if a bounding box collides with any city object
    checkCollision(carBox) {
        for (let i = 0; i < this.colliders.length; i++) {
            if (carBox.intersectsBox(this.colliders[i])) {
                return true;
            }
        }
        return false;
    }
}
