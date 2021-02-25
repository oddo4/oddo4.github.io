import './style.css'

import * as THREE from 'three';
// import * as dat from 'dat.gui'
import CANNON from 'cannon'
// import typefaceFont from 'three/examples/fonts/helvetiker_regular.typeface.json'

import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { VRButton } from 'three/examples/jsm/webxr/VRButton.js';
import { XRControllerModelFactory } from 'three/examples/jsm/webxr/XRControllerModelFactory.js';
// import { AxesHelper, Mesh } from 'three';

/*
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
// debugObject.createBox = () => {
//     createBox(
//         Math.random(),
//         Math.random(),
//         Math.random(),
//         { 
//             x: (Math.random() * 0.5) * 3, 
//             y: 3, 
//             z: ((Math.random() * 0.5) * 3) - 3
//         }
//     )
// }
debugObject.spawnEnemy = () => {
    spawnEnemy()
}
debugObject.startEnemySpawn = () => {
    startSpawning()
}
debugObject.stopEnemySpawn = () => {
    stopSpawning()
}
debugObject.reset = () => {
    clearObjects()
    clearEnemyObjects()
}
gui.add(debugObject, 'createBullet')
// gui.add(debugObject, 'createBox')
gui.add(debugObject, 'spawnEnemy')
gui.add(debugObject, 'startEnemySpawn')
gui.add(debugObject, 'stopEnemySpawn')
gui.add(debugObject, 'reset')
//#endregion Debug
//*/

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
const textPhysicsMaterial = new CANNON.Material('text')

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

// Bullet/Text contact material
const bulletTextPhysicsContactMaterial = new CANNON.ContactMaterial(
    bulletPhysicsMaterial, 
    textPhysicsMaterial, 
    {
        friction: 1,
        restitution: 0
    }
)
world.addContactMaterial(bulletTextPhysicsContactMaterial)

/// Colliders
// Player
const playerShape = new CANNON.Cylinder(0.15, 0.15, 1.8, 12)
const playerBody = new CANNON.Body({
    mass: 1, // object static
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

//#region Models
const gltfLoader = new GLTFLoader()
let empusaModel = new THREE.Group()

function loadModels() {
    gltfLoader.load(
        '/models/empusa/empusa.gltf',
        (gltf) =>
        {
            let dummy = new THREE.Object3D()
            gltf.scene.traverse((child) => {
                if (child.isMesh) {
                    let instancedMesh = new THREE.InstancedMesh(child.geometry, child.material, 1);
                    instancedMesh.setMatrixAt(0, dummy.matrix);
                    instancedMesh.castShadow = true
                    instancedMesh.scale.set(2, 2, 2)
                    empusaModel.add(instancedMesh);
                }
            })
            
            init();
            animate();
        }
        // (progress) =>
        // {
        //     console.log(progress)
        // },
        // (error) =>
        // {
        //     console.log(error)
        // }
    )    
}

//#endregion

//#region Fonts
const fontLoader = new THREE.FontLoader()
let easyModeText, hardModeText, easyModeBody, hardModeBody
fontLoader.load(
    '/fonts/helvetiker_regular.typeface.json',
    (font) =>
    {
        const easyTextGeometry = new THREE.TextGeometry(
            'Dead Weight\n      Mode',
            {
                font: font,
                size: 0.2,
                height: 0.2,
                curveSegments: 8,
                bevelEnabled: false,
            }
        )
        easyTextGeometry.center()

        const easyTextMaterial = new THREE.MeshBasicMaterial()
        easyModeText = new THREE.Mesh(easyTextGeometry, easyTextMaterial)
        easyModeText.position.set(-1.5, 2, -2)
        easyModeText.rotation.reorder('YXZ')
        easyModeText.rotation.y = 20 * ((Math.PI * 2) / 360)
        easyModeText.rotation.x = 5 * ((Math.PI * 2) / 360)
        
        const easyTextBox = easyTextGeometry.boundingBox.max
        const easyTextShape = new CANNON.Box(new CANNON.Vec3(easyTextBox.x, easyTextBox.y, easyTextBox.z))
        easyModeBody = new CANNON.Body({
            mass: 0,
            shape: easyTextShape,
            material: textPhysicsMaterial
        })
        easyModeBody.position.copy(easyModeText.position)
        easyModeBody.quaternion.copy(easyModeText.quaternion)
        easyModeBody.addEventListener('collide', startEasyMode)
        world.addBody(easyModeBody)

        const hardTextGeometry = new THREE.TextGeometry(
            'Wacky Woohoo\n     Pizza Man\n        Mode',
            {
                font: font,
                size: 0.2,
                height: 0.2,
                curveSegments: 8,
                bevelEnabled: false
            }
        )
        hardTextGeometry.center()
        const hardTextMaterial = new THREE.MeshBasicMaterial()
        hardModeText = new THREE.Mesh(hardTextGeometry, hardTextMaterial)
        hardModeText.position.set(1.5, 2, -2)
        hardModeText.rotation.reorder('YXZ')
        hardModeText.rotation.y = -20 * ((Math.PI * 2) / 360)
        hardModeText.rotation.x = 5 * ((Math.PI * 2) / 360)
        
        const hardTextBox = hardTextGeometry.boundingBox.max
        const hardTextShape = new CANNON.Box(new CANNON.Vec3(hardTextBox.x, hardTextBox.y, hardTextBox.z))
        hardModeBody = new CANNON.Body({
            mass: 0,
            shape: hardTextShape,
            material: textPhysicsMaterial
        })
        hardModeBody.position.copy(hardModeText.position)
        hardModeBody.quaternion.copy(hardModeText.quaternion)
        hardModeBody.addEventListener('collide', startHardMode)
        world.addBody(hardModeBody)
    }
)
//#endregion

//#region Sounds
const hitSound = new Audio('/sounds/hit.mp3')
const gunShotSound = new Audio('/sounds/gun_shot.mp3')
const allRightSound = new Audio('/sounds/all_right.mp3')
const showdownSound = new Audio('/sounds/showdown.mp3')
const deathSound = new Audio('/sounds/death.mp3')

hitSound.load()
gunShotSound.load()
allRightSound.load()
showdownSound.load()
deathSound.load()

function playHitSound(collision) {
    playSound(hitSound, 0.3)
}

async function playSound(sound, soundVolume) {
    sound.volume = soundVolume
    sound.currentTime = 0
    await sound.play()
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

//#region Utils
const objectsToUpdate = []
const enemyObjectsToUpdate = []

const defaultMaterial = new THREE.MeshStandardMaterial({
    metalness: 0.3,
    roughness: 0.4,
    envMap: environmentMapTexture
})

const bulletMaterial = new THREE.MeshStandardMaterial({
    color: '#b09e3a',
    metalness: 0.9,
    roughness: 0.5,
    envMap: environmentMapTexture
})

const enemyMaterial = new THREE.MeshStandardMaterial({
    color: '#050505',
    metalness: 0.2,
    roughness: 0.7,
    envMap: environmentMapTexture
})

// Bullet
const sphereGeometry = new THREE.SphereBufferGeometry(1, 20, 20)
function createBullet(radius, position) {
    // Three.js mesh
    const mesh = new THREE.Mesh(sphereGeometry, bulletMaterial)
    mesh.scale.set(radius, radius, radius)
    mesh.castShadow = true
    mesh.position.copy(position)
    scene.add(mesh)

    // Cannon.js body
    const shape = new CANNON.Sphere(radius * 2.5)
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
// function createBox(width, height, depth, position) {
//     // Three.js mesh
//     const mesh = new THREE.Mesh(boxGeometry, defaultMaterial)
//     mesh.scale.set(width, height, depth)
//     mesh.castShadow = true
//     mesh.position.copy(position)
//     scene.add(mesh)

//     // Cannon.js body
//     const shape = new CANNON.Box(new CANNON.Vec3(width * 0.5, height * 0.5, depth * 0.5))
//     const body = new CANNON.Body({
//         mass: 1,
//         position: new CANNON.Vec3(0, 3, 0),
//         shape: shape,
//         material: defaultPhysicsMaterial
//     })
//     body.position.copy(position)
//     body.addEventListener('collide', playHitSound)
//     world.addBody(body)

//     let object = {
//         mesh: mesh,
//         body: body
//     }

//     // Save in objectsToUpdate
//     objectsToUpdate.push(object)

//     return object;
// }

function createEnemy(width, height, depth, position) {
    let dummy = new THREE.Object3D();

    // Three.js mesh
    // const mesh = new THREE.Mesh(boxGeometry, enemyMaterial)
    // mesh.scale.set(width, height, depth)
    // mesh.castShadow = true
    // mesh.position.copy(position)
    let modelGroup = new THREE.Group()
    modelGroup.copy(empusaModel)
    modelGroup.position.copy(position)
    scene.add(modelGroup)

    // const hitboxMesh = new THREE.Mesh(boxGeometry, enemyMaterial)
    // hitboxMesh.scale.set(width, height, depth)
    // hitboxMesh.castShadow = true
    // hitboxMesh.position.copy(position)
    // hitboxMesh.position.y = height / 2
    // scene.add(hitboxMesh)

    // Cannon.js body
    const shape = new CANNON.Box(new CANNON.Vec3(width * 0.5, height * 0.5, depth * 0.5))
    const body = new CANNON.Body({
        mass: 0,
        position: new CANNON.Vec3(0, 0, 0),
        shape: shape,
        material: enemyPhysicsMaterial
    })
    body.position.copy(position)
    body.position.y = height * 0.5
    world.addBody(body)

    let object = {
        mesh: modelGroup,
        body: body,
        speed: (0.01 * gameSpeed) * (Math.max(0.1, Math.random()))
        // hitbox: hitboxMesh
    }

    // const axesHelper = new THREE.AxesHelper(1)
    // mesh.add(axesHelper)

    // Save in enemyObjectsToUpdate
    enemyObjectsToUpdate.push(object)

    return object;
}

function bulletOnHit(collision) {
    collision.target.removeEventListener('collide', playHitSound)
    collision.target.removeEventListener('collide', bulletOnHit)

    let object = objectsToUpdate.find(obj => obj.body === collision.target)
    object.body.applyImpulse(new CANNON.Vec3(), object.body.position)
    objectsToUpdate.splice(objectsToUpdate.indexOf(object), 1)
    
    // Remove mesh
    scene.remove(object.mesh)
    // Remove body, delayed to avoid errors
    setTimeout(() => { world.removeBody(object.body) }, 500)
    let enemy = enemyObjectsToUpdate.find(obj => obj.body === collision.body)

    // check if hitted enemy
    if (enemy != null && collision.body.material.name == "enemy") {
        // console.log('enemy hit')
        enemyObjectsToUpdate.splice(enemyObjectsToUpdate.indexOf(enemy), 1)
        // Remove mesh
        scene.remove(enemy.mesh)
        // Remove body, delayed to avoid errors
        setTimeout(() => { world.removeBody(enemy.body) }, 500)
    }
}

// function checkCollideWithPlayer(collision) {
//     // check if hitted player
//     if (collision.body.material.name == "player") {
//         collision.target.removeEventListener('collide', checkCollideWithPlayer)
//         stopSpawning()
//         console.log('player dead')
//     }
// }

function checkCollideWithEnemy(collision) {
    // check if hitted enemy
    if (collision.body.material.name == "enemy") {
        collision.target.removeEventListener('collide', checkCollideWithEnemy)
        stopSpawning()
        gameOver()
    }
}

function createGunModel(controllerGrip, color) {
    const group = new THREE.Group()
    group.rotation.set(
        -60 * ((Math.PI * 2) / 360), 
        0, 
        0
    )
    const meshBarrel = new THREE.Mesh(
        new THREE.BoxBufferGeometry(0.02, 0.035, 0.15),
        new THREE.MeshStandardMaterial({
            color: color,
            metalness: 0.9,
            roughness: 0.4,
            envMap: environmentMapTexture
        })
    )
    meshBarrel.position.set(0, 0.025, -0.13)
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
    if (enemyObjectsToUpdate.length < 20) {
        createEnemy(
            0.75,
            2.25,
            0.75,
            { 
                x: Math.round(Math.random()) == 0 ? (Math.min(-2, -(Math.random() * 10))) : (Math.max(2, (Math.random() * 10))),
                y: 0, 
                z: Math.round(Math.random()) == 0 ? (Math.min(-2, -(Math.random() * 10))) : (Math.max(2, (Math.random() * 10)))
            }
        )
        console.log(enemyObjectsToUpdate.length)
    }
}
//#endregion Utils

//#region Base
let camera, scene, renderer;
let controller1, controller2;
let controllerGrip1, controllerGrip2;

const clock = new THREE.Clock();
let oldElapsedTime = 0

const playerMesh = new THREE.Mesh(
    new THREE.CylinderBufferGeometry(0.15, 0.15, 0.1, 12),
    new THREE.MeshStandardMaterial({
        color: '#550000',
        metalness: 0.9,
        roughness: 0.4,
        envMap: environmentMapTexture
    })
)
playerMesh.position.y = 0.05

loadModels();

function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color('#38151d');  

    camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set( 0, 1.6, 3 );

    const floor = new THREE.Mesh(
        new THREE.PlaneGeometry(100, 100),
        new THREE.MeshStandardMaterial({
            color: '#912c34',
            metalness: 0.9,
            roughness: 0.4,
            envMap: environmentMapTexture
        })
    )
    floor.receiveShadow = true
    floor.rotation.x = - Math.PI * 0.5
    scene.add(floor)

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8)
    scene.add(ambientLight)

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.6)
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
        playSound(gunShotSound, 0.5)
    }

    function onSelectEnd() {
        this.userData.isSelecting = false
    }
    function onSqueezeStart() {
        this.userData.isSqueezing = true
        // startSpawning()
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
    controllerGrip1.add(createGunModel(controllerGrip1, '#020202'))
    controller1.userData.controllerGrip = controllerGrip1
    scene.add(controllerGrip1);

    controllerGrip2 = renderer.xr.getControllerGrip(1);
    controllerGrip2.add(controllerModelFactory.createControllerModel(controllerGrip2));
    controller2.userData.controllerGrip = controllerGrip2
    controllerGrip2.add(createGunModel(controllerGrip2, '#333333'))

    scene.add(controllerGrip2);

    window.addEventListener('resize', onWindowResize);

    scene.add(playerMesh)
    scene.add(easyModeText)
    scene.add(hardModeText)
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

let gameSpeed = 1

function startEasyMode(collision) {
    if (!spawnStarted) {
        // console.log('easy start')
        easyModeText.visible = false
        hardModeText.visible = false
        gameSpeed = 2
        startSpawning(2000)
        playSound(allRightSound, 0.5)
    }
}

function startHardMode(collision) {
    if (!spawnStarted) {
        // console.log('hard start')
        easyModeText.visible = false
        hardModeText.visible = false
        gameSpeed = 3
        startSpawning(500)
        playSound(showdownSound, 0.5)
    }
}

function gameOver() {
    // console.log('game over')
    playSound(deathSound, 0.5)
    easyModeText.visible = true
    hardModeText.visible = true
}

let spawnInterval = null
let spawnStarted = false

function startSpawning(interval) {
    if (!spawnStarted) {
        // console.log('spawn started')
        playerBody.addEventListener('collide', checkCollideWithEnemy)
        spawnInterval = setInterval(() => { spawnEnemy() }, interval)
        spawnStarted = true
    }
}

function stopSpawning() {
    if (spawnInterval != null) {
        // console.log('spawn ended')
        clearInterval(spawnInterval)
        clearEnemyObjects()
        spawnStarted = false
        spawnInterval = null
    }
}

function clearObjects() {
    while (objectsToUpdate.length > 0) {
        for (let i = 0; i < objectsToUpdate.length; i++) {
            const object = objectsToUpdate[i];
            objectsToUpdate.splice(i, 1)
            // Remove mesh
            scene.remove(object.mesh)
    
            // Remove body
            object.body.removeEventListener('collide', playHitSound)
            setTimeout(() => { world.removeBody(object.body) }, 500)
        }
    }
}

function clearEnemyObjects() {
    while (enemyObjectsToUpdate.length > 0) {
        for (let i = 0; i < enemyObjectsToUpdate.length; i++) {
            const enemy = enemyObjectsToUpdate[i];
            enemyObjectsToUpdate.splice(i, 1)
            // Remove mesh
            scene.remove(enemy.mesh)
    
            // Remove body
            // enemy.body.removeEventListener('collide', checkCollideWithPlayer)
            setTimeout(() => { world.removeBody(enemy.body) }, 500)
        }
    }
}

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
    playerBody.position.y = 0.9
    playerBody.position.z = camera.position.z

    playerMesh.position.copy(playerBody.position)
    
    // easyModeText.position.copy(easyModeBody.position)
    // easyModeText.quaternion.copy(easyModeBody.quaternion)

    // hardModeText.position.copy(hardModeBody.position)
    // hardModeText.quaternion.copy(hardModeBody.quaternion)

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

        enemy.mesh.position.add(dir.multiplyScalar(enemy.speed))
        enemy.body.position.copy(enemy.mesh.position)
        enemy.body.position.y = enemy.body.shapes[0].halfExtents.y
    }

    renderer.render(scene, camera);
}