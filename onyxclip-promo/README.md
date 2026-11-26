# OnyxClip promo video

A 33-second vertical (1080×1920, 30 fps) TikTok / Reels / Shorts ad for onyxclip.com, made in the
"mission" motion-graphics style: dark city-map background, HUD with a step counter, word-by-word
captions with highlighted keywords, MISSION FAILED → 4 steps → MISSION PASSED.

## Deliverables

| File | What it is |
|---|---|
| `out/onyxclip_promo.mp4` | Final video with AI voiceover, music and sound effects |
| `out/onyxclip_promo_no_voice.mp4` | Same video, music + sound effects only, so you can record your own voice over it |
| `out/onyxclip_promo_v2_remake.mp4` | **Beat-for-beat remake** of the green "YOUR FIRST CLIP" reference (35.4s): every scene and line lands at the same timestamp as the reference |
| `out/onyxclip_promo_v2_remake_no_voice.mp4` | The remake without voiceover |

## v2 remake: reference timeline

| Time | Reference | OnyxClip remake |
|---|---|---|
| 0.0–3.3 | Live stream cards, YOUR FIRST CLIP, "clip GTA 6 streams with Claude" | Long-video cards, YOUR FIRST CLIP, "clip long videos with AI" |
| 3.4–4.7 | MISSION FAILED, red X, "Nobody shows you the setup" | same |
| 4.8–7.1 | Dashed route reveal, "Here's mine, from zero to this clip" | same |
| 7.2–13.3 | Step 1: terminal, "open Claude Code and type set up live clipper", ok checks | Step 1: Onyx panel, "open OnyxClip and paste in your YouTube link", ok checks |
| 13.4–19.7 | Step 2: wheel of 5 streamers lights up one per name | Step 2: wheel of 5 moment types (Funny, Emotional, Hype, Banter, Payoffs) |
| 19.8–24.7 | Step 3: watches 5 streams at once, reading every chat message | Step 3: watches the whole video at once, reading every word |
| 24.8–28.7 | Step 4: chat spike chart, SAVED, caught/edited log | Step 4: virality spike chart, SAVED, scored/edited log |
| 28.8–31.5 | Phone clip, "MADE 09:05 · I WAS AT WORK" | same, with the OnyxClip clip |
| 31.6–35.4 | MISSION PASSED, route complete, "linked in my bio" card | same |

Rebuild the remake with `--script script_v2.json --build build_v2` (tts.py), `--comp comp_v2 --build build_v2` (render.js)
and `--build build_v2` (audio.py). In `script_v2.json`, `at`/`end` are the reference's timestamps for each line.

## Voiceover script (with timings)

Read it at the same pace if you record your own voice. The captions follow these times.

| Time | Line |
|---|---|
| 0:00 | Everyone's telling you to start clipping. |
| 0:02 | Nobody tells you you'll scrub for an hour and close the tab. → **MISSION FAILED** |
| 0:06 | Here's my route. One video, four steps. |
| 0:09 | Step one. Paste the link. |
| 0:11 | Step two. It watches the whole thing and reads every line. |
| 0:14 | Step three. Every moment gets a virality score… best first. |
| 0:18 | Step four. Cut it vertical, captions on, ready to post. |
| 0:22 | Nine clips from one video. I never opened an editor. |
| 0:26 | Mission passed. |
| 0:27 | Two free videos every month. onyxclip.com |

## Things to change before posting

- **Handle**: the top-left reads `@onyxclip`. Change it in `comp/index.html` (`#handle`).
- **Accent colour**: one variable, `--accent` in `comp/index.html` (currently Onyx blue `#4f86ff`).
  Route/node colours in `comp/main.js` use the same hex values.
- **Lines / wording**: edit `script.json` (`*word*` = highlighted keyword, `|` = caption break,
  `shown{spoken}` = show one thing, say another), then rebuild.
- **Voice**: `"voice"` in `script.json` (Kokoro voices, e.g. `af_heart`, `am_michael`, `am_adam`, `bf_emma`).

## Rebuild

```bash
npm install                      # gsap + fonts
pip install kokoro-onnx soundfile scipy
# Kokoro model files (kokoro-v1.0.onnx, voices-v1.0.bin) from
# github.com/thewh1teagle/kokoro-onnx/releases/tag/model-files-v1.0
KOKORO_DIR=/path/to/models python3 tools/tts.py   # voiceover + word timings
node tools/render.js --preview 1,5,12             # spot-check frames -> build/preview/
node tools/render.js --workers 4                  # all frames -> build/video.mp4 (+ build/cues.json)
python3 tools/audio.py                            # music, SFX, ducking, loudness (-14 LUFS)
ffmpeg -i build/video.mp4 -i audio/mix.wav -map 0:v -map 1:a -c:v copy -c:a aac -b:a 192k \
  -shortest -movflags +faststart out/onyxclip_promo.mp4
```

The music and sound effects are synthesised from scratch in `tools/audio.py` (no samples), so
there is nothing to license. The clip images in `assets/` were cropped from the OnyxClip project
screenshot (your own generated clips).
