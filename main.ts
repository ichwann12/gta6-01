// SOLMAR CITY — a make.fun gta6-01 entry (Node 22, standard library only).
//
// An original open-world crime game in the spirit of GTA 6, written for this
// bounty: a sun-soaked coastal city you explore on foot and by car, with
// traffic and pedestrians, cars to steal and drive, a wanted level and police
// who respond, a five-mission story, combat, a HUD with a minimap, a title
// screen and a save. Nothing here is from any commercial game — the city,
// characters, vehicles, names, story, art and sounds are all original.
//
// The game itself is plain static files under game/ (game/index.html and its
// ES modules, no library, no network request). This program hands it in: it
// copies game/ and screenshots/ from beside this file to /output and writes
// /output/dossier.json, the summary the judge reads, with the vendored
// make.fun library (vendor/makefun-game.ts, the kit's copy, unchanged).
// It runs twice and both runs write the same bytes: the copy is a plain
// recursive copy and the dossier is deterministic, so nothing in /output
// depends on the clock or on chance.
//
// Serve it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

/** How many files and bytes a tree holds, for the run summary below. */
function treeSize(dir: string): { files: number; bytes: number } {
  let files = 0;
  let bytes = 0;
  const walk = (d: string): void => {
    for (const name of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, name.name);
      if (name.isDirectory()) walk(p);
      else if (name.isFile()) {
        files += 1;
        bytes += statSync(p).size;
      }
    }
  };
  walk(dir);
  return { files, bytes };
}

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the bytes; the others refuse an entry the
// scorer would refuse (more than 4 screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB of game
// files, in all, or a path under game/ over 1000 bytes: game/ counts beside /output's own 1000-entry cap, its
// screenshots/ and dossier.json).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);

// Run summary, so a local run shows what was handed in (the grader reads /output, not stdout).
const game = treeSize(join(out, 'game'));
const shots = existsSync(join(out, 'screenshots')) ? treeSize(join(out, 'screenshots')) : { files: 0, bytes: 0 };
console.log(
  `SOLMAR CITY handed in: game/ ${game.files} files (${game.bytes} bytes), ` +
    `screenshots/ ${shots.files} files (${shots.bytes} bytes), dossier.json written to ${out}`,
);
