#!/usr/bin/env bash
# Render the composition as N parallel browser processes over N frame ranges, then join them losslessly.
# Software WebGL (SwiftShader) runs one GPU process per browser at ~1 core, so separate browsers scale with cores
# while Remotion's in-browser --concurrency does not. Resumable: finished parts are kept.
# usage: scripts/render_parallel.sh <outdir> [scale] [N]     env: TOTAL (frames, default 2025), COMP (composition id)
set -uo pipefail
OUT=${1:-out/bridge}; SCALE=${2:-1}; N=${3:-4}; TOTAL=${TOTAL:-2025}; COMP=${COMP:-BridgeShort}
mkdir -p "$OUT/parts"; CH=$(( (TOTAL + N - 1) / N ))
pids=()
for ((k=0; k<N; k++)); do
  a=$((k*CH)); b=$((a+CH-1)); ((b>=TOTAL)) && b=$((TOTAL-1))
  f=$(printf "%s/parts/p_%04d.mp4" "$OUT" "$a")
  if [ -s "$f" ]; then echo "keep $f"; continue; fi
  ( REMOTION_TMP="$PWD/.remotion-tmp/p$k" node scripts/render.mjs "$f.part.mp4" "$a-$b" "$SCALE" 1 "$COMP" > "$OUT/parts/log_$k.txt" 2>&1 \
      && mv "$f.part.mp4" "$f" && echo "part $k done ($a-$b)" ) &
  pids+=($!)
done
for p in "${pids[@]}"; do wait "$p"; done
: > "$OUT/parts/list.txt"
for ((k=0; k<N; k++)); do f=$(printf "p_%04d.mp4" $((k*CH))); [ -s "$OUT/parts/$f" ] || { echo "MISSING $f"; exit 1; }; echo "file '$f'" >> "$OUT/parts/list.txt"; done
ffmpeg -y -loglevel error -f concat -safe 0 -i "$OUT/parts/list.txt" -c copy "$OUT/video_silent.mp4" && echo "ALL DONE $OUT/video_silent.mp4"
