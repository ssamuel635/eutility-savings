"""Generates assets/img/hero-hdb.svg — an original illustrated HDB-at-sunset scene with
subtle looping motion (a stand-in for the cinemagraph in the brief). Replace with real
imagery/cinemagraph before launch."""
import random
random.seed(7)
W,H=800,1000
out=[]
a=out.append
a(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" preserveAspectRatio="xMidYMax slice" role="img" aria-label="Illustration of HDB blocks at sunset with lit windows">')
a('''<defs>
<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
<stop offset="0" stop-color="#0D2A5C"/><stop offset=".35" stop-color="#34407F"/>
<stop offset=".6" stop-color="#B55A7E"/><stop offset=".78" stop-color="#F57C00"/><stop offset="1" stop-color="#FFC069"/></linearGradient>
<radialGradient id="sun" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#FFF3C4"/><stop offset=".55" stop-color="#FFD180"/><stop offset="1" stop-color="#FFD180" stop-opacity="0"/></radialGradient>
<linearGradient id="facade" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#F1D3BC"/><stop offset="1" stop-color="#E2B89C"/></linearGradient>
<linearGradient id="facade2" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#D9E3EE"/><stop offset="1" stop-color="#BFCCDC"/></linearGradient>
</defs>
<style>
.fl{animation:fl 7s ease-in-out infinite}
@keyframes fl{0%,100%{opacity:1}45%{opacity:1}50%{opacity:.25}55%{opacity:1}}
.on{animation:on 11s ease-in-out infinite}
@keyframes on{0%,40%{opacity:0}48%,100%{opacity:1}}
.sun{animation:sun 6s ease-in-out infinite alternate;transform-origin:560px 700px}
@keyframes sun{from{transform:scale(1)}to{transform:scale(1.06)}}
.cloud{animation:drift 40s linear infinite alternate}
@keyframes drift{from{transform:translateX(-30px)}to{transform:translateX(40px)}}
.bird{animation:bird 18s linear infinite}
@keyframes bird{from{transform:translate(-120px,0)}to{transform:translate(920px,-60px)}}
@media (prefers-reduced-motion:reduce){*{animation:none!important}}
</style>''')
a(f'<rect width="{W}" height="{H}" fill="url(#sky)"/>')
a('<circle class="sun" cx="560" cy="700" r="170" fill="url(#sun)"/><circle cx="560" cy="700" r="62" fill="#FFE8A3"/>')
a('<g class="cloud" fill="#FFFFFF" opacity=".18"><ellipse cx="180" cy="260" rx="140" ry="18"/><ellipse cx="260" cy="245" rx="80" ry="14"/><ellipse cx="620" cy="360" rx="120" ry="14"/></g>')
a('<g class="bird" fill="none" stroke="#1B2447" stroke-width="2.4" stroke-linecap="round"><path d="M0 420q8-8 16 0q8-8 16 0"/><path d="M40 440q6-6 12 0q6-6 12 0"/></g>')
# distant skyline
x=0
a('<g fill="#3A3570" opacity=".75">')
while x<W:
    w=random.randint(40,90); h=random.randint(120,300)
    a(f'<rect x="{x}" y="{780-h}" width="{w}" height="{h+10}"/>'); x+=w+random.randint(0,12)
a('</g>')
def block(x,y,w,h,fid,floors,cols,family=None):
    top=y
    a(f'<rect x="{x}" y="{y}" width="{w}" height="{H-y}" fill="url(#{fid})"/>')
    a(f'<rect x="{x+w-18}" y="{y}" width="18" height="{H-y}" fill="#000" opacity=".12"/>')
    a(f'<rect x="{x+w*0.3}" y="{y-26}" width="{w*0.4}" height="26" fill="url(#{fid})"/><rect x="{x+w*0.3}" y="{y-26}" width="{w*0.4}" height="4" fill="#000" opacity=".15"/>')
    fh=(H-y-30)/floors
    cw=(w-30)/cols
    for f in range(floors):
        fy=y+14+f*fh
        a(f'<rect x="{x}" y="{fy+fh-5}" width="{w}" height="3" fill="#000" opacity=".08"/>')
        for c in range(cols):
            wx=x+12+c*cw; ww=cw-8; wh=fh*0.5
            r=random.random()
            if family and (f,c)==family:
                a(f'<rect x="{wx-4}" y="{fy+fh*0.12}" width="{ww+8}" height="{wh+6}" fill="#FFD54F"/>')
                cx=wx+ww/2
                a(f'<g fill="#5B3B3B"><circle cx="{cx-7}" cy="{fy+fh*0.12+10}" r="4"/><rect x="{cx-11}" y="{fy+fh*0.12+14}" width="8" height="{wh-10}" rx="3"/><circle cx="{cx+6}" cy="{fy+fh*0.12+13}" r="3"/><rect x="{cx+3}" y="{fy+fh*0.12+16}" width="6" height="{wh-13}" rx="3"/></g>')
                continue
            if r<0.22: cls=' class="fl"' if random.random()<.3 else ''; col='#FFD54F'
            elif r<0.28: cls=' class="on"'; col='#FFE082'
            else: cls=''; col='#6B5566' if fid=='facade' else '#55607A'
            a(f'<rect{cls} x="{wx:.1f}" y="{fy+fh*0.15:.1f}" width="{ww:.1f}" height="{wh:.1f}" rx="1.5" fill="{col}" style="animation-delay:{random.uniform(0,9):.1f}s"/>')
block(20,430,230,0,'facade',16,5)
block(270,520,190,0,'facade2',13,4,family=(6,2))
block(500,470,260,0,'facade',15,6)
# trees & ground
a('<g fill="#1B3A2F">')
for i in range(22):
    cx=i*40+random.randint(-10,10); r=random.randint(26,44)
    a(f'<circle cx="{cx}" cy="{H-40+random.randint(-10,10)}" r="{r}"/>')
a('</g><rect y="975" width="800" height="25" fill="#14261F"/>')
a('</svg>')
open('assets/img/hero-hdb.svg','w').write('\n'.join(out))
print('ok')
