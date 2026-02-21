import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Track } from './Track.js';
import { Car } from './Car.js';
import { Controls } from './Controls.js';
import { CameraFollow } from './CameraFollow.js';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);
scene.fog = new THREE.Fog(0x87ceeb, 200, 1000);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);
// Initial camera position somewhat behind and above
camera.position.set(0, 5, -10);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
dirLight.position.set(100, 200, 50);
dirLight.castShadow = true;
dirLight.shadow.mapSize.width = 2048;
dirLight.shadow.mapSize.height = 2048;
dirLight.shadow.camera.near = 0.5;
dirLight.shadow.camera.far = 1000;
const d = 300;
dirLight.shadow.camera.left = -d; dirLight.shadow.camera.right = d;
dirLight.shadow.camera.top = d; dirLight.shadow.camera.bottom = -d;
scene.add(dirLight);

const track = new Track(scene);
const controls = new Controls();
// Pass the GLTF model path to the Car constructor
const car = new Car(scene, controls, '/models/mercedes.glb');
const cameraFollow = new CameraFollow(camera, car.mesh, renderer.domElement);

// Add OrbitControls for mouse interaction
const orbitControls = new OrbitControls(camera, renderer.domElement);
orbitControls.enableDamping = true; // Gives a nice smooth feeling
orbitControls.dampingFactor = 0.05;
orbitControls.maxPolarAngle = Math.PI / 2 - 0.05; // Don't allow camera to go below ground
orbitControls.minDistance = 5; // Don't zoom inside the car
orbitControls.maxDistance = 50; // Don't zoom out too far

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}, false);

const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();

    car.update(delta);

    // Update OrbitControls target to follow the car seamlessly
    const carPos = cameraFollow.getTargetPosition();
    orbitControls.target.copy(carPos);

    orbitControls.update(); // Required since damping is enabled

    renderer.render(scene, camera);
}
animate();
