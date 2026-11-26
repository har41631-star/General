#!/usr/bin/env bash
# Mux the silent render with the sound mix, then run the template's frame-by-frame QA.
# usage: scripts/finish.sh [renderdir] [final.mp4]
set -euo pipefail
R=${1:-out/bridge}; F=${2:-out/bridge_short_1080.mp4}
ffmpeg -y -loglevel error -i "$R/video_silent.mp4" -i audio/mix.wav -map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -b:a 320k -movflags +faststart -shortest "$F"
ls -la "$F"
python3 scripts/short_qa.py "$F" "$R/qa" "$R/shots.json"
