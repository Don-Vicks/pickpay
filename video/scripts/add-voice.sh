#!/usr/bin/env bash
# Mixes a voiceover recording over the rendered demo, with the music turned down underneath.
#   video/scripts/add-voice.sh voice.m4a [offset_ms]
# offset_ms delays the voice (use it if you started speaking before pressing play; default 0).
# Writes video/out/pickpay-demo-voice.mp4. Needs ffmpeg.
set -euo pipefail

VOICE="${1:?usage: add-voice.sh <voice recording> [offset_ms]}"
OFFSET="${2:-0}"
DIR="$(cd "$(dirname "$0")/.." && pwd)"
IN="$DIR/out/pickpay-demo.mp4"
OUT="$DIR/out/pickpay-demo-voice.mp4"

[ -f "$IN" ] || { echo "Render the video first: cd video && pnpm render" >&2; exit 1; }

# Voice: cleaned up (low cut, gentle compression) and levelled to a standard loudness.
# Music: lowered to 30% so the voice sits clearly on top. Video stream is copied unchanged.
ffmpeg -v error -y -i "$IN" -i "$VOICE" -filter_complex "\
[1:a]highpass=f=80,acompressor=threshold=-20dB:ratio=3:attack=5:release=120,loudnorm=I=-16:TP=-1.5:LRA=11,adelay=${OFFSET}|${OFFSET},aresample=48000[v];\
[0:a]volume=0.3,aresample=48000[m];\
[m][v]amix=inputs=2:duration=first:normalize=0[a]" \
  -map 0:v -map "[a]" -c:v copy -c:a aac -b:a 192k "$OUT"

echo "wrote $OUT"
