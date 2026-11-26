# Cartoon 3D short: "The Bridge That Fell for a Song"

A 67.5 s vertical animated short (1080x1920, 30 fps), built here from the free
[claude-animated-shorts](https://github.com/mromidev/claude-animated-shorts) skill: flat 2D cartoon characters in a
painted 3D town, rendered with three.js inside Remotion. It has ink outlines, lens blur, a colour grade, a synthesized
march score and sound effects, and a TTS narration. There is no AI video generator; every frame is code.

| File | What it is |
|---|---|
| `out/bridge_short_1080.mp4` | Final video: picture + narration + music + SFX |
| `src/videos/bridge/` | The template's bridge short source (world, characters, ink, lens blur, grade, story/camera), unchanged |
| `audio/` | The template's sound synthesis (`mix.py` runs it all) + `voice_build.py` (our narration, see below) |
| `voice/` | `voice.wav` (Kokoro TTS, voice `af_heart`), `words.json`, `phrases.json` (where each phrase sits) |
| `public/bridge/kenney/` | The 26 Kenney CC0 props the world loads (Nature Kit + Fantasy Town Kit) |
| `scripts/` | Linux render helpers (`stills.mjs`, `render.mjs`, `render_parallel.sh`) + the template's QA helpers |

The story is the template author's example. Their skill says story, characters and voice should be your own: to make
a new short, follow the pipeline in the skill's `SKILL.md`. This render shows that the pipeline works end to end.

## What it took to make the template run here

The repo ships the source but no Remotion project, no props, no voice, and Windows-only render scripts. To get it
running in a Linux container with no GPU:

1. **Remotion project.** `src/index.ts` + `src/Root.tsx` register `BridgeShort` (1080x1920, 2025 frames).
2. **Pinned the older React stack.** With `@react-three/postprocessing` v3 (React 19 / R3F 9) every frame came out
   blank. v3 builds its composer in an effect, one tick after Remotion's single `advance()` per frame, so nothing was
   drawn. Pinned React 18.3.1 + `@react-three/fiber` 8.18 + `@react-three/postprocessing` 2.19.1 (composer built in
   `useMemo`), which renders the full post chain.
3. **Props.** kenney.nl is not reachable from here, so the 26 CC0 models (plus the Fantasy Town `colormap.png`) came from
   a GitHub mirror (`series-ai/jam-ready-assets`, Git LFS).
4. **Software WebGL.** Renders use the pre-installed `chrome-headless-shell` with SwiftShader (`gl: "swangle"`).
   SwiftShader runs one GPU process per browser at about one core, so `render_parallel.sh` runs one browser per core
   on separate frame ranges and joins them with a stream copy. At 1080x1920 that is about 1 fps on 4 cores, so the
   67 s film takes about 35 min.
5. **Narration.** The picture is timed to the author's own recording, which isn't in the repo. `audio/voice_build.py`
   synthesizes each phrase with Kokoro and fits it into the picture's slots. Key words are pinned to their events:
   "Then," on the music's dead stop at 33.0 s, "snaps" on the bolt at 34.6 s, "...in step" on the third hammer blow.
   Phrases that would overrun their slot are sped up (1.08x base, up to 1.32x).

## Rebuild

```bash
npm install
```

```bash
python3 audio/voice_build.py --models <dir with kokoro-v1.0.onnx + voices-v1.0.bin>
```

```bash
cd audio && python3 mix.py && cd ..
```

```bash
scripts/render_parallel.sh out/bridge 1 4
```

```bash
ffmpeg -i out/bridge/video_silent.mp4 -i audio/mix.wav -map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -b:a 320k -shortest out/bridge_short_1080.mp4
```

- Kokoro models: `https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/` (`pip install kokoro-onnx`).
- Stills for look checks: `node scripts/stills.mjs out/check/s_ 200,1350,1800 0.5`.
- 2K (1440x2560, the skill's final spec): `scripts/render_parallel.sh out/bridge2k 1.3333 4`, about 1.8x longer.
- Other voices: `--voice am_michael`, `bm_george`, etc. Re-run `mix.py` after any voice change (music/SFX are cached).

## Credits

- Template code and docs: MIT, (c) 2026 Mr omi (`LICENSE-template`).
- 3D props: Kenney Nature Kit and Fantasy Town Kit, CC0 (kenney.nl).
- Voice: Kokoro-82M (Apache-2.0) via kokoro-onnx.
- The skill's private reference frames (`references/`) are style-study material only and are not included here.
