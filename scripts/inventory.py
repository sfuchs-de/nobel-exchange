"""Public award-index inventory. The index is a discovery aid, not final verification."""
import json, re, html, subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
RAW=ROOT/'research'/'raw'
RAW.mkdir(parents=True, exist_ok=True)
def clean(s): return ' '.join(html.unescape(re.sub('<[^>]+>', ' ', s)).split())
def get(url,key):
    p=RAW/(key+'.html')
    if not p.exists():p.write_bytes(subprocess.check_output(['curl','--fail','--silent','--show-error','--max-time','40',url]))
    return p.read_text()
url='https://en.wikipedia.org/wiki/List_of_Clarivate_Citation_laureates_in_Economic_Sciences'
source=get(url,'clarivate-index')
table=re.search(r'<table class="wikitable".*?</table>',source,re.S)[0]
entries=[]; year=''; inherited={}
for row in re.findall(r'<tr\b.*?</tr>',table,re.S):
    cells=re.findall(r'<t[dh]\b([^>]*)>(.*?)</t[dh]>',row,re.S)
    if len(cells)==1:
        year=re.search(r'20\d\d(?:[–-]20\d\d)?',clean(cells[0][1]))[0]; continue
    if len(cells)<3 or '(born' not in clean(row) and not re.search(r'\(\d{4}[–-]\d{4}\)',clean(row)): continue
    full=[]; i=0
    for col in range(5):
        if col in inherited:
            val,remaining=inherited[col];full.append(val)
            if remaining<=1:del inherited[col]
            else:inherited[col]=(val,remaining-1)
        elif i<len(cells):
            attrs,val=cells[i];i+=1;full.append(val)
            span=re.search(r'rowspan="(\d+)"',attrs)
            if span:inherited[col]=(val,int(span[1])-1)
        else:full.append('')
    person=full[1];name=clean(person).split(' (')[0]
    link=re.search(r'<a[^>]+href="([^"]+)"',person)
    profile=html.unescape(link[1]) if link else ''
    if profile.startswith('./'):profile='https://en.wikipedia.org/wiki/'+profile[2:]
    if profile.startswith('/'):profile='https://en.wikipedia.org'+profile
    winner='Nobel' in full[0] or bool(re.search(r'20\d\d',clean(full[0])))
    deceased=bool(re.search(r'\(\d{4}[–-]\d{4}\)',clean(person)))
    entries.append({'name':name,'year':year,'institution_at_award':clean(full[4]),'profile':profile,'eligible':not winner and not deceased,'exclusion':'previous Nobel laureate' if winner else 'deceased' if deceased else None})
(ROOT/'research'/'clarivate-inventory.json').write_text(json.dumps({'retrieved':'2026-10-08','index':url,'primaryArchive':'https://clarivate.com/citation-laureates/hall-of-citation-laureates/','entries':entries},ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'total':len(entries),'eligible':sum(e['eligible'] for e in entries)}))
for e in entries:
    if e['eligible']:print(e['name']+' | '+e['institution_at_award'])
