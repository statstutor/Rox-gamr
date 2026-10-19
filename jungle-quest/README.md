# 🌴 Jungle Quest

An online multiplayer jungle adventure for **4 to 9 players**, each on their own phone or computer.
Explore the jungle together, fight creatures, solve mysteries, and unlock new levels.

## Levels

1. **🐊 Crocodile Lake**: fight a crocodile and a piranha swarm, answer the Whispering Reeds' riddles,
   find out who stole the map, crack the Frog Stone code, then beat the boss, **King Croc**.
2. **🐻 Bear Cave**: fight a bat swarm, a giant spider and a grumpy bear, survive the Echo Chamber riddles,
   find the snack thief, open the Crystal Door, then beat **Old Grizzly**.
3. **🌲 Mysterious Forest** (more mysteries than fighting): the Talking Trees and the Riddle Stones ask riddles,
   the Lost Path makes you pick the right way at each fork, the Glowing Mushroom Ring is a code lock, and
   shadow wolves and a sneaky wildcat attack. The boss is **the Owl Guardian**.
4. **🏔️ Mountaintop**: fight a mountain goat herd, an angry ram and a snow eagle, answer the Wind Riddles,
   find out who took the climbing rope, open the Summit Gate, then beat **the Goat King**.
5. **🕳️ Mole Hideout** (more fighting than mysteries): fight mole diggers, a giant worm, a grumpy badger,
   a beetle swarm and a burrowing snake, get through the Mole Riddle Door and the Tunnel Lock, then beat
   **the Mole Queen**.

Each level unlocks after you beat the one before it.

## How to play

- One person clicks **Create a new game** and shares the 4-letter code (or the invite link).
- Everyone else types the code and clicks **Join game**. The host starts once there are 4 to 9 explorers.
- On the map, the **leader** 🧭 picks where the team goes next. The leader changes after every place.
- **Fights** are turn-based. Everyone picks a move (Attack, Power Smash, Defend or Heal) and the round
  plays out once everyone has chosen, with a cutscene of every explorer's move and the creature's attack back
  (tap Skip to jump past it). The host can skip anyone who is taking too long.
- **Mysteries**:
  - *Riddles*: anyone can answer, but wrong answers hurt the whole team.
  - *Lost path*: read the clue at each fork and pick the right way.
  - *Clue hunts*: search places to find 3 clues (watch out for traps!), then guess who did it.
  - *Secret codes*: each player sees **different** hints on their own screen, so talk to each other to crack the code.
- Beat every creature and mystery on a level, then defeat the boss to unlock the next level.
- If the whole team is knocked out, you wake up back at camp and can try that fight again.

**More players = harder game:** creatures get more health, more attacks and bigger hits, riddle
challenges get longer, clue hunts hide more traps, and secret codes get longer.

## Running it

You need [Node.js](https://nodejs.org) 18 or newer. No other packages are needed.

```sh
cd jungle-quest
npm start
```

Then open http://localhost:3000. Friends on the same Wi-Fi can join at `http://<your computer's IP>:3000`.
To play with people anywhere, put it on a Node hosting service (for example Render, Railway or Fly.io)
using `npm start` as the start command. The service sets `PORT` automatically.

Run `npm test` to play through all five levels with pretend players for every team size from 4 to 9.

Games are kept in the server's memory, so restarting the server ends any games in progress.
Unlocked levels are remembered in each player's browser, so whoever hosts next time keeps them.

## Claude page version

`node build-artifact.js <file.html>` bundles the game into one page that can be published on claude.ai.
That version also has **Play solo with AI teammates** (3 to 8 computer explorers who fight, lead and search
for clues, and share their code hints) and **Play on this device** (pass one phone or computer around). Its online mode
uses the page's built-in shared storage and live room instead of `server.js`: the host's page runs the
game, and other players need a Claude account and access to the page.
