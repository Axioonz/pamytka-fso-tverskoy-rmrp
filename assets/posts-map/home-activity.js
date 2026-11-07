/* Главная страница: публичная карта активности постов без персональных данных. */
(()=>{
  'use strict';
  const root=document.getElementById('nv-activity-map');
  if(!root)return;
  const get=id=>document.getElementById(id);
  const hint=get('nv-am-hint'),total=get('nv-am-total'),activeCount=get('nv-am-active');
  const names={'1':'КПП №1','2':'КПП №2','3':'КПП Гос. думы','4':'КПП 2-го этажа','5':'КПП 5-го этажа'};
  const buildings={fso:'Здание ФСО',duma:'Государственная дума',government:'Дом Правительства'};
  const markers=[...root.querySelectorAll('[data-home-post]')];
  const places=[...root.querySelectorAll('[data-home-place]')];
  let counts={'1':0,'2':0,'3':0,'4':0,'5':0};
  let loaded=false,selected=null,requestId=0,db=null;
  function plural(n){return n+' '+(n%10===1&&n%100!==11?'сотрудник':n%10>=2&&n%10<=4&&(n%100<12||n%100>14)?'сотрудника':'сотрудников')}
  function setHint(value,error=false){
    hint.textContent=value;
    hint.classList.toggle('is-error',error);
  }
  function postMessage(id){
    if(!loaded)return names[id]+'. Данные пока не загружены.';
    const count=counts[id];
    return names[id]+'. '+(count?('На посту '+plural(count)+'.'):'Пост свободен.');
  }
  function draw(){
    const nums=Object.values(counts);
    total.textContent=String(nums.reduce((sum,n)=>sum+n,0));
    activeCount.textContent=String(nums.filter(n=>n>0).length);
    for(const marker of markers){
      const id=marker.dataset.homePost,n=counts[id]||0;
      marker.classList.toggle('is-active',n>0);
      marker.setAttribute('aria-label',postMessage(id));
      const badge=marker.querySelector('.nv-am-post-count');
      if(badge){
        badge.hidden=!n;
        badge.style.display=n?'':'none';
        const text=badge.querySelector('text');
        if(text)text.textContent=String(n);
      }
    }
    if(selected?.type==='post')setHint(postMessage(selected.id));
    else if(!selected){
      const sum=nums.reduce((a,n)=>a+n,0);
      setHint(sum?'Активных КПП: '+nums.filter(n=>n>0).length+'. На постах '+plural(sum)+'. Нажмите на точку для подробностей.':'Сейчас активных постов нет. Нажмите на значок, чтобы посмотреть объект.');
    }
  }
  function choose(target){
    const post=target.closest?.('[data-home-post]');
    const place=target.closest?.('[data-home-place]');
    if(post){
      const id=post.dataset.homePost;
      selected={type:'post',id};
      setHint(postMessage(id));
    }else if(place){
      const id=place.dataset.homePlace;
      if(!buildings[id])return;
      selected={type:'place',id};
      setHint(buildings[id]+'. Объект отмечен на карте.');
    }
  }
  root.querySelector('#nv-am-svg')?.addEventListener('click',e=>choose(e.target));
  root.querySelector('#nv-am-svg')?.addEventListener('keydown',e=>{
    if(e.key==='Enter'||e.key===' '){
      if(e.target.closest?.('[data-home-post],[data-home-place]')){
        e.preventDefault();choose(e.target);
      }
    }
  });
  async function refresh(){
    if(!db)return;
    const current=++requestId;
    try{
      const {data,error}=await db.rpc('fso_post_counts');
      if(error)throw error;
      if(current!==requestId)return;
      if(!Array.isArray(data))throw Error('Unexpected post count payload');
      const next={'1':0,'2':0,'3':0,'4':0,'5':0};
      for(const row of data){
        if(!Object.prototype.hasOwnProperty.call(next,row?.post_id))continue;
        const value=Number(row.count);
        if(Number.isSafeInteger(value)&&value>=0)next[row.post_id]=value;
      }
      counts=next;loaded=true;
      draw();
    }catch(error){
      if(current!==requestId)return;
      if(!loaded){total.textContent='—';activeCount.textContent='—'}
      setHint('Не удалось загрузить активность постов. Повторим запрос при обновлении.',true);
      console.warn('Карта активных постов:',error);
    }
  }
  (async()=>{
    try{
      if(!window.supabase?.createClient)throw Error('Supabase недоступен');
      db=window.supabase.createClient(
        'https://lejagyuibxdnvpmxoggy.supabase.co',
        'sb_publishable_8cdFcw4V8F545924bpdLjg_3yKTHt1d',
        {auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}}
      );
      await refresh();
      window.setInterval(()=>{if(!document.hidden)refresh()},15000);
      window.addEventListener('focus',refresh);
      document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()});
    }catch(error){
      setHint('Карта временно не получает данные об активности.',true);
      console.warn('Карта активных постов:',error);
    }
  })();
})();