import type { StyleId, StyleIntensity } from "@/domain/entities/types";

export const ART_STYLE_IDS = [
  "impressionist",
  "watercolor",
  "pointillist",
  "pop-art",
  "abstract",
  "vangogh",
  "picasso",
  "warhol",
  "davinci",
  "monet",
  "cartoon",
  "ai-character",
] as const satisfies readonly StyleId[];

export const ART_INTENSITIES = ["low", "medium", "high"] as const satisfies readonly StyleIntensity[];

const treatments: Record<(typeof ART_STYLE_IDS)[number], string> = {
  impressionist:
    "a luminous Impressionist painting with lively dabbed strokes, broken colour, soft edges, and dancing natural light",
  watercolor:
    "a delicate watercolor wash with translucent pigment, soft bleeding edges, and textured cold-press paper",
  pointillist:
    "a rich oil painting with layered pigment, confident visible brush strokes, vibrant saturation, and subtle canvas texture",
  "pop-art":
    "a sophisticated pencil and charcoal drawing with cross-hatching, high-contrast monochrome contours, and visible paper tooth",
  abstract:
    "a bold modernist painting with angular geometric planes and a controlled expressive palette",
  vangogh:
    "an oil painting in the unmistakable style of Vincent van Gogh: thick swirling impasto brushstrokes, rhythmic curved marks like The Starry Night, vivid cobalt blues and chrome yellows",
  picasso:
    "a Cubist painting in the style of Pablo Picasso: faces and forms fragmented into bold angular geometric planes, multiple viewpoints at once, strong black contours, flat ochre, blue and red colour fields",
  warhol:
    "an Andy Warhol pop-art silkscreen print: flat saturated neon colour blocks, bold black halftone shadows, high-contrast posterized portrait, presented as a 2x2 grid of the same image in four different colour schemes",
  davinci:
    "a Renaissance oil painting in the style of Leonardo da Vinci: sfumato soft smoky shading, warm umber and olive tones, aged varnished panel with fine craquelure, misty atmospheric landscape",
  monet:
    "an Impressionist painting in the style of Claude Monet: soft dappled sunlight, short pastel broken-colour dabs, shimmering reflections like his water-lily garden paintings",
  cartoon:
    "a cheerful 2D cartoon illustration: clean bold outlines, flat bright cel-shaded colours, simplified friendly features while keeping each person recognizable",
  "ai-character":
    "a 3D animated movie character render in a Pixar-like style: stylized proportions, large expressive eyes, smooth skin, soft cinematic global illumination, while keeping each person recognizable",
};

const intensityInstructions: Record<StyleIntensity, string> = {
  low: "Keep the source composition and facial structure very close; apply the medium gently.",
  medium: "Balance clear source likeness with an unmistakable transformation in the requested medium.",
  high: "Make the artistic construction bold and pervasive while retaining recognizable identities and essential objects.",
};

export function isArtStyleId(value: string): value is (typeof ART_STYLE_IDS)[number] {
  return ART_STYLE_IDS.some((id) => id === value);
}

export function isArtIntensity(value: string): value is StyleIntensity {
  return ART_INTENSITIES.some((intensity) => intensity === value);
}

export function artworkKey(styleId: StyleId, intensity: StyleIntensity): string {
  return `${styleId}:${intensity}`;
}

export function buildArtEditPrompt(
  styleId: (typeof ART_STYLE_IDS)[number],
  intensity: StyleIntensity,
): string {
  return [
    `Transform the supplied photograph into ${treatments[styleId]}.`,
    intensityInstructions[intensity],
    "Preserve every person's recognizable identity, age, expression, skin tone, pose, gaze, body proportions, and relative position.",
    "Preserve the original crop, camera viewpoint, number of people, main objects, and scene layout.",
    "Do not add or remove people, facial features, fingers, limbs, text, signatures, borders, watermarks, or frames.",
    "The result must be a complete polished artwork, not a photo with a color filter applied.",
  ].join(" ");
}