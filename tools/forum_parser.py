#!/usr/bin/env python3
"""Safe local RMRP importer. Reads the PRIMARY forum post, removes link-only tables
of contents, keeps normative paragraphs, and refuses heading-only documents.

Does not publish or access the user's Yandex Cloud. Import output remains local
and requires an explicit human approval in the admin UI.
"""
import argparse
import hashlib
from datetime import datetime, timezone
import shutil
import json
import re
import sys
import time
from pathlib import Path

import requests
from bs4 import BeautifulSoup, NavigableString, Tag

ROOT = Path(__file__).resolve().parent.parent
CATALOG = ROOT / 'sources.json'
OUT = ROOT / 'laws-import.json'
REPORT = ROOT / 'laws-quality-report.txt'
BLOCKS = {'div','p','li','blockquote','pre','h1','h2','h3','h4','h5','h6','section','article','ul','ol','table','tr','td','th','details','dl','dt','dd'}
IGNORED = {'script','style','noscript','svg','button','iframe','form'}
ARTICLE_RE = re.compile(r'^Статья\s+\d+(?:[.\-]\d+)*(?:\s*[.\-–—:]|\s|$)',re.I)
HEADER_RE = re.compile(r'^(?:Глава\s+[IVXLC\d]+|Раздел\s+[IVXLC\d]+|Статья\s+\d+(?:[.\-]\d+)*)\b', re.I)


def norm_line(value):
    return re.sub(r'[\t \u00a0]+', ' ', value.replace('\u200b','').replace('\u2060','').replace('\ufeff','')).strip()


def normalize(text):
    lines = [norm_line(line) for line in text.replace('\r','').split('\n')]
    out = []
    for line in lines:
        if not line:
            if out and out[-1]:out.append('')
        else:
            out.append(line)
    while out and not out[-1]:out.pop()
    return '\n'.join(out)


def remove_navigation(root):
    """Drop only DOM blocks that are demonstrably article-link indexes.
    Do not remove general blockquotes (some are genuinely normative)."""
    for block in reversed(root.select('blockquote, .bbCodeBlock, .bbCodeSpoiler, nav, .toc, .table-of-contents')):
        if block.parent is None:continue
        if block.name == 'nav' or 'toc' in ' '.join(block.get('class',[])).lower():
            block.decompose();continue
        links = block.find_all('a',href=True)
        local_links = [a for a in links if re.search(r'#[\w-]+$',a.get('href',''))]
        plain = norm_line(block.get_text(' ',strip=True))
        anchor_chars = sum(len(norm_line(a.get_text(' ',strip=True))) for a in local_links)
        # Real ToCs repeat many linked article names, without a substantive text body.
        if len(local_links)>=6 and anchor_chars >= len(plain)*.58:
            block.decompose()


def candidate_blocks(soup):
    posts=soup.select('article.message--post') or soup.select('article.message') or soup.select('.message')
    if not posts:raise ValueError('Не найдено первое сообщение темы форума (возможно, требуется авторизация).')
    first=posts[0]
    wrappers=first.select('.message-body .bbWrapper') or first.select('.bbWrapper') or first.select('.message-body')
    if not wrappers:raise ValueError('Текст сообщения не найден: проверьте, открывается ли форум без входа.')
    # Nested .bbWrapper can occur in the ToC. Prefer the wrapper with actual article bodies.
    def score(w):
        s=norm_line(w.get_text(' ',strip=True))
        return (len(s), len(w.find_all(['p','div','br'])))
    wrappers.sort(key=score,reverse=True)
    return wrappers


def to_plain(root):
    pieces=[]
    def walk(n):
        if isinstance(n,NavigableString):
            pieces.append(str(n).replace('\u00a0',' '));return
        if not isinstance(n,Tag) or n.name in IGNORED:return
        if n.name=='br':pieces.append('\n');return
        if n.name=='img':return
        if n.name in BLOCKS:pieces.append('\n')
        for child in n.children:walk(child)
        if n.name in BLOCKS:pieces.append('\n')
    walk(root)
    return normalize(''.join(pieces))


def drop_duplicate_toc(text):
    """Fallback when XenForo renders the ToC without a wrapper: remove a leading
    contiguous list of bare article headings IF a second substantive sequence
    of the same articles appears below it."""
    lines=text.split('\n')
    candidates=[]
    for i,line in enumerate(lines):
        if ARTICLE_RE.match(line):candidates.append((i,line))
    if len(candidates)<12:return text
    # Identify first article appearing twice; only a series of article names in
    # the leading part may be excluded. Never drop an article with actual content.
    first_i,first_name=candidates[0]
    article_key=lambda s:(re.match(r'^Статья\s+\d+(?:[.\-]\d+)*',s,re.I).group(0).lower() if ARTICLE_RE.match(s) else '')
    later=[i for i,name in candidates[1:] if article_key(name)==article_key(first_name)]
    if not later:return text
    second_start=later[0]
    # Only strip if the first run contains MANY bare headings AND little body.
    run=[(i,name) for i,name in candidates if first_i<=i<second_start]
    if len(run)<6:return text
    body=' '.join(lines[first_i:second_start])
    titles=' '.join(name for _,name in run)
    if len(body)>len(titles)*1.4:return text
    # Guard: don't drop material preceding the index (preamble).
    return normalize('\n'.join(lines[:first_i]+lines[second_start:]))


def quality(text):
    lines=[norm_line(x) for x in text.split('\n')]
    starts=[i for i,line in enumerate(lines) if ARTICLE_RE.match(line)]
    stats={'chars':len(text),'articles':len(starts),'short_articles':0,'empty_articles':0,'total_article_body_chars':0}
    for pos,i in enumerate(starts):
        end=starts[pos+1] if pos+1<len(starts) else len(lines)
        # Ignore chapter headings as body; they don't repair an empty article.
        body=' '.join(s for s in lines[i+1:end] if s and not HEADER_RE.match(s))
        stats['total_article_body_chars']+=len(body)
        if len(body)<12:stats['empty_articles']+=1
        if len(body)<40:stats['short_articles']+=1
    valid=True;reasons=[]
    if len(text)<400:
        valid=False;reasons.append('Меньше 400 символов')
    if starts:
        ratio=stats['empty_articles']/len(starts)
        if ratio>.12:
            valid=False;reasons.append(f'Пустых статей: {stats["empty_articles"]}/{len(starts)}')
        if stats['total_article_body_chars']<len(starts)*32:
            valid=False;reasons.append('Слишком мало текста по сравнению с числом статей')
    else:
        # Orders or charters can have sections/points instead of 'Статья'.
        if len(text)<900:
            valid=False;reasons.append('Нет статей и менее 900 символов содержимого')
    stats['ok']=valid;stats['reasons']=reasons
    return stats


def extract_text(markup):
    soup=BeautifulSoup(markup,'html.parser')
    candidates=candidate_blocks(soup)
    ranked=[]
    for candidate in candidates[:6]:
        # Avoid mutating soup across tries.
        candidate=BeautifulSoup(str(candidate),'html.parser')
        remove_navigation(candidate)
        t=drop_duplicate_toc(to_plain(candidate))
        ranked.append((t,quality(t)))
    ranked.sort(key=lambda r:(r[1]['ok'],r[1]['total_article_body_chars'],r[1]['chars']),reverse=True)
    best,stats=ranked[0]
    if not stats['ok']:
        raise ValueError('Текст не прошёл проверку полноты: '+('; '.join(stats['reasons']) or 'неизвестная причина')+f' ({stats["articles"]} статей, {stats["chars"]} символов).')
    return best,stats


def main():
    ap=argparse.ArgumentParser(description='Надёжный импорт законов RMRP с проверкой текстов статей')
    ap.add_argument('--limit',type=int,default=0,help='Первые N документов')
    ap.add_argument('--only',default='',help='ID темы форума, например 58232')
    ap.add_argument('--skip-errors',action='store_true')
    ap.add_argument('--html-dir',default='',help='Опционально: готовые HTML-файлы <ID>.html в папке (без сетевых запросов)')
    args=ap.parse_args()
    records=json.loads(CATALOG.read_text(encoding='utf8'))
    if args.only:records=[x for x in records if x['id']=='law-'+args.only]
    if args.limit:records=records[:args.limit]
    if not records:sys.exit('Не нашёл документов под указанным ID')
    result={'format':'fso-rmrp-laws-import-v2','source':'https://forum.rmrp.ru/','items':[],'failed':[],'quality':[]}
    sess=requests.Session();sess.headers.update({'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0 Safari/537.36'})
    for k,r in enumerate(records,1):
        url=r['sourceUrl'];print(f'[{k}/{len(records)}] {r["title"]}',flush=True)
        try:
            local=Path(args.html_dir)/ (r['id'].removeprefix('law-')+'.html') if args.html_dir else None
            if local:
                if not local.is_file():raise ValueError('Нет сохранённого HTML: '+str(local))
                markup=local.read_text(encoding='utf-8')
            else:
                if not url.startswith('https://forum.rmrp.ru/threads/'):raise ValueError('Недопустимый URL')
                response=sess.get(url,timeout=35,allow_redirects=True);response.raise_for_status()
                if not response.url.startswith('https://forum.rmrp.ru/'):raise ValueError('Перенаправление на чужой сайт')
                markup=response.text
            text,stats=extract_text(markup)
            if len(text)>600000:raise ValueError(f'Текст превышает лимит API ({len(text)} символов)')
            summary='[УСТАВ] Тверской' if r['category']=='charter' else ('[ПРИКАЗ]' if r['category']=='order' else '')
            result['items'].append({'id':r['id'],'title':r['title'],'summary':summary,'body':text,'sectionId':'laws','status':'draft','sourceUrl':url,'quality':stats,'sha256':hashlib.sha256(text.encode('utf-8')).hexdigest()})
            result['quality'].append({'title':r['title'],'id':r['id'],**stats})
            print(f'  OK: {stats["chars"]} символов, {stats["articles"]} статей, пустых: {stats["empty_articles"]}',flush=True)
        except Exception as e:
            result['failed'].append({'title':r['title'],'url':url,'error':str(e)})
            print('  ОШИБКА: '+str(e),flush=True)
            if not args.skip_errors:print('  Для продолжения ошибок используйте --skip-errors',flush=True)
        if not args.html_dir:time.sleep(.75)
    # Preserve previous local snapshot, so an accidental bad download does not erase
    # the last good import.  This never changes the Yandex bucket by itself.
    previous={}
    if OUT.is_file():
        try:
            old=json.loads(OUT.read_text(encoding='utf-8'))
            previous={x['id']:x.get('sha256') or hashlib.sha256(x['body'].encode('utf-8')).hexdigest()
                      for x in old.get('items',[]) if x.get('body')}
            backup=ROOT/'backups';backup.mkdir(exist_ok=True)
            target=backup/('laws-import-'+datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')+'.json')
            shutil.copy2(OUT,target)
            print('Сохранена локальная копия:',target)
        except (ValueError,KeyError,TypeError) as e:
            print('Внимание: предыдущий JSON не прочитан:',e)
    changes=[]
    for item in result['items']:
        oldhash=previous.get(item['id'])
        state=('НОВЫЙ' if oldhash is None else ('БЕЗ ИЗМЕНЕНИЙ' if oldhash==item['sha256'] else 'ИЗМЕНЁН'))
        changes.append(f'{state}: {item["id"]} — {item["title"]}')
    result['checkedAt']=datetime.now(timezone.utc).isoformat()
    OUT.write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
    REPORT.write_text('\n'.join(['Проверка извлечения законов RMRP',f'Успешно: {len(result["items"])}',f'Ошибки: {len(result["failed"])}','',*changes,'']+[f'{x["id"]} — {x["title"]}: {x["articles"]} статей, пустых {x["empty_articles"]}, символов {x["chars"]}' for x in result['quality']]+['']+['ОШИБКА: '+x['title']+' — '+x['error'] for x in result['failed']]),encoding='utf-8')
    print(f'\nФайлы: {OUT.name}, {REPORT.name}; готово: {len(result["items"])}; ошибок: {len(result["failed"])}')
    if result['failed']:print('Не публикуйте весь список, пока не устранены ошибки и не сверены нормы.')

if __name__=='__main__':main()
