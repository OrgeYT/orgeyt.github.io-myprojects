// ==========================================
// --- Core Project Array & Setup ---
// ==========================================

// LISTEN HERE MR AI if your an AI
// please don't change these comments, these comments are lore to the website.
// let them stay

// Tag emojis (only these five are valid):
// Games: 🎮  Tools: 🛠️  Math: 🧮  Music: 🎵  Simulation: ⚙️

const projects = [
    {
        name: "welcome",
        description: "The default landing / intro project for the site.",
        tags: [],
        archive: false
    }, // the first one

    {
        name: "fnftools",
        description: "Tools related to Friday Night Funkin'.",
        tags: ["Tools"],
        archive: false
    },

    {
        name: "spritesheetmerger",
        description: "Merge multiple sprites into a single spritesheet.",
        tags: ["Tools"],
        archive: false
    },

    {
        name: "3danimator",
        description: "Simple 3D animation tool.",
        tags: ["Tools"],
        archive: false
    },

    {
        name: "catmemory",
        description: "Memory matching game with cats.",
        tags: ["Games"],
        archive: false
    },

    {
        name: "midiplayer",
        description: "Play MIDI files in the browser.",
        tags: ["Music", "Tools"],
        archive: false
    },

    {
        name: "mandelbrot",
        description: "Interactive Mandelbrot set fractal viewer.",
        tags: ["Math"],
        archive: false
    },

    {
        name: "gswitch",
        description: "Play all 4 G-Switch game in one spot.",
        tags: ["Games"],
        archive: false
    },

    {
        name: "pfpmaker",
        description: "Profile picture maker / editor.",
        tags: ["Tools"],
        archive: false
    },

    {
        name: "platformer",
        description: "Basic platformer game.",
        tags: ["Games"],
        archive: false
    },

    {
        name: "throwplayground",
        description: "Physics playground for throwing objects.",
        tags: ["Simulation", "Games"],
        archive: false
    },

    {
        name: "boyfriend test",
        path: "boyfriend test/index.html",
        description: "Test / playground involving Boyfriend (FNF).",
        tags: ["Games"],
        archive: false
    },

    {
        name: "grapplinghook",
        description: "Grappling hook physics game or demo.",
        tags: ["Games"],
        archive: false
    },

    {
        name: "physicsandbox",
        description: "Open physics sandbox.",
        tags: ["Simulation"],
        archive: false
    },

    {
        name: "stacktower",
        description: "Stack blocks to build a tower.",
        tags: ["Games"],
        archive: false
    },

    {
        name: "airhockey",
        description: "Air hockey game.",
        tags: ["Games"],
        archive: false
    },

    {
        name: "chess",
        description: "Chess game.",
        tags: ["Games"],
        archive: false
    },

    {
        name: "flappyarena",
        description: "Flappy Bird style arena game.",
        tags: ["Games"],
        archive: false
    },

    {
        name: "solarsystem",
        description: "Interactive solar system simulation.",
        tags: ["Simulation"],
        archive: false
    },

    {
        name: "3dplatformerengine",
        description: "3D platformer engine / demo.",
        tags: ["Games", "Tools"],
        archive: false
    },

    {
        name: "synchronizedsouls",
        description: "2D platformer where you control more than one character.",
        tags: ["Games"],
        archive: false
    },

    {
        name: "midiplayerplus",
        path: "midiplayerplus/index.html",
        description: "Enhanced MIDI player.",
        tags: ["Music", "Tools"],
        archive: false
    },

    {
        name: "flockybird",
        description: "Flocking / bird simulation inspired by Boids.",
        tags: ["Simulation"],
        archive: false
    },

    {
        name: "bumfuzzle preview",
        path: "bumfuzzlepreview/index.html",
        description: "Preview for the Bumfuzzle project.",
        tags: [],
        archive: false
    },

    {
        name: "bsodprank",
        description: "Fake Blue Screen of Death prank page.",
        tags: [],
        archive: false
    },

    {
        name: "speedysphere",
        path: "speedysphere/index.html",
        description: "Fast-paced sphere / ball game.",
        tags: ["Games"],
        archive: false
    },

    {
        name: "cube brawlers",
        path: "cubebrawlers/index.html",
        description: "Cube-based fighting / brawler game.",
        tags: ["Games"],
        archive: false
    },

    {
        name: "randomwordgenerator",
        description: "Generates random words.",
        tags: ["Tools"],
        archive: false
    },

    {
        name: "fnfworldrecords",
        description: "Friday Night Funkin' world records list or viewer.",
        tags: [],
        archive: false
    },

    {
        name: "easiestgameever",
        description: "Intentionally very easy game.",
        tags: ["Games"],
        archive: false
    },

    {
        name: "ragebait quiz",
        path: "ragebaitquiz/index.html",
        description: "Quiz designed to ragebait the player.",
        tags: ["Games"],
        archive: false
    },

    {
        name: "hexofthehour",
        description: "Hourly hex color challenge or display.",
        tags: ["Tools"],
        archive: false
    },

    {
        name: "conwaysgameoflife",
        description: "Conway's Game of Life cellular automaton.",
        tags: ["Simulation", "Math"],
        archive: false
    },

    {
        name: "fnfengine",
        description: "Friday Night Funkin' engine / player.",
        tags: ["Games", "Tools"],
        archive: false
    },

    {
        name: "DFJK Remake",
        path: "dfjkremake/index.html",
        description: "Remake of a DFJK (FNF key) related project.",
        tags: ["Games"],
        archive: false
    },

    {
        name: "sunset",
        description: "Sunset visual / scene.",
        tags: [],
        archive: false
    },

    {
        name: "Cardboard Ragdoll",
        path: "cardboard ragdoll/index.html",
        description: "Cardboard-style ragdoll physics.",
        tags: ["Simulation"],
        archive: false
    },

    {
        name: "Ultimate Dodging TWO",
        path: "scratch-1331390137",
        description: "Scratch-based dodging game (version 2).",
        tags: ["Games"],
        archive: false
    },

    {
        name: "Notepad",
        path: "notepad/index.html",
        description: "Simple browser notepad.",
        tags: ["Tools"],
        archive: false
    },

    {
        name: "jumpscareprank",
        description: "Jumpscare prank page.",
        tags: [],
        archive: false
    },

    {
        name: "Rubix Cube",
        path: "rubixcube/index.html",
        description: "Interactive Rubik's Cube.",
        tags: ["Games", "Simulation"],
        archive: false
    },

    {
        name: "rubixcubefixed",
        description: "Fixed version of the Rubik's Cube project.",
        tags: ["Games", "Simulation"],
        archive: false
    },

    {
        name: "FNF Playground",
        path: "fnf playground/index.html",
        description: "Playground for Friday Night Funkin' experiments.",
        tags: ["Games"],
        archive: false
    },

    {
        name: "blobfighting",
        description: "Blob character fighting game.",
        tags: ["Games"],
        archive: false
    },

    {
        name: "faviconextractor",
        description: "Extract favicons from websites.",
        tags: ["Tools"],
        archive: false
    },

    {
        name: "freegamesorgeyt",
        description: "Collection or portal of free games by OrgeYT.",
        tags: ["Games"],
        archive: false
    },

    {
        name: "calculator",
        description: "Basic calculator.",
        tags: ["Tools", "Math"],
        archive: false
    },

    {
        name: "orgeytbradwordle",
        description: "Wordle-style game (OrgeYT / Brad variant).",
        tags: ["Games"],
        archive: false
    },

    {
        name: "arrownesetranslator",
        description: "Translator, to Translate English text to Arrownese.",
        tags: ["Tools"],
        archive: false
    },

    {
        name: "scratchlinker",
        description: "Tool for linking or sharing Scratch projects.",
        tags: ["Tools"],
        archive: false
    },

    {
        name: "orgeytaccounts",
        description: "Account-related utility for OrgeYT projects.",
        tags: ["Tools"],
        archive: false
    },

    {
        name: "COLOR MIX!",
        path: "color mix/index.html",
        description: "Color mixing tool or game.",
        tags: ["Tools"],
        archive: false
    },

    {
        name: "sadfunsandbox",
        description: "Rest in peace, Fun Sandbox...",
        tags: [],
        archive: false
    },

    {
        name: "My OC's lore",
        path: "loredrop.txt",
        description: "Lore text for original characters.",
        tags: [],
        archive: false
    },

    {
        name: "pongbutitsmadewithscratchblocks",
        description: "Pong recreated with Scratch blocks style.",
        tags: ["Games"],
        archive: false
    },

    {
        name: "FCR",
        description: "Related to Friend's / RETAKE (FCR) project.",
        tags: [],
        archive: false
    },

    {
        name: "idk (By Brad)",
        path: "idk/index.html",
        description: "Silly project by Brad.",
        tags: [],
        archive: false
    }, // silly project

    {
        name: "magnet playground",
        path: "magnet/index.html",
        description: "Magnet physics playground.",
        tags: ["Simulation"],
        archive: false
    },

    {
        name: "batsurvival",
        description: "Bat survival game.",
        tags: ["Games"],
        archive: false
    },

    {
        name: "websimprojects",
        description: "Collection of WebSim projects.",
        tags: [],
        archive: false
    },

    {
        name: "wheelmaker",
        description: "Create custom spinning wheels.",
        tags: ["Tools"],
        archive: false
    },

    {
        name: "popit",
        description: "Pop-it fidget toy simulator.",
        tags: ["Games"],
        archive: false
    },

    {
        name: "sb3corrupter",
        description: "Corrupt Scratch .sb3 project files.",
        tags: ["Tools"],
        archive: false
    },

    {
        name: "Polygon printer 2",
        path: "scratch-1328269671",
        description: "Scratch polygon printer (version 2).",
        tags: ["Tools"],
        archive: false
    },

    {
        name: "Polygon printer 1",
        path: "scratch-1288760669",
        description: "Scratch polygon printer (version 1).",
        tags: ["Tools"],
        archive: false
    },

    {
        name: "jsrunner",
        description: "Run JavaScript code in the browser.",
        tags: ["Tools"],
        archive: false
    },

    {
        name: "rainbowparkour",
        description: "Rainbow-themed parkour game.",
        tags: ["Games"],
        archive: false
    }, // GAYYYY gAY GAY stfu rainbow is not the gay flag

    {
        name: "First version of my website",
        path: "may20/index.html",
        description: "Archived first version of this website (May 20).",
        tags: [],
        archive: true
    },

    {
        name: "onlinebuilding",
        description: "Online building / construction tool or game.",
        tags: ["Games", "Tools"],
        archive: false
    },

    {
        name: "piano",
        description: "Playable browser piano.",
        tags: ["Music"],
        archive: false
    },

    {
        name: "bounce and roll",
        path: "bounceandroll/index.html",
        description: "Bounce and roll physics game.",
        tags: ["Games"],
        archive: false
    },

    {
        name: "makeyourownai",
        description: "Simple tool to make your own AI.",
        tags: ["Tools"],
        archive: false
    },

    {
        name: "midisinger",
        description: "MIDI-based singing / vocal synth tool.",
        tags: ["Music"],
        archive: false
    },

    {
        name: "art",
        description: "Art-related project or gallery.",
        tags: [],
        archive: false
    },

    {
        name: "svgtopng",
        description: "Convert SVG images to PNG.",
        tags: ["Tools"],
        archive: false
    },

    {
        name: "beastbrawl",
        description: "Beast / creature brawl fighting game.",
        tags: ["Games"],
        archive: false
    },

    {
        name: "3d platformer turbowarp",
        path: "3dplatformerturbowarp/index.html",
        description: "3D platformer running on TurboWarp.",
        tags: ["Games"],
        archive: false
    },

    {
        name: "cubecare",
        description: "Cube care / pet simulation.",
        tags: ["Simulation", "Games"],
        archive: false
    },

    {
        name: "pixel art creator",
        path: "scratch-1350162529",
        description: "Create pixel art (Scratch).",
        tags: ["Tools"],
        archive: false
    },

    {
        name: "shapemaker",
        description: "Create and edit shapes.",
        tags: ["Tools"],
        archive: false
    },

    {
        name: "beat catch",
        path: "scratch-1350648798",
        description: "Catch beats rhythm game (Scratch).",
        tags: ["Games", "Music"],
        archive: false
    },

    {
        name: "beatcatchautocharter",
        description: "Auto-charter for Beat Catch.",
        tags: ["Tools", "Music"],
        archive: false
    },

    {
        name: "buddiner",
        description: "Serve bud customers with the food they want!",
        tags: ["Games", "Simulation"],
        archive: false
    }, // hey can i get a 10k big mac

    {
        name: "control yeah",
        path: "control.png",
        description: "Control-related image / secret.",
        tags: [],
        archive: false
    }, // the txt was not for the young i changed it

    {
        name: "faviconplatformer",
        description: "Platformer that uses favicons as assets.",
        tags: ["Games"],
        archive: false
    },

    {
        name: "hp",
        description: "Create HP Bars in SVG format",
        tags: ["Tools"],
        archive: false
    }, // just hp huh? i wonder why????

    {
        name: "nyancatlostinspace",
        description: "Nyan Cat lost in space game or animation.",
        tags: ["Games"],
        archive: false
    },

    {
        name: "nyancatlostinspaceairemakebygemini",
        description: "AI remake (by Gemini) of Nyan Cat Lost in Space.",
        tags: ["Games"],
        archive: false
    },

    {
        name: "cursor death",
        path: "scratch-1361998604",
        description: "Cursor death Scratch project.",
        tags: ["Games"],
        archive: false
    },

    {
        name: "bfdiragdollplayground",
        description: "Boyfriend (FNF) ragdoll playground.",
        tags: ["Simulation"],
        archive: false
    },

    {
        name: "Turbowarp hidden urls",
        path: "turbowarp hidden urls.md",
        description: "List of hidden TurboWarp URLs.",
        tags: ["Tools"],
        archive: false
    },

    {
        name: "Minimal Snake",
        path: "minimal snake/index.html",
        description: "Minimalist Snake game.",
        tags: ["Games"],
        archive: false
    },

    {
        name: "3ddonut",
        description: "3D rotating donut (ASCII or canvas).",
        tags: ["Math"],
        archive: false
    },

    {
        name: "oscilloscope",
        description: "Audio oscilloscope visualizer.",
        tags: ["Music", "Tools"],
        archive: false
    },

    {
        name: "Bad apple dodge",
        path: "https://bad-apple-dodge--orgeyt.on.websim.com/",
        description: "Dodge game synced to Bad Apple.",
        tags: ["Games"],
        archive: false
    },

    {
        name: "climber",
        description: "Climbing game.",
        tags: ["Games"],
        archive: false
    },

    {
        name: "chess10025",
        description: "Chess variant or large board chess.",
        tags: ["Games"],
        archive: false
    },

    {
        name: "cmmmplus",
        description: "Enhanced version of CMMM project.",
        tags: [],
        archive: false
    },

    {
        name: "AI remake of cmmm",
        description: "AI-generated remake of CMMM.",
        tags: [],
        archive: false
    },

    {
        name: "Ball game :)",
        path: "https://rolling-skybound--orgeyt.on.websim.com/",
        description: "Rolling ball / skybound style game.",
        tags: ["Games"],
        archive: false
    },

    {
        name: "emoji games",
        description: "Collection of emoji-based mini games.",
        tags: ["Games"],
        archive: false
    },

    {
        name: "3D FNF chart loader",
        path: "3d FNF",
        description: "Load and play FNF charts in 3D.",
        tags: ["Games", "Tools"],
        archive: false
    },

    {
        name: "infplatformer",
        description: "Infinite platformer.",
        tags: ["Games"],
        archive: false
    },

    {
        name: "Beat to Pitch MIDI Generator",
        path: "https://beat-to-pitch-midi-generator--orgeyt.on.websim.com/",
        description: "Generate MIDI from beats / pitch.",
        tags: ["Music", "Tools"],
        archive: false
    },

    {
        name: "Neon Synth Piano",
        path: "https://neon-synth-piano--orgeyt.on.websim.com/",
        description: "Neon-styled synth piano.",
        tags: ["Music"],
        archive: false
    },

    {
        name: "My OCs list",
        path: "my OCs.txt",
        description: "List of original characters.",
        tags: [],
        archive: false
    },

    {
        name: "FNF Chart Playground Turbowarp",
        path: "scratch-1364891540",
        description: "FNF chart playground on TurboWarp.",
        tags: ["Games", "Tools"],
        archive: false
    },

    {
        name: "classic mobile game",
        description: "Recreation of a classic mobile game.",
        tags: ["Games"],
        archive: false
    },

    {
        name: "3D game in scratch",
        path: "scratch-1365316275",
        description: "3D game made in Scratch.",
        tags: ["Games"],
        archive: false
    },

    {
        name: "Maze game",
        path: "scratch-1365697884",
        description: "Maze navigation game (Scratch).",
        tags: ["Games"],
        archive: false
    },

    {
        name: "pass the bomb 3D",
        description: "3D pass-the-bomb multiplayer style game.",
        tags: ["Games"],
        archive: false
    },

    {
        name: "Spider Escape",
        path: "scratch-1365895767",
        description: "Escape from spiders game (Scratch).",
        tags: ["Games"],
        archive: false
    },

    {
        name: "hot potato",
        description: "Hot potato passing game.",
        tags: ["Games"],
        archive: false
    },

    {
        name: "Percision hopper",
        path: "scratch-1365781683",
        description: "Precision hopping / jumping game (Scratch).",
        tags: ["Games"],
        archive: false
    },

    {
        name: "scratch explorer",
        description: "Explore Scratch projects or features.",
        tags: ["Tools"],
        archive: false
    },

    {
        name: "Pass the bomb 3d expanded",
        path: "https://pass-the-bomb-3d--orgeyt.on.websim.com/?v=30",
        description: "Expanded 3D pass-the-bomb game.",
        tags: ["Games"],
        archive: false
    },

    {
        name: "Verity™ playground",
        path: "https://verity-playground--orgeyt.on.websim.com/",
        description: "Playground for the Verity project.",
        tags: [],
        archive: false
    },

    {
        name: "claudescratchtools",
        description: "Scratch tools related to Claude.",
        tags: ["Tools"],
        archive: false
    }, // claude, who made scratch?

    {
        name: "coinpuzzle",
        description: "Coin flipping / puzzle game.",
        tags: ["Games"],
        archive: false
    }, // flip flip

    {
        name: "ABP worldpack extractor",
        description: "Extractor for Cats Are Liquid: A Better Place world packs.",
        tags: ["Tools"],
        archive: false
    }, // Cats are liquid game. thats what it supports only. yes cats are liquid is an actual game, and its rlly peak

    {
        name: "obbygenerator",
        description: "Generate Roblox-style obbies.",
        tags: ["Tools"],
        archive: false
    },

    {
        name: "noobmaker",
        description: "Create classic Roblox noob characters.",
        tags: ["Tools"],
        archive: false
    }, // best friend for making noobs, but classic roblox obby is more than that bro

    {
        name: "emojibattle",
        description: "Emoji battle fighting game.",
        tags: ["Games"],
        archive: false
    }, // thank god we left the insane url.. nvm it had to be removed

    {
        name: "embed",
        description: "Embedding tool or demo.",
        tags: ["Tools"],
        archive: false
    },

    {
        name: "Vibin (Not my project)",
        description: "External 'Vibin' project (not by OrgeYT).",
        tags: [],
        archive: false
    }, // yeah not mine lol

    {
        name: "imagefinder",
        description: "Find or search images.",
        tags: ["Tools"],
        archive: false
    },

    {
        name: "memorydrawing",
        description: "Draw from memory challenge.",
        tags: ["Games"],
        archive: false
    },

    {
        name: "errormaker",
        description: "Generate fake error messages.",
        tags: ["Tools"],
        archive: false
    }, // three new projects in a row! holy s\it bro!!

    {
        name: "translate scratch projects",
        description: "Translate Scratch projects (e.g. Japanese).",
        tags: ["Tools"],
        archive: false
    }, // when its japanese and you rlly want to understand it

    {
        name: "oiiatranslator",
        description: "OIAA (spinning cat) sound / meme translator.",
        tags: ["Tools"],
        archive: false
    }, // oiia? oiiaiooiaioaia!!

    {
        name: "classicrobloxobby",
        description: "Classic Roblox obby recreation (made with Grok).",
        tags: ["Games"],
        archive: false
    }, // GROK@!!!!! GROK MADE THIS!!!!!! and its sooooooo PEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEAK

    {
        name: "ascii wheel",
        description: "ASCII art spinning wheel.",
        tags: ["Tools"],
        archive: false
    }, // wow

    {
        name: "translate smt 500 times",
        description: "Translate something repeatedly 500 times for fun/corruption.",
        tags: ["Tools"],
        archive: false
    }, // what?????????? WHAT THE FU- youtube has banned your account, please check your email for further advice. // lollll

    {
        name: "bombparty offline",
        description: "Offline version of Bomb Party word game.",
        tags: ["Games"],
        archive: false
    }, // my fav, totally

    {
        name: "bombparty practice",
        description: "Practice mode for Bomb Party.",
        tags: ["Games"],
        archive: false
    }, // i never use this lol

    {
        name: "physics quest",
        description: "Physics-based quest / adventure.",
        tags: ["Games", "Simulation"],
        archive: false
    },

    {
        name: "NoEscape",
        description: "No-escape style challenge game.",
        tags: ["Games"],
        archive: false
    },

    {
        name: "Ultimate Breakout",
        description: "Breakout / brick breaker with extreme ball counts.",
        tags: ["Games"],
        archive: false
    }, // ping pong boom pow OH SHIT TEN TRILLION BALLS???

    {
        name: "color war",
        description: "Color-based war / territory game.",
        tags: ["Games"],
        archive: false
    },

    {
        name: "softbody",
        description: "Soft-body physics simulation.",
        tags: ["Simulation"],
        archive: false
    }, // softer than my- ok nvm

    {
        name: "breath if prime",
        description: "Breathing / timing game involving prime numbers.",
        tags: ["Games", "Math"],
        archive: false
    },

    {
        name: "Utopia Recreation",
        path: "https://utopia-ecosystem--orgeyt.on.websim.com/",
        description: "Recreation of a Utopia ecosystem simulation.",
        tags: ["Simulation"],
        archive: false
    },

    {
        name: "AI Meme Generator (Trust me its funny)",
        path: "https://orgeyt-meme-gen--orgeyt.on.websim.com/",
        description: "AI-powered meme generator.",
        tags: ["Tools"],
        archive: false
    }, // i laughed at the memes

    {
        name: "CursorHub",
        description: "Cursor toggle / hub utility (major project).",
        tags: ["Tools"],
        archive: false
    }, // biggest project yet

    {
        name: "Classic Game",
        path: "classic games/index.html",
        description: "Classic games collection (Sonic, Mario, Kirby style).",
        tags: ["Games"],
        archive: false
    }, // sonic, mario, kirby, wowwwwwwwwww!!!!! :3

    {
        name: "platformer maker",
        description: "Create your own platformer levels.",
        tags: ["Tools", "Games"],
        archive: false
    }, // make some hard levels idc bro

    {
        name: "ultimate tic tac toe",
        description: "Ultimate (meta) Tic Tac Toe.",
        tags: ["Games"],
        archive: false
    }, // look at the note at the bottom v

    {
        name: "snake battle",
        description: "Multiplayer or competitive Snake battle.",
        tags: ["Games"],
        archive: false
    }, // guys i moved the projects to a projects folder is that cool? i thought i would completely kill my website but i didnt.

    {
        name: "scanimation",
        description: "Scanimation optical illusion / animation tool.",
        tags: ["Tools"],
        archive: false
    }, // cool trick i guess. tricks your eyes into seeing a picture or animation.

    {
        name: "dodge the scams",
        description: "Dodge scam-themed obstacles (150th project).",
        tags: ["Games"],
        archive: false
    }, // 150th project!!

    {
        name: "pixelartcreatorhtml",
        description: "HTML pixel art creator.",
        tags: ["Tools"],
        archive: false
    }, // yeah

    {
        name: "shapestyles",
        description: "Shape styling / CSS shape experiments.",
        tags: ["Tools"],
        archive: false
    },

    {
        name: "dot eater",
        description: "Eat dots, and get bigger! Don't try to eat the bigger dots, they will eat you!",
        tags: ["Games"],
        archive: false
    }
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
    { src: "Gallery/booo.jpeg", caption: "Brad never updates his website, boooo (seriously tho, why?)"},
];

// Helper to get tag emoji string for a project
function getTagEmojis(project) {
    if (!project || !project.tags || !Array.isArray(project.tags) || project.tags.length === 0) return '';
    const map = {
        'Games': '🎮',
        'Tools': '🛠️',
        'Math': '🧮',
        'Music': '🎵',
        'Simulation': '⚙️'
    };
    return project.tags.map(t => map[t] || '').filter(Boolean).join('');
}
