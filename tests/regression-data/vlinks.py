import json,ssl,urllib.request,concurrent.futures as cf,collections
items=json.load(open('visit_urls.json'))
UA={'User-Agent':'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124 Safari/537.36'}
def chk(it):
    id,k,u=it
    for m in ('HEAD','GET'):
        try:
            with urllib.request.urlopen(urllib.request.Request(u,headers=UA,method=m),timeout=12) as r: return [id,k,u,r.status,r.geturl()]
        except urllib.error.HTTPError as e:
            if m=='HEAD' and e.code in (400,403,404,405,501): continue
            return [id,k,u,e.code,'']
        except Exception as e:
            if m=='HEAD': continue
            return [id,k,u,0,type(e).__name__]
with cf.ThreadPoolExecutor(48) as ex: out=list(ex.map(chk,items))
json.dump(out,open('vlinks_result.json','w')); print(collections.Counter(o[3] for o in out))
