/* Одна карта для двух режимов: посты и патрули. Без внешних зависимостей. */
(()=>{
  const svg=document.getElementById('postmap-svg');
  if(!svg)return;
  const stage=document.getElementById('postmap-viewport');
  const layerPosts=document.getElementById('postmap-post-layer');
  const layerPlaces=document.getElementById('postmap-landmark-layer');
  const layerRoutes=document.getElementById('postmap-route-layer');
  const popup=document.getElementById('postmap-popup');
  const badge=popup?.querySelector('.postmap-badge');
  const photo=document.getElementById('postmap-popup-photo');
  const title=document.getElementById('postmap-popup-title');
  const description=document.getElementById('postmap-popup-desc');
  const zoomLabel=document.getElementById('postmap-zoom');
  const patrolHint=document.getElementById('postmap-patrol-hint');
  const base={x:0,y:0,w:1790,h:1518};
  const posts={
    '1':{x:579.1,y:527.9,title:'КПП №1',desc:'Пост у восточной границы охраняемой территории.',photo:'./assets/posts-map/photos/kpp-1.jpg'},
    '2':{x:386.1,y:621.3,title:'КПП №2',desc:'Пост у южной стороны охраняемой территории.',photo:'./assets/posts-map/photos/kpp-2.jpg'},
    '3':{x:160.1,y:689.6,title:'КПП Гос. думы',desc:'Контрольно-пропускной пункт Государственной думы.',photo:'./assets/posts-map/photos/kpp-3.jpg'},
    '4':{x:1254,y:1366,title:'КПП 2-го этажа',desc:'Дополнительный КПП на 2-м этаже в отмеченной точке.',photo:null},
    '5':{x:1282,y:1379,title:'КПП 5-го этажа',desc:'Дополнительный КПП на 5-м этаже в отмеченной точке.',photo:null}
  };
  const places={
    fso:{x:255,y:506,title:'Здание ФСО',desc:'Федеральная служба охраны.'},
    duma:{x:161,y:780,title:'Государственная дума',desc:'Здание Государственной думы.'},
    government:{x:1351,y:1302,title:'Дом Правительства',desc:'Здание Правительства.'}
  };
  let view={...base},mode='posts',drag=null,dragMoved=false;
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  function closePopup(){
    popup.hidden=true;
    document.querySelectorAll('#postmap-post-layer .postmap-point.is-selected, #postmap-landmark-layer .postmap-place.is-selected').forEach(el=>el.classList.remove('is-selected'));
  }
  function markersScale(){
    const scale=view.w/base.w;
    layerPosts.querySelectorAll('[data-post]').forEach(el=>{
      const p=posts[el.dataset.post];
      if(p)el.setAttribute('transform','translate('+p.x+' '+p.y+') scale('+scale+')');
    });
    layerPlaces?.querySelectorAll('[data-place]').forEach(el=>{
      const p=places[el.dataset.place];
      if(p)el.setAttribute('transform','translate('+p.x+' '+p.y+') scale('+scale+')');
    });
  }
  function setView(next){
    const w=clamp(next.w,245,base.w);
    const h=w*base.h/base.w;
    view={x:clamp(next.x,0,base.w-w),y:clamp(next.y,0,base.h-h),w,h};
    svg.setAttribute('viewBox',[view.x,view.y,view.w,view.h].join(' '));
    if(zoomLabel)zoomLabel.textContent=Math.round(base.w/view.w*100)+'%';
    markersScale();
  }
  function svgPos(e){
    const p=svg.createSVGPoint();
    p.x=e.clientX;p.y=e.clientY;
    const m=svg.getScreenCTM();
    return m?p.matrixTransform(m.inverse()):{x:view.x+view.w/2,y:view.y+view.h/2};
  }
  function zoom(ratio,anchor){
    const p=anchor||{x:view.x+view.w/2,y:view.y+view.h/2};
    const w=clamp(view.w*ratio,245,base.w);
    const k=w/view.w;
    setView({x:p.x-(p.x-view.x)*k,y:p.y-(p.y-view.y)*k,w});
  }
  function focus(id){
    const p=posts[id];if(!p)return;
    const w=clamp(660,245,base.w);
    const h=w*base.h/base.w;
    setView({x:p.x-w/2,y:p.y-h/2,w});
  }
  function selectPost(id,fly=false){
    if(mode!=='posts'||!posts[id])return;
    const p=posts[id];
    closePopup();
    const point=layerPosts.querySelector('[data-post="'+id+'"]');
    if(point)point.classList.add('is-selected');
    title.textContent=p.title;
    description.textContent=p.desc;
    popup.dataset.popupType='post';
    if(badge)badge.textContent='Контрольно-пропускной пункт';
    const occupancy=popup.querySelector('#postmap-occupancy');
    if(occupancy)occupancy.hidden=false;
    photo.hidden=!p.photo;
    if(p.photo){photo.src=p.photo;photo.alt='Фото '+p.title}
    else{photo.removeAttribute('src');photo.alt=''}
    popup.hidden=false;
    if(fly)focus(id);
  }
  function selectPlace(id){
    const p=places[id];if(!p)return;
    closePopup();
    const marker=layerPlaces?.querySelector('[data-place="'+id+'"]');
    if(marker)marker.classList.add('is-selected');
    popup.dataset.popupType='place';
    if(badge)badge.textContent='Объект на карте';
    title.textContent=p.title;
    description.textContent=p.desc;
    photo.hidden=true;
    photo.removeAttribute('src');
    const occupancy=popup.querySelector('#postmap-occupancy');
    if(occupancy)occupancy.hidden=true;
    popup.hidden=false;
  }
  function setMode(value){
    mode=value==='patrols'?'patrols':'posts';
    layerPosts.hidden=mode!=='posts';
    layerRoutes.hidden=mode!=='patrols';
    closePopup();
  }
  function buildRoutes(){
    // Будущие маршруты задаются в data/07-посты-и-патрули.js
    // window.FSO_MAP_PATROLS=[{id:'route-1',title:'...',points:[[x,y],...]}]
    const data=Array.isArray(window.FSO_MAP_PATROLS)?window.FSO_MAP_PATROLS:[];
    const ns='http://www.w3.org/2000/svg';
    layerRoutes.replaceChildren();
    let valid=0;
    data.forEach(entry=>{
      const pts=Array.isArray(entry.points)?entry.points.filter(v=>Array.isArray(v)&&v.length>=2&&Number.isFinite(+v[0])&&Number.isFinite(+v[1])):[];
      if(pts.length<2)return;
      const g=document.createElementNS(ns,'g');
      const line=document.createElementNS(ns,'polyline');
      line.setAttribute('points',pts.map(p=>p[0]+','+p[1]).join(' '));
      line.setAttribute('class','postmap-route');
      line.setAttribute('tabindex','0');
      line.setAttribute('role','button');
      line.setAttribute('aria-label',String(entry.title||'Маршрут патруля'));
      const tip=document.createElementNS(ns,'title');tip.textContent=String(entry.title||'Маршрут патруля');
      line.append(tip);g.append(line);
      [pts[0],pts[pts.length-1]].forEach(p=>{const c=document.createElementNS(ns,'circle');c.setAttribute('cx',p[0]);c.setAttribute('cy',p[1]);c.setAttribute('r','5');c.setAttribute('class','postmap-route-anchor');g.append(c)});
      g.addEventListener('click',()=>{if(patrolHint)patrolHint.textContent=String(entry.title||'Маршрут патруля')+(entry.description?' · '+String(entry.description):'')});
      g.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();g.dispatchEvent(new Event('click'))}});
      layerRoutes.append(g);valid++;
    });
    if(patrolHint)patrolHint.textContent=valid?('Найдено маршрутов: '+valid+'. Нажмите на линию для просмотра информации.'):'Маршруты патрулирования пока не добавлены. В этой вкладке будут отображаться их линии на общей карте.';
  }
  svg.addEventListener('wheel',e=>{e.preventDefault();zoom(e.deltaY>0?1.16:1/1.16,svgPos(e))},{passive:false});
  svg.addEventListener('dblclick',e=>{e.preventDefault();zoom(.70,svgPos(e))});
  svg.addEventListener('pointerdown',e=>{
    if(e.button!==0)return;
    const marker=e.target.closest?.('[data-post]');
    const place=e.target.closest?.('[data-place]');
    drag={x:e.clientX,y:e.clientY,lastX:e.clientX,lastY:e.clientY,post:marker?.dataset.post||null,place:place?.dataset.place||null};
    dragMoved=false;
    svg.classList.add('is-dragging');
    try{svg.setPointerCapture(e.pointerId)}catch{}
  });
  svg.addEventListener('pointermove',e=>{
    if(!drag)return;
    const dx=e.clientX-drag.lastX,dy=e.clientY-drag.lastY;
    if(Math.hypot(e.clientX-drag.x,e.clientY-drag.y)>5)dragMoved=true;
    if(dragMoved){
      const m=svg.getScreenCTM();
      if(m){
        const a=svgPos({clientX:drag.lastX,clientY:drag.lastY});
        const b=svgPos(e);
        setView({x:view.x+a.x-b.x,y:view.y+a.y-b.y,w:view.w});
      }
    }
    drag.lastX=e.clientX;drag.lastY=e.clientY;
  });
  function release(e,cancelled=false){
    if(!drag)return;
    const id=drag.post,place=drag.place;
    const shouldSelect=!cancelled&&!dragMoved;
    drag=null;svg.classList.remove('is-dragging');
    try{svg.releasePointerCapture(e.pointerId)}catch{}
    if(shouldSelect&&id)selectPost(id);
    else if(shouldSelect&&place)selectPlace(place);
  }
  svg.addEventListener('pointerup',e=>release(e));
  svg.addEventListener('pointercancel',e=>release(e,true));
  svg.addEventListener('keydown',e=>{
    const key=e.target.closest?.('[data-post]')?.dataset.post;
    const place=e.target.closest?.('[data-place]')?.dataset.place;
    if((key||place)&&(e.key==='Enter'||e.key===' ')){
      e.preventDefault();
      if(key)selectPost(key);else selectPlace(place);
    }
  });
  document.getElementById('postmap-zoom-in')?.addEventListener('click',()=>zoom(.78));
  document.getElementById('postmap-zoom-out')?.addEventListener('click',()=>zoom(1.28));
  document.getElementById('postmap-reset')?.addEventListener('click',()=>{setView(base);closePopup()});
  document.getElementById('postmap-popup-close')?.addEventListener('click',closePopup);
  document.querySelectorAll('#posts-screen [data-service-tab]').forEach(button=>{
    button.addEventListener('click',()=>setMode(button.dataset.serviceTab));
  });
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'&&!popup.hidden)closePopup();
  });
  buildRoutes();setView(base);setMode('posts');
})();
