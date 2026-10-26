#!/usr/bin/env python3
"""Update PUBLIC statutory text stored alongside the GitHub Pages site.
Never writes to Yandex, never asks the user for a password.
Each document is replaced only after checking its completeness.
"""
from __future__ import annotations
import argparse
from datetime import datetime, timezone
import hashlib
import json
import re
from pathlib import Path
import sys
import time
import requests
from forum_parser import extract_text, quality

ROOT = Path(__file__).resolve().parent.parent
SOURCES = ROOT / 'sources.json'
DATA = ROOT / 'laws-data'
MANIFEST = DATA / 'manifest.json'
REPORT = DATA / 'last-check.txt'
ALLOWED_ID = re.compile(r'^law-\d{3,8}$')


def dump_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def main():
    args_parser=argparse.ArgumentParser()
    args_parser.add_argument('--only', help='Forum thread ID, e.g. 25069')
    args_parser.add_argument('--html-dir', help='Use pre-saved thread HTML files instead of network (test/offline)')
    args=args_parser.parse_args()
    sources=json.loads(SOURCES.read_text(encoding='utf-8'))
    if args.only:
        sources=[s for s in sources if s['id']=='law-'+args.only]
        if not sources: raise SystemExit('No such document in sources.json: '+args.only)
    DATA.mkdir(exist_ok=True)
    try:
        manifest=json.loads(MANIFEST.read_text(encoding='utf-8'))
        existing=manifest.get('documents',{})
        if not isinstance(existing,dict):raise ValueError('bad documents object')
    except (OSError,ValueError):
        existing={}
    session=requests.Session()
    session.headers.update({'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0.0.0 Safari/537.36'})
    started=datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')
    log=['Обновление законодательства RMRP — '+started,'','Источники: первый пост опубликованных тем форума RMRP','']
    new_count=0;changed_count=0;unchanged_count=0;failed_count=0
    for idx,s in enumerate(sources,1):
        id=s['id'];url=s['sourceUrl'];title=s['title']
        if not ALLOWED_ID.fullmatch(id) or not url.startswith('https://forum.rmrp.ru/threads/'):
            print('SKIP: unsafe source',id);failed_count+=1;log.append('ОШИБКА: '+title+' — неправильная ссылка');continue
        try:
            if args.html_dir:
                path=Path(args.html_dir)/(id.removeprefix('law-')+'.html')
                markup=path.read_text(encoding='utf-8')
            else:
                resp=session.get(url, timeout=35, allow_redirects=True)
                resp.raise_for_status()
                if not resp.url.startswith('https://forum.rmrp.ru/'):raise ValueError('Redirect outside RMRP')
                markup=resp.text
            text,stats=extract_text(markup)
            # FSO Federal Law No. 22-FZ has a newer published revision dated
            # 24 August 2026. Some anonymous forum views expose the 2025 first
            # post; never silently replace the new law with this older text.
            if id=='law-25069':
                normalized=text.lower().replace('\xa0',' ')
                if not re.search(r'24\s+августа\s+2026', normalized):
                    raise ValueError('Первая запись форума не содержит редакцию от 24.08.2026; требуется ручная проверка актуального текста')
            if not stats['ok'] or not text.strip():raise ValueError('Full-text check failed')
            if len(text)>2_000_000:raise ValueError('Document too large')
            # Guard against a valid-looking forum TOC with no real provision bodies.
            if stats['articles'] and stats['total_article_body_chars'] < stats['articles'] * 32:
                raise ValueError('Article bodies are too short')
            content_hash=hashlib.sha256(text.encode('utf-8')).hexdigest()
            old=existing.get(id)
            if old and old.get('sha256')==content_hash and (DATA/(id+'.json')).is_file():
                unchanged_count+=1
                log.append('БЕЗ ИЗМЕНЕНИЙ: '+title)
            else:
                status='ИЗМЕНЁН' if old else 'НОВЫЙ'
                doc={
                    'id':id,'title':title,'category':s.get('category','federal'),
                    'sourceUrl':url,'updatedAt':started,'sha256':content_hash,
                    'body':text
                }
                dump_json(DATA/(id+'.json'),doc)
                existing[id]={
                    'title':title, 'category':s.get('category','federal'),
                    'sourceUrl':url,'sha256':content_hash,'updatedAt':started,
                    'articles':stats['articles'], 'chars':stats['chars']
                }
                if old:changed_count+=1
                else:new_count+=1
                log.append(status+': '+title+' — '+str(stats['articles'])+' статей, '+str(stats['chars'])+' символов')
            print(f'[{idx}/{len(sources)}] OK {title}')
        except Exception as exc:
            failed_count+=1
            msg=f'ОШИБКА: {title} — {type(exc).__name__}: {exc}'
            log.append(msg+'; предыдущая версия сохранена')
            print(f'[{idx}/{len(sources)}] '+msg)
        if not args.html_dir: time.sleep(.5)
    dump_json(MANIFEST,{'format':'fso-rmrp-laws-static-v1','documents':existing})
    log.extend(['','Итог: новых '+str(new_count)+', изменённых '+str(changed_count)+', без изменений '+str(unchanged_count)+', ошибок '+str(failed_count),
                'Документы с ошибкой НЕ перезаписаны.','Новый текст следует выборочно сверять с форумом перед использованием.'])
    REPORT.write_text('\n'.join(log)+'\n',encoding='utf-8')
    print('\n'.join(log[-4:]))
    if failed_count and not existing:
        print('Нет ни одного проверенного документа; публикации не произошло',file=sys.stderr)
        return 1
    return 0

if __name__=='__main__':raise SystemExit(main())
