import { mkdir, writeFile } from "fs/promises";
import path from "path";

/**
 * DEV-ONLY writer for /lab/cloud-sprites: receives a baked cloud sprite as a
 * WebP data-URL and writes it to public/clouds/sprites/<file>. Exists so the
 * bake lands directly in the repo instead of the browser's Downloads folder.
 * Hard-disabled in production builds.
 */
export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return new Response("Not found", { status: 404 });
  }

  const { file, dataUrl } = (await request.json()) as {
    file?: unknown;
    dataUrl?: unknown;
  };

  // Strict allowlisted filename — no separators, no traversal.
  if (typeof file !== "string" || !/^[a-z0-9][a-z0-9-]*\.webp$/.test(file)) {
    return Response.json({ error: "bad file name" }, { status: 400 });
  }
  const match =
    typeof dataUrl === "string"
      ? /^data:image\/webp;base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl)
      : null;
  if (!match) {
    return Response.json({ error: "bad dataUrl" }, { status: 400 });
  }

  const dir = path.join(process.cwd(), "public", "clouds", "sprites");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, file), Buffer.from(match[1], "base64"));
  return Response.json({ ok: true, file });
}
