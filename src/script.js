import './style.css'

import * as THREE from 'three';
import * as dat from 'dat.gui'
import CANNON from 'cannon'

import { VRButton } from 'three/examples/jsm/webxr/VRButton.js';
import { XRControllerModelFactory } from 'three/examples/jsm/webxr/XRControllerModelFactory.js';
import { AxesHelper } from 'three';

/**
 * Debug
 */
const gui = new dat.GUI()
const debugObject = {}

debugObject.createSphere = () => {
    let instance = createSphere(
        Math.random() * 0.5, 
        { 
            x: (Math.random() * 0.5) * 3, 
            y: 3, 
            z: (Math.random() * 0.5) * 3
        }
    )
    console.log(instance)
}
debugObject.createBox = () => {
    createBox(
        Math.random(),
        Math.random(),
        Math.random(),
        { 
            x: (Math.random() * 0.5) * 3, 
            y: 3, 
            z: (Math.random() * 0.5) * 3
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
    }
}
gui.add(debugObject, 'createSphere')
gui.add(debugObject, 'createBox')
gui.add(debugObject, 'reset')

/**
 * Sounds
 */
const hitSound = new Audio('/sounds/hit.mp3')

const playHitSound = (collision) => {
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

/**
 * Textures
 */
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

/**
 * Physics
 */
// World
const world = new CANNON.World()
// world.broadphase = new CANNON.SAPBroadphase(world)
world.allowSleep = true
world.gravity.set(0, -9.81, 0)

// Default physics material
const defaultPhysicsMaterial = new CANNON.Material('default')
const defaultPhysicsContactMaterial = new CANNON.ContactMaterial(
    defaultPhysicsMaterial, 
    defaultPhysicsMaterial, 
    {
        friction: 0.1,
        restitution: 0.9
    }
)
world.addContactMaterial(defaultPhysicsContactMaterial)

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

/**
 * Base
 */

let camera, scene, renderer;
let controller1, controller2;
let controllerGrip1, controllerGrip2;

const clock = new THREE.Clock();
let oldElapsedTime = 0

init();
animate();

function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color( 0x505050 );

    camera = new THREE.PerspectiveCamera( 50, window.innerWidth / window.innerHeight, 0.1, 10 );
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

    renderer = new THREE.WebGLRenderer( { antialias: true } );
    renderer.setPixelRatio( window.devicePixelRatio );
    renderer.setSize( window.innerWidth, window.innerHeight );
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.xr.enabled = true;
    document.body.appendChild( renderer.domElement );
    document.body.appendChild( VRButton.createButton( renderer ) );

    // controllers
    function onSelectStart() {
        this.userData.isSelecting = true;
        let instance = createSphere(0.01, this.position)
        instance.body.quaternion.copy(this.quaternion)
        instance.body.applyLocalImpulse(new CANNON.Vec3(0, 0, -50), instance.body.position)
    }

    function onSelectEnd() {
        this.userData.isSelecting = false;
    }

    controller1 = renderer.xr.getController( 0 );
    controller1.addEventListener( 'selectstart', onSelectStart );
    controller1.addEventListener( 'selectend', onSelectEnd );
    controller1.addEventListener( 'connected', function ( event ) {
        this.add( buildController( event.data ) );
    } );
    controller1.addEventListener( 'disconnected', function () {
        this.remove( this.children[ 0 ] );
    } );
    controller1.userData.isLeft = true
    scene.add( controller1 );

    controller2 = renderer.xr.getController( 1 );
    controller2.addEventListener( 'selectstart', onSelectStart );
    controller2.addEventListener( 'selectend', onSelectEnd );
    controller2.addEventListener( 'connected', function ( event ) {
        this.add( buildController( event.data ) );
    } );
    controller2.addEventListener( 'disconnected', function () {
        this.remove( this.children[ 0 ] );
    } );
    controller2.userData.isLeft = false
    scene.add( controller2 );

    // The XRControllerModelFactory will automatically fetch controller models
    // that match what the user is holding as closely as possible. The models
    // should be attached to the object returned from getControllerGrip in
    // order to match the orientation of the held device.

    const controllerModelFactory = new XRControllerModelFactory();

    controllerGrip1 = renderer.xr.getControllerGrip( 0 );
    controllerGrip1.add( controllerModelFactory.createControllerModel( controllerGrip1 ) );
    scene.add( controllerGrip1 );

    controllerGrip2 = renderer.xr.getControllerGrip( 1 );
    controllerGrip2.add( controllerModelFactory.createControllerModel( controllerGrip2 ) );
    scene.add( controllerGrip2 );

    window.addEventListener( 'resize', onWindowResize );
}

function buildController( data ) {
    let geometry, material;

    switch ( data.targetRayMode ) {
        case 'tracked-pointer':
            geometry = new THREE.BufferGeometry();
            geometry.setAttribute( 'position', new THREE.Float32BufferAttribute( [ 0, 0, 0, 0, 0, - 1 ], 3 ) );
            geometry.setAttribute( 'color', new THREE.Float32BufferAttribute( [ 0.5, 0.5, 0.5, 0, 0, 0 ], 3 ) );

            material = new THREE.LineBasicMaterial( { vertexColors: true, blending: THREE.AdditiveBlending } );

            return new THREE.Line( geometry, material );
        case 'gaze':

            geometry = new THREE.RingGeometry( 0.02, 0.04, 32 ).translate( 0, 0, - 1 );
            material = new THREE.MeshBasicMaterial( { opacity: 0.5, transparent: true } );
            return new THREE.Mesh( geometry, material );
    }
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize( window.innerWidth, window.innerHeight );
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
}

function handleController(controller) {
    if (controller.userData.isSelecting) {
        // Controller trigger pressed
        // let instance = createSphere(0.1, controller.position)
        // instance.body.quaternion.copy(controller.quaternion)
        // instance.body.applyLocalForce(new CANNON.Vec3(0, 0, 100), instance.body.position)
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

function render() {
    handleController(controller1);
    handleController(controller2);
    
    // leftAxesHelper.position.copy(controller1.position)
    // leftAxesHelper.quaternion.copy(controller1.quaternion)
    // rightAxesHelper.position.copy(controller2.position)
    // rightAxesHelper.quaternion.copy(controller2.quaternion)

    const elapsedTime = clock.getElapsedTime()
    const deltaTime = elapsedTime - oldElapsedTime
    oldElapsedTime = elapsedTime

    // Update physics world
    world.step(1 / 60, deltaTime, 3)

    for (const object of objectsToUpdate) {
        object.mesh.position.copy(object.body.position)
        object.mesh.quaternion.copy(object.body.quaternion)
    }

    renderer.render(scene, camera);
}

/**
 * Utils
 */
const objectsToUpdate = []

const defaultMaterial = new THREE.MeshStandardMaterial({
    metalness: 0.3,
    roughness: 0.4,
    envMap: environmentMapTexture
})     

// Sphere
const sphereGeometry = new THREE.SphereBufferGeometry(1, 20, 20)   

const createSphere = (radius, position) => {
    // Three.js mesh
    const mesh = new THREE.Mesh(sphereGeometry, defaultMaterial)
    mesh.scale.set(radius, radius, radius)
    mesh.castShadow = true
    mesh.position.copy(position)
    scene.add(mesh)

    // Cannon.js body
    const shape = new CANNON.Sphere(radius)
    const body = new CANNON.Body({
        mass: 1,
        position: new CANNON.Vec3(0, 3, 0),
        shape: shape,
        material: defaultPhysicsMaterial
    })
    body.position.copy(position)
    body.addEventListener('collide', playHitSound)
    body.addEventListener('collide', destroyOnHit)
    world.addBody(body)

    let object = {
        mesh: mesh,
        body: body
    }

    // Save in objectsToUpdate
    objectsToUpdate.push(object)
    console.log(objectsToUpdate)

    return object;
}

// Box
const boxGeometry = new THREE.BoxBufferGeometry(1, 1, 1)

const createBox = (width, height, depth, position) => {
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

const destroyOnHit = (collision) => {
    collision.target.removeEventListener('collide', destroyOnHit)
    collision.target.removeEventListener('collide', playHitSound)
    var object = objectsToUpdate.find(obj => obj.body === collision.target)
    objectsToUpdate.splice(objectsToUpdate.indexOf(object), 1)

    // Remove mesh
    scene.remove(object.mesh)
    // Remove body, delayed to avoid errors
    setTimeout(() => { world.removeBody(object.body) }, 500)
}