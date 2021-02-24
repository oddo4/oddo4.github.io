import './style.css'

import * as THREE from 'three';
import * as dat from 'dat.gui'
import CANNON from 'cannon'

import { VRButton } from 'three/examples/jsm/webxr/VRButton.js';
import { XRControllerModelFactory } from 'three/examples/jsm/webxr/XRControllerModelFactory.js';
import { AxesHelper, Mesh } from 'three';

//#region Debug
const gui = new dat.GUI()
const debugObject = {}

debugObject.createBullet = () => {
    createBullet(
        0.01, 
        { 
            x: (Math.random() * 0.5) * 3, 
            y: 3, 
            z: (Math.random() * 0.5) * 3
        }
    )
}
debugObject.createBox = () => {
    createBox(
        Math.random(),
        Math.random(),
        Math.random(),
        { 
            x: (Math.random() * 0.5) * 3, 
            y: 3, 
            z: ((Math.random() * 0.5) * 3) - 3
        }
    )
}
debugObject.spawnEnemy = () => {
    createEnemy(
        0.5,
        1.8,
        0.5,
        { 
            x: ((Math.random() - 0.5) * 10), 
            y: 0.9, 
            z: ((Math.random() - 0.5) * 10)
        }
    )
}
debugObject.reset = () => {
    for (const object of objectsToUpdate) {
        // Remove body
        object.body.removeEventListener('collide', playHitSound)
        world.removeBody(object.body)

        // Remove mesh
        scene.remove(object.mesh)
        objectsToUpdate.splice(objectsToUpdate.indexOf(object), 1)
    }
    for (const enemy of enemyObjectsToUpdate) {
        // Remove body
        enemy.body.removeEventListener('collide', playHitSound)
        world.removeBody(enemy.body)

        // Remove mesh
        scene.remove(enemy.mesh)
        enemyObjectsToUpdate.splice(enemyObjectsToUpdate.indexOf(enemy), 1)
    }
}
gui.add(debugObject, 'createBullet')
gui.add(debugObject, 'createBox')
gui.add(debugObject, 'spawnEnemy')
gui.add(debugObject, 'reset')
//#endregion Debug

//#region Sounds
const hitSound = new Audio('/sounds/hit.mp3')

function playHitSound(collision) {
    const impactStrength = collision.contact.getImpactVelocityAlongNormal()

    if (impactStrength > 1.5) {
        let soundVolume = 0
        if (impactStrength > 1.5 + 5) {
            soundVolume = 1
        }
        else {
            soundVolume = Math.random() * ((impactStrength - 1.5) / 5)
        }
        hitSound.volume = soundVolume
        hitSound.currentTime = 0
        hitSound.play()
    }
}
//#endregion Sounds

//#region Textures
const textureLoader = new THREE.TextureLoader()
const cubeTextureLoader = new THREE.CubeTextureLoader()

const environmentMapTexture = cubeTextureLoader.load([
    '/textures/environmentMaps/0/px.png',
    '/textures/environmentMaps/0/nx.png',
    '/textures/environmentMaps/0/py.png',
    '/textures/environmentMaps/0/ny.png',
    '/textures/environmentMaps/0/pz.png',
    '/textures/environmentMaps/0/nz.png'
])
//#endregion Textures

//#region Physics
// World
const world = new CANNON.World()
// world.broadphase = new CANNON.SAPBroadphase(world)
world.allowSleep = true
world.gravity.set(0, -9.81, 0)

// Physics material
const defaultPhysicsMaterial = new CANNON.Material('default')
const playerPhysicsMaterial = new CANNON.Material('player')
const enemyPhysicsMaterial = new CANNON.Material('enemy')
const bulletPhysicsMaterial = new CANNON.Material('bullet')

// Default contact material
const defaultPhysicsContactMaterial = new CANNON.ContactMaterial(
    defaultPhysicsMaterial, 
    defaultPhysicsMaterial, 
    {
        friction: 0.9,
        restitution: 0.1
    }
)
world.addContactMaterial(defaultPhysicsContactMaterial)

// Player/Enemy contact material
const playerEnemyPhysicsContactMaterial = new CANNON.ContactMaterial(
    playerPhysicsMaterial, 
    enemyPhysicsMaterial, 
    {
        friction: 1,
        restitution: 0
    }
)
world.addContactMaterial(playerEnemyPhysicsContactMaterial)

// Enemy/Bullet contact material
const enemyBulletPhysicsContactMaterial = new CANNON.ContactMaterial(
    bulletPhysicsMaterial, 
    enemyPhysicsMaterial, 
    {
        friction: 1,
        restitution: 0
    }
)
world.addContactMaterial(enemyBulletPhysicsContactMaterial)

/// Colliders
// Player
const playerShape = new CANNON.Cylinder(0.15, 0.15, 1.8, 24)
const playerBody = new CANNON.Body({
    mass: 0, // object static
    shape: playerShape,
    material: playerPhysicsMaterial
})
playerBody.position.y = 0.9
world.addBody(playerBody)

// Floor
const floorShape = new CANNON.Plane()
const floorBody = new CANNON.Body({
    mass: 0, // object static
    shape: floorShape,
    material: defaultPhysicsMaterial
})
floorBody.quaternion.setFromAxisAngle(
    new CANNON.Vec3(-1, 0, 0),
    Math.PI * 0.5
)
world.addBody(floorBody)
//#endregion Physics

//#region Utils
const objectsToUpdate = []
const enemyObjectsToUpdate = []

const defaultMaterial = new THREE.MeshStandardMaterial({
    metalness: 0.3,
    roughness: 0.4,
    envMap: environmentMapTexture
})

// Bullet
const sphereGeometry = new THREE.SphereBufferGeometry(1, 20, 20)
function createBullet(radius, position) {
    // Three.js mesh
    const mesh = new THREE.Mesh(sphereGeometry, defaultMaterial)
    mesh.scale.set(radius, radius, radius)
    mesh.castShadow = true
    mesh.position.copy(position)
    scene.add(mesh)

    // Cannon.js body
    const shape = new CANNON.Sphere(radius * 2)
    const body = new CANNON.Body({
        mass: 0.5,
        position: new CANNON.Vec3(0, 3, 0),
        shape: shape,
        material: bulletPhysicsMaterial
    })
    body.position.copy(position)
    body.addEventListener('collide', playHitSound)
    body.addEventListener('collide', bulletOnHit)
    world.addBody(body)

    let object = {
        mesh: mesh,
        body: body
    }

    // Save in objectsToUpdate
    objectsToUpdate.push(object)
    //console.log(objectsToUpdate)

    return object;
}

// Box
const boxGeometry = new THREE.BoxBufferGeometry(1, 1, 1)
function createBox(width, height, depth, position) {
    // Three.js mesh
    const mesh = new THREE.Mesh(boxGeometry, defaultMaterial)
    mesh.scale.set(width, height, depth)
    mesh.castShadow = true
    mesh.position.copy(position)
    scene.add(mesh)

    // Cannon.js body
    const shape = new CANNON.Box(new CANNON.Vec3(width * 0.5, height * 0.5, depth * 0.5))
    const body = new CANNON.Body({
        mass: 1,
        position: new CANNON.Vec3(0, 3, 0),
        shape: shape,
        material: defaultPhysicsMaterial
    })
    body.position.copy(position)
    body.addEventListener('collide', playHitSound)
    world.addBody(body)

    let object = {
        mesh: mesh,
        body: body
    }

    // Save in objectsToUpdate
    objectsToUpdate.push(object)

    return object;
}

function createEnemy(width, height, depth, position) {
    // Three.js mesh
    const mesh = new THREE.Mesh(boxGeometry, defaultMaterial)
    mesh.scale.set(width, height, depth)
    mesh.castShadow = true
    mesh.position.copy(position)
    scene.add(mesh)

    // Cannon.js body
    const shape = new CANNON.Box(new CANNON.Vec3(width * 0.5, height * 0.5, depth * 0.5))
    const body = new CANNON.Body({
        mass: 0,
        position: new CANNON.Vec3(0, 3, 0),
        shape: shape,
        material: enemyPhysicsMaterial
    })
    body.position.copy(position)
    body.addEventListener('collide', playHitSound)
    world.addBody(body)

    let object = {
        mesh: mesh,
        body: body
    }

    const axesHelper = new THREE.AxesHelper(1)
    mesh.add(axesHelper)

    // Save in enemyObjectsToUpdate
    enemyObjectsToUpdate.push(object)

    return object;
}

function bulletOnHit(collision) {
    collision.target.removeEventListener('collide', bulletOnHit)
    collision.target.removeEventListener('collide', playHitSound)

    let velocity = new CANNON.Vec3()
    velocity.copy(collision.target.velocity)
    velocity.normalize()

    let object = objectsToUpdate.find(obj => obj.body === collision.target)
    object.body.applyImpulse(new CANNON.Vec3(), object.body.position)
    objectsToUpdate.splice(objectsToUpdate.indexOf(object), 1)
    //collision.body.applyForce(velocity, collision.body.position)
    
    // Remove mesh
    scene.remove(object.mesh)
    // Remove body, delayed to avoid errors
    setTimeout(() => { world.removeBody(object.body) }, 500)

    // check if hitted enemy
    if (collision.body.material.name == "enemy") {
        console.log('enemy hit')
        collision.body.removeEventListener('collide', playHitSound)
        let enemy = enemyObjectsToUpdate.find(obj => obj.body === collision.body)

        // Remove mesh
        scene.remove(enemy.mesh)
        // Remove body, delayed to avoid errors
        setTimeout(() => { world.removeBody(enemy.body) }, 500)
    }
}

function createGunModel(controllerGrip) {
    const group = new THREE.Group()
    group.rotation.set(
        -60 * ((Math.PI * 2) / 360), 
        0, 
        0
    )
    const meshBarrel = new THREE.Mesh(
        new THREE.BoxBufferGeometry(0.02, 0.025, 0.1),
        defaultMaterial
    )
    meshBarrel.position.set(0, 0.025, -0.08)
    meshBarrel.rotation.set(0, 0, 0)
    group.add(meshBarrel)

    // const meshHandle = new THREE.Mesh(
    //     new THREE.BoxBufferGeometry(0.02, 0.06, 0.025),
    //     defaultMaterial
    // )
    // group.add(meshHandle)
    return group
}

function spawnEnemy() {
    console.log('spawned enemy')
    createEnemy(
        0.5,
        1.8,
        0.5,
        { 
            x: ((Math.random() - 0.5) * 20), 
            y: 0.9, 
            z: ((Math.random() - 0.5) * 20)
        }
    )
}
//#endregion Utils

//#region Base
let camera, scene, renderer;
let controller1, controller2;
let controllerGrip1, controllerGrip2;

const clock = new THREE.Clock();
let oldElapsedTime = 0

init();
animate();

function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x505050);

    camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set( 0, 1.6, 3 );

    const floor = new THREE.Mesh(
        new THREE.PlaneGeometry(100, 100),
        new THREE.MeshStandardMaterial({
            color: '#777777',
            metalness: 0.3,
            roughness: 0.4,
            envMap: environmentMapTexture
        })
    )
    floor.receiveShadow = true
    floor.rotation.x = - Math.PI * 0.5
    scene.add(floor)

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7)
    scene.add(ambientLight)

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.2)
    directionalLight.castShadow = true
    directionalLight.shadow.mapSize.set(1024, 1024)
    directionalLight.shadow.camera.far = 15
    directionalLight.shadow.camera.left = - 7
    directionalLight.shadow.camera.top = 7
    directionalLight.shadow.camera.right = 7
    directionalLight.shadow.camera.bottom = - 7
    directionalLight.position.set(5, 5, 5)
    scene.add(directionalLight)

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.xr.enabled = true;
    document.body.appendChild(renderer.domElement);
    document.body.appendChild(VRButton.createButton(renderer));

    // controllers
    function onSelectStart() {
        this.userData.isSelecting = true
        let instance = createBullet(0.01, this.position)
        let quaternion = new THREE.Quaternion()
        this.userData.controllerGrip.children[1].getWorldQuaternion(quaternion)
        instance.body.quaternion.copy(quaternion)
        instance.body.applyLocalForce(new CANNON.Vec3(0, 0, -1000), instance.body.position)
    }

    function onSelectEnd() {
        this.userData.isSelecting = false
    }
    function onSqueezeStart() {
        this.userData.isSqueezing = true
    }

    function onSqueezeEnd() {
        this.userData.isSqueezing = false
    }

    controller1 = renderer.xr.getController(0);
    controller1.addEventListener('selectstart', onSelectStart);
    controller1.addEventListener('selectend', onSelectEnd);
    controller1.addEventListener('squeezestart', onSqueezeStart);
    controller1.addEventListener('squeezeend', onSqueezeEnd);
    controller1.addEventListener('connected', function (event) {
        // this.add(buildController(event.data));
    });
    controller1.addEventListener('disconnected', function () {
        // this.remove(this.children[0]);
    });
    controller1.userData.isLeft = true
    scene.add(controller1);

    controller2 = renderer.xr.getController(1);
    controller2.addEventListener('selectstart', onSelectStart);
    controller2.addEventListener('selectend', onSelectEnd);
    controller2.addEventListener('squeezestart', onSqueezeStart);
    controller2.addEventListener('squeezeend', onSqueezeEnd);
    controller2.addEventListener('connected', function (event) {
        //this.add(buildController(event.data));
    });
    controller2.addEventListener('disconnected', function () {
        //this.remove(this.children[0]);
    });
    controller2.userData.isLeft = false
    scene.add(controller2);

    // The XRControllerModelFactory will automatically fetch controller models
    // that match what the user is holding as closely as possible. The models
    // should be attached to the object returned from getControllerGrip in
    // order to match the orientation of the held device.

    const controllerModelFactory = new XRControllerModelFactory();

    controllerGrip1 = renderer.xr.getControllerGrip(0);
    controllerGrip1.add(controllerModelFactory.createControllerModel(controllerGrip1));
    controllerGrip1.add(createGunModel(controllerGrip1))
    controller1.userData.controllerGrip = controllerGrip1
    scene.add(controllerGrip1);

    controllerGrip2 = renderer.xr.getControllerGrip(1);
    controllerGrip2.add(controllerModelFactory.createControllerModel(controllerGrip2));
    controller2.userData.controllerGrip = controllerGrip2
    controllerGrip2.add(createGunModel(controllerGrip2))

    scene.add(controllerGrip2);

    window.addEventListener('resize', onWindowResize);
}

function buildController(data) {
    let geometry, material;
    switch (data.targetRayMode) {
        case 'tracked-pointer':
            geometry = new THREE.BufferGeometry();
            geometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, -1], 3));
            geometry.setAttribute('color', new THREE.Float32BufferAttribute([0.5, 0.5, 0.5, 0, 0, 0], 3));

            material = new THREE.LineBasicMaterial({ vertexColors: true, blending: THREE.AdditiveBlending });

            return new THREE.Line(geometry, material);
        case 'gaze':
            geometry = new THREE.RingGeometry(0.02, 0.04, 32).translate(0, 0, -1);
            material = new THREE.MeshBasicMaterial({ opacity: 0.5, transparent: true });
            return new THREE.Mesh(geometry, material);
    }
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize(window.innerWidth, window.innerHeight );
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
}

function handleController(controller) {
    if (controller.userData.isSelecting) {
        // Controller trigger pressed
        // let instance = createSphere(0.1, controller.position)
        // instance.body.quaternion.copy(controller.quaternion)
        // instance.body.applyLocalForce(new CANNON.Vec3(0, 0, 100), instance.body.position)
    }

    if (controller.userData.isSqueezing) {
        
    }
}

/**
 * AxesHelpers
 */
// const leftAxesHelper = new THREE.AxesHelper(0.1)
// const rightAxesHelper = new THREE.AxesHelper(0.1)
// scene.add(leftAxesHelper)
// scene.add(rightAxesHelper)

function animate() {
    renderer.setAnimationLoop(render);
}

const lastPos = new THREE.Vector3()

setInterval(() => { spawnEnemy() }, 2000)

function render() {
    handleController(controller1);
    handleController(controller2);
    
    // leftAxesHelper.position.copy(controller1.position)
    // controller1.userData.controllerGrip.children[1].getWorldQuaternion(leftAxesHelper.quaternion)
    // rightAxesHelper.position.copy(controller2.position)
    // controller2.userData.controllerGrip.children[1].getWorldQuaternion(rightAxesHelper.quaternion)

    const elapsedTime = clock.getElapsedTime()
    const deltaTime = elapsedTime - oldElapsedTime
    oldElapsedTime = elapsedTime

    // Update physics world
    world.step(1 / 60, deltaTime, 3)

    playerBody.position.x = camera.position.x
    playerBody.position.z = camera.position.z

    for (const object of objectsToUpdate) {
        object.mesh.position.copy(object.body.position)
        object.mesh.quaternion.copy(object.body.quaternion)
    }

    for (const enemy of enemyObjectsToUpdate) {
        const enemyPos = enemy.mesh.position
        const cameraPos = camera.position
        cameraPos.y = enemy.mesh.position.y
        enemy.mesh.lookAt(cameraPos)
        // enemy.mesh.rotation.x = 0
        // enemy.mesh.rotation.z = 0
        enemy.body.quaternion.copy(enemy.mesh.quaternion)
        
        const dir = new THREE.Vector3().subVectors(cameraPos, enemyPos)
        dir.normalize()
        //console.log(dir)
        enemy.mesh.position.add(dir.multiplyScalar(0.01))
        enemy.body.position.copy(enemy.mesh.position)
    }

    renderer.render(scene, camera);
}