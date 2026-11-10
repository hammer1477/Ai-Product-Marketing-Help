// Fetches a remote/signed image URL once and inlines it as a base64 data
// URI, so the final Satori render doesn't depend on a signed URL still
// being valid (or the network) at render time — per Satori's own guidance
// that embedded image data avoids extra I/O during rendering.
export async function toDataUri(url: string): Promise<string> {
  if (url.startsWith("data:")) return url;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch image for inlining: ${url} (${response.status})`);
  }

  const contentType = response.headers.get("content-type") ?? "image/jpeg";
  const buffer = Buffer.from(await response.arrayBuffer());
  return `data:${contentType};base64,${buffer.toString("base64")}`;
}
