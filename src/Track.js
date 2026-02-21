import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export class Track {
    constructor(scene) {
        this.scene = scene;
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
                }
            });

            // Position on ground
            city.position.y = 0;

            this.scene.add(city);
            console.log('City map loaded!');
        }, undefined, (error) => {
            console.error('Error loading city map:', error);
            // Fallback to simple ground
            this.buildFallbackTrack();
        });
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
