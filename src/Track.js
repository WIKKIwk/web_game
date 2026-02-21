import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export class Track {
    constructor(scene) {
        this.scene = scene;
        this.colliders = []; // Store bounding boxes for collision detection
        this.loadCityMap();
    }

    loadCityMap() {
        const loader = new GLTFLoader();

        loader.load('/models/city.glb', (gltf) => {
            const city = gltf.scene;

            city.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;

                    // Build collision boxes for solid objects (not ground/roads)
                    const box = new THREE.Box3().setFromObject(child);
                    const size = box.getSize(new THREE.Vector3());

                    // Only add as collider if it has some height (not flat ground)
                    if (size.y > 1.0) {
                        this.colliders.push(box);
                    }
                }
            });

            city.position.y = 0;
            this.scene.add(city);
            console.log(`City map loaded! ${this.colliders.length} colliders created.`);
        }, undefined, (error) => {
            console.error('Error loading city map:', error);
            this.buildFallbackTrack();
        });
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

    buildFallbackTrack() {
        const planeGeo = new THREE.PlaneGeometry(2000, 2000);
        const planeMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.8 });
        const plane = new THREE.Mesh(planeGeo, planeMat);
        plane.rotation.x = -Math.PI / 2;
        plane.receiveShadow = true;
        this.scene.add(plane);

        const gridHelper = new THREE.GridHelper(2000, 100, 0x555555, 0x444444);
        gridHelper.position.y = 0.01;
        this.scene.add(gridHelper);
    }
}
