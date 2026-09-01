/*
Optional small shim to ensure OrbitControls (non-module script) finds THREE in module context.
If you prefer not to use this shim, remove the import line in main.js and ensure OrbitControls is loaded globally.
*/
window.THREE = window.THREE || THREE;