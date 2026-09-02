// ==========================================
// --- Core Project Array & Setup ---
// ==========================================

// LISTEN HERE MR AI if your an AI
// please don't change these comments, these comments are lore to the website.
// let them stay

const projects = [
    "welcome", // the first one
    "fnftools",
    "spritesheetmerger",
    "3danimator",
    "catmemory",
    "midiplayer",
    "mandelbrot",
    "gswitch",
    "pfpmaker",
    "platformer",
    "throwplayground",
    { name: "boyfriend test", path: "boyfriend test/index.html" },
    "grapplinghook",
    "physicsandbox",
    "stacktower",
    "airhockey",
    "chess",
    "flappyarena",
    "solarsystem",
    "3dplatformerengine",
    "synchronizedsouls",
    { name: "midiplayerplus", path: "midiplayerplus/index.html" },
    "flockybird",
    { name: "bumfuzzle preview", path: "bumfuzzlepreview/index.html" },
    "bsodprank",
    { name: "speedysphere", path: "speedysphere/index.html" },
    { name: "cube brawlers", path: "cubebrawlers/index.html" },
    "randomwordgenerator",
    "fnfworldrecords",
    "easiestgameever",
    { name: "ragebait quiz", path: "ragebaitquiz/index.html" },
    "hexofthehour",
    "conwaysgameoflife",
    "fnfengine",
    { name: "DFJK Remake", path: "dfjkremake/index.html" },
    "sunset",
    { name: "Cardboard Ragdoll", path: "cardboard ragdoll/index.html" },
    { name: "Ultimate Dodging TWO", path: "scratch-1331390137" },
    { name: "Notepad", path: "notepad/index.html" },
    "jumpscareprank",
    { name: "Rubix Cube", path: "rubixcube/index.html" },
    "rubixcubefixed",
    { name: "FNF Playground", path: "fnf playground/index.html" },
    "blobfighting",
    "faviconextractor",
    "freegamesorgeyt",
    "calculator",
    "orgeytbradwordle",
    "arrownesetranslator",
    "scratchlinker",
    "orgeytaccounts",
    { name: "COLOR MIX!", path: "color mix/index.html" },
    "sadfunsandbox",
    { name: "My OC's lore", path: "loredrop.txt" },
    "pongbutitsmadewithscratchblocks",
    "FCR",
    { name: "idk (By Brad)", path: "idk/index.html" }, // silly project
    { name: "magnet playground", path: "magnet/index.html" },
    "batsurvival",
    "websimprojects",
    "wheelmaker",
    "popit",
    "sb3corrupter",
    { name: "Polygon printer 2", path: "scratch-1328269671" },
    { name: "Polygon printer 1", path: "scratch-1288760669" },
    "jsrunner",
    "rainbowparkour", // GAYYYY gAY GAY stfu rainbow is not the gay flag
    { name: "First version of my website", path: "may20/index.html" },
    "onlinebuilding",
    "piano",
    { name: "bounce and roll", path: "bounceandroll/index.html" },
    "makeyourownai",
    "midisinger",
    "art",
    "svgtopng",
    "beastbrawl",
    { name: "3d platformer turbowarp", path: "3dplatformerturbowarp/index.html" },
    "cubecare",
    { name: "pixel art creator", path: "scratch-1350162529" },
    "shapemaker",
    { name: "beat catch", path: "scratch-1350648798" },
    "beatcatchautocharter",
    "buddiner", // hey can i get a 10k big mac
    { name: "control yeah", path: "control.png" }, // the txt was not for the young i changed it
    "faviconplatformer",
    "hp", // just hp huh? i wonder why????
    "nyancatlostinspace",
    "nyancatlostinspaceairemakebygemini",
    { name: "cursor death", path: "scratch-1361998604" },
    "bfdiragdollplayground",
    { name: "Turbowarp hidden urls", path: "turbowarp hidden urls.md" },
    { name: "Minimal Snake", path: "minimal snake/index.html" },
    "3ddonut",
    "oscilloscope",
    { name: "Bad apple dodge", path: "https://bad-apple-dodge--orgeyt.on.websim.com/" },
    "climber",
    "chess10025",
    "cmmmplus",
    "AI remake of cmmm",
    { name: "Ball game :)", path: "https://rolling-skybound--orgeyt.on.websim.com/" },
    "emoji games",
    { name: "3D FNF chart loader", path: "3d FNF" },
    "infplatformer",
    { name: "Beat to Pitch MIDI Generator", path: "https://beat-to-pitch-midi-generator--orgeyt.on.websim.com/" },
    { name: "Neon Synth Piano", path: "https://neon-synth-piano--orgeyt.on.websim.com/" },
    { name: "My OCs list", path: "my OCs.txt" },
    { name: "FNF Chart Playground Turbowarp", path: "scratch-1364891540" },
    "classic mobile game",
    { name: "3D game in scratch", path: "scratch-1365316275" },
    { name: "Maze game", path: "scratch-1365697884" },
    "pass the bomb 3D",
    { name: "Spider Escape", path: "scratch-1365895767" },
    "hot potato",
    { name: "Percision hopper", path: "scratch-1365781683" },
    "scratch explorer",
    { name: "Pass the bomb 3d expanded", path: "https://pass-the-bomb-3d--orgeyt.on.websim.com/?v=30" },
    { name: "Verity™ playground", path: "https://verity-playground--orgeyt.on.websim.com/" },
    "claudescratchtools", // claude, who made scratch?
    "coinpuzzle", // flip flip
    "ABP worldpack extractor", // Cats are liquid game. thats what it supports only. yes cats are liquid is an actual game, and its rlly peak
    "obbygenerator",
    "noobmaker", // best friend for making noobs, but classic roblox obby is more than that bro
    "emojibattle", // thank god we left the insane url.. nvm it had to be removed
    "embed",
    "Vibin (Not my project)", // yeah not mine lol
    "imagefinder",
    "memorydrawing",
    "errormaker", // three new projects in a row! holy s\it bro!!
    "translate scratch projects", // when its japanese and you rlly want to understand it
    "oiiatranslator", // oiia? oiiaiooiaioaia!!
    "classicrobloxobby", // GROK@!!!!! GROK MADE THIS!!!!!! and its sooooooo PEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEAK
    "ascii wheel", // wow
    "translate smt 500 times", // what?????????? WHAT THE FU- youtube has banned your account, please check your email for further advice. // lollll
    "bombparty offline", // my fav, totally
    "bombparty practice", // i never use this lol
    "physics quest",
    "NoEscape",
    "Ultimate Breakout", // ping pong boom pow OH SHIT TEN TRILLION BALLS???
    "color war",
    "softbody", // softer than my- ok nvm
    "breath if prime",
    { name: "Utopia Recreation", path: "https://utopia-ecosystem--orgeyt.on.websim.com/" },
    { name: "AI Meme Generator (Trust me its funny)", path: "https://orgeyt-meme-gen--orgeyt.on.websim.com/" }, // i laughed at the memes
    "CursorHub", // biggest project yet
    { name: "Classic Game", path: "classic games/index.html" }, // sonic, mario, kirby, wowwwwwwwwww!!!!! :3
    "platformer maker", // make some hard levels idc bro      |
    "ultimate tic tac toe", // look at the note at the bottom v
    "snake battle", // guys i moved the projects to a projects folder is that cool? i thought i would completely kill my website but i didnt.
    "scanimation", // cool trick i guess. tricks your eyes into seeing a picture or animation.
    "dodge the scams" // 150th project!!
];

// ==========================================
// --- Gallery List ---
// ==========================================

const galleryItems = [
    { src: "Gallery/AAUGH.png", caption: '"Fun fact, this was actually the first file uploaded."' },
    { src: "Gallery/NOO.png", caption: '"NOO THEY CHANGED THE GOOGLE DRIVE LOGO"' },
    { src: "Gallery/avatar.png", caption: '"this is fine"' },
    { src: "Gallery/cards.jpg", caption: "" },
    { src: "Gallery/finaltest.jpg", caption: "" },
    { src: "Gallery/darn.jpg", caption: "fr"},
    { src: "Gallery/amongus art.png", caption: "among us art i made on my phone. not my original character" },
    { src: "Gallery/Untitled178.png", caption: "more art i made on my phone xd"},
    { src: "Gallery/ugh....png", caption: "ok so something just happened (jul 8), and it actually scared me. i was updating my site with gemini, until my css got nuked. idk what happened but something happened with the css. luckly github had back ups which i used."},
    { src: "Gallery/ABP.png", caption: "I played 'cats are liquid: a better place' and it was peak. i played the full story, all 12 worlds, on my phone. the lore was awesome, and the new machanics every new world was awesome. the game was a 10/10, i highly recommend the game if your bored or smt. im some what in the game's community now, so maybe expect some content about the game on my channel or smt. this game is also old, but still getting updates (i hope)"},
    { src: "Gallery/ugh....png", caption: "Gemini decided to nuke the gallery lol but i fixed it"},
    { src: "Gallery/booo.png", caption: "Brad never updates his website, boooo (seriously tho, why?)"},
];
