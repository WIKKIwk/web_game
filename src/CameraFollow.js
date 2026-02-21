import * as THREE from 'three';

export class CameraFollow {
    constructor(camera, targetMesh, domElement) {
        this.camera = camera;
        this.target = targetMesh;
        this.domElement = domElement;
    }

    getTargetPosition() {
        if (!this.target) return new THREE.Vector3(0, 0, 0);

        const targetWorldPosition = new THREE.Vector3();
        this.target.getWorldPosition(targetWorldPosition);

        // We look slightly above the car's center
        targetWorldPosition.y += 1.0;
        return targetWorldPosition;
    }
}
