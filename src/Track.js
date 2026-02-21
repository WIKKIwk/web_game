import * as THREE from 'three';
export class Track {
    constructor(scene) {
        this.scene = scene;
        this.buildTrack();
    }
    buildTrack() {
        const planeGeo = new THREE.PlaneGeometry(2000, 2000);
        const planeMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.8 });
        const plane = new THREE.Mesh(planeGeo, planeMat);
        plane.rotation.x = -Math.PI / 2;
        plane.receiveShadow = true;
        this.scene.add(plane);

        const gridHelper = new THREE.GridHelper(2000, 100, 0x555555, 0x444444);
        gridHelper.position.y = 0.01;
        this.scene.add(gridHelper);

        const boxGeo = new THREE.BoxGeometry(4, 4, 4);
        const boxMat = new THREE.MeshStandardMaterial({ color: 0xff4444 });

        for (let i = 0; i < 50; i++) {
            const box = new THREE.Mesh(boxGeo, boxMat);
            let px = (Math.random() - 0.5) * 400;
            let pz = (Math.random() - 0.5) * 400;
            if (Math.abs(px) < 10 && Math.abs(pz) < 10) px += 20;
            box.position.set(px, 2, pz);
            box.castShadow = true;
            box.receiveShadow = true;
            this.scene.add(box);
        }
    }
}
