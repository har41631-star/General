# "Who Got the Better Grades?" (Synaptic Recall)

An 85 s vertical (1080x1920, 30 fps) animated story short for Synaptic Recall, made with the cartoon-3D pipeline
from the claude-animated-shorts skill: flat ink-outlined characters in painted 3D sets, rendered with three.js
inside Remotion (composition `GradesShort`). Dr. Synapse, the Synaptic Recall mascot, is drawn with the same code as
the cast and appears in the app, in Leo's "brain shelf", in the exam flash, at the ceremony and on the end card.

Final video: `out/grades_short_1080.mp4` (and `out/grades_short_1080_novoice.mp4`, music + SFX only, for your own voice).

## Script as voiced

| Time | Who | Line |
|---|---|---|
| 0:00 | Narrator | Two students. Same college. Same pre-med track. Who do you think ended up with the better grades? |
| 0:07 | Narrator | This is Marcus. Marcus is smart. Top of his high school class. In college, his plan was simple: outwork everyone. |
| 0:14 | Narrator | He re-read every lecture. Highlighted every line. Rewrote his notes... three times. |
| 0:20 | Narrator | And this is Leo. Leo is... not that kid. Honestly? He's average. He forgets stuff. A lot. *(walks into a door)* |
| 0:27 | Narrator | But Leo knew one thing about himself. If he was gonna remember anything, he needed a better system. Not more hours. |
| 0:33 | Narrator | So after every lecture, he dropped it into Synaptic Recall. |
| 0:37 | Dr. Synapse | Send me your lecture, and I'll turn it into a story and an Anki deck! |
| 0:41 | Narrator | Then he'd just quiz himself. A little every day. On the bus. In line for lunch. Then he went and lived his life. |
| 0:48 | Narrator | Meanwhile, Marcus had a problem. He'd read everything. But when he closed the book... it was gone. |
| 0:55 | Narrator | Leo's brain? Everything had a shelf. |
| 0:57 | Narrator | Then came the MCAT. Same exam. Same question. One of them had seen it a hundred times. The other had actually practiced remembering it. |
| 1:06 | Narrator | If you guessed Leo... you were right. Not because he was smarter. Because he knew his tools. |
| 1:11 | Leo | Bro. Stop re-reading. Try this. |
| 1:15 | Dr. Synapse | Work hard. But work smart! *(white coat ceremony, both of them)* |
| 1:17 | Narrator | Synaptic Recall. Turn your lectures into stories and Anki decks. *(end card)* |

On-screen text: "Who got the better grades?", "Marcus", "Study time: 14 hrs/day", "Leo", "Study time: ~2 hrs/day",
"Leo: Accepted · Ridgeview School of Medicine", end card "Synaptic Recall / Turn your lectures into stories & Anki decks".

## Honesty checklist

- Product claims come from the app's own home page: upload a lecture (PDF or PowerPoint), get a Story ("to understand it")
  and an Anki deck ("to memorize it"); Dr. Synapse's line is the page's own greeting. The laptop screen is a redrawn
  copy of that page. Please check these still match the product before posting.
- No stats, scores or "studies show" claims. "14 hrs/day" and "~2 hrs/day" are the characters' story numbers.
- Marcus, Leo and Ridgeview are fictional. The MCAT is named in the narration only (spelled "M-Cat" for the TTS).
- Add the platform's ad / paid-partnership label if it applies.
- The end card shows no link: set `PRODUCT_URL` in `src/videos/grades/Grades.tsx` to add one.

## Rebuild

```bash
python3 grades/voice_build.py --models <dir with kokoro-v1.0.onnx + voices-v1.0.bin>
```

```bash
python3 grades/audio.py
```

```bash
COMP=GradesShort TOTAL=2543 scripts/render_parallel.sh out/grades 1 4
```

```bash
ffmpeg -i out/grades/video_silent.mp4 -i grades/audio/mix.wav -map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -b:a 320k -shortest out/grades_short_1080.mp4
```

- The picture is timed to `grades/voice/timeline.json`, so new voice lines re-time every shot and sound cue. Set
  `TOTAL` to the new frame count it prints.
- Voices: narrator `af_heart`, Leo `am_puck`, Dr. Synapse `bm_george` (Kokoro). Change them with `--narrator/--leo/--doc`.
- Stills: `node scripts/stills.mjs out/g/s_ 138,1154,2260 0.5 GradesShort`.
- Code: `src/videos/grades/` (`story.ts` shot plan, `sets.ts` sets, `toon.ts` characters + Dr. Synapse, `tex.ts` textures and
  the app screen, `Grades.tsx` composition, overlays and end card). It reuses the bridge short's ink, lens blur,
  grade, two-tone and card shading from `src/videos/bridge/`.
- Fonts: Fredoka and Inter (SIL OFL, `public/grades/fonts/`).
