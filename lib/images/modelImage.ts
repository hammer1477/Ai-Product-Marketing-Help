import sharp from "sharp";

/**
 * The product photo, sized for a vision model.
 *
 * Phone photos run to several megabytes; the model reads small print just
 * as well at 1280px, and the request stays fast and well under inline
 * size limits. Flattened onto white so a transparent PNG doesn't arrive as
 * a black rectangle.
 */
export async function toModelImage(dataUri: string): Promise<string> {
  const match = /^data:[^;]+;base64,([\s\S]*)$/.exec(dataUri);
  if (!match) throw new Error("Expected a base64 data URI");

  const jpeg = await sharp(Buffer.from(match[1], "base64"))
    .rotate()
    .resize(1280, 1280, { fit: "inside", withoutEnlargement: true })
    .flatten({ background: "#ffffff" })
    .jpeg({ quality: 86 })
    .toBuffer();

  return `data:image/jpeg;base64,${jpeg.toString("base64")}`;
}
