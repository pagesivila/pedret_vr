// Imports
import * as THREE from 'three';
import * as NEXUS from './Nexus3D.js'
import { Monitor } from './Monitor.js'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { BoxLineGeometry } from 'three/addons/geometries/BoxLineGeometry.js';
import { PLYLoader } from 'three/addons/loaders/PLYLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createText } from 'three/addons/webxr/Text2D.js';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import { XRControllerModelFactory } from 'three/addons/webxr/XRControllerModelFactory.js';

// https://github.com/felixmariotto/three-mesh-ui
// import VRControl from './utils/VRControl.js';
import ThreeMeshUI from 'three-mesh-ui';
import controlsImage from "/controls.jpeg";

import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { rotate } from 'three/tsl';

// models aïllats:
// https://threejs.org/examples/webgl_clipping.html

let scene, renderer, camera, controls, clock, delta, raycaster, controller1, controller2, helpersGroup, pointer, intersected = [];

let baseReferenceSpace, z_shift = 20, xrRotationY = 0, xrPosition = { x: 0, y: 0, z: -z_shift };

let prevA = false, prevB = false, prevX = false, prevY = false, prevJ = false, prevK = false, lockJ = true, lockK = true, button1Pressed = false, button2Pressed = false, joyPressed = false, lockSelect = false;
let lightsGroup, flashlight1, flashlight2;

let mainModelsGroup, floor, grid, marker1, marker2, mapP;

let floorLeft, gridLeft, floorRight, gridRight, floorApse, gridApse;

let primaryModelsGroup, primaryTargetError, base;

let secondaryModelsGroup, secondaryTargetError, button, button_instanced;

let hotspotModelsGroup, hotspot_in, hotspot_next, hotspot_prev;

// ---- PELS BOTONS I TEXT INICIAL ---- //
let meshContainer, meshes, currentMesh;
let closeButtonHiddenManually = false;
let selectState = false;
const objsToTest = [];

let introStarted = false;
let churchLabel;
let listener, introAudio;
let gltfLoader;
let isNavigatingChurch = false;
let churchLoaded = [false, false, false, false, false, false];
let churchLoadPromises = [null, null, null, null, null, null];

let pedret_IX = null;
let pedret_X = null;
let pedret_XI = null;
let pedret_XII = null;
let pedret_XIII = null;
let pedret_XXI = null;

let churchPlaceholder = null;
let currentTargetChurchIndex = 0;

// --- GLOBAL CONSTANTS (Top of script.js) ---
const COLOR_FLOOR_IDLE = 0x95F2D9; // Default Floor (Turquoise)
const COLOR_WALL_IDLE  = 0xFFA500; // Default Wall (Orange)
const COLOR_PLAYING    = 0xD8F9F0; // Active Audio 
const COLOR_PLAYED     = 0x7F8C8D; // Visited / Played (Dimmed Grey)

// --- 3D COLLISION SYSTEM ---
const collisionRaycaster = new THREE.Raycaster();
const COLLISION_BUFFER = 0.20; // Buffer distance in meters from walls, roof, or objects

const floorSweepUniforms = {
    uTime: { value: 0 }
};

init();

function init() {

    // Scene

    scene = new THREE.Scene();
//    window.scene = scene; //debugging

//    scene.background = new THREE.Color( 0x505050 );
//    scene.fog = new THREE.Fog( 0x050505, 100, 1000 );

    new THREE.TextureLoader().load( './adb_2k.jpg', function ( texture ) {
        texture.mapping = THREE.EquirectangularReflectionMapping;

        scene.background = texture;
//        scene.environment = texture;

        scene.backgroundRotation.y += Math.PI/2;
        scene.environmentRotation.y += Math.PI/2;
    } );

    // Renderer

    renderer = new THREE.WebGLRenderer( { antialias: true } );
    //renderer.setClearColor( scene.fog.color );
    renderer.autoClear = false;
    renderer.setPixelRatio( window.devicePixelRatio );
    renderer.setSize( window.innerWidth, window.innerHeight );

    //renderer.outputColorSpace = THREE.LinearSRGBColorSpace;

    //renderer.toneMapping = THREE.ACESFilmicToneMapping;
    //renderer.toneMappingExposure = 1; //default

    //renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    renderer.xr.enabled = true;
    renderer.setAnimationLoop( animate );
    renderer.xr.setFoveation(0);

    document.body.appendChild( renderer.domElement );
    document.body.appendChild( VRButton.createButton( renderer ) );

    // Camera

    camera = new THREE.PerspectiveCamera( 30, window.innerWidth / window.innerHeight, 0.1, 1000 );
    camera.position.set( 0, 1.8, z_shift );

    // Controls

    controls = new OrbitControls( camera, renderer.domElement );

    let controls_options = {
        rotateSpeed: 0.5,
        zoomSpeed: 4,
        panSpeed: 0.8,
        noZoom: false,
        noPan: false,
        enableDamping: true,
        staticMoving: true,
        dynamicDampingFactor: 0.3,
        target: new THREE.Vector3( 0, 1, 0 ),
    }
    for( const [key, value] of Object.entries(controls_options))
        controls[key] = value;

    controls.update();

    // Lights.
    // // ---- HE BORRAT TOTES MENYS AMBIENT LIGHT I LES DE LA CAPELLA PERQUÈ HE BAKED TEXTURA DE L'ESGLÉSIA AMB OBJECTIU DE NO UTILITZAR TANTA MEMORIA (Q IGUAL NO SÉ MIRAR JEJ) ---- //

        lightsGroup = new THREE.Group();
        lightsGroup.name = 'lightsGroup';
        scene.add( lightsGroup );
        helpersGroup = new THREE.Group();
        helpersGroup.name = 'helpersGroup';
        // scene.add( helpersGroup );

       scene.add( new THREE.AmbientLight( 0xffffff, 2 ) ); //0.2

        flashlight1 = new THREE.SpotLight( 0xffffbb, 1.0, 10.0, Math.PI/4.0, 0.5, 2 );
        flashlight1.position.set( 0.0, 0.0, 0.0 );   //same position as controller
        flashlight1.target.position.z = -1.0;        //front
        flashlight1.target.updateMatrixWorld();
        flashlight1.power = 0; //default 1000
    //    flashlight1.castShadow = true;
    //    flashlight1.shadow.mapSize.width = 512;  // default
    //    flashlight1.shadow.mapSize.height = 512; // default
    //    flashlight1.shadow.camera.near = 0.5;       // default
        flashlight1.shadow.camera.far = 1;
    //    flashlight1.shadow.camera.fov = 90;
    //    flashlight1.shadow.bias = - 0.0001;
    //    flashlight1.shadow.radius = 10;
        flashlight1.shadow.normalBias = 0.005;
    //    flashlight1.shadow.blurSamples = 16;
        flashlight1.name = 'flashlight';
    //	const flashHelper = new THREE.SpotLightHelper( flashlight1 );
    //	const flashHelper = new THREE.CameraHelper( flashlight1.shadow.camera );
    //	helpersGroup.add( flashHelper );

        flashlight2 = flashlight1.clone();


    // Models

    primaryTargetError = 5.0; //define error tolerance for nexus models in primary scene
    secondaryTargetError = 0.0; //define error tolerance for nexus models in secondary scene

    NEXUS.Cache.maxCacheSize = 1024 * 1000000; //set maximum cache size for nexus models
    NEXUS.Cache.targetError = primaryTargetError; //set error tolerance for nexus models in primary scene


    // MAIN MODELS GROUP START (FLOOR + GRID + MARKER) /////////////////////////////////////////////////////

    mainModelsGroup = new THREE.Group();
    mainModelsGroup.name = 'mainModelsGroup';
    scene.add( mainModelsGroup );

    floor = new THREE.Mesh(
        new THREE.PlaneGeometry( 28, 40, 2, 2 ).rotateX( - Math.PI / 2 ).translate( 0, 0, 2 ),//
        new THREE.MeshStandardMaterial( { color: 0xbcbcbc, transparent: true, opacity: 0.8 } )
    );
    floor.name = 'floor';
    floor.receiveShadow = true;
    mainModelsGroup.add( floor );

    grid = new THREE.LineSegments(
        new BoxLineGeometry( 28, 0, 40, 28, 1, 40 ).translate( 0, 0.01, 2 ),
        new THREE.LineBasicMaterial({
            color: 0x000000,
            transparent: true,
            opacity: 1.0,
            depthTest: true,
            linewidth: 2,
        })
    );
    grid.name = 'grid';
    mainModelsGroup.add( grid );

    marker1 = new THREE.Mesh(
        new THREE.CircleGeometry( 0.25, 32 ).rotateX( - Math.PI / 2 ),
//		new THREE.CylinderGeometry(.3, .3, 0.01, 32),
		new THREE.MeshBasicMaterial({ color: 0xFDC148 })
	);
    marker1.name = 'marker1';
    marker1.visible = false;
    mainModelsGroup.add( marker1 );

    marker2 = marker1.clone();
    marker2.name = 'marker2';
    mainModelsGroup.add( marker2 );

    mapP = new NEXUS.Nexus3D('./models/mapF3.nxz', renderer, { 
    onLoad: (nexus) => { 
        const p =   nexus.boundingSphere.center.negate();
//        const s = 1/nexus.boundingSphere.radius;
        const s = 1.0; //scale
        nexus.position.set(p.x*s, p.y*s, p.z*s);
        nexus.scale.set(s, s, s);
    
        nexus.rotation.y = Math.PI/4;

     
        nexus.position.x = 10;   // += esquerre 3 F:10
        nexus.position.y = +5; // += amunt 13 F:5
        nexus.position.z = -1; // += endavant -5 F:-1

        nexus.castShadow = true;
        nexus.receiveShadow = true;

        mainModelsGroup.add( nexus );   
        // applyMapCubeCut(nexus);     
    }, onUpdate: (nexus) => { 
//        console.log(nexus);
    }, onProgress: (nexus) => { 
//        console.log(nexus);
    }, function ( error ) { 
        console.error( error ); 
    }
    }); 
    // console.log('map loaded');
    mapP.name = 'mapP';  


    gltfLoader = new GLTFLoader(); // només la primera vegada
    showInitialChurch();

    // MAIN MODELS GROUP END (FLOOR + GRID + MARKER) ///////////////////////////////////////////////////////


    // PRIMARY MODELS GROUP START (PEDRET IX + CHURCH LABEL) ////////////////////////////////////////////////////

    primaryModelsGroup = new THREE.Group();
    primaryModelsGroup.name = 'primaryModelsGroup';
    scene.add( primaryModelsGroup );

    
    base = new THREE.Mesh(
        new THREE.BoxGeometry( 15.0, 1.5, 0.1 ),
        new THREE.MeshPhongMaterial({
            color: 0xa0adaf,
            shininess: 150,
            specular: 0x111111
        })
    );
    base.position.set(7.0, 1.0, -5.25);
    base.rotation.set(0, Math.PI/3.8, 0)
    base.castShadow = true;
    base.receiveShadow = true;
    base.name = 'base';
    primaryModelsGroup.add( base );

    churchLabel = createTextMesh(
        'IXth century church',
        1.5,
        { x: 0, y: Math.PI/3.8, z: 0 }, // rotation
        { x: 7.0, y: 1.0, z: -5.15} // position
    );
    primaryModelsGroup.add(churchLabel);

    // PRIMARY MODELS GROUP END (PEDRET IX + CHURCH LABEL) //////////////////////////////////////////////////////


    // SECONDARY MODELS GROUP START (OTHER PEDRETS + BUTTON) ///////////////////////////////////////////////

    secondaryModelsGroup = new THREE.Group();
    secondaryModelsGroup.name = 'secondaryModelsGroup';
//    scene.add( secondaryModelsGroup );
    

    // --- LATERAL NAVE FLOORS & GRIDS ---
    // --- LATERAL NAVE & APSE FLOORS MATERIAL ---
    const sideFloorMat = new THREE.MeshStandardMaterial({ 
        color: 0xbcbcbc, 
        transparent: true, 
        opacity: 0.1 
    });

    sideFloorMat.onBeforeCompile = (shader) => {
        shader.uniforms.uTime = floorSweepUniforms.uTime;

        shader.vertexShader = shader.vertexShader.replace(
            '#include <clipping_planes_pars_vertex>',
            `#include <clipping_planes_pars_vertex>
            varying vec3 vWorldPosition;`
        );
        shader.vertexShader = shader.vertexShader.replace(
            '#include <fog_vertex>',
            `#include <fog_vertex>
            vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;`
        );

        shader.fragmentShader = shader.fragmentShader.replace(
            '#include <clipping_planes_pars_fragment>',
            `#include <clipping_planes_pars_fragment>
            varying vec3 vWorldPosition;
            uniform float uTime;`
        );

        const targetChunk = shader.fragmentShader.includes('#include <opaque_fragment>') 
            ? '#include <opaque_fragment>' 
            : '#include <dithering_fragment>';

        shader.fragmentShader = shader.fragmentShader.replace(
            targetChunk,
            `${targetChunk}
            vec3 pos = vWorldPosition;
            if (pos.z < -15.0) pos.z += 20.0; // WebXR coordinate shift normalization
            
            float diagCoord = pos.x + pos.z;
            
            // --- CONTROL PARAMETERS ---
            float sweepTime = 2.0;  // Fast travel across all floors (0.4 seconds)
            float interval  = 7.0; // Long pause between sweeps (10 seconds total cycle)
            float beamWidth = 1.0;  // Narrow mirror-like line width (0.3 meters)
            
            float startPos = -18.0;
            float endPos   = 4.0;
            
            float cycleTime   = mod(uTime, interval);
            float rawProgress = cycleTime / sweepTime;
            
            // Renamed 'active' -> 'isActive' to fix GLSL reserved keyword error
            float isActive = step(rawProgress, 1.0);
            float progress = clamp(rawProgress, 0.0, 1.0);
            
            float pulsePos   = mix(startPos, endPos, progress);
            float distToBeam = abs(diagCoord - pulsePos);
            
            float pulse = (1.0 - smoothstep(0.0, beamWidth, distToBeam)) * isActive;
            
            float subtleGlow = pulse * 0.25;
            
            gl_FragColor.rgb += vec3(0.0, 0.85, 1.0) * subtleGlow;
            gl_FragColor.a = min(1.0, gl_FragColor.a + subtleGlow * 0.4);`



            // float diagCoord = vWorldPosition.x + vWorldPosition.z;
            
            // // 1. Velocitat ajustada per donar més espai/temps entre passada i passada
            // float rawWave = sin(uTime * 0.3 - diagCoord * 0.05);
            
            // // 2. Umbral molt alt (0.975 a 0.998): redueix la franja a un línia molt estreta (reflex de mirall)
            // float pulse = smoothstep(0.995, 0.998, rawWave);
            
            // // 3. Intensitat molt reduïda (0.25) per a una llum discreta
            // float subtleGlow = pulse * 0.45;
            
            // // Tonalitat blanc-blavosa suau tipus reflex de vidre/mirall
            // gl_FragColor.rgb += vec3(0.0, 0.85, 1.0) * subtleGlow;
            // gl_FragColor.a = min(1.0, gl_FragColor.a + subtleGlow * 0.3);`
        );
    };
    // const sideFloorMat = new THREE.MeshStandardMaterial({ color: 0xbcbcbc, transparent: true, opacity: 0.1 });
    const sideGridMat = new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.6, depthTest: true });

    // Left Nave Floor & Grid (Adjust Y elevation & position as needed)
    floorLeft = new THREE.Mesh(
        new THREE.PlaneGeometry(3.7, 4.6).rotateX(-Math.PI / 2),
        sideFloorMat
    );
    floorLeft.name = 'floor'; // Raycaster will treat it as valid floor
    floorLeft.position.set(-6.5, 1.3, -5.5);
    floorLeft.receiveShadow = true;

    gridLeft = new THREE.LineSegments(
        new BoxLineGeometry(3.7, 0, 4.6, 3.7, 1, 4.6),
        sideGridMat
    );
    gridLeft.position.set(-6.5, 1.31, -5.5);

    secondaryModelsGroup.add(floorLeft);
    secondaryModelsGroup.add(gridLeft);

    // Right Nave Floor & Grid (Adjust Y elevation & position as needed)
    floorRight = new THREE.Mesh(
        new THREE.PlaneGeometry(3.0, 4.6).rotateX(-Math.PI / 2),
        sideFloorMat
    );
    floorRight.name = 'floor';
    floorRight.position.set(3.0, 0.13, -5.5);
    floorRight.receiveShadow = true;

    gridRight = new THREE.LineSegments(
        new BoxLineGeometry(3.0, 0, 4.6, 3.0, 1, 4.6),
        sideGridMat
    );
    gridRight.position.set(3.0, 0.15, -5.5);

    secondaryModelsGroup.add(floorRight);
    secondaryModelsGroup.add(gridRight);

    // Apse Floor & Grid (Adjust Y elevation & position as needed)
    floorApse = new THREE.Mesh(
        new THREE.PlaneGeometry(5.0, 4.5).rotateX(-Math.PI / 2),
        sideFloorMat
    );
    floorApse.name = 'floor';
    floorApse.position.set(-1.1, 0.54, -7.5);
    floorApse.receiveShadow = true;

    gridApse = new THREE.LineSegments(
        new BoxLineGeometry(5.0, 0, 4.5, 5.0, 1, 4.5),
        sideGridMat
    );
    gridApse.position.set(-1.1, 0.55, -7.5);

    secondaryModelsGroup.add(floorApse);
    secondaryModelsGroup.add(gridApse);

    button = new THREE.Mesh(
        new RoundedBoxGeometry(0.5, 0.2, 0.4, 50, 2),  // w, h, d, segments, radius
        new THREE.MeshStandardMaterial({
            color: 0x3B3B3B,
            transparent: true,
            opacity: 0.3
        })
    );

    button.rotation.z = Math.PI / 2;
    button.rotation.y = Math.PI / 2;
    button.position.set(0.3, 2.3, -5.1);
    button.scale.set(1, 0.2, 1);
    button.name = 'button';
    button.castShadow = true;
    button.receiveShadow = true;

    const loader = new THREE.TextureLoader();
    const exitTexture = loader.load('exit.png'); // transparent PNG recommended

    // Create a plane with the icon
    const iconMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(0.15, 0.15), // adjust size to fit button
        new THREE.MeshBasicMaterial({
            map: exitTexture,
            transparent: true,
            opacity: 1.0
        })
    );

    // Rotate and position the icon on the button
    iconMesh.rotation.x = -Math.PI / 2; // align with button surface
    iconMesh.rotation.z = Math.PI / 2; // align with button surface
    iconMesh.position.set(0, 0.13, -0.02);  // slightly above button surface

    // Add icon to button
    button.add(iconMesh);
    secondaryModelsGroup.add(button);

// // Instance (Cloned)
        button_instanced = button.clone();
        button_instanced.name = 'button';
        
        button_instanced.position.z = 4;
        button_instanced.position.x = -3.3;
        button_instanced.rotation.z = Math.PI / 2 + Math.PI / 2;

        secondaryModelsGroup.add( button_instanced );

    // SECONDARY MODELS GROUP END (OTHER PEDRETS + BUTTON) ////////////////////////////////////////////////


    // HOTSPOT MODELS GROUP START  /////////////////////////////////////////////////////////////////////////

    hotspotModelsGroup = new THREE.Group();
    hotspotModelsGroup.name = 'hotspotModelsGroup';
    // scene.add( hotspotModelsGroup ); 

    hotspot_in = new THREE.Mesh(
        new THREE.OctahedronGeometry(1, 0).translate( 2.75, 3.5, -5.5 ),
        new THREE.MeshPhongMaterial({
            color: 0x00ffff,
            transparent: true,
            opacity: 0.9
        })
    );
    hotspot_in.name = 'hotspot_in';
    hotspot_in.userData.description = 'Go inside';
    hotspot_in.userData.tooltip = createTextMesh( hotspot_in.userData.description, 0.03, { x: -Math.PI / 6, y: 0, z: 0 }, { x: 0, y: 0.04, z: -0.25 }, 0x000000 );
    hotspot_in.userData.tooltip.name = 'tooltip';
    hotspotModelsGroup.add( hotspot_in );

    hotspot_next = new THREE.Mesh(
        new THREE.OctahedronGeometry(1, 0),
        new THREE.MeshPhongMaterial({
            color: 0x00ffff,
            transparent: true,
            opacity: 0.9
        })
    );
    hotspot_next.name = 'hotspot_next';
    hotspot_next.position.set( 10, 6, -6 );
    hotspot_next.userData.description = 'Next church';
    hotspot_next.userData.tooltip = createTextMesh( hotspot_next.userData.description, 0.03, { x: -Math.PI / 6, y: 0, z: 0 }, { x: 0, y: 0.04, z: -0.25 }, 0x000000 );
    hotspot_next.userData.tooltip.name = 'tooltip';
    hotspotModelsGroup.add( hotspot_next );

    hotspot_prev = new THREE.Mesh(
        new THREE.OctahedronGeometry(1, 0),
        new THREE.MeshPhongMaterial({
            color: 0x00ffff,
            transparent: true,
            opacity: 0.9
        })
    );
    hotspot_prev.name = 'hotspot_prev';
    hotspot_prev.position.set( -13, 6, -6 );
    hotspot_prev.userData.description = 'Previous church';
    hotspot_prev.userData.tooltip = createTextMesh( hotspot_prev.userData.description, 0.03, { x: -Math.PI / 6, y: 0, z: 0 }, { x: 0, y: 0.04, z: -0.25 }, 0x000000 );
    hotspot_prev.userData.tooltip.name = 'tooltip';
    hotspotModelsGroup.add( hotspot_prev );


    // Create the audio listener FIRST
    listener = new THREE.AudioListener();
    camera.add(listener);

    // Intro audio: plays when the app starts
    introAudio = new THREE.Audio(listener);

    const audioLoader = new THREE.AudioLoader();

    audioLoader.load(
        'audio/intro.mp3',

        (buffer) => {
            introAudio.setBuffer(buffer);
            introAudio.setLoop(false);
            introAudio.setVolume(1);

            console.log('Intro audio file loaded successfully');

            startIntroAudio();
        });

    loadHotspotsFromJSON();
    loadCollisionWallsFromJSON();


    updateConditionalHotspots();

    // HOTSPOT MODELS GROUP END  ///////////////////////////////////////////////////////////////////////////


    /////////// UI BUTTONS START ////////////////////
    // ---- BOTONS INFO I CLOSE---- //

        meshContainer = new THREE.Group();
        meshContainer.position.set( 0, -0.25, 0. );
        camera.add( meshContainer );

        //

        const cylinder = createMeshUI('You are about to explore a 3D reconstruction of the evolution of Sant Quirze de Pedret church and its frescoes. The stages of the church have been digitally recreated to offer a glimpse into their original appearance and historical significance.', { x: 0, y: 0, z: -2 }, 'center');
        cylinder.set({
            textAlign: 'justify-left',
            width: 1.161,
            height: 0.86,
            // textAnchor: 'left'
        });

        const sphere = createMeshUI('TRIGGER: ray for teleport and selection \nGRIP: toggle flashlight; when on, A/B adjust its brightness \nBUTTON A/B: toggle hotspots  \nJOYSTICK: vertical movement (UP/DOWN)', { x: 0, y: 0, z: 0 }, 'left');
        sphere.set({
            textAlign: 'left',
            // textAnchor: 'left'
        });

        const box = createMeshUI('', { x: 0, y: 0, z: 0 }, 'left');
            box.set({
                width: 0.8,
                height: 0.8,
                margin: 0.05
            });

            new THREE.TextureLoader().load(controlsImage, (controlsTexture) => {
                box.set({
                backgroundTexture: controlsTexture,
                });
            });

        const rightSubBlock = new ThreeMeshUI.Block({
            // width: 2,             // total width of the block
            // height: 1,            // total height of the block
            contentDirection: 'row',  // horizontal layout
            justifyContent: 'center', // align children horizontally
            alignItems: 'center',   // align children vertically
            margin: 0.025,
            padding: 0.02,
            fontSize: 0.05,
            backgroundOpacity: 0
        });
        rightSubBlock.position.set(0, 0, -2);
        rightSubBlock.add(sphere, box);

        cylinder.visible = rightSubBlock.visible = false;
        cylinder.hasCloseButton = true;       // text panel
        rightSubBlock.hasCloseButton = false; // icon-only panel


        meshContainer.add( cylinder, rightSubBlock );

        meshes = [ cylinder, rightSubBlock ];
        currentMesh = 0;

        showMesh( currentMesh );
        makePanel();

        renderer.setAnimationLoop( loop );

    /////////// UI BUTTONS START ////////////////////

    // Controller Model

    const controllerModelFactory = new XRControllerModelFactory();

    const controllerGrip1 = renderer.xr.getControllerGrip( 0 );
    controllerGrip1.add( controllerModelFactory.createControllerModel( controllerGrip1 ) );
    scene.add( controllerGrip1 );

    const controllerGrip2 = renderer.xr.getControllerGrip( 1 );
    controllerGrip2.add( controllerModelFactory.createControllerModel( controllerGrip2 ) );
    scene.add( controllerGrip2 );

    // Controller Ray

    const line = new THREE.QuadraticBezierCurve3(
		new THREE.Vector3(0, 0, 0),
		new THREE.Vector3(0, 0, 0),
		new THREE.Vector3(0, 0, -1)
	);

	const ray1 = new THREE.Mesh(
        new THREE.TubeGeometry(line, 64, .0025, 8, false),
        new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    ray1.name = 'ray';
    ray1.scale.z = 15;
	ray1.visible = false;

    const ray2 = ray1.clone();
    ray2.material = ray1.material.clone();
    ray2.name = 'ray';

    controller1 = renderer.xr.getController( 0 );
    controller1.name = 'controller1';
    controller1.intersected = [],
    controller1.add( ray1 );
    controller1.add( flashlight1 );          //attach flashlight to controller
	controller1.add( flashlight1.target );   //attach flashlight to controller
    scene.add( controller1 );

    controller2 = renderer.xr.getController( 1 );
    controller2.name = 'controller2';
    controller2.intersected = [],
    controller2.add( ray2 );
    controller2.add( flashlight2 );          //attach flashlight to controller
	controller2.add( flashlight2.target );   //attach flashlight to controller
    scene.add( controller2 );


    // Animation
    clock = new THREE.Clock();

    // Interactions
    raycaster = new THREE.Raycaster();
    // ---- AIXO CREC QUE HO NECESSITAVA PELS UI BUTTONS ---- //
    pointer = new THREE.Vector2();

    // Listeners
    controller1.addEventListener( 'squeezestart', onSqueezeStart );
    controller1.addEventListener( 'squeezeend', onSqueezeEnd );
    controller2.addEventListener( 'squeezestart', onSqueezeStart );
    controller2.addEventListener( 'squeezeend', onSqueezeEnd );

    controller1.addEventListener( 'selectstart', onSelectStart );
    controller1.addEventListener( 'selectend', onSelectEnd );
    controller2.addEventListener( 'selectstart', onSelectStart );
    controller2.addEventListener( 'selectend', onSelectEnd );

    controller1.addEventListener('connected', (e) => {
        controller1.userData.connected = true; //indicates that the controller is connected

        controller1.gamepad = e.data.gamepad;
        controller1.handedness = e.data.handedness;
   });

    controller2.addEventListener('connected', (e) => {
        controller2.userData.connected = true; //indicates that the controller is connected

        controller2.gamepad = e.data.gamepad;
        controller2.handedness = e.data.handedness;
   });

    controller1.addEventListener('disconnected', (e) => {
        controller1.userData.connected = false; //indicates that the controller is disconnected
   });

    controller2.addEventListener('disconnected', (e) => {
        controller2.userData.connected = false; //indicates that the controller is disconnected
   });

   // ---- POINTER  I TOUCHSTART-TOUCHEND ÉS PER UI BUTTONS ---- //
    document.addEventListener( 'pointermove', onPointerMove );
    window.addEventListener( 'pointerdown', () => {
        selectState = true;
    } );

    window.addEventListener( 'pointerup', () => {
        selectState = false;
    } );
    window.addEventListener( 'touchstart', ( event ) => {
        selectState = true;
        pointer.x = ( event.touches[ 0 ].clientX / window.innerWidth ) * 2 - 1;
        pointer.y = -( event.touches[ 0 ].clientY / window.innerHeight ) * 2 + 1;
    } );

    window.addEventListener( 'touchend', () => {
        selectState = false;
        pointer.x = null;
        pointer.y = null;
    } );

    renderer.xr.addEventListener('sessionstart', (e) => {
        baseReferenceSpace = renderer.xr.getReferenceSpace();
        mainModelsGroup.position.z -= z_shift;
        primaryModelsGroup.position.z -= z_shift;
        secondaryModelsGroup.position.z -= z_shift;
        hotspotModelsGroup.position.z -= z_shift;
        lightsGroup.position.z -= z_shift;
        helpersGroup.position.z -= z_shift;
        startIntroAudio();
    });

    renderer.xr.addEventListener('sessionend', (e) => {
        mainModelsGroup.position.z += z_shift;
        primaryModelsGroup.position.z += z_shift;
        secondaryModelsGroup.position.z += z_shift;
        hotspotModelsGroup.position.z += z_shift;
        lightsGroup.position.z += z_shift;
        helpersGroup.position.z += z_shift;
        camera.fov = 30;
        camera.position.set( 0, 1.8, 25 );
    });

    window.addEventListener( 'resize', onWindowResize );

}

function getChurchModel(index) {
    switch (index) {
        case 0: return pedret_IX;
        case 1: return pedret_X;
        case 2: return pedret_XI;
        case 3: return pedret_XII;
        case 4: return pedret_XIII;
        case 5: return pedret_XXI;
        default: return null;
    }
}

function loadChurch(index) {
    if (index < 0 || index > 5) {
        return Promise.resolve(null);
    }

    if (churchLoaded[index]) {
        return Promise.resolve(getChurchModel(index));
    }

    // Si ja s'està carregant, reutilitza la mateixa promesa.
    if (churchLoadPromises[index]) {
        return churchLoadPromises[index];
    }

    const names = [
        'pedret_IX',
        'pedret_X',
        'pedret_XI',
        'pedret_XII',
        'pedret_XIII',
        'pedret_XXI'
    ];

    const urls = [
        './models/pedret_IX.glb',
        './models/pedret_X.glb',
        './models/pedret_XI.glb',
        './models/pedret_XII.glb',
        './models/pedret_XIII.glb',
        './models/pedret_xxi_v1.nxz'
    ];

    const url = urls[index];
    const isNexus = url.endsWith('.nxz');

    // 1. Choose loader based on extension
    const loaderPromise = isNexus
        ? new Promise((resolve, reject) => {
              const nexus = new NEXUS.Nexus3D(url, renderer, {
                  onLoad: () => resolve(nexus),
                  onError: (err) => reject(err)
              });
          })
        : gltfLoader.loadAsync(url).then((gltf) => gltf.scene);

    // 2. Process loaded mesh
    churchLoadPromises[index] = loaderPromise
        .then((loadedModel) => {
            loadedModel.name = names[index];

            const box = new THREE.Box3().setFromObject(loadedModel);
            const center = new THREE.Vector3();
            box.getCenter(center);
            loadedModel.position.sub(center);

            loadedModel.position.y += 5;
            loadedModel.position.z -= 10;
            loadedModel.rotation.y = Math.PI / 4;

            loadedModel.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });
    // churchLoadPromises[index] = gltfLoader.loadAsync(urls[index])
    //     .then((gltf) => {
    //         const loadedModel = gltf.scene;
    //         loadedModel.name = names[index];

    //         const box = new THREE.Box3().setFromObject(loadedModel);
    //         const center = new THREE.Vector3();
    //         box.getCenter(center);
    //         loadedModel.position.sub(center);

    //         loadedModel.position.y += 5;
    //         loadedModel.position.z -= 10;
    //         loadedModel.rotation.y = Math.PI / 4;

    //         loadedModel.traverse((child) => {
    //             if (child.isMesh) {
    //                 child.castShadow = true;
    //                 child.receiveShadow = true;
    //             }
    //         });

            switch (index) {
                case 0: pedret_IX = loadedModel; break;
                case 1: pedret_X = loadedModel; break;
                case 2: pedret_XI = loadedModel; break;
                case 3: pedret_XII = loadedModel; break;
                case 4: pedret_XIII = loadedModel; break;
                case 5: pedret_XXI = loadedModel; break;
            }

            churchLoaded[index] = true;

            console.log(`${names[index]} loaded`);

            return loadedModel;
        })
        .catch((error) => {
            churchLoadPromises[index] = null;
            console.error(`Error loading ${names[index]}`, error);
            throw error;
        });

    return churchLoadPromises[index];
}

async function prepareNearbyChurches(currentIndex) {
    const neighbours = [
        currentIndex - 1,
        currentIndex + 1
    ].filter(index => index >= 0 && index <= 5);

    neighbours.forEach(index => {
        if (churchLoaded[index]) {
            console.log(`Pedret ${index + 1} already loaded`);
            return;
        }

        //console.log(`Preloading Pedret ${index + 1}...`);

        loadChurch(index)
            .then(() => {
                console.log(`Pedret ${index + 1} ready`);
            })
            .catch(error => {
                console.error(`Could not preload Pedret ${index + 1}:`, error);
            });
    });
}

/**
 * Creates a procedural wireframe church silhouette with a floating "LOADING..." banner.
 * Generates instantly using Three.js primitives with zero download delay.
 */
function createChurchPlaceholder() {
    const group = new THREE.Group();
    group.name = 'church_placeholder';

    // Shared wireframe material for the church silhouette
    const wireMat = new THREE.MeshBasicMaterial({
        color: 0x121212,
        transparent: true,
        opacity: 0.9,
        side: THREE.DoubleSide
    });

    // 1. Unified Main Nave + Roof (Single Extruded Mesh)
    const naveShape = new THREE.Shape();
    naveShape.moveTo(-2.9, 0);   // Bottom-left
    naveShape.lineTo(2.9, 0);    // Bottom-right
    naveShape.lineTo(2.9, 3.6);  // Right eave height
    naveShape.lineTo(0, 5.2);    // Roof peak
    naveShape.lineTo(-2.9, 3.6); // Left eave height
    naveShape.closePath();

    const extrudeSettings = {
        depth: 9.5,
        bevelEnabled: false
    };

    const naveWithRoof = new THREE.Mesh(
        new THREE.ExtrudeGeometry(naveShape, extrudeSettings),
        wireMat
    );
    // ExtrudeGeometry extends along +Z from Z=0. Offset by -4.75 to center it along Z.
    naveWithRoof.position.set(0, 0, -4.75);
    group.add(naveWithRoof);

    // 3. Bell Tower & Spire
    const tower = new THREE.Mesh(new THREE.BoxGeometry(2.0, 6.5, 2.0), wireMat);
    tower.position.set(-2.2, 3.25, 3.5);
    group.add(tower);

    const towerRoof = new THREE.Mesh(new THREE.ConeGeometry(1.5, 2.0, 4), wireMat);
    towerRoof.position.set(-2.2, 7.5, 3.5);
    towerRoof.rotation.y = Math.PI / 4;
    group.add(towerRoof);

    // 4. Floating 3D Text (Uses existing createTextMesh helper)
    if (typeof createTextMesh === 'function') {
        const loadingText = createTextMesh(
            'LOADING CHURCH...',
            1.0,
            { x: 0, y: 0, z: 0 },
            { x: 0, y: 1.2, z: 6.0 },
            0x000000
        );
        loadingText.rotation.y = -Math.PI / 4;
        loadingText.name = 'placeholder_text';
        group.add(loadingText);
    }

    // 5. Rotating Base Ring (Visual Loading Indicator)
    const ringGeom = new THREE.TorusGeometry(6.5, 0.05, 8, 32);
    const ringMat = new THREE.MeshBasicMaterial({
        color: 0x00ffff,
        transparent: true,
        opacity: 0.6
    });
    const ring = new THREE.Mesh(ringGeom, ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.05;
    ring.name = 'placeholder_ring';
    group.add(ring);

    return group;
}

function removePlaceholder() {
    if (churchPlaceholder) {
        removeGroupAndDispose(churchPlaceholder);
        churchPlaceholder = null;
    }
}

async function showInitialChurch() {
    try {
        const model = await loadChurch(0);

        if (!model) return;

        primaryModelsGroup.add(model);

        model.position.set(0, 0, -10);
        model.rotation.y = Math.PI / 4;

        updateChurchLabel('IXth century church');
        updateConditionalHotspots();

        prepareNearbyChurches(0);

    } catch (error) {
        console.error('Could not show initial church:', error);
    }
}


// ---- AIXO CREC QUE HO NECESSITAVA PELS UI BUTTONS ---- //
function onPointerMove( event ) {

    pointer.x = ( event.clientX / window.innerWidth ) * 2 - 1;
    pointer.y = - ( event.clientY / window.innerHeight ) * 2 + 1;
}

function removeGroupAndDispose(group) {
    group.traverse(function(child) {
        if (child.isMesh) {
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
                if (Array.isArray(child.material)) child.material.forEach(mat => mat.dispose());
                else child.material.dispose();
            }
        }
    });
    if (group.parent) group.parent.remove(group);
}

function createTextMesh(message, height, rotation, position, background_color) {
    const text = createText( message, height );
    text.rotation.set( rotation.x, rotation.y, rotation.z );
    text.position.set( position.x, position.y, position.z );

    const group = new THREE.Group();

    if ( background_color !== undefined ) {
        // Calculate the text bounding box to size the background
        text.geometry.computeBoundingBox();
        const box = text.geometry.boundingBox;
        const width = box.max.x - box.min.x;
        const h = box.max.y - box.min.y;

        // Create a black plane slightly larger than the text
        const padding = 0.03;
        const bgGeometry = new THREE.PlaneGeometry(width + padding, h + padding);
        const bgMaterial = new THREE.MeshBasicMaterial({ color: background_color, side: THREE.DoubleSide });
        const background = new THREE.Mesh(bgGeometry, bgMaterial);

        // Align the plane behind the text
        background.rotation.copy(text.rotation);
        background.position.copy(text.position);
        background.position.y -= 0.001; // slightly behind the text

        // Add the plane to the group
        group.add(background);
    }

    group.add(text);

    return group;
}

function updateChurchLabel(message) {
    if (!churchLabel) return;

    const text = churchLabel.children.find(child => child.isMesh);
    if (!text) return;

    // Create the new text using the same height
    const newText = createText(message, 1.5);

    // Replace the old geometry
    text.geometry.dispose();
    text.geometry = newText.geometry;

    // Replace the old canvas texture
    text.material.map.dispose();
    text.material.map = newText.material.map;
    text.material.needsUpdate = true;

    // Dispose of the temporary material
    newText.material.dispose();
}

function teleport( position, update ) {
        const rotationTransform = new XRRigidTransform(
            { x: 0, y: 0, z: 0, w: 1 },
            new THREE.Quaternion().setFromEuler(new THREE.Euler(0, xrRotationY, 0, 'YXZ'))
            );

        const translationTransform = new XRRigidTransform(
            { x: position.x, y: position.y, z: position.z + z_shift, w: 1 },
            new THREE.Quaternion()
        );

        let currentSpace = baseReferenceSpace.getOffsetReferenceSpace(rotationTransform);
        currentSpace = currentSpace.getOffsetReferenceSpace(translationTransform);
        renderer.xr.setReferenceSpace(currentSpace);

        // Update tracked position
        if (update) xrPosition = { x: position.x, y: position.y, z: position.z };
}

function checkXRButtons( controller ) {
    if (!controller.userData.connected) return;

    if (controller.handedness == 'right') {
        // A = button[4], B = button[5]
        const aPressed = controller.gamepad.buttons[4]?.pressed;
        const bPressed = controller.gamepad.buttons[5]?.pressed;

        // x = axes[2], y = axes[3]
        const threshold = 0.0; // deadzone
        const x = Math.abs(controller.gamepad.axes[2]) > threshold ? controller.gamepad.axes[2] : 0;
        const y = Math.abs(controller.gamepad.axes[3]) > threshold ? controller.gamepad.axes[3] : 0;
        const jPressed = x != 0 || y != 0 ? true : false;

        // Press Joy
        if (jPressed && !prevJ) {
            if ( joyPressed ) return;
            joyPressed = true;
            lockJ = false;
        }
        // Press & Hold Joy
        if (jPressed) {
            if ( lockJ ) return; //if joy is locked, do not move

            ////////// JOYPAD NAVIGATION //////////////////////////////////////////
//            if ( !primaryModelsGroup.parent ) {         //enable joypad only with secondary models group
            // if ( !secondaryModelsGroup.parent ) {         //enable joypad only with primary models group
                const movSpeed = 0.5;
//                const rotSpeed = 0.5;

                // Calculate movement
                // const deltaX = -x * movSpeed * delta;     //X
                const deltaY =  y * movSpeed * delta;     //Y
//                const deltaZ = -y * movSpeed * delta;     //Z
//                const deltaX = Math.sin(xrRotationY) * ( y * movSpeed * delta); //X FPS
//                const deltaZ = Math.cos(xrRotationY) * (-y * movSpeed * delta); //Z FPS

                // Update tracked position
                // xrPosition.x += deltaX;                   //X
                xrPosition.y += deltaY;                   //Y
//                xrPosition.z += deltaZ;                   //Z

                if (xrPosition.y > 0) xrPosition.y = 0;   //Y prevent going below ground level
//                if (xrPosition.y < -2) xrPosition.y = -2; //Y prevent going too high

                // Update tracked rotation
//                xrRotationY += x * rotSpeed * delta;      //Y FPS

                teleport( xrPosition, true );
        //    }
            resolveWallCollisions();
            ///////////////////////////////////////////////////////////////////////

        }
        // Release Joy
        if (!jPressed && prevJ) {
            joyPressed = false;
            lockJ = true;
        }

        // Press A
        if (aPressed && !prevA) {
            if ( button1Pressed ) return;
            button1Pressed = true;
            if ( !controller.userData.squeezed ) {
                if ( primaryModelsGroup.parent ) {
                    if ( hotspotModelsGroup.parent ) removeGroupAndDispose( hotspotModelsGroup ); //remove hotspot models
                    else {
                scene.add(hotspotModelsGroup);

                // Find the currently active church
                const models = [
                    pedret_IX,
                    pedret_X,
                    pedret_XI,
                    pedret_XII,
                    pedret_XIII,
                    pedret_XXI
                ];

                const isInside = scene.children.includes(secondaryModelsGroup);
                const activeGroup = isInside ? secondaryModelsGroup : primaryModelsGroup;

                let currentIndex = models.findIndex(
                    model => model && model.parent === activeGroup
                );

                if (currentIndex === -1) currentIndex = 0;

                updateNavigationHotspots(currentIndex);
            } //add hotspot models
                }
            }
        }
        // Press & Hold A
        if (aPressed) {
            if ( controller.userData.squeezed ) controller.getObjectByName( 'flashlight' ).power += 1;
        }
        // Release A
        if (!aPressed && prevA) {
            button1Pressed = false;
        }

        // Press B
        if (bPressed && !prevB) {
            if ( button2Pressed ) return;
            button2Pressed = true;
            if ( !controller.userData.squeezed ) {
                if ( primaryModelsGroup.parent ) {
                    if ( hotspotModelsGroup.parent ) removeGroupAndDispose( hotspotModelsGroup ); //remove hotspot models
                    else scene.add( hotspotModelsGroup ); //add hotspot models
                }
            }
        }

        // Press & Hold B
        if (bPressed) {
            if ( controller.userData.squeezed && controller.getObjectByName( 'flashlight' ).power > 2 ) controller.getObjectByName( 'flashlight' ).power -= 1;
        }
        // Release B
        if (!bPressed && prevB) {
            button2Pressed = false;
        }

        prevA = aPressed;
        prevB = bPressed;
        prevJ = jPressed;
    }
    else {
        // X = button[4], Y = button[5]
        const xPressed = controller.gamepad.buttons[4]?.pressed;
        const yPressed = controller.gamepad.buttons[5]?.pressed;

        // x = axes[2], y = axes[3]
        const threshold = 0.05; // deadzone
        const x = Math.abs(controller.gamepad.axes[2]) > threshold ? controller.gamepad.axes[2] : 0;
        const y = Math.abs(controller.gamepad.axes[3]) > threshold ? controller.gamepad.axes[3] : 0;
        const jPressed = x != 0 || y != 0 ? true : false;

        // Press Joy
        if (jPressed && !prevK) {
            if ( joyPressed ) return;
            joyPressed = true;
            lockK = false;
        }
        // Press & Hold Joy
        if (jPressed) {
            if ( lockK ) return; //if joy is locked, do not move

            ////////// JOYPAD NAVIGATION //////////////////////////////////////////
//            if ( !primaryModelsGroup.parent ) {         //enable joypad only with secondary models group
            // if ( !secondaryModelsGroup.parent ) {         //enable joypad only with primary models group
                const movSpeed = 0.5;
//                const rotSpeed = 0.5;

                // Calculate movement
                // const deltaX = -x * movSpeed * delta;     //X
                const deltaY =  y * movSpeed * delta;     //Y
//                const deltaZ = -y * movSpeed * delta;     //Z
//                const deltaX = Math.sin(xrRotationY) * ( y * movSpeed * delta); //X FPS
//                const deltaZ = Math.cos(xrRotationY) * (-y * movSpeed * delta); //Z FPS

                // Update tracked position
                // xrPosition.x += deltaX;                   //X
                xrPosition.y += deltaY;                   //Y
//                xrPosition.z += deltaZ;                   //Z

                if (xrPosition.y > 0) xrPosition.y = 0;   //Y prevent going below ground level
//                if (xrPosition.y < -2) xrPosition.y = -2; //Y prevent going too high

                // Update tracked rotation
//                xrRotationY += x * rotSpeed * delta;      //Y FPS

                teleport( xrPosition, true );
            // }
            ///////////////////////////////////////////////////////////////////////

        }
        // Release Joy
        if (!jPressed && prevK) {
            joyPressed = false;
            lockK = true;
        }

        // Press X
        if (xPressed && !prevX) {
            if ( button1Pressed ) return;
            button1Pressed = true;
            if ( !controller.userData.squeezed ) {
                if ( primaryModelsGroup.parent ) {
                    if ( hotspotModelsGroup.parent ) removeGroupAndDispose( hotspotModelsGroup ); //remove hotspot models
                    else scene.add( hotspotModelsGroup ); //add hotspot models
                }
            }
        }
        // Press & Hold X
        if (xPressed) {
            if ( controller.userData.squeezed ) controller.getObjectByName( 'flashlight' ).power += 1;
            // else {
            //     const speed = 0.5;

            //     // Calculate upward movement
            //     const upwardY = -1 * speed * delta;

            //     // Update tracked position
            //     xrPosition.y += upwardY;

            //     teleport( xrPosition, true );
            // }
        }
        // Release X
        if (!xPressed && prevX) {
            button1Pressed = false;
        }

        // Press Y
        if (yPressed && !prevY) {
            if ( button2Pressed ) return;
            button2Pressed = true;

            if ( !controller.userData.squeezed ) {
                if ( primaryModelsGroup.parent ) {
                    if ( hotspotModelsGroup.parent ) removeGroupAndDispose( hotspotModelsGroup ); //remove hotspot models
                    else scene.add( hotspotModelsGroup ); //add hotspot models
                }
            }
        }
        // Press & Hold Y
        if (yPressed) {
            if ( controller.userData.squeezed ) {
                if ( controller.getObjectByName( 'flashlight' ).power > 2 ) controller.getObjectByName( 'flashlight' ).power -= 1;
            }
            // else {
            //     const speed = 0.5;

            //     // Calculate upward movement
            //     const downwardY = 1 * speed * delta;

            //     // Update tracked position
            //     xrPosition.y += downwardY;
            //     if (xrPosition.y > 0) xrPosition.y = 0; //prevent going below ground level

            //     teleport( xrPosition, true );
            // }
        }
        // Release Y
        if (!yPressed && prevY) {
            button2Pressed = false;
        }

        prevX = xPressed;
        prevY = yPressed;
        prevK = jPressed;
    }
}


function onSelectStart( event ) {
    const controller = event.target;
    if (lockSelect) return; //if select is locked, do not select
    lockSelect = true;
    controller.userData.selected = true; //indicates that the controller is in select mode
    // ---- A PARTIR D'AQUÍ TOT ÉS UI BUTTONS -- //
    selectState = true;

    const intersections = getIntersections( controller, true, true );

    if ( intersections.length > 0 ) {

        const intersection = intersections[ 0 ];
        let current = intersection.object;
        while(current) {
            current = current.parent;
        }

        const uiBlock = getUIBlock(intersection.object);
        if (uiBlock) {
            uiBlock.setState('idle');
            controller.userData.selectedUI = null; // remember for release
            return;
        }
        // if (intersection.object.isUI) {
        //     controller.attach(intersection.object);
        //     controller.userData.selected = intersection.object;
        // }

    }
    controller.userData.targetRayMode = event.data.targetRayMode;
}

async function onSelectEnd( event ) {
    const controller = event.target;
    if ( controller.userData.selected ) lockSelect = false; //unlock select
    else return; //if controller is not in select mode, do not deselect
    controller.userData.selected = false; //indicates that the controller is not in select mode anymore
    // ---- COSES DELS UI BUTTONS ---- //
    selectState = false;

    // ATURA QUALSEVOL ÀUDIO ACTIU IMMEDIATAMENT EN INTERACTUAR
    // stopAllAudio(hotspotObject);

    const modelTransforms = [
        { inside: { pos: [0, -2.9, -1.2], rotY: Math.PI / 2 }, outside: { pos: [0.0, 0.0, -10.0], rotY: Math.PI / 4 } }, // pedret_IX
        { inside: { pos: [0, -2.9, -1.2], rotY: Math.PI / 2 }, outside: { pos: [0.0, 0.0, -10.0], rotY: Math.PI / 4 } }, // pedret_X
        { inside: { pos: [0, -2.9, -1.2], rotY: Math.PI / 2 }, outside: { pos: [0.0, 0.0, -10.0], rotY: Math.PI / 4 } },  // pedret_XI
        { inside: { pos: [0, -2.9, -1.2], rotY: Math.PI / 2 }, outside: { pos: [0.0, 0.0, -10.0], rotY: Math.PI / 4 } },  // pedret_XII
        { inside: { pos: [0, -2.9, -1.2], rotY: Math.PI / 2 }, outside: { pos: [0.0, 0.0, -10.0], rotY: Math.PI / 4 } },  // pedret_XIII
        { inside: { pos: [0, -2.9, -0.8], rotY: Math.PI / 2 }, outside: { pos: [0.0, 0.0, -10.0], rotY: Math.PI / 4 } }  // pedret_XXI
    ];

    const mapTransforms = {
        outside: {
            pos: [10, 5, -1],
            rotY: Math.PI / 4
        },
        inside: {
            pos: [13, 1.5, -3], 
            rotY: Math.PI / 2
        }
    };
    
    const labels = [
        'IXth century church',
        'Xth century church',
        'XIth century church',
        'XIIth century church',
        'XIIIth century church',
        'XXIst century church'
    ];

    // coses dels botons meshUi
    const intersections = getIntersections( controller, true, true );
    if ( intersections.length > 0 ) {
        const intersection = intersections[ 0 ];
        let current = intersection.object;
        while(current) {
            current = current.parent;
        }
        const uiBlock = getUIBlock(intersection.object);
        if (uiBlock) {
            uiBlock.setState('selected');
            controller.userData.selectedUI = uiBlock; // remember for release
            // return;
        }

    }
    // ---- FINS AQUÍ UI BUTTONS ---- //


    if ( controller.intersected.length > 0 ) {
        const intersectedObject = controller.intersected[ 0 ];
        const selectedName = intersectedObject.name;
        // stopAllAudio();

        // Stop audio on any interaction.
        // If the same audio hotspot is selected, toggle it off.
        const isAudioHotspot = !!intersectedObject.userData?.audio;

        if (isAudioHotspot) {
            const toggledOff = stopAllAudio(intersectedObject);
            if (toggledOff) return;
        } else {
            stopAllAudio();
        }

        // =========================================================
        // HOTSPOT SELECTION LOGIC (FLOOR & WALL)
        // =========================================================
        if ( intersectedObject.userData && intersectedObject.userData.type ) {

            // Set current hotspot to PLAYING color (Bright Green)
            intersectedObject.material.color.setHex(COLOR_PLAYING);
            if (intersectedObject.material.emissive) {
                intersectedObject.material.emissive.setHex(COLOR_PLAYING);
            }

            const audio = intersectedObject.userData.audio;

            // Attach end listener to switch to PLAYED color (Grey) when audio finishes
            if (audio) {
                audio.onEnded = function () {
                    THREE.Audio.prototype.onEnded.call(this);
                    intersectedObject.userData.played = true;
                    intersectedObject.material.color.setHex(COLOR_PLAYED);
                    if (intersectedObject.material.emissive) {
                        intersectedObject.material.emissive.setHex(COLOR_PLAYED);
                    }
                };

                // Play audio ONCE here for both Floor and Wall
                if ( intersectedObject.userData.audioLoaded ) {
                    audio.play();
                }
            }

            // -----------------------------------------------------
            // BRANCH A: WALL HOTSPOT ("Stand & Observe")
            // -----------------------------------------------------
            if ( intersectedObject.userData.type === 'wall' ) {
                

                // Clean controller ray visuals
                marker1.visible = marker2.visible = false;
                const ray = controller.getObjectByName('ray');
                if (ray) ray.visible = false;

                return; // EXIT WITHOUT TELEPORTING
            }

            // -----------------------------------------------------
            // BRANCH B: FLOOR HOTSPOT (Overview & Teleport)
            // -----------------------------------------------------
            if ( intersectedObject.userData.type === 'floor_hotspot' ) {


                // Teleport to floor target
                const worldPosition = new THREE.Vector3();
                intersectedObject.getWorldPosition(worldPosition);
                const offsetZ = 20;

                controller.intersection = {
                    x: worldPosition.x,
                    y: worldPosition.y,
                    z: worldPosition.z + offsetZ
                };

                teleport({
                    x: -controller.intersection.x,
                    y: -controller.intersection.y,
                    z: -controller.intersection.z
                }, true);

                // Reveal associated wall pins for this floor zone
                updateVisibleWallPins(selectedName);

                // Clean controller ray visuals
                marker1.visible = marker2.visible = false;
                const ray = controller.getObjectByName('ray');
                if (ray) ray.visible = false;

                return;
            }
        }

        // ---- AIXÒ ÉS PER TORNAR A LA PAGINA INICIAL DE L'ESGLÉSIA ---- //
        if ( controller.intersected[ 0 ].name === 'button' ) {
            
            
            scene.remove( secondaryModelsGroup );


            NEXUS.Cache.targetError = primaryTargetError; //set error tolerance for nexus models in primary scene
            scene.add( primaryModelsGroup );
            scene.add( hotspotModelsGroup );

            // Restore the map for the exterior view.
            if (mapP) {
                const transform = mapTransforms.outside;

                mapP.position.set(...transform.pos);
                mapP.rotation.y = transform.rotY;

                mapP.updateMatrix();
                mapP.updateMatrixWorld(true);
            }

            floor.geometry = new THREE.PlaneGeometry( 40, 28, 2, 2).rotateX( -Math.PI / 2 ).rotateY( Math.PI / 2).translate(0, 0, 2); 
            floor.material.transparent = true;
            floor.material.opacity = 1.0;
            grid.geometry = new BoxLineGeometry( 28, 0, 40, 28, 1, 40 ).translate( 0, 0.01, 2 ).rotateY( 0 );
            // Manté el model que estava actiu a l'interior i el mostra a l'exterior
            // Troba quin model està actiu a DINS (secondaryModelsGroup)
            const models = [ pedret_IX, pedret_X, pedret_XI, pedret_XII, pedret_XIII, pedret_XXI ].filter( Boolean );
            let currentInsideIdx = models.findIndex( m => m.parent === secondaryModelsGroup );
            if ( currentInsideIdx === -1 ) currentInsideIdx = currentTargetChurchIndex;

            if (churchPlaceholder) {
                primaryModelsGroup.add(churchPlaceholder);
                const transform = modelTransforms[currentTargetChurchIndex].outside;
                churchPlaceholder.position.set(...transform.pos);
                churchPlaceholder.rotation.y = transform.rotY;
            }

            // El passa a FORA (primaryModelsGroup) amb la posició exterior
            models.forEach( ( model, idx ) => {
                if ( idx === currentInsideIdx ) {
                    primaryModelsGroup.add( model );

                    const transform = modelTransforms[ idx ] ? modelTransforms[ idx ].outside : modelTransforms[ 0 ].outside;
            
                    // Set position and rotation for outside view
                    model.position.set( transform.pos[0], transform.pos[1], transform.pos[2] );
                    model.rotation.y = transform.rotY;

                    updateChurchLabel(labels[idx]); 
                    
                } else {
                    primaryModelsGroup.remove( model ); 
                    secondaryModelsGroup.remove( model ); 
                }
            } );
            updateHotspotPositions( false );
            updateConditionalHotspots();

            controller.intersection = { x: 0.25, y: 0, z: 20 }; //reset intersection point

        }
        else {
            // ---- ANAR A L'INTERIOR O NAVEGAR ---- //
            let tooltip = controller.getObjectByName( 'tooltip' );
            if (controller.getObjectByName( 'tooltip' )) controller.remove(tooltip);

            switch ( controller.intersected[ 0 ].name ) {
                case 'hotspot_in':  // go inside. 
                    
                    // Manté el model que estava actiu a l'exterior i el mostra a l'interior
                    const insideModels = [ pedret_IX, pedret_X, pedret_XI, pedret_XII, pedret_XIII, pedret_XXI ].filter( Boolean );
                    let currentOutsideIdx = insideModels.findIndex( m => m.parent === primaryModelsGroup );
                    if ( currentOutsideIdx === -1 ) currentOutsideIdx = currentTargetChurchIndex;

                    if (churchPlaceholder) {
                        secondaryModelsGroup.add(churchPlaceholder);
                        const transform = modelTransforms[currentTargetChurchIndex].inside;
                        churchPlaceholder.position.set(...transform.pos);
                        churchPlaceholder.rotation.y = transform.rotY;
                    }

                    // Apply the exact "inside" transform from modelTransforms
                    insideModels.forEach( ( model, idx ) => {
                        if ( idx === currentOutsideIdx ) {
                            secondaryModelsGroup.add( model );
                            const transform = modelTransforms[ idx ].inside;
                            model.position.set( ...transform.pos );
                            model.rotation.y = transform.rotY;
                        } else {
                            primaryModelsGroup.remove( model ); 
                            secondaryModelsGroup.remove( model );
                        }
                    } );
                    scene.add (secondaryModelsGroup);

                    // Rotate and reposition the map for the interior view.
                    if (mapP) {
                        const transform = mapTransforms.inside;

                        mapP.position.set(...transform.pos);
                        mapP.rotation.y = transform.rotY;

                        mapP.updateMatrix();
                        mapP.updateMatrixWorld(true);
                    }

                    updateHotspotPositions( true );
                    updateConditionalHotspots();
                    updateCollisionWallVisibility(currentTargetChurchIndex);
                    break;
                
                
                case 'hotspot_next':
                case 'hotspot_prev': {
                    let models = [
                        pedret_IX,
                        pedret_X,
                        pedret_XI,
                        pedret_XII,
                        pedret_XIII,
                        pedret_XXI
                    ];

                    const isInside = scene.children.includes(secondaryModelsGroup);
                    const activeGroup = isInside ? secondaryModelsGroup : primaryModelsGroup;
                    const hiddenGroup = isInside ? primaryModelsGroup : secondaryModelsGroup;

                    let currentChurchIndex = models.findIndex(
                        model => model && model.parent === activeGroup
                    );

                    if (currentChurchIndex === -1) currentChurchIndex = currentTargetChurchIndex;

                    const nextIndex = Math.max(
                        0,
                        Math.min(
                            5,
                            currentChurchIndex +
                                (controller.intersected[0].name === 'hotspot_next' ? 1 : -1)
                        )
                    );

                    if (nextIndex === currentChurchIndex) return;

                    currentTargetChurchIndex = nextIndex;
                    updateCollisionWallVisibility(nextIndex);

                    // Remove current active models/placeholders
                    removePlaceholder();
                    models.forEach(model => {
                        if (model && model.isObject3D) {
                            hiddenGroup.add(model);
                        }
                    });

                    const transform = isInside
                        ? modelTransforms[nextIndex].inside
                        : modelTransforms[nextIndex].outside;

                    if (!isInside) {
                        updateChurchLabel(labels[nextIndex]);
                    }

                    // Update navigation hotspot visibility
                    const btnPrev = scene.getObjectByName('hotspot_prev');
                    const btnNext = scene.getObjectByName('hotspot_next');
                    setHotspotEnabled(btnPrev, nextIndex !== 0);
                    setHotspotEnabled(btnNext, nextIndex !== 5);

                    // IF ALREADY LOADED: Show actual model immediately
                    if (churchLoaded[nextIndex]) {
                        const targetModel = getChurchModel(nextIndex);
                        if (targetModel) {
                            activeGroup.add(targetModel);
                            targetModel.position.set(...transform.pos);
                            targetModel.rotation.y = transform.rotY;
                        }
                        updateConditionalHotspots();
                        prepareNearbyChurches(nextIndex).catch(console.error);
                    } else {
                        // IF NOT LOADED YET: Immediately show wireframe placeholder
                        churchPlaceholder = createChurchPlaceholder();
                        activeGroup.add(churchPlaceholder);
                        churchPlaceholder.position.set(...transform.pos);
                        churchPlaceholder.rotation.y = transform.rotY;

                        // Load in background without freezing the UI
                        loadChurch(nextIndex).then((loadedModel) => {
                            if (currentTargetChurchIndex === nextIndex && loadedModel) {
                                removePlaceholder();
                                activeGroup.add(loadedModel);
                                loadedModel.position.set(...transform.pos);
                                loadedModel.rotation.y = transform.rotY;
                                updateConditionalHotspots();
                                prepareNearbyChurches(nextIndex).catch(console.error);
                            }
                        }).catch(console.error);
                    }

                    marker1.visible = marker2.visible = false;
                    const ray = controller.getObjectByName('ray');
                    if (ray) ray.visible = false;

                    return;
                }
                
                default:
                    // break;
                    marker1.visible = marker2.visible = false; //hide markers
                    controller.getObjectByName( 'ray' ).visible = false; //hide ray
                    return;
            }

            removeGroupAndDispose( primaryModelsGroup );
            NEXUS.Cache.targetError = secondaryTargetError //set error tolerance for nexus models in secondary scene
            scene.add( secondaryModelsGroup );
            floor.geometry = new THREE.PlaneGeometry( 15, 5.25, 2, 2 ).rotateX( - Math.PI / 2 ).translate( -2.5, 0.06, 1.5 ).rotateY( - Math.PI / 2).rotateZ(- Math.PI / 256).rotateX( Math.PI / 256);
            floor.material.transparent = true;
            floor.material.opacity = 0.1;
            grid.geometry = new BoxLineGeometry( 15, 0, 5.25, 15, 1, 5.25 ).translate( -2.5, 0.07, 1.5  ).rotateY( - Math.PI / 2).rotateZ(- Math.PI / 256).rotateX( Math.PI / 256);
            controller.intersection = { x: -1.8, y: 0, z: 3.5 }; //reset intersection point
        }
    }

    if ( controller.intersection ) teleport( { x: -controller.intersection.x, y: -controller.intersection.y, z: -controller.intersection.z }, true); //teleport to intersection point

    marker1.visible = marker2.visible = false; //hide markers
    controller.getObjectByName( 'ray' ).visible = false; //hide ray
}

// Shows wall pins linked to active floor hotspot, hides all others
function updateVisibleWallPins( activeFloorHotspotName ) {
    hotspotModelsGroup.traverse(( object ) => {
        if ( object.userData && object.userData.type === 'wall' ) {
            if ( object.userData.parentFloor === activeFloorHotspotName ) {
                object.visible = true;
            } else {
                object.visible = false;
            }
        }
    });
}

function updateNavigationHotspots(currentIndex) {
    const btnPrev = scene.getObjectByName('hotspot_prev');
    const btnNext = scene.getObjectByName('hotspot_next');

    setHotspotEnabled(btnPrev, currentIndex > 0);
    setHotspotEnabled(btnNext, currentIndex < 5);
}

function stopAllAudio(triggeredObject = null) {
    let currentlyPlayingObject = null;

    hotspotModelsGroup.traverse((object) => {
        if (object.userData?.audio?.isPlaying) {
            currentlyPlayingObject = object;
        }
    });

    // Same audio hotspot selected: toggle it off
    if (triggeredObject && currentlyPlayingObject === triggeredObject) {
        currentlyPlayingObject.userData.audio.stop();
        currentlyPlayingObject.userData.played = true;
        currentlyPlayingObject.material.color.setHex(COLOR_PLAYED);

        if (currentlyPlayingObject.material.emissive) {
            currentlyPlayingObject.material.emissive.setHex(COLOR_PLAYED);
        }

        return true;
    }

    // Stop all currently playing hotspot audio
    hotspotModelsGroup.traverse((object) => {
        if (object.userData?.audio?.isPlaying) {
            object.userData.audio.stop();
            object.userData.played = true;
            object.material.color.setHex(COLOR_PLAYED);

            if (object.material.emissive) {
                object.material.emissive.setHex(COLOR_PLAYED);
            }
        }
    });

    // Also stop the introduction if playing
    if (introAudio?.isPlaying) {
        introAudio.stop();
    }

    return false;
}

function updateConditionalHotspots() {
    const isInside = scene.children.includes(secondaryModelsGroup);
    const currentView = isInside ? 'inside' : 'outside';
    const activeGroup = isInside ? secondaryModelsGroup : primaryModelsGroup;

    // 1. Actualitza la visibilitat dels hotspots de terra
    hotspotModelsGroup.traverse(( object ) => {
        if ( object.userData && object.userData.type === 'floor_hotspot' ) {
            const modelIdx = object.userData.requiredModelIndex;
            const reqView = object.userData.requiredView;

            let isVisible = true;

            // A. Comprova si la vista (inside/outside) és la correcta
            if ( reqView && reqView !== 'any' && reqView !== currentView ) {
                isVisible = false;
            }

            // B. Comprova si el model de l'església requerit està actiu a la vista actual
            if ( isVisible && modelIdx !== undefined ) {
                const modelObj = getChurchModel(modelIdx);
                if ( !modelObj || modelObj.parent !== activeGroup ) {
                    isVisible = false;
                }
            }

            // Activa o amaga el hotspot
            object.visible = isVisible;
            const targetY = (object.userData.baseY !== undefined) ? object.userData.baseY : 0.05;
            object.position.y = isVisible ? targetY : -100;
            object.updateMatrix();
            object.updateMatrixWorld(true);
        }
    });

    // 2. En canviar de vista o segle, amaga tots els pins de paret i apaga el spotlight
    hotspotModelsGroup.traverse(( object ) => {
        if ( object.userData && object.userData.type === 'wall' ) {
            object.visible = false;
        }
    });

    // 3. Hotspot d'entrada/sortida
    const hotspotIn = scene.getObjectByName('hotspot_in');
    if (hotspotIn) {
        hotspotIn.position.set(0, isInside ? -100 : 0, 0);
        hotspotIn.updateMatrix();
        hotspotIn.updateMatrixWorld(true);
    }
}

function updateHotspotPositions( isInside ) {
    const btnPrev = scene.getObjectByName( 'hotspot_prev' );
    const btnNext = scene.getObjectByName( 'hotspot_next' );

    // DEFINEIX AQUÍ LES POSICIONS I ROTACIONS PER A DINS I PER A FORA
    const config = isInside ? {
        // POSICIONS A L'INTERIOR (DINS)
        prev: { pos: [ -3.2, 1.5, 1.7 ], rotY: 0, scale: [ 0.2, 0.2, 0.2 ] },
        next: { pos: [ 0.2, 1.5, 1.7 ], rotY: 0, scale: [ 0.2, 0.2, 0.2 ] }
    } : {
        // POSICIONS A L'EXTERIOR (FORA)
        prev: { pos: [ -13, 6, -6 ], rotY: 0, scale: [ 0.7, 0.7, 0.7 ] },
        next: { pos: [ 10, 6, -6 ], rotY: 0, scale: [ 0.7, 0.7, 0.7 ] }
    };

    if ( btnPrev ) {
        btnPrev.position.set( ...config.prev.pos );
        if ( config.prev.rotY !== undefined ) btnPrev.rotation.y = config.prev.rotY;
        if ( config.prev.scale ) btnPrev.scale.set( ...config.prev.scale );
    }

    if ( btnNext ) {
        btnNext.position.set( ...config.next.pos );
        if ( config.next.rotY !== undefined ) btnNext.rotation.y = config.next.rotY;
        if ( config.next.scale ) btnNext.scale.set( ...config.next.scale );
    }
}


function setHotspotEnabled(hotspot, enabled) {
    if (!hotspot) return;

    hotspot.visible = enabled;
    hotspot.userData.disabled = !enabled;
}

function onSqueezeStart( event ) {
    const controller = event.target;
    controller.userData.squeezed = true; //indicates that the controller is in select mode
    if ( controller.userData.flashPower !== undefined ) controller.getObjectByName( 'flashlight' ).power = controller.userData.flashPower;
    else controller.getObjectByName( 'flashlight' ).power = 10;
}

function onSqueezeEnd( event ) {
    const controller = event.target;
    controller.userData.squeezed = false; //indicates that the controller is in select mode
    controller.getObjectByName( 'flashlight' ).power = 0;
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize( window.innerWidth, window.innerHeight );
}

// ---- COSES AFEGIDES PELS UI BUTTONS ---- //
function getIntersections(controller, xr = true, includeUI = false) {
    // Start with floor and scene object groups
    // Include all floor planes (Main Nave, Left Nave, Right Nave)
    const objects = [floor, floorLeft, floorRight, floorApse].filter(Boolean);

    scene.traverse(child => {
        if (child.name === 'button' || 
            (child.parent && child.parent.name === 'hotspotModelsGroup')
        ) {objects.push(child);
        }
    });

    // Add UI objects
    if (includeUI && Array.isArray(objsToTest) && objsToTest.length){
         objects.push(...objsToTest);
        }

        // Set up the raycaster
        if (xr) {
            controller.updateMatrixWorld();
            raycaster.setFromXRController(controller);
        } else {
            camera.updateMatrixWorld();
            raycaster.setFromCamera(controller, camera);
        }

        return raycaster.intersectObjects(objects, true);
}

// ---- COSES AFEGIDES PELS UI BUTTONS ---- //
function intersectObjects ( controller, xr = true ) {
    if (!controller.userData.connected) return;
    controller.intersection = false;

    let currentMarker = marker1;
    if (controller.handedness === 'left') currentMarker = marker2;
    currentMarker.visible = false;

    let tooltip = controller.getObjectByName( 'tooltip' );
    if (tooltip) controller.remove(tooltip);

    let ray = controller.getObjectByName( 'ray' );
    ray.visible = true;

    const intersections = getIntersections( controller, true, true );
    // console.log("Intersections:", intersections);

    if (controller.userData.hovered) {
        controller.userData.hovered.forEach(obj => {
            obj.material.emissive.b = 0;
            obj.material.opacity = 0.6;
            obj.material.alphaHash = false;
            obj.material.needsUpdate = true;
        });
    }
    controller.userData.hovered = [];

    if ( intersections.length > 0 ) {
        const intersection = intersections[ 0 ];

        // find the actual button block
        const uiBlock = getUIBlock(intersection.object, 'hovered');
        if (uiBlock) {
            uiBlock.setState('hovered');
            intersected.push(uiBlock);
            // ---- volia posar que el ray fos cyan QUAN S'INTERSECT PERO NO SÉ FER-HO: crec que no puc perquè no tinc controller.intersected.push(uiBlock) pero quan ho faig se'm xafa ---- //
        }

        const object = (intersection.object.parent.parent && intersection.object.parent.parent.name == 'button') ? intersection.object.parent.parent : intersection.object;

        // Exit if in mobile-ar
        if ( controller.userData.targetRayMode === 'screen' ) return;

        ray.scale.z = intersection.distance;

        if (object.name == 'floor') {
            // controller.intersection = intersection.point;
            controller.intersection = intersection.point.clone();
            controller.intersection.z += z_shift;

            currentMarker.position.copy( controller.intersection );
            // currentMarker.position.y += 0.01;
            // Dynamic elevation offset so reticle snaps above hit floor plane Y
            currentMarker.position.y = intersection.point.y + 0.01;
            currentMarker.visible = true;

            ray.material.color.set( 0xffffff );
        }
        else if (object.parent.name == 'hotspotModelsGroup' || object.name == 'button') {
            object.material.emissive.b = 1;
            object.material.emissiveIntensity = 3;
            object.material.opacity = 1;
            object.material.needsUpdate = true;

            controller.userData.hovered.push(object);

            controller.intersected.push( object );
            currentMarker.visible = false;
            ray.material.color.set( 0x00ffff );
            if (object.userData.tooltip) controller.add( object.userData.tooltip);
        }
        else {
            currentMarker.visible = false;
            ray.material.color.set( 0xFF4517 );
        }
    } else {
        ray.material.color.set( 0xFF4517 );
        ray.scale.z = 15;
    }
}

function cleanIntersected( controller ) {
    while ( controller.intersected.length ) {
        const object = controller.intersected.pop();
        object.material.emissive.b = 0
    }
}

// ---- COSES DELS UI BUTTONS --- //
function cleanIntersectedUI() {
    while (intersected.length) {
        const obj = intersected.pop();
        if (obj.isUI) obj.setState('idle');
    }
}

// ---- COSES DELS UI BUTTONS --- //
function createMeshUI(content = 'Some text to be displayed', position = { x: 0, y: 0, z: 0 }) {
  const containerUI = new ThreeMeshUI.Block({
    width: 1.2,
    height: 0.8,
    padding: 0.1,
    borderRadius: 0.02,
    fontSize: 0.055,
    justifyContent: 'center',
    fontFamily: './fonts/Roboto-msdf.json',
    fontTexture: './fonts/Roboto-msdf.png',
    margin: 0.05
  });

  const text = new ThreeMeshUI.Text({
    content: content
  });

  containerUI.add(text);

  camera.add(containerUI);

  containerUI.position.set(position.x, position.y, position.z);
  containerUI.rotation.set(0, 0, 0);

  return containerUI;
}

// ---- COSES DELS UI BUTTONS --- //
function showMesh(index) {
    if (!meshes || meshes.length === 0) return;
    if (index < 0 || index >= meshes.length) return;

    meshes.forEach((m, i) => m.visible = (i === index));
    currentMesh = index;

    if (!window.closeButton) return;

    const panel = meshes[currentMesh];
    if (!panel) return;

    // Show the close button only if panel wants it AND user hasn't manually hidden it
    window.closeButton.visible = panel.hasCloseButton && !closeButtonHiddenManually;
}


// ---- COSES DELS UI BUTTONS --- //
function makePanel() {

    // Container block, in which we put the two buttons.
    // We don't define width and height, it will be set automatically from the children's dimensions
    // Note that we set contentDirection: "row-reverse", in order to orient the buttons horizontally

    const container = new ThreeMeshUI.Block( {
        justifyContent: 'center',
        contentDirection: 'row-reverse',
        fontFamily: './fonts/Roboto-msdf.json',
        fontTexture: './fonts/Roboto-msdf.png',
        fontSize: 0.07,
        padding: 0.02,
        borderRadius: 0.11,
        backgroundOpacity: 0
    } );

    container.isUI = true;

    camera.add(container);
    container.position.set(-0.5, 0.35, -2);
    container.rotation.set(0, 0, 0);


    // Important: if camera wasn’t in the scene, add it
    if (!scene.children.includes(camera)) {
        scene.add(camera);
    }


    // BUTTONS

    const buttonOptions = {
        width: 0.3,
        height: 0.15,
        justifyContent: 'center',
        offset: 0.05,
        margin: 0.02,
        borderRadius: 0.075,
        backgroundOpacity: 0.3
    };

    const hoveredStateAttributes = {
        state: 'hovered',
        attributes: {
            offset: 0.035,
            backgroundColor: new THREE.Color( 0x999999 ),
            backgroundOpacity: 1,
            fontColor: new THREE.Color( 0xffffff )
        },
    };

    const idleStateAttributes = {
        state: 'idle',
        attributes: {
            offset: 0.035,
            backgroundColor: new THREE.Color( 0x666666 ),
            backgroundOpacity: 0.3,
            fontColor: new THREE.Color( 0xffffff )
        },
    };

    const buttonClose = new ThreeMeshUI.Block( buttonOptions );
    const buttonHelp = new ThreeMeshUI.Block( buttonOptions );

    const loader = new THREE.TextureLoader();
    const closeTexture = loader.load('close.png'); 
    const infoTexture = loader.load('info.png');   
    const helpTexture = loader.load('help.png');   
    const controllerTexture = loader.load('vr-controller.png');   

    const closeIcon = new THREE.Mesh(
        new THREE.PlaneGeometry(0.1, 0.1), 
        new THREE.MeshBasicMaterial({
            map: closeTexture,
            transparent: true,
            depthWrite: false
        })
    );

    const infoIcon = new THREE.Mesh(
        new THREE.PlaneGeometry(0.1, 0.1),
        new THREE.MeshBasicMaterial({
            map: infoTexture,
            transparent: true,
            depthWrite: false
        })
    );

    const helpIcon = new THREE.Mesh(
        new THREE.PlaneGeometry(0.1, 0.1),
        new THREE.MeshBasicMaterial({
            map: helpTexture,
            transparent: true,
            depthWrite: false
        })
    );

    const controllerIcon = new THREE.Mesh(
        new THREE.PlaneGeometry(0.1, 0.1),
        new THREE.MeshBasicMaterial({
            map: controllerTexture,
            transparent: true,
            depthWrite: false
        })
    );

    buttonClose.add( closeIcon );
    buttonHelp.add( controllerIcon );

    closeIcon.position.z = 0.01;
    infoIcon.position.z = 0.01;
    helpIcon.position.z = 0.01;
    controllerIcon.position.z = 0.01;

    const selectedAttributes = {
        offset: 0.02,
        backgroundColor: new THREE.Color( 0x777777 ),
        fontColor: new THREE.Color( 0x222222 )
    };

    buttonClose.setupState( {
        state: 'selected',
        attributes: selectedAttributes,

        onSet: () => {
        // hide current panel
            if (meshes[currentMesh]) meshes[currentMesh].visible = false;

            if (window.closeButton) {
                window.closeButton.visible = false;
            }
            buttonHelp.remove(controllerIcon);
            buttonHelp.remove(infoIcon);
            buttonHelp.add( helpIcon );

            // mark that user manually hid the close button
            closeButtonHiddenManually = true;
        }
    });

    buttonClose.setupState(hoveredStateAttributes);
    buttonClose.setupState(idleStateAttributes);
    buttonClose.isUI = true;
    buttonClose.name = "closeButton";
    window.closeButton = buttonClose; // global reference

    buttonHelp.setupState( {
        state: 'selected',
        attributes: selectedAttributes,
        onSet: () => {
            // increment currentMesh safely
            if (meshes.length === 0) return;
            currentMesh = ( currentMesh + 1 ) % meshes.length;

            showMesh( currentMesh );

            // ALWAYS show close button when clicking next
            if (window.closeButton) window.closeButton.visible = true;

            if(currentMesh === 0){
                buttonHelp.remove(infoIcon);
                buttonHelp.remove(helpIcon);
                buttonHelp.add( controllerIcon );
            } else {
                buttonHelp.remove(helpIcon);
                buttonHelp.remove(controllerIcon);
                buttonHelp.add( infoIcon );
            }


        }
    } );
    buttonHelp.setupState( hoveredStateAttributes );
    buttonHelp.setupState( idleStateAttributes );
    buttonHelp.isUI = true;

    //

    container.add( buttonClose, buttonHelp );
    objsToTest.push( buttonClose, buttonHelp );

}

// ---- COSES DELS UI BUTTONS --- //
function getUIBlock(object, state) {
    let current = object;
    while (current) {
        if (current.isUI) return current; // this is your Block (buttonNext / buttonPrevious)
        current = current.parent;
    }
    return null;
}

function createAudioHotspot({
    listener,
    id,
    type = 'floor_hotspot',
    parentFloor = null,
    audioPath,
    position,
    description,
    volume = 0.8,
    color = 0x95F2D9,
    opacity = 0.6,
    plyPath = null,
    rotation = null
}) {
    const audio = new THREE.Audio(listener);
    const audioLoader = new THREE.AudioLoader();
    const idleColor = (type === 'wall') ? COLOR_WALL_IDLE : COLOR_FLOOR_IDLE;

    const hotspot = new THREE.Mesh(); // Container mesh

    // Differentiate geometry/material based on plyPath or hotspot type
    if (plyPath) {
        // --- CUSTOM PLY MESH (e.g. arrow.ply) ---
        const plyLoader = new PLYLoader();
        plyLoader.load(plyPath, (geometry) => {
            geometry.center();
            geometry.computeVertexNormals();
            geometry.scale(0.5, 0.5, 0.5);

            hotspot.geometry = geometry;
            hotspot.material = new THREE.MeshStandardMaterial({
                color: 0x00ffff,
                emissive: 0x004444,
                emissiveIntensity: 0.5,
                side: THREE.DoubleSide
            });

            if (rotation) {
                hotspot.rotation.set(rotation.x, rotation.y, rotation.z);
            }
        });
    } else if (type === 'wall') {
        // --- WALL HOTSPOT SPHERE ---
        hotspot.geometry = new THREE.SphereGeometry(0.1, 16, 16);
        hotspot.material = new THREE.MeshPhongMaterial({
            color: 0xffa500,
            emissive: 0xff8c00,
            emissiveIntensity: 0.6
        });
    } else {
        // // --- FLOOR HOTSPOT CYLINDER ---
        // hotspot.geometry = new THREE.CylinderGeometry(0.7, 0.7, 0.05, 18);
        // hotspot.material = new THREE.MeshPhongMaterial({
        //     color,
        //     transparent: true,
        //     opacity
        // });

        // // --- FLOOR HOTSPOT DOUBLE RING ---
        // hotspot.geometry = new THREE.RingGeometry(0.0, 0.42, 32).rotateX(-Math.PI / 2);
        // hotspot.material = new THREE.MeshPhongMaterial({
        //     color: 0x00ffff,
        //     emissive: color,
        //     emissiveIntensity: 2.0,
        //     transparent: true,
        //     opacity: 1.0,
        //     side: THREE.DoubleSide,
        //     depthWrite: false
        // });
        
        // // const outerAccentRing = new THREE.Mesh(
        // //     new THREE.RingGeometry(0.5, 0.56, 32).rotateX(-Math.PI / 2),
        // //     new THREE.MeshBasicMaterial({
        // //         color: 0x00ffff,
        // //         transparent: true,
        // //         opacity: 1.0,
        // //         side: THREE.DoubleSide,
        // //         depthWrite: false
        // //     })
        // // );
        
        // // hotspot.add(outerAccentRing);
        // // Create a 12-segment dashed outer accent ring
        // const segmentedGroup = new THREE.Group();
        // const totalSegments = 12;
        // const segmentArc = (Math.PI * 2) / totalSegments;

        // for (let i = 0; i < totalSegments; i++) {
        //     // Render alternating arcs (leaving gaps between dashes)
        //     if (i % 2 === 0) continue; 
            
        //     const dashGeom = new THREE.RingGeometry(
        //         0.5, 0.56, 8, 1, 
        //         i * segmentArc, 
        //         segmentArc * 0.7
        //     ).rotateX(-Math.PI / 2);
            
        //     const dashMesh = new THREE.Mesh(
        //         dashGeom,
        //         new THREE.MeshBasicMaterial({
        //             color: color,
        //             transparent: true,
        //             opacity: 0.9,
        //             blending: THREE.AdditiveBlending,
        //             side: THREE.DoubleSide,
        //             depthWrite: false
        //         })
        //     );
        //     segmentedGroup.add(dashMesh);
        // }

        // hotspot.add(segmentedGroup);
        
        // --- 1. BASE FLOOR HOTSPOT DISC ---
        hotspot.geometry = new THREE.RingGeometry(0.0, 0.42, 32).rotateX(-Math.PI / 2);
        hotspot.material = new THREE.MeshPhongMaterial({
            color: 0x00ffff,
            emissive: color,
            emissiveIntensity: 2.0,
            transparent: true,
            opacity: 1.0,
            side: THREE.DoubleSide,
            depthWrite: false
        });

        // --- 3. VERY SOFT VOLUMETRIC VERTICAL LIGHT BEAM ---
        const beamGeo = new THREE.CylinderGeometry(0.35, 0.4, 1.0, 20, 1, true);
        beamGeo.translate(0, 0.5, 0);
        // Unique phase seed so each hotspot flows out-of-sync from the others
        const uniqueSeed = Math.random() * 100.0;

        const softBeamMat = new THREE.ShaderMaterial({
            uniforms: {
                uColor: { value: new THREE.Color(color) },
                uTime: floorSweepUniforms.uTime,
                uPhase: { value: uniqueSeed }
            },
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            side: THREE.DoubleSide,
            vertexShader: `
                varying vec2 vUv;
                varying vec3 vNormal;
                varying vec3 vViewPosition;

                void main() {
                    vUv = uv;
                    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                    vViewPosition = -mvPosition.xyz;
                    vNormal = normalMatrix * normal;
                    gl_Position = projectionMatrix * mvPosition;
                }
            `,
            fragmentShader: `
                uniform vec3 uColor;
                uniform float uTime;
                uniform float uPhase;
                varying vec2 vUv;
                varying vec3 vNormal;
                varying vec3 vViewPosition;

                void main() {
                    // 1. Upward rising plasma streams (different speeds & frequencies)
                    float stream1 = sin(vUv.y * 10.0 - uTime * 4.8 + uPhase);
                    float stream2 = cos(vUv.y * 18.0 - uTime * 4.2 + uPhase * 1.7);
                    
                    // 2. Swirling spiral wrap around the cylinder
                    float swirl = sin(vUv.x * 12.56 + vUv.y * 6.0 - uTime * 1.8 + uPhase);
                    
                    // Combine layers into an animated fluid plasma intensity (0.0 to 1.0)
                    float flowPattern = (stream1 * 0.4 + stream2 * 0.35 + swirl * 0.25) * 0.5 + 0.5;

                    // 3. Exponential vertical dissolve into thin air
                    float verticalFade = pow(1.0 - vUv.y, 2.8);

                    // 4. Soft volumetric edge (Fresnel outer shell)
                    vec3 normal = normalize(vNormal);
                    vec3 viewDir = normalize(vViewPosition);
                    float rim = pow(1.0 - abs(dot(normal, viewDir)), 1.5);

                    // Modulate opacity and color brightness with the upward flow
                    float alpha = verticalFade * rim * (0.2 + flowPattern * 0.8) * 0.4;
                    vec3 finalColor = uColor * (0.8 + flowPattern * 0.6);

                    gl_FragColor = vec4(finalColor, alpha);
                }
            `
        });

        const lightBeam = new THREE.Mesh(beamGeo, softBeamMat);

        // Disable raycasting on light beam
        lightBeam.raycast = () => {}; 

        hotspot.add(lightBeam);
        
    }

    hotspot.name = id;
    hotspot.position.set(position.x, position.y, position.z);

    // Attach metadata to userData
    hotspot.userData = {
        id,
        type,
        parentFloor,
        description,
        audio,
        audioLoaded: false,
        played: false,
        idleColor,
        baseY: position.y
    };

    // Wall pins are invisible until their floor hotspot is activated
    if (type === 'wall') {
        hotspot.visible = false;
    }

    // Create Tooltip
    hotspot.userData.tooltip = createTextMesh(
        description,
        0.03,
        { x: -Math.PI / 6, y: 0, z: 0 },
        { x: 0, y: 0.1, z: -0.25 },
        0x000000
    );
    hotspot.userData.tooltip.name = 'tooltip';

    hotspot.add(audio);
    hotspotModelsGroup.add(hotspot);

    // Load Audio (if specified)
    if (audioPath) {
        audioLoader.load(
            audioPath,
            function (buffer) {
                audio.setBuffer(buffer);
                audio.setVolume(volume);
                hotspot.userData.audioLoaded = true;
            },
            undefined,
            function (error) {
                console.error(`${id}: Error loading audio`, error);
            }
        );
    }

    return hotspot;
}

async function loadHotspotsFromJSON() {
    const modelIndexMap = {
        'pedret_IX': 0,
        'pedret_X': 1,
        'pedret_XI': 2,
        'pedret_XII': 3,
        'pedret_XIII': 4,
        'pedret_XXI': 5
    };

    try {
        const response = await fetch('/hotspots.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();

        data.forEach(config => {
            const hotspot = createAudioHotspot({
                listener,
                id: config.id,
                type: config.type,
                parentFloor: config.parentFloor || null,
                audioPath: config.audioPath,
                position: config.position,
                description: config.description,
                plyPath: config.plyPath || null,
                rotation: config.rotation || null
            });

            if (config.requiredModel) {
                hotspot.userData.requiredModelIndex = modelIndexMap[config.requiredModel];
            }
            hotspot.userData.requiredView = config.requiredView || 'inside';
        });

        updateConditionalHotspots();
    } catch (error) {
        console.error('Error loading hotspots JSON:', error);
    }
}

async function startIntroAudio() {
    if (!introAudio || !introAudio.buffer || introStarted) return;

    try {
        await listener.context.resume();

        //console.log('Audio context state:', listener.context.state);

        if (listener.context.state === 'running') {
            introAudio.play();
            introStarted = true;
            //console.log('Intro audio is playing');
        }
    } catch (error) {
        console.error('Could not start intro audio:', error);
    }
}

function createCollisionWall(width, height, posX, posY, posZ, rotY = 0, rotX = 0, debug = true, validModels = null) {
    const wall = new THREE.Mesh(
        new THREE.PlaneGeometry(width, height),
        new THREE.MeshBasicMaterial({
            color: 0xff0055,
            wireframe: true,
            transparent: true,
            opacity: 0.6,
            side: THREE.FrontSide,
            visible: debug
        })
    );
    wall.name = 'collision_wall';
    wall.position.set(posX, posY, posZ);
    wall.rotation.y = rotY;
    wall.rotation.x = rotX;
    
    // Store metadata for stage filtering
    wall.userData.debug = debug;
    wall.userData.validModels = validModels; 
    return wall;
}

function updateCollisionWallVisibility(stageIndex = currentTargetChurchIndex) {
    [primaryModelsGroup, secondaryModelsGroup].forEach(group => {
        if (!group) return;
        group.traverse((child) => {
            if (child.isMesh && child.name === 'collision_wall') {
                const valid = child.userData.validModels;
                const isActive = !valid || (Array.isArray(valid) && valid.includes(stageIndex));
                
                child.visible = Boolean(child.userData.debug) && isActive;
            }
        });
    });
}

async function loadCollisionWallsFromJSON() {
    try {
        const response = await fetch('/collisionWalls.json');
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();

        const activeStage = currentTargetChurchIndex;

        data.forEach(config => {
            const valid = config.validModels || null;
            const isActive = !valid || (Array.isArray(valid) && valid.includes(activeStage));
            const debugMode = config.debug !== undefined ? config.debug : true;

            const wall = createCollisionWall(
                config.width,
                config.height,
                config.position.x,
                config.position.y,
                config.position.z,
                config.rotation?.y || 0,
                config.rotation?.x || 0,
                debugMode,
                valid
            );
            
            // Add wall to primaryModelsGroup if targetGroup is "primary", otherwise secondaryModelsGroup
            if (config.targetGroup === 'primary') {
                primaryModelsGroup.add(wall);
            } else {
                secondaryModelsGroup.add(wall);
            }
        });
        // Filter wall visibility immediately for the active church stage
        updateCollisionWallVisibility(currentTargetChurchIndex);
    } catch (error) {
        console.error('Error loading collision walls JSON:', error);
    }
}

function resolveWallCollisions() {
    const isInside = scene.children.includes(secondaryModelsGroup);
    const activeGroup = isInside ? secondaryModelsGroup : primaryModelsGroup;
    if (!activeGroup) return;

    const headWorldPos = new THREE.Vector3();
    camera.getWorldPosition(headWorldPos);

    const activeStage = currentTargetChurchIndex;
    const rayTargets = [];

    activeGroup.traverse((child) => {
        if (child.isMesh && child.name === 'collision_wall') {
            const valid = child.userData.validModels;
            const isActive = !valid || (Array.isArray(valid) && valid.includes(activeStage));

            // Hide wall if it isn't active for the current stage
            child.visible = Boolean(child.userData.debug) && isActive;

            if (isActive) {
                rayTargets.push(child);
            }
        }
    });

    if (rayTargets.length === 0) return;

    const checkDirections = [
        new THREE.Vector3(1, 0, 0),
        new THREE.Vector3(-1, 0, 0),
        new THREE.Vector3(0, 0, 1),
        new THREE.Vector3(0, 0, -1),
        new THREE.Vector3(0, 1, 0),
        new THREE.Vector3(0, -1, 0)
    ];

    let positionChanged = false;

    for (const dir of checkDirections) {
        collisionRaycaster.set(headWorldPos, dir);
        collisionRaycaster.far = COLLISION_BUFFER;

        const hits = collisionRaycaster.intersectObjects(rayTargets, true);
        if (hits.length === 0) continue;

        const hit = hits[0];
        if (!hit.face) continue;

        const worldNormal = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);

        if (worldNormal.dot(dir) < -0.2) {
            const penetration = COLLISION_BUFFER - hit.distance;

            if (penetration > 0) {
                xrPosition.x += -worldNormal.x * penetration;
                xrPosition.z += -worldNormal.z * penetration;

                if (Math.abs(worldNormal.y) > 0.3) {
                    xrPosition.y += -worldNormal.y * penetration;
                }

                positionChanged = true;
            }
        }
    }

    if (positionChanged) {
        teleport(xrPosition, true);
    }
}

// ---- COSES DELS UI BUTTONS --- //
function loop() {

    controls.update();

    animate();
}

function animate() {
    delta = clock.getDelta();
    controls.update(delta);

    // Accumulate time safely without calling clock.getElapsedTime() 
    // (which can interfere with clock.getDelta())
    if (window.hotspotTime === undefined) window.hotspotTime = 0;
    window.hotspotTime += delta;

    // Update diagonal floor sweep time
    floorSweepUniforms.uTime.value = window.hotspotTime;

    // =========================================================
    // CRASH-PROOF HOTSPOT ANIMATION LOOP
    // =========================================================
    if (hotspotModelsGroup) {
        hotspotModelsGroup.traverse((object) => {
            // 1. Skip non-mesh children (e.g. THREE.Audio, THREE.Group)
            if (!object.isMesh) return;

            // 2. Check if this mesh is currently playing audio
            if (object.userData && object.userData.audio && object.userData.audio.isPlaying) {
                
                // Continuous rotation
                object.rotation.y += delta * 1.0;

                // Shrink wall hotspots to 60% size while being listened to
                if (object.userData.type === 'wall') {
                    const smallPulse = 0.55 + Math.sin(window.hotspotTime * 4.0) * 0.05;
                    object.scale.set(smallPulse, smallPulse, smallPulse);
                }

                // Optional glowing intensity (safely guarded)
                if (object.material && object.material.emissiveIntensity !== undefined) {
                    object.material.emissiveIntensity = 0.3 + Math.sin(window.hotspotTime * 1.0) * 0.15;
                }

            } else if (object.userData && object.userData.type) {
                
                // REST STATE: Reset scale and emissive intensity when idle
                object.scale.set(1.0, 1.0, 1.0);
                if (object.material && object.material.emissiveIntensity !== undefined) {
                    object.material.emissiveIntensity = 0.3;
                }
            }
        });
    }

    // --- INSERT ANIMATED RING LOGIC HERE ---
    if (churchPlaceholder) {
        const ring = churchPlaceholder.getObjectByName('placeholder_ring');
        if (ring) {
            ring.rotation.z += delta * 1.0; // Rotates loading ring on ground
        }
        const baseSkyHeight = 8.0; // Height in the sky
        churchPlaceholder.position.y = baseSkyHeight + Math.sin(window.hotspotTime * 1.5) * 0.4;
    }
    // ----------------------------------------

    if ( renderer.xr.isPresenting ) {
        checkXRButtons( controller1 );
        checkXRButtons( controller2 );
    }

    ThreeMeshUI.update();

    render();
}

function render() {

    cleanIntersectedUI();

    if (controller1.userData.selected) {
        cleanIntersected( controller1 );
        intersectObjects( controller1 );
    }
    if (controller2.userData.selected) {
        cleanIntersected( controller2 );
        intersectObjects( controller2 );
    }

    renderer.render( scene, camera );
}