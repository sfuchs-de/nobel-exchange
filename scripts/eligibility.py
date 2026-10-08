"""Read each public biography separately; retain evidence for the final roster review."""
import json,re,html,subprocess,concurrent.futures,time
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];RAW=ROOT/'research'/'raw'
data=json.loads((ROOT/'public'/'candidates.json').read_text())
def clean(s):return ' '.join(html.unescape(re.sub('<[^>]+>',' ',s)).split())
def read(url,key):
    path=RAW/(key+'.html')
    if not path.exists():
        content=subprocess.check_output(['curl','--fail','--location','--silent','--show-error','--max-time','25',url],stderr=subprocess.PIPE)
        path.write_bytes(content)
    return path.read_text()
try:
    aea=read('https://www.aeaweb.org/about-aea/honors-awards/bates-clark','aea-clark-index')
except Exception:aea=''
def one(c):
    url=c['profileUrl']
    if '/bates-clark' in url:
        links=re.findall(r'<a[^>]+href="([^"]+)"[^>]*>(.*?)</a>',aea,re.S)
        surname=c['name'].split()[-1]
        match=[u for u,t in links if surname.lower() in clean(t).lower()]
        if match:
            url=html.unescape(match[0]);url='https://www.aeaweb.org'+url if url.startswith('/') else url
        else:return {'id':c['id'],'name':c['name'],'status':'needs biography','source':url}
    if '/hall-of-' in url:return {'id':c['id'],'name':c['name'],'status':'needs biography','source':url}
    try:
        s=read(url,c['id']+'-bio')
        title=clean(re.search(r'<title[^>]*>(.*?)</title>',s,re.S)[1]) if '<title' in s else ''
        death=re.findall(r'<th[^>]*>\s*Died\s*</th>\s*<td[^>]*>(.*?)</td>',s,re.S)
        birth=re.findall(r'<th[^>]*>\s*Born\s*</th>\s*<td[^>]*>(.*?)</td>',s,re.S)
        description=re.search(r'<meta[^>]+(?:name|property)="(?:description|og:description)"[^>]+content="([^"]+)"',s)
        paragraphs=[clean(p) for p in re.findall(r'<p\b[^>]*>(.*?)</p>',s,re.S) if c['name'].split()[-1].lower() in clean(p).lower()]
        return {'id':c['id'],'name':c['name'],'source':url,'title':title,'death':list(map(clean,death)),'birth':list(map(clean,birth)),'description':html.unescape(description[1]) if description else '', 'biography_excerpt':next((p[:650] for p in paragraphs if len(p)>60),''),'status':'reviewed source' if title else 'needs biography','retrieved':'2026-10-08'}
    except Exception as e:return {'id':c['id'],'name':c['name'],'source':url,'status':'unavailable','error':str(e)[:200]}
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:result=list(pool.map(one,data['candidates']))
(ROOT/'research'/'eligibility-audit.json').write_text(json.dumps(result,indent=2,ensure_ascii=False)+'\n')
for r in result:print(r['name']+' | '+r['status']+' | '+str(r.get('death',[]))+' | '+r.get('biography_excerpt','')[:150])
