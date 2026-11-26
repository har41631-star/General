import sys, glob
from PIL import Image, ImageDraw
files = sorted(glob.glob(sys.argv[1]))
out = sys.argv[2]; cols = int(sys.argv[3]) if len(sys.argv) > 3 else 4
w, h = 432, 768
rows = (len(files) + cols - 1) // cols
sheet = Image.new('RGB', (cols * w + (cols - 1) * 8, rows * h + (rows - 1) * 8), 'white')
for i, f in enumerate(files):
    im = Image.open(f).convert('RGB').resize((w, h), Image.LANCZOS)
    ImageDraw.Draw(im).text((8, 8), f.split('/')[-1], fill='yellow')
    sheet.paste(im, ((i % cols) * (w + 8), (i // cols) * (h + 8)))
sheet.save(out)
