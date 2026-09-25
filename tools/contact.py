import sys, math
from pathlib import Path
from PIL import Image, ImageDraw
cat=sys.argv[1]; cols=int(sys.argv[2]) if len(sys.argv)>2 else 6; tw=int(sys.argv[3]) if len(sys.argv)>3 else 220
files=sorted(Path('raw',cat).glob('*.png'))
ims=[Image.open(f).convert('RGB') for f in files]
th=int(tw*ims[0].height/ims[0].width)
rows=math.ceil(len(ims)/cols)
sheet=Image.new('RGB',(cols*tw,rows*(th+14)),(20,20,20))
d=ImageDraw.Draw(sheet)
for i,(f,im) in enumerate(zip(files,ims)):
    x=(i%cols)*tw; y=(i//cols)*(th+14)
    sheet.paste(im.resize((tw,th)),(x,y)); d.text((x+3,y+th),f.stem,fill=(255,255,0))
sheet.save(f'/tmp/claude-0/sheet_{cat}.jpg',quality=85)
print(len(files))
