"""2.5D relight maps for a painted cut-out rock (rock treatment "relight",
components/ui/relit-rock.tsx). Needs numpy + Pillow.

usage: python3 scripts/rocks/gen-relight-maps.py <rock.png> <out.png> [preview-dir]

The hero rocks ship as AVIF, which Pillow can't read here — decode first, and
encode the result near-lossless (lossy WebP/AVIF subsample chroma, which
smears the normal channels):
  node -e 'require("sharp")("public/rocks/left-rock.avif").png().toFile("/tmp/left-rock.png")'
  python3 scripts/rocks/gen-relight-maps.py /tmp/left-rock.png /tmp/left.relight.png
  node -e 'require("sharp")("/tmp/left.relight.png").resize({height:982,kernel:"lanczos3"}).webp({nearLossless:true,quality:60,effort:6}).toFile("public/rocks/left-rock.relight.webp")'

The encode halves it once more (982px tall = a quarter of the 3928px
painting): the relief is low-frequency, so it holds up at that size against a
1.5-dpr canvas, at about a third of the bytes (~210 KB per cliff vs ~620 KB).

Writes an RGBA map at half the source resolution:
  R,G = tangent-space normal x,y (OpenGL convention, +y up), n*0.5+0.5;
        z = sqrt(1 - x² - y²) is rebuilt in the shader
  B   = the painting's own low-frequency shading (baked daylight), as
        lum_blur / mean_lum * 0.5 — so 0.5 means "average-lit"; the shader
        divides it back out to flatten the baked sun before relighting.

Height = inflated silhouette (multi-scale blurred alpha → rounded body, steep
at the outline so the rim catches light) + band-passed luminance (the
painting's strokes and cracks read as relief: lit = raised).
"""
import sys
import numpy as np
from PIL import Image, ImageFilter

src, out = sys.argv[1], sys.argv[2]
prev = sys.argv[3] if len(sys.argv) > 3 else None

im = Image.open(src).convert("RGBA")
W, H = im.size[0] // 2, im.size[1] // 2
im = im.resize((W, H), Image.LANCZOS)
a_img = im.getchannel("A")
arr = np.asarray(im, np.float32) / 255
alpha = arr[..., 3]
lum = arr[..., :3] @ np.array([0.2126, 0.7152, 0.0722], np.float32)


def _box(x, r, axis):
    # running-sum box filter of radius r, edge-padded
    pad = [(0, 0)] * x.ndim
    pad[axis] = (r + 1, r)
    c = np.cumsum(np.pad(x, pad, mode="edge"), axis=axis, dtype=np.float64)
    n = x.shape[axis]
    hi = np.take(c, np.arange(2 * r + 1, 2 * r + 1 + n), axis=axis)
    lo = np.take(c, np.arange(0, n), axis=axis)
    return ((hi - lo) / (2 * r + 1)).astype(np.float32)


def blur(x, s):
    # three box passes per axis ≈ a gaussian of sigma s
    r = max(1, int(round(np.sqrt(12 * s * s / 3 + 1) / 2)))
    for axis in (0, 1):
        for _ in range(3):
            x = _box(x, r, axis)
    return x


# ── body shape: inflate the silhouette ──────────────────────────────────────
shape = np.zeros_like(alpha)
for s, w in ((4, 0.35), (16, 0.35), (48, 0.3)):
    shape += w * blur(alpha, s)
shape = np.sqrt(np.clip(shape, 0, 1))  # round the shoulders

# ── surface relief from the painting (lit ≈ raised) ─────────────────────────
# Normalise by local alpha so the outline's dark falloff isn't read as a ditch.
la = blur(lum * alpha, 1.2) / np.maximum(blur(alpha, 1.2), 1e-3)
fine = la - blur(la, 6)
mid = blur(la, 3) - blur(la, 28)
relief = (0.6 * fine + 1.0 * mid) * alpha

height = shape * 40.0 + relief * 60.0  # px-ish units at the working res

gy, gx = np.gradient(height)
n = np.stack([-gx, gy, np.ones_like(gx) * 2.0], -1)  # +y up: image y is down
n /= np.linalg.norm(n, axis=-1, keepdims=True)

# baked shading: very low-frequency luminance over the rock only
mean_l = float((lum * alpha).sum() / max(alpha.sum(), 1))
baked = blur(lum * alpha, 40) / np.maximum(blur(alpha, 40), 1e-3)
baked = np.clip(baked / mean_l * 0.5, 0, 1)

# Opaque RGB (no alpha: browsers may premultiply on decode and crush RGB where
# alpha is low): R,G = normal x,y (z is rebuilt in the shader), B = baked.
rgb = np.stack([n[..., 0] * 0.5 + 0.5, n[..., 1] * 0.5 + 0.5, baked], -1)
Image.fromarray((rgb * 255 + 0.5).astype(np.uint8), "RGB").save(out)
print(out, W, H, "mean lum", round(mean_l, 3))

if prev:
    # quick CPU relight preview (linear light), night + sunset
    def lin(c):
        return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)

    def srgb(c):
        c = np.clip(c, 0, 1)
        return np.where(c <= 0.0031308, c * 12.92, 1.055 * c ** (1 / 2.4) - 0.055)

    alb = lin(arr[..., :3])
    for name, amb, key, kd, rim, flat in (
        ("night", (0.07, 0.09, 0.16), (0.30, 0.42, 0.75), (-0.55, 0.5, 0.67), (0.35, 0.5, 0.95), 0.6),
        ("sunset", (0.55, 0.42, 0.52), (0.85, 0.45, 0.22), (0.7, 0.15, 0.7), (1.0, 0.55, 0.3), 0.35),
    ):
        L = np.array(kd, np.float32); L /= np.linalg.norm(L)
        ndl = np.clip(n @ L, 0, 1)[..., None]
        rimt = np.clip(1 - n[..., 2], 0, 1) ** 1.5 * np.clip(n[..., :2] @ L[:2] / np.linalg.norm(L[:2]), 0, 1)
        flatten = 1 / np.clip(1 + (baked * 2 - 1) * flat, 0.4, 2.5)
        a2 = alb * flatten[..., None]
        col = a2 * (np.array(amb) + np.array(key) * ndl) + a2 * np.array(rim) * rimt[..., None] * 1.5
        o = np.concatenate([srgb(col), alpha[..., None]], -1)
        bg = np.ones_like(o[..., :3]) * (np.array([16, 38, 74]) / 255 if name == "night" else np.array([230, 150, 160]) / 255)
        comp = o[..., :3] * alpha[..., None] + bg * (1 - alpha[..., None])
        Image.fromarray((comp * 255).astype(np.uint8)).save(f"{prev}/{name}-{src.split('/')[-1]}")
    nimg = Image.fromarray(((n * 0.5 + 0.5) * 255).astype(np.uint8))
    nimg.save(f"{prev}/normal-{src.split('/')[-1]}")
