#!/usr/bin/env python3
"""
Usage: python3 scripts/crop-avatar.py <source_photo> <name>

Crops any photo to a square centered on the face and saves it as
images/team-<name>.jpg, ready to commit.

Examples:
  python3 scripts/crop-avatar.py ~/Downloads/PHOTO-123.jpg danny
  python3 scripts/crop-avatar.py ~/Downloads/PHOTO-456.jpg tamara
  python3 scripts/crop-avatar.py ~/Downloads/PHOTO-789.jpg francisco

Face position is detected automatically. Falls back to center-crop if
face detection is unavailable.
"""

import sys
import os
from PIL import Image

def crop_square_on_face(src_path, dest_path):
    img = Image.open(src_path).convert('RGB')
    w, h = img.size

    face_y = h // 2  # default: center
    face_detected = False

    # Try OpenCV face detection if available
    try:
        import cv2
        import numpy as np
        cv_img = cv2.imdecode(np.frombuffer(open(src_path,'rb').read(), np.uint8), cv2.IMREAD_COLOR)
        cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
        faces = cascade.detectMultiScale(cv2.cvtColor(cv_img, cv2.COLOR_BGR2GRAY), 1.1, 4)
        if len(faces):
            x, fy, fw, fh = sorted(faces, key=lambda f: f[2]*f[3])[-1]  # largest face
            face_y = fy + fh // 2
            face_detected = True
            print(f"Face detected at y={face_y} ({face_y/h*100:.0f}% from top)")
    except ImportError:
        pass

    if not face_detected:
        # Heuristic: faces tend to be in the upper 40% of portrait photos
        face_y = int(h * 0.38) if h > w else h // 2
        print(f"No face detection available — using heuristic y={face_y} ({face_y/h*100:.0f}%)")

    # Square size = full image width
    size = w
    top  = max(0, face_y - size // 2)
    bottom = top + size
    if bottom > h:
        bottom = h
        top = max(0, bottom - size)

    cropped = img.crop((0, top, w, bottom))
    cropped.save(dest_path, quality=92)
    print(f"Saved {dest_path} — {w}x{h} → {cropped.size[0]}x{cropped.size[1]} (y {top}–{bottom})")

if __name__ == '__main__':
    if len(sys.argv) != 3:
        print(__doc__)
        sys.exit(1)

    src  = os.path.expanduser(sys.argv[1])
    name = sys.argv[2].lower()
    dest = os.path.join(os.path.dirname(__file__), '..', 'images', f'team-{name}.jpg')
    dest = os.path.normpath(dest)

    if not os.path.exists(src):
        print(f"Error: {src} not found")
        sys.exit(1)

    crop_square_on_face(src, dest)
    print(f"\nNext: bump the cache version in index.html for avatar-{name}, then git add + commit + push.")
