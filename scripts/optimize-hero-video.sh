#!/usr/bin/env bash
# optimize-hero-video.sh
# Usage: bash scripts/optimize-hero-video.sh <input-video-path>
# Writes hero-1080.mp4, hero-720.mp4, hero-poster.jpg into site/assets/videos/

set -euo pipefail

FFMPEG=~/tools/ffmpeg/node_modules/ffmpeg-static/ffmpeg
FFPROBE=~/tools/ffmpeg/node_modules/ffprobe-static/bin/darwin/arm64/ffprobe

INPUT="${1:-}"
if [[ -z "$INPUT" ]]; then
  echo "Usage: $0 <input-video-path>" >&2
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

echo "==> Encoding hero-1080.mp4 (max 1920px wide, H.264 crf 26 slow, no audio)..."
"$FFMPEG" -y -i "$INPUT" \
  -vf "scale='min(1920,iw)':'trunc(ow/a/2)*2'" \
  -c:v libx264 -preset slow -crf 26 -pix_fmt yuv420p \
  -an -movflags +faststart \
  "$OUTDIR/hero-1080.mp4"

echo ""
echo "==> Encoding hero-720.mp4 (max 1280px wide, H.264 crf 26 slow, no audio)..."
"$FFMPEG" -y -i "$INPUT" \
  -vf "scale='min(1280,iw)':'trunc(ow/a/2)*2'" \
  -c:v libx264 -preset slow -crf 26 -pix_fmt yuv420p \
  -an -movflags +faststart \
  "$OUTDIR/hero-720.mp4"

echo ""
echo "==> Extracting hero-poster.jpg (frame at ~1s, 1920px wide, quality 80)..."
"$FFMPEG" -y -ss 1 -i "$INPUT" \
  -vframes 1 -update 1 \
  -vf "scale=1920:-1" \
  -q:v 4 \
  "$OUTDIR/hero-poster.jpg"
# Note: -q:v 4 ≈ quality 80 for JPEG in ffmpeg (scale 2–31, lower=better)

echo ""
echo "==> Output file sizes:"
ls -lh "$OUTDIR/hero-1080.mp4" "$OUTDIR/hero-720.mp4" "$OUTDIR/hero-poster.jpg"
