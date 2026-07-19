import type { S3Client } from "bun";

// S3Client.list exists at runtime (Bun >= 1.3) but is missing from the
// hoisted type surface — typed shim.
export function listObjects(
  client: S3Client,
  prefix: string,
): Promise<{ contents?: Array<{ key: string }> }> {
  return (
    client as unknown as {
      list: (o: { prefix: string; maxKeys: number }) => Promise<{ contents?: Array<{ key: string }> }>;
    }
  ).list({ prefix, maxKeys: 1000 });
}
