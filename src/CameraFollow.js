import * as THREE from 'three';
export class CameraFollow {
    constructor(camera, targetMesh) {
        this.camera = camera;
        this.target = targetMesh;
        this.offset = new THREE.Vector3(0, 5, -10);
        this.lookAtOffset = new THREE.Vector3(0, 1, 0);
    }
    update() {
        if (!this.target) return;
        const targetWorldPosition = new THREE.Vector3();
        this.target.getWorldPosition(targetWorldPosition);
        const offsetRotated = this.offset.clone();
        offsetRotated.applyQuaternion(this.target.quaternion);

        const idealPosition = targetWorldPosition.clone().add(offsetRotated);
        this.camera.position.lerp(idealPosition, 0.1);

        const lookAtPosition = targetWorldPosition.clone().add(this.lookAtOffset);
        this.camera.lookAt(lookAtPosition);
    }
}
