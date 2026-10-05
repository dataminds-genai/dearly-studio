# Complete the Dearly Studio creator

## What will change
- Keep the Quick Creator as both `/` and `/create`, preserve the focused full-screen creation experience, and remove any remaining Discover navigation.
- Expand the Message tab with recipient and sender fields, relationship, occasion, and mood chips, a memory field, live message editing, AI writing, and four refinement actions without inventing a default name.
- Move the five-format selector directly below the preview. Changing Square, Story, Portrait, Landscape, or A6 will resize the live card immediately and drive the same export dimensions.
- Add direct upload and drag-and-drop, plus a header-accessible occasion photo library with category filters, loading placeholders, locally bundled Unsplash photos, attribution, and one-tap selection.
- Add direct photo framing controls: drag to pan, pinch or wheel to zoom, a desktop/mobile zoom control, rotation, and reset. Keep the image cropped without distortion.
- Expand the draggable message into a complete typography tool with font family, size, bold/italic/underline, alignment, color, and backdrop contrast. Keep pointer and touch movement inside safe card bounds.
- Replace photo-derived style thumbnails with dedicated samples for Original, Watercolor Wash, Oil Painting, Pencil / Charcoal, and Impressionist.
- Add an in-browser art renderer for instant, dependable styling. When remote artwork cannot be created, fall back automatically with “Rendering artwork on device...” and show a brush-stroke painting animation while processing.
- Extend sharing with high-resolution PNG, print-ready PDF, and the native share sheet, all using the exact ratio, crop, pan, zoom, rotation, art treatment, and text styling shown in the preview.

## Interaction and accessibility
- Use existing warm semantic colors with restrained Apple-like glass controls, stable tap targets, keyboard labels, focus states, and reduced-motion behavior.
- Keep the preview visible while editing on desktop and compact on mobile, without nested card clutter or long instructional text.
- Preserve existing languages and ensure new controls remain usable in right-to-left layouts.

## Technical details
- Extend the saved draft model with normalized pan/zoom and typography properties, with migration defaults for older browser drafts.
- Create shared composition geometry so preview, client-side effects, PNG, PDF, and native sharing use one source of truth.
- Split photo transforms, client art processing, text layout, and export composition into focused browser modules; keep message generation in the existing server route.
- Use a browser-compatible PDF generator and locally stored stock/style-preview assets; no customer photo or credential is sent directly from browser code to third parties.
- Keep remote artwork optional. The local processor is the reliable fallback and never runs on initial load—only after the user selects a non-original style.
- Update the architectural project notes to reflect the client fallback and server boundaries.

## Verification
- Check `/` and `/create` on phone and desktop, including drag/drop upload and the occasion library.
- Verify mouse, touch, wheel, and keyboard-friendly controls for pan, zoom, reset, text movement, typography, ratios, and style selection.
- Compare preview against exported PNG and PDF for every ratio, including rotated and zoomed photos.
- Force the remote artwork route to fail and confirm the local fallback, notification, and animation complete correctly.
- Verify native sharing payloads where supported, fallback download behavior elsewhere, reduced motion, right-to-left layout, metadata, tests, and the current build.
