import json,sys,ssl,time,urllib.request,concurrent.futures as cf
r=json.load(open('colleges.json'))['colleges']
kind=sys.argv[1]
if kind=='links': items=[(c['id'],c['name'],c['link']) for c in r if c.get('link')]
else: items=[(c['id'],c['name'],c['photo']['url']) for c in r if c.get('photo') and c['photo'].get('url')]
ctx=ssl.create_default_context()
UA={'User-Agent':'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124 Safari/537.36','Accept':'*/*'}
def chk(it):
    id,name,u=it
    for method in ('HEAD','GET'):
        try:
            req=urllib.request.Request(u,headers=UA,method=method)
            with urllib.request.urlopen(req,timeout=15,context=ctx) as resp:
                ct=resp.headers.get('content-type',''); ln=resp.headers.get('content-length')
                body=resp.read(2048) if method=='GET' else b''
                return dict(id=id,name=name,url=u,status=resp.status,final=resp.geturl(),ct=ct,len=ln,method=method)
        except urllib.error.HTTPError as e:
            if method=='HEAD' and e.code in (403,405,400,404,501): continue
            return dict(id=id,name=name,url=u,status=e.code,err=str(e))
        except Exception as e:
            if method=='HEAD': continue
            return dict(id=id,name=name,url=u,status=0,err=type(e).__name__+': '+str(e)[:100])
out=[]
with cf.ThreadPoolExecutor(48) as ex:
    for i,res in enumerate(ex.map(chk,items)):
        out.append(res)
json.dump(out,open(f'{kind}_result.json','w'))
print('done',kind,len(out))
