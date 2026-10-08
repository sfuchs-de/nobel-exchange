"""Reproducible public-source inventory. No credentials; no raw research text in public assets."""
import json, re, time, html, subprocess
from pathlib import Path
from urllib.request import Request, urlopen
def clean(s): return ' '.join(html.unescape(re.sub('<[^>]+>', ' ', s)).split())
def field(row, cls):
    m=re.search(r'<(?:span|td) class="'+re.escape(cls)+r'[^\"]*"[^>]*>(.*?)</(?:span|td)>',row,re.S)
    return clean(m[1]) if m else ''

ROOT=Path(__file__).resolve().parents[1]
RAW=ROOT/'research'/'raw'
RAW.mkdir(parents=True, exist_ok=True)
def get(url, key):
    p=RAW/(key+'.html')
    if p.exists(): return p.read_text()
    data=subprocess.check_output(['curl','--fail','--silent','--show-error','--max-time','35',url],text=True)
    p.write_text(data)
    time.sleep(.4)
    return data

base='https://clarivate.com/citation-laureates/hall-of-citation-laureates/'
items=[]
for page in range(1,9):
    url=base+f'?wpv_view_count=291984&clv-cl-fields=economics&wpv_paged={page}'
    rows=re.findall(r'<tr class="cl-laureate.*?</tr>',get(url,f'clarivate-{page}'),re.S)
    if not rows: break
    new=0
    for row in rows:
        if field(row,'cl-field')!='Economics':continue
        name=field(row,'cl-name')
        if any(i['name']==name for i in items):continue
        text=clean(row)
        year=re.search(r'cl-year-(\d+)',str(row))
        items.append({'name':name,'year':int(year[1]) if year else None,'institution_at_award':field(row,'cl-description'),'source':url,'raw_status':text,'row_classes':re.search('class="([^\"]+)"',row)[1]})
        new+=1
    print('Clarivate page',page,'new entries',new,flush=True)
    if not new:break
(ROOT/'research'/'clarivate-inventory.json').write_text(json.dumps({'retrieved':'2026-10-08','source':base,'entries':items},ensure_ascii=False,indent=2)+'\n')
print('Total Clarivate economists:',len(items))
