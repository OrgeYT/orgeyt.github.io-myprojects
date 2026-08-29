const GAMES = [
  // NES
  {
    id: "smb",
    title: "Super Mario Bros.",
    system: "nes",
    core: "nes",
    rom: "roms/nes/super-mario-bros.nes",
    thumb: "thumbs/smb.jpg",
    year: 1985,
    hack: false,
    description: "The classic that started it all."
  },
  {
    id: "smb2",
    title: "Super Mario Bros. 2",
    system: "nes",
    core: "nes",
    rom: "roms/nes/super-mario-bros-2.nes",
    thumb: "thumbs/smb2.jpg",
    year: 1988,
    hack: false,
    description: "Pull up vegetables and ride on clouds."
  },
  {
    id: "smb3",
    title: "Super Mario Bros. 3",
    system: "nes",
    core: "nes",
    rom: "roms/nes/super-mario-bros-3.nes",
    thumb: "thumbs/smb3.jpg",
    year: 1988,
    hack: false,
    description: "Tanooki suits, flying, and world maps."
  },
  {
    id: "kirby",
    title: "Kirby's Adventure",
    system: "nes",
    core: "nes",
    rom: "roms/nes/Kirby's Adventure (E).nes",
    thumb: "thumbs/kirby.png",
    year: 1993,
    hack: false,
    description: "Inhale enemies and copy their abilities."
  },
  {
    id: "nyancat",
    title: "Nyan Cat",
    system: "nes",
    core: "nes",
    rom: "roms/nes/nyancat.nes",
    thumb: "thumbs/nyancat.png",
    year: 2020,
    hack: true,
    description: "Nyan Cat on the NES!"
  },

  // SNES
  {
    id: "smw",
    title: "Super Mario World",
    system: "snes",
    core: "snes",
    rom: "roms/snes/super-mario-world.smc",
    thumb: "thumbs/smw.png",
    year: 1990,
    hack: false,
    description: "Ride Yoshi through Dinosaur Land."
  },
  {
    id: "smas",
    title: "Super Mario All-Stars",
    system: "snes",
    core: "snes",
    rom: "roms/snes/super-mario-all-stars.smc",
    thumb: "thumbs/smas.jpg",
    year: 1993,
    hack: false,
    description: "Enhanced versions of the classic Mario games."
  },

  // Genesis / Mega Drive
  {
    id: "sonic1",
    title: "Sonic the Hedgehog",
    system: "genesis",
    core: "segaMD",
    rom: "roms/genesis/sonic-the-hedgehog.bin",
    thumb: "thumbs/sonic1.png",
    year: 1991,
    hack: false,
    description: "Gotta go fast! The original Genesis classic."
  },
  {
    id: "sonic2",
    title: "Sonic the Hedgehog 2",
    system: "genesis",
    core: "segaMD",
    rom: "roms/genesis/sonic-the-hedgehog-2.gen",
    thumb: "thumbs/sonic2.jpg",
    year: 1992,
    hack: false,
    description: "Tails joins the adventure."
  },
  {
    id: "sonic3",
    title: "Sonic the Hedgehog 3",
    system: "genesis",
    core: "segaMD",
    rom: "roms/genesis/sonic-the-hedgehog-3.gen",
    thumb: "thumbs/sonic3.png",
    year: 1994,
    hack: false,
    description: "Epic platforming with new moves."
  },
  {
    id: "sonic-knuckles",
    title: "Sonic & Knuckles",
    system: "genesis",
    core: "segaMD",
    rom: "roms/genesis/sonic-and-knuckles.gen",
    thumb: "thumbs/sonic-knuckles.png",
    year: 1994,
    hack: false,
    description: "Play as Knuckles the Echidna."
  },
  {
    id: "s3k",
    title: "Sonic 3 & Knuckles",
    system: "genesis",
    core: "segaMD",
    rom: "roms/genesis/sonic-and-knuckles-with-sonic-3.gen",
    thumb: "thumbs/s3k.jpg",
    year: 1994,
    hack: false,
    description: "The complete combined experience."
  },
  {
    id: "sonic-3-in-1",
    title: "Sonic 3-in-1",
    system: "genesis",
    core: "segaMD",
    rom: "roms/genesis/sonic-3-in-1.gen",
    thumb: "thumbs/sonic-3-in-1.png",
    year: 1994,
    hack: false,
    description: "Sonic 1, 2, and 3 in one cartridge."
  },
  {
    id: "s1yourpast",
    title: "Sonic 1: Your Past",
    system: "genesis",
    core: "segaMD",
    rom: "roms/genesis/s1yourpast.bin",
    thumb: "thumbs/s1yourpast.png",
    year: 2020,
    hack: true,
    description: "ROM hack of Sonic the Hedgehog."
  },
  {
    id: "scheroes",
    title: "Sonic Heroes (Hack)",
    system: "genesis",
    core: "segaMD",
    rom: "roms/genesis/scheroes.bin",
    thumb: "thumbs/scheroes.jpg",
    year: 2022,
    hack: true,
    description: "Sonic Heroes inspired Genesis ROM hack."
  },

  // Master System
  {
    id: "sonic-ms",
    title: "Sonic the Hedgehog",
    system: "sms",
    core: "segaMS",
    rom: "roms/sms/sonic-the-hedgehog-ms.sms",
    thumb: "thumbs/sonic-ms.png",
    year: 1991,
    hack: false,
    description: "Sonic on the Sega Master System."
  }
];
