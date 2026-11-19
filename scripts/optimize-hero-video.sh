#!/usr/bin/env bash
# optimize-hero-video.sh
# Usage: bash scripts/optimize-hero-video.sh <input-video-path> <prefix>
# Writes <prefix>-1080.mp4, <prefix>-720.mp4, and <prefix>-poster.jpg into site/assets/videos/

set -euo pipefail

FFMPEG=~/tools/ffmpeg/node_modules/ffmpeg-static/ffmpeg
FFPROBE=~/tools/ffmpeg/node_modules/ffprobe-static/bin/darwin/arm64/ffprobe

INPUT="${1:-}"
PREFIX="${2:-}"
if [[ -z "$INPUT" ]] || [[ -z "$PREFIX" ]]; then
  echo "Usage: $0 <input-video-path> <prefix>" >&2
  exit 1
fi

if [[ ! -f "$INPUT" ]]; then
  echo "Error: input file not found: $INPUT" >&2
  exit 1
fi

OUTDIR="$(dirname "$0")/../site/assets/videos"
mkdir -p "$OUTDIR"

echo "Input:  $INPUT"
echo "Output: $OUTDIR"
echo ""

echo "==> Encoding ${PREFIX}-1080.mp4 (max 1920px wide, H.264 crf 26 slow, no audio)..."
"$FFMPEG" -y -i "$INPUT" \
  -vf "scale='min(1920,iw)':'trunc(ow/a/2)*2'" \
  -c:v libx264 -preset slow -crf 26 -pix_fmt yuv420p \
  -an -movflags +faststart \
  "$OUTDIR/${PREFIX}-1080.mp4"

echo ""
echo "==> Encoding ${PREFIX}-720.mp4 (max 1280px wide, H.264 crf 26 slow, no audio)..."
"$FFMPEG" -y -i "$INPUT" \
  -vf "scale='min(1280,iw)':'trunc(ow/a/2)*2'" \
  -c:v libx264 -preset slow -crf 26 -pix_fmt yuv420p \
  -an -movflags +faststart \
  "$OUTDIR/${PREFIX}-720.mp4"

echo ""
echo "==> Extracting ${PREFIX}-poster.jpg (frame at ~1s, 1920px wide, quality 80)..."
"$FFMPEG" -y -ss 1 -i "$INPUT" \
  -vframes 1 -update 1 \
  -vf "scale=1920:-1" \
  -q:v 4 \
  "$OUTDIR/${PREFIX}-poster.jpg"
# Note: -q:v 4 ≈ quality 80 for JPEG in ffmpeg (scale 2–31, lower=better)

echo ""
echo "==> Output file sizes:"
ls -lh "$OUTDIR/${PREFIX}-1080.mp4" "$OUTDIR/${PREFIX}-720.mp4" "$OUTDIR/${PREFIX}-poster.jpg"
