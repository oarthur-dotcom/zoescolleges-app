#!/usr/bin/env python3
"""QA for a Muse photo handoff. Usage: qa_photos.py photos.json [MANIFEST.json] [--sheets N]
Checks (each photo): school id exists, 4-year/any, has NO existing photo, license on allowlist, https URL loads as image/*
(>=600px wide, landscape), URL not used by another school, no logo/seal/sign/map words in the file name.
Writes sheets/sheet-NN.png contact sheets (12 per sheet, school + city) for the 40 biggest schools plus a random sample of 60,
so a person can look at every one of those. Wikimedia rate-limits: requests are paced and honour Retry-After."""
import json,sys,os,io,re,time,random,hashlib,urllib.request,urllib.error
from PIL import Image,ImageDraw
UA={"User-Agent":"zoescolleges-photo-qa/1.0 (oarthur@gmail.com)"}
CAT="https://cdn.jsdelivr.net/gh/oarthur-dotcom/zoescolleges-data@714eeb9/colleges.json"
OKLIC=re.compile(r"^(CC0|CC BY(-SA)? [0-9.]+|Public domain|PD.*|CC BY(-SA)? [0-9.]+ .*)$",re.I)
BADNAME=re.compile(r"logo|seal|wordmark|crest|coat[_ ]of|emblem|flag|shield|signature|icon|symbol|mascot|map|sign[._ ]|_sign|entrance_sign|\.svg|\.pdf|portrait|president",re.I)
def get(url,tries=8):
    for i in range(tries):
        try: return urllib.request.urlopen(urllib.request.Request(url,headers=UA),timeout=40)
        except urllib.error.HTTPError as e:
            if e.code==429: time.sleep(min(120,int(e.headers.get('retry-after','30'))+3)); continue
            if e.code in (404,410): return None
            time.sleep(4)
        except Exception: time.sleep(6)
    return None
def main():
    f=sys.argv[1]; photos=json.load(open(f)); manifest=sys.argv[2] if len(sys.argv)>2 and not sys.argv[2].startswith('--') else None
    out=os.path.join(os.path.dirname(os.path.abspath(f)),'qa'); os.makedirs(out+'/sheets',exist_ok=True)
    rep={'checked':0,'ok':0,'problems':[],'manifest':None}
    if manifest:
        m=json.load(open(manifest)); bad=[]; base=os.path.dirname(os.path.abspath(manifest))
        for name,sha in (m.get('files') or m).items():
            sha=sha.get('sha256') if isinstance(sha,dict) else sha
            p=os.path.join(base,name)
            if os.path.exists(p) and hashlib.sha256(open(p,'rb').read()).hexdigest()!=sha: bad.append(name)
        rep['manifest']={'mismatched':bad}
    cat={str(c.get('unitid')):c for c in json.load(get(CAT))['colleges']}
    seen={}; good=[]
    for sid,p in photos.items():
        if sid.startswith('_') or not isinstance(p,dict): continue
        rep['checked']+=1; why=[]
        c=cat.get(sid)
        if not c: why.append('unknown school id')
        else:
            if c.get('photo') and c['photo'].get('url'): why.append('school already has a photo (must not replace)')
        u=p.get('url','')
        if not u.startswith('https://'): why.append('url not https')
        if not OKLIC.match(p.get('license','') or ''): why.append('license not allowed: %r'%p.get('license'))
        if BADNAME.search(u.split('/')[-1]): why.append('file name looks like logo/seal/sign/map')
        if u in seen: why.append('same URL as '+seen[u])
        seen[u]=sid
        if not why:
            r=get(u)
            if not r: why.append('url did not load')
            else:
                if not r.headers.get('content-type','').startswith('image/'): why.append('not an image')
                else:
                    try:
                        im=Image.open(io.BytesIO(r.read())).convert('RGB')
                        if im.width<600: why.append('under 600px wide')
                        if im.width<im.height: why.append('portrait')
                        if not why: good.append((sid,c,im))
                    except Exception as e: why.append('unreadable image')
            time.sleep(1.2)
        if why: rep['problems'].append({'id':sid,'name':(c or {}).get('name'),'why':why})
        else: rep['ok']+=1
    sz=lambda c:((c.get('scorecard') or {}).get('size') or 0)
    big=sorted(good,key=lambda x:-sz(x[1]))[:40]; rest=[g for g in good if g not in big]; random.seed(1); samp=random.sample(rest,min(60,len(rest)))
    review=big+samp; W,H=360,250
    for k in range(0,len(review),12):
        sheet=Image.new('RGB',(W*4,H*3),'white'); d=ImageDraw.Draw(sheet)
        for i,(sid,c,im) in enumerate(review[k:k+12]):
            t=im.copy(); t.thumbnail((W,H-34)); x,y=(i%4)*W,(i//4)*H; sheet.paste(t,(x,y))
            d.text((x+3,y+H-32),f"{k+i+1}. {c['name'][:52]}",fill='black'); d.text((x+3,y+H-18),f"{c.get('city','')}, {c.get('state','')}  {c['id'][:20]}",fill='gray')
        sheet.save(f"{out}/sheets/sheet-{k//12+1:02d}.png")
    rep['review_sheets']=(len(review)+11)//12; json.dump(rep,open(out+'/qa-report.json','w'),indent=1)
    print(json.dumps({k:(v if k!='problems' else len(v)) for k,v in rep.items()}))
main()
