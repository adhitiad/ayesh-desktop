import os
from PIL import Image, ImageDraw, ImageFont

S = 1024
img = Image.new('RGBA', (S, S), (0, 0, 0, 0))
d = ImageDraw.Draw(img)
d.rounded_rectangle([0, 0, S - 1, S - 1], radius=int(S * 0.1875), fill=(15, 23, 42, 255))
margin = int(S * 0.12)
d.ellipse([margin, margin, S - margin, S - margin], outline=(56, 189, 248, 255), width=int(S * 0.035))
font = ImageFont.truetype(r'C:\Windows\Fonts\arialbd.ttf', int(S * 0.5))
d.text((S / 2, S / 2), 'A', font=font, fill=(248, 250, 252, 255), anchor='mm')
os.makedirs('assets', exist_ok=True)
img.save('assets/icon.png')
img.save('assets/icon.ico', sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
print('ok', img.size)
