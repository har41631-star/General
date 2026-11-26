// usage: node scripts/render.mjs <out.mp4> [from-to] [scale] [concurrency]
// Linux/cloud render: headless Chromium + SwiftShader WebGL. Frames are pure functions of the frame number,
// so any range can be rendered separately and concatenated.
import fs from "node:fs";
import path from "node:path";
const tmp = process.env.REMOTION_TMP || path.resolve(".remotion-tmp");
fs.mkdirSync(tmp, { recursive: true });
process.env.TEMP = process.env.TMP = process.env.TMPDIR = tmp;
const { bundle } = await import("@remotion/bundler");
const { renderMedia, selectComposition } = await import("@remotion/renderer");
const [out, range, scale = "1", conc = "2", id = "BridgeShort"] = process.argv.slice(2);
const browserExecutable = process.env.CHROME || "/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell";
const chromiumOptions = { gl: process.env.GL || "swangle" };
const serveUrl = await bundle({ entryPoint: path.resolve(process.env.BRIDGE_ENTRY || "src/index.ts"), publicDir: path.resolve("public") });
const inputProps = process.env.PROPS ? JSON.parse(process.env.PROPS) : {};
const composition = await selectComposition({ serveUrl, id, inputProps, browserExecutable, chromiumOptions, timeoutInMilliseconds: 600000 });
const frameRange = range && range !== "all" ? range.split("-").map(Number) : null;
fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
const t0 = Date.now();
let last = 0;
await renderMedia({ composition, serveUrl, codec: "h264", crf: 16, outputLocation: out, inputProps, scale: Number(scale),
  frameRange, concurrency: Number(conc), browserExecutable, chromiumOptions, timeoutInMilliseconds: 600000, muted: true,
  onProgress: ({ renderedFrames }) => { if (renderedFrames - last >= 10) { last = renderedFrames; const s = (Date.now() - t0) / 1000;
    console.log(`frames ${renderedFrames} ${s.toFixed(0)}s ${(renderedFrames / s).toFixed(2)} fps`); } } });
console.log("done", out, ((Date.now() - t0) / 1000).toFixed(0) + "s");
