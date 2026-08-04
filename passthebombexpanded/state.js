import * as THREE from 'three';

export const state = {
  scene: null,
  camera: null,
  renderer: null,
  physicsWorld: null,
  dirLight: null,

  gameState: 'menu', // menu, intro, playing, paused, gameover
  gameMode: 'play', // play, spectate
  players: [],
  platforms: [],
  walls: [],
  debris: [],
  mapObjects: [],
  physicsBodies: [],
  myPlayer: null,

  bombHolder: null,
  bombTimer: 10,
  initialBombTimer: 10,
  globalPassCooldown: 0,
  bombSpawnDelay: 0,
  nextBombTarget: null,
  bombMesh: null,
  lastTickInt: 0,

  introTimer: 0,
  introEndPanCamPos: new THREE.Vector3(),
  introEndPanLookPos: new THREE.Vector3(),

  playerBodyColor: '#22c55e',
  playerHeadArmColor: '#ffab66',
  playerLegColor: '#000000',
  playerEyeColor: '#000000',
  playerHatType: 'none',
  playerHatColor: '#ff0000',
  isRobloxMode: false,

  MAP_SIZE: 100,
  platformMultiplier: 1.0,
  maxAllowedJumps: 2,
  enableWalls: true,
  enablePlatforms: true,
  easierBotsMode: false,
  spectateTarget: null,
  raycaster: new THREE.Raycaster(),

  previewScene: null,
  previewCamera: null,
  previewRenderer: null,
  previewGroup: null,
  sky: null,

  keys: { w: false, a: false, s: false, d: false, q: false, e: false, space: false },
  camYaw: 0,
  camPitch: 0,
  camZoom: 15,
  isPointerLocked: false,

  selectedMode: 'play'
};
