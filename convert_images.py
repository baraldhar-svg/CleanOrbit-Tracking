import os, glob
from PIL import Image

for f in glob.glob('apps/webview-app/assets/*.png'):
    print(f"Converting {f}...")
    try:
        img = Image.open(f)
        img = img.convert('RGBA')
        img.save(f, 'PNG')
        print(f"Success: {f}")
    except Exception as e:
        print(f"Failed to convert {f}: {e}")
