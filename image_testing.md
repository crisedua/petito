# Image Integration Testing Playbook (fal.ai bonus scenes)

## Image Handling Rules
- Always use base64-encoded images for all tests and requests.
- Accepted formats: JPEG, PNG, WEBP only. Do not use SVG, BMP, HEIC.
- Do not upload blank, solid-color, or uniform-variance images. Every image must contain real
  visual features (objects, edges, textures, shadows) — use a real pet photo.
- If the image is not PNG/JPEG/WEBP, transcode to PNG or JPEG before upload and re-detect MIME.
- If the image is animated (GIF/APNG/animated WEBP), extract the first frame only.
- Resize large images to reasonable bounds (avoid oversized payloads).

## App specifics
- Bonus scene generation runs inside the generate pipeline (fal-ai/nano-banana/edit via Emergent
  Universal Key proxy). It is best-effort: if it fails, the pipeline continues without the bonus slide.
- To test: create a story, upload 3+ real pet photos (JPEG), call generate, poll GET /api/stories/{id}
  until status preview_ready, and confirm a slide with kind "bonus" may appear.
