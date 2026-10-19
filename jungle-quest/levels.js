'use strict';
// All the creatures, riddles, clue hunts and code doors for each level.
// To add a level later, add another object to LEVELS.

const LEVELS = [
  {
    id: 1,
    name: 'Crocodile Lake',
    emoji: '🐊',
    theme: 'lake',
    blurb: 'A misty lake deep in the jungle. Something with lots of teeth lives here...',
    intro: 'Your team pushes through the vines and reaches a misty lake. Bubbles rise from the water. Beat the creatures and solve the mysteries, then face the King of the lake!',
    spots: [
      {
        id: 'croc', type: 'fight', name: 'Snappy the Crocodile', emoji: '🐊',
        intro: 'A crocodile bursts out of the water with its jaws wide open!',
        creature: { hpPer: 16, attacks: 1, dmg: [4, 8],
          special: { every: 3, kind: 'big', name: 'Death Roll', dmg: [5, 8] } },
      },
      {
        id: 'piranha', type: 'fight', name: 'Piranha Swarm', emoji: '🐟',
        intro: 'The water starts to boil... it is a swarm of hungry piranhas!',
        creature: { hpPer: 14, attacks: 3, dmg: [2, 4] },
      },
      {
        id: 'reeds', type: 'riddle', name: 'The Whispering Reeds', emoji: '🌾',
        intro: 'The tall reeds whisper riddles. Answer them right or they will whip you with their stems!',
        riddles: [
          { q: 'I have a mouth but never eat, and a bed but never sleep. What am I?', a: 'A river', wrong: ['A crocodile', 'A cave', 'A boat'] },
          { q: 'What has teeth but can never bite?', a: 'A comb', wrong: ['A crocodile', 'A shark', 'A baby'] },
          { q: 'The more of them you take, the more you leave behind. What are they?', a: 'Footsteps', wrong: ['Photos', 'Fish', 'Bananas'] },
          { q: 'What gets wetter the more it dries?', a: 'A towel', wrong: ['A sponge', 'A lake', 'Rain'] },
          { q: 'What can travel all around the world while staying in one corner?', a: 'A stamp', wrong: ['A spider', 'The moon', 'A map'] },
          { q: 'What has a neck but no head?', a: 'A bottle', wrong: ['A snake', 'A shirt', 'A giraffe'] },
        ],
      },
      {
        id: 'map', type: 'hunt', name: 'The Stolen Map', emoji: '🗺️',
        intro: 'Oh no! The team\'s treasure map was stolen while you slept by the lake. Search the shore for clues and work out who took it. Watch out for traps!',
        places: [
          ['Muddy Bank', '🟫'], ['Hollow Log', '🪵'], ['Lily Pads', '🪷'], ['Old Canoe', '🛶'],
          ['Tall Reeds', '🌾'], ['Fallen Tree', '🌳'], ['Rock Pile', '🪨'], ['Fisher\'s Hut', '🛖'],
          ['Vine Swing', '🌿'], ['Sandy Beach', '🏖️'], ['Banana Tree', '🌴'], ['Bird Nest', '🪺'],
        ],
        clues: [
          'Tiny handprints in the mud... with long, thin fingers.',
          'A trail of banana peels leading toward the trees.',
          'A torn corner of the map, stuck way up high in the branches. Someone climbed!',
        ],
        traps: [
          'A snapping turtle bites your toe!',
          'You slip in the mud and bonk your head!',
          'Angry hornets fly out!',
          'A sneaky crocodile tail whacks you!',
        ],
        empty: ['Just some mud.', 'Nothing but a sleepy frog.', 'Only some old leaves.', 'A few pretty shells, but no clues.'],
        question: 'Who stole the map?',
        answer: 'A monkey 🐒',
        wrongAnswers: ['A crocodile 🐊', 'A hippo 🦛', 'A flamingo 🦩'],
      },
      {
        id: 'frogstone', type: 'code', name: 'The Frog Stone', emoji: '🐸',
        intro: 'A giant stone frog guards a secret door with a symbol lock. Each explorer remembers a different part of the old jungle song. Talk to each other and share what you know to crack the code!',
        symbols: ['🐸', '🌙', '☀️', '🌊', '🍃', '⭐'],
      },
      {
        id: 'kingcroc', type: 'fight', boss: true, name: 'King Croc', emoji: '🐊👑',
        intro: 'The lake goes quiet... then the biggest crocodile you have ever seen rises up, wearing a golden crown!',
        creature: { hpPer: 24, attacks: 2, dmg: [5, 9],
          special: { every: 3, kind: 'all', name: 'Tail Splash', dmg: [3, 5] } },
      },
    ],
  },
  {
    id: 2,
    name: 'Bear Cave',
    emoji: '🐻',
    theme: 'cave',
    blurb: 'A dark cave behind the waterfall. Growls echo from inside...',
    intro: 'Behind a waterfall you find a huge dark cave. Your torches flicker. Something big is snoring deep inside...',
    spots: [
      {
        id: 'bats', type: 'fight', name: 'Bat Swarm', emoji: '🦇',
        intro: 'Hundreds of bats wake up and swoop down at you!',
        creature: { hpPer: 15, attacks: 3, dmg: [2, 4],
          special: { every: 3, kind: 'all', name: 'Screech', dmg: [2, 3] } },
      },
      {
        id: 'spider', type: 'fight', name: 'Giant Cave Spider', emoji: '🕷️',
        intro: 'A spider the size of a car drops from the ceiling on a thick silk rope!',
        creature: { hpPer: 18, attacks: 2, dmg: [3, 6],
          special: { every: 3, kind: 'big', name: 'Venom Bite', dmg: [5, 8] } },
      },
      {
        id: 'bear', type: 'fight', name: 'Grumpy Bear', emoji: '🐻',
        intro: 'You woke up a bear. It is NOT happy about it!',
        creature: { hpPer: 20, attacks: 1, dmg: [6, 10],
          special: { every: 3, kind: 'big', name: 'Bear Hug', dmg: [6, 9] } },
      },
      {
        id: 'echo', type: 'riddle', name: 'The Echo Chamber', emoji: '🗣️',
        intro: 'A voice echoes through the cave asking riddles. Wrong answers make rocks fall from the ceiling!',
        riddles: [
          { q: 'The more of me there is, the less you can see. What am I?', a: 'Darkness', wrong: ['Fog', 'Water', 'Light'] },
          { q: 'I speak without a mouth and hear without ears. In caves I answer back. What am I?', a: 'An echo', wrong: ['A bat', 'The wind', 'A ghost'] },
          { q: 'What has a head and a tail but no body?', a: 'A coin', wrong: ['A snake', 'A comet', 'A tadpole'] },
          { q: 'What can you catch but never throw?', a: 'A cold', wrong: ['A ball', 'A fish', 'A bus'] },
          { q: 'What has hands but cannot clap?', a: 'A clock', wrong: ['A bear', 'A glove', 'A tree'] },
          { q: 'What goes up but never comes down?', a: 'Your age', wrong: ['A balloon', 'A bat', 'Smoke'] },
        ],
      },
      {
        id: 'food', type: 'hunt', name: 'Who Took the Food?', emoji: '🍪',
        intro: 'Someone sneaked into camp and ate all your snacks! Search the cave for clues to find the thief. Careful, the cave has traps!',
        places: [
          ['Stalagmite', '🗻'], ['Dark Tunnel', '🕳️'], ['Crystal Pool', '💧'], ['Mine Cart', '🛒'],
          ['Bone Pile', '🦴'], ['Mossy Rock', '🪨'], ['Bear Den', '🛏️'], ['Echo Hole', '🌀'],
          ['Glowing Mushrooms', '🍄'], ['Rope Ladder', '🪜'], ['Underground Stream', '🌊'], ['Cave Painting', '🖼️'],
        ],
        clues: [
          'Small paw prints that look like tiny human hands.',
          'Snack wrappers opened very neatly, not torn to shreds.',
          'A tuft of grey fur with black rings on it, like from a striped tail.',
        ],
        traps: [
          'A rock falls on your head!',
          'You step on a sleeping bat and it bites you!',
          'The floor gives way and you tumble down!',
          'Sticky spider web! You struggle and get scraped!',
        ],
        empty: ['Just cold stone.', 'Nothing but drips of water.', 'Only some old pebbles.', 'A few glowing worms, but no clues.'],
        question: 'Who ate the snacks?',
        answer: 'A raccoon 🦝',
        wrongAnswers: ['A bear 🐻', 'A bat 🦇', 'A spider 🕷️'],
      },
      {
        id: 'crystal', type: 'code', name: 'The Crystal Door', emoji: '💎',
        intro: 'A door made of crystal blocks the way to the deepest part of the cave. Each explorer sees a different glowing hint on the walls. Share what you see to crack the code!',
        symbols: ['💎', '🔥', '🌙', '⭐', '🗝️', '🍄'],
      },
      {
        id: 'oldgrizzly', type: 'fight', boss: true, name: 'Old Grizzly, King of the Cave', emoji: '🐻👑',
        intro: 'The ground shakes. The biggest, oldest bear in the jungle stands up on two legs and ROARS!',
        creature: { hpPer: 28, attacks: 2, dmg: [6, 10],
          special: { every: 2, kind: 'all', name: 'Mighty Roar', dmg: [3, 6] } },
      },
    ],
  },
];

module.exports = { LEVELS };
