# contact sheet of stills: python3 scripts/sheet.py "<glob>" out.jpg [cols] [cell width]
import sys, glob, re
from PIL import Image, ImageDraw
fs = sorted(glob.glob(sys.argv[1]), key=lambda f: int(re.findall(r"(\d+)\.jpg$", f)[0]))
cols = int(sys.argv[3]) if len(sys.argv) > 3 else 5; w = int(sys.argv[4]) if len(sys.argv) > 4 else 216; h = w * 16 // 9
rows = (len(fs) + cols - 1) // cols
S = Image.new("RGB", (cols * w, rows * h), "white")
for i, f in enumerate(fs):
    im = Image.open(f).convert("RGB").resize((w, h)); ImageDraw.Draw(im).text((4, 4), re.findall(r"(\d+)\.jpg$", f)[0], fill="yellow")
    S.paste(im, ((i % cols) * w, (i // cols) * h))
S.save(sys.argv[2], quality=85)
