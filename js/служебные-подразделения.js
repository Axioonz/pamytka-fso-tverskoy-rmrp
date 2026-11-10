/* Department pages live on the public portal; private data is fetched only via authorized RPC. */
(()=>{'use strict';
const root=document.getElementById('departments-screen');
if(!root)return;
const el=id=>document.getElementById(id);
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const names={
 'АС':{index:'01',summary:'Служебный порядок, требования подразделения и актуальная информация руководства.',symbol:'АС'},
 'УЛО':{index:'02',summary:'Правила службы, установленные требования и материалы подразделения.',symbol:'УЛО'},
 'Академия':{index:'03',summary:'Подготовка курсантов, учебные материалы и служебные объявления.',symbol:'А'}
};
const CONFIG={url:'https://lejagyuibxdnvpmxoggy.supabase.co',key:'sb_publishable_8cdFcw4V8F545924bpdLjg_3yKTHt1d'};
let api=null,current='',profile=null,user=null,pages=[],message='',busy=false;
const validDep=value=>Object.hasOwn(names,value);
const when=value=>value?new Date(value).toLocaleDateString('ru-RU',{day:'numeric',month:'long',year:'numeric'}):'';
const client=()=>{
 if(api)return api;
 if(!window.supabase?.createClient)return null;
 api=window.supabase.createClient(CONFIG.url,CONFIG.key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
 return api;
};
function linked(text){
 return String(text||'').split(/(https:\/\/[^\s<>"']+)/g).map(part=>{
  if(!/^https:\/\//i.test(part))return esc(part);
  try{const u=new URL(part);return '<a href="'+esc(u.href)+'" rel="noopener noreferrer" target="_blank">'+esc(part)+'</a>'}
  catch{return esc(part)}
 }).join('');
}
function pane(title,text,ordinal){
 return '<article class="sdept-material"><div class="sdept-material-top"><span class="sdept-material-no">'+ordinal+'</span><h3>'+esc(title)+'</h3></div>'+
  (text?'<div class="sdept-copy">'+linked(text)+'</div>':'<p class="sdept-empty">Материалы пока не опубликованы.</p>')+'</article>';
}
function editorial(page){
 if(!['admin','hr'].includes(profile?.role))return '';
 return '<details class="sdept-edit-panel"><summary><span>Редактирование материалов</span><span aria-hidden="true">+</span></summary>'+
  '<form id="sdept-material-form" class="sdept-editor-form">'+
  '<label>Основная информация<textarea name="essentials" maxlength="8000" rows="5" placeholder="Основные положения и порядок службы">'+esc(page.essentials)+'</textarea></label>'+
  '<label>Система повышения<textarea name="promotion" maxlength="8000" rows="5" placeholder="Требования к повышению, порядок подачи рапортов">'+esc(page.promotion_rules)+'</textarea></label>'+
  '<label>Установленная форма<textarea name="uniform" maxlength="8000" rows="4" placeholder="Правила формы, ссылки на образцы">'+esc(page.uniform_rules)+'</textarea></label>'+
  '<label>Важные материалы и контакты<textarea name="contacts" maxlength="8000" rows="4" placeholder="Контакты и полезные служебные материалы">'+esc(page.service_contacts)+'</textarea></label>'+
  '<div class="sdept-form-actions"><button class="sdept-primary" type="submit">Сохранить изменения</button></div></form></details>';
}
function notices(page){
 const canEdit=['admin','hr'].includes(profile?.role);
 const posting=canEdit?'<details class="sdept-add-news"><summary>+ Новое объявление</summary>'+
  '<form id="sdept-news-form" class="sdept-editor-form"><label>Тема<input name="title" minlength="4" maxlength="180" required placeholder="Например, информация от начальника"></label>'+
  '<label>Сообщение<textarea name="body" minlength="10" maxlength="6000" rows="5" required placeholder="Текст объявления"></textarea></label>'+
  '<div class="sdept-form-actions"><button class="sdept-primary" type="submit">Опубликовать</button></div></form></details>':'';
 const n=Array.isArray(page.announcements)?page.announcements:[];
 return '<section class="sdept-news"><div class="sdept-news-head"><div><span class="sdept-overline">ИНФОРМАЦИЯ РУКОВОДСТВА</span>'+
  '<h3>Объявления подразделения</h3></div>'+posting+'</div>'+
  (n.length?'<div class="sdept-news-list">'+n.map(item=>
   '<article class="sdept-news-item"><div class="sdept-news-top"><div><time>'+esc(when(item.published_at))+'</time><h4>'+esc(item.title)+'</h4></div>'+
   (canEdit?'<button type="button" class="sdept-remove" data-news-remove="'+esc(item.id)+'">Удалить</button>':'')+'</div>'+
   '<div class="sdept-news-author">'+esc(item.author||'Руководство')+'</div><div class="sdept-copy">'+linked(item.body)+'</div></article>').join('')+'</div>':
   '<p class="sdept-empty">Объявлений пока нет.</p>')+'</section>';
}
function auth(){
 return '<div class="sdept-gate"><div class="sdept-gate-icon" aria-hidden="true">✳</div>'+
  '<span class="sdept-overline">ДОСТУП ПО ЛИЧНОМУ ДЕЛУ</span><h3>Требуется вход в служебную учётную запись</h3>'+
  '<p>Материалы открываются непосредственно здесь после авторизации. Подразделение определяется по записи сотрудника в кадровом реестре.</p>'+
  '<form id="sdept-login-form" class="sdept-login-form"><label>Служебный логин или почта<input name="login" type="text" required autocomplete="username" placeholder="Служебный логин"></label>'+
  '<label>Пароль<input name="password" type="password" required autocomplete="current-password" placeholder="Пароль от личного кабинета"></label>'+
  '<button class="sdept-primary" type="submit">Войти и открыть материалы</button></form>'+
  '<p class="sdept-gate-note">Используйте те же данные, что и для личного кабинета.</p></div>';
}
function denied(){
 const allowed=pages.map(p=>p.department);
 return '<div class="sdept-gate sdept-denied"><div class="sdept-gate-icon" aria-hidden="true">◈</div>'+
  '<span class="sdept-overline">ОГРАНИЧЕННЫЙ ДОСТУП</span><h3>Материалы подразделения недоступны</h3>'+
  '<p>В вашем личном деле указано другое подразделение. Доступ меняется после оформления перевода в кадровом реестре.</p>'+
  (allowed.length?'<p class="sdept-allowed">Ваш доступ: <strong>'+esc(allowed.join(', '))+'</strong></p>':'<p class="sdept-allowed">К аккаунту не привязано действующее личное дело с доступом к этому подразделению.</p>')+
  (allowed.length===1?'<button type="button" class="sdept-primary" data-sdept-switch="'+esc(allowed[0])+'">Открыть '+esc(allowed[0])+'</button>':'')+
  '<button type="button" class="sdept-quiet" id="sdept-logout">Сменить учётную запись</button></div>';
}
function render(){
 if(!current)return;
 const area=el('sdept-content');const dept=names[current];
 el('sdept-path-name').textContent=current;
 el('sdept-current-name').textContent=current;
 el('sdept-current-subtitle').textContent=dept.summary;
 el('sdept-hero-glyph').textContent=dept.symbol;
 if(busy){area.innerHTML='<div class="sdept-loading"><span class="sdept-spinner"></span>Загрузка служебных материалов</div>';return}
 if(message){area.innerHTML='<div class="sdept-message" role="alert">'+esc(message)+'</div><button type="button" class="sdept-primary" id="sdept-retry">Повторить</button>';return}
 if(!user){area.innerHTML=auth();return}
 const page=pages.find(p=>p.department===current);
 if(!page){area.innerHTML=denied();return}
 area.innerHTML='<div class="sdept-access-row"><span class="sdept-access-mark"><span class="sdept-dot"></span> ДОСТУП ПОДТВЕРЖДЁН</span>'+
  '<span class="sdept-updated">Обновлено '+esc(when(page.updated_at))+'</span></div>'+
  '<div class="sdept-material-grid">'+pane('Основная информация',page.essentials,'01')+
  pane('Система повышения',page.promotion_rules,'02')+
  pane('Установленная форма',page.uniform_rules,'03')+
  pane('Важные материалы и контакты',page.service_contacts,'04')+'</div>'+
  editorial(page)+notices(page);
}
async function load(){
 busy=true;message='';render();
 const supa=client();
 if(!supa){busy=false;message='Не загрузилась библиотека авторизации. Обновите страницу и проверьте подключение к интернету.';render();return}
 try{
  const identity=await supa.auth.getUser();
  if(identity.error)throw identity.error;
  user=identity.data?.user||null;pages=[];profile=null;
  if(user){
   const [p,d]=await Promise.all([
    supa.from('fso_profiles').select('role').eq('user_id',user.id).maybeSingle(),
    supa.rpc('fso_subdivisions_read')
   ]);
   if(p.error)throw p.error;
   if(d.error)throw d.error;
   profile=p.data||null;pages=Array.isArray(d.data)?d.data:[];
  }
 }catch(e){message='Не удалось открыть материалы: '+(e.message||'Ошибка сервера');}
 finally{busy=false;render()}
}
function open(dept){
 if(!validDep(dept))return;
 current=dept;
 el('sdept-catalog').hidden=true;
 el('sdept-catalog-foot').hidden=true;
 el('sdept-detail').hidden=false;
 root.querySelector('.sdept-intro').hidden=true;
 root.scrollIntoView({behavior:'instant',block:'start'});
 load();
}
function back(){
 current='';message='';
 el('sdept-detail').hidden=true;
 el('sdept-catalog').hidden=false;
 el('sdept-catalog-foot').hidden=false;
 root.querySelector('.sdept-intro').hidden=false;
 root.scrollIntoView({behavior:'instant',block:'start'});
}
function showError(e){
 message=e?.message||'Не удалось сохранить данные';
 busy=false;render();
}
root.addEventListener('click',async event=>{
 const card=event.target.closest('[data-sdept]');
 if(card){open(card.dataset.sdept);return}
 if(event.target.closest('#sdept-back')){back();return}
 if(event.target.closest('#sdept-retry')){load();return}
 const select=event.target.closest('[data-sdept-switch]');
 if(select){open(select.dataset.sdeptSwitch);return}
 if(event.target.closest('#sdept-logout')){
  try{await client()?.auth.signOut();user=null;profile=null;pages=[];message='';render()}
  catch(e){showError(e)}
  return;
 }
 const del=event.target.closest('[data-news-remove]');
 if(del){
  if(!window.confirm('Удалить объявление подразделения?'))return;
  del.disabled=true;
  const res=await client().rpc('fso_subdivision_announcement_delete',{p_id:del.dataset.newsRemove});
  if(res.error){showError(res.error);return}
  load();
 }
});
root.addEventListener('submit',async event=>{
 const form=event.target;if(!form.matches('#sdept-login-form,#sdept-material-form,#sdept-news-form'))return;
 event.preventDefault();
 const btn=form.querySelector('[type="submit"]');btn.disabled=true;
 const fields=new FormData(form);
 try{
  if(form.id==='sdept-login-form'){
   const login=String(fields.get('login')||'').trim().toLowerCase();
   if(!login.includes('@')&&!/^[a-z][a-z0-9_-]{2,23}$/.test(login))throw new Error('Укажите служебный логин или адрес электронной почты');
   const email=login.includes('@')?login:login+'@staff.fso-rmrp.example';
   const res=await client().auth.signInWithPassword({email,password:String(fields.get('password')||'')});
   if(res.error)throw res.error;
  }else if(form.id==='sdept-material-form'){
   const res=await client().rpc('fso_subdivision_save',{
    p_department:current,p_essentials:String(fields.get('essentials')||''),
    p_promotion:String(fields.get('promotion')||''),p_uniform:String(fields.get('uniform')||''),
    p_contacts:String(fields.get('contacts')||'')
   });
   if(res.error)throw res.error;
  }else{
   const res=await client().rpc('fso_subdivision_announcement_publish',{
    p_department:current,p_title:String(fields.get('title')||''),p_body:String(fields.get('body')||'')
   });
   if(res.error)throw res.error;
  }
  load();
 }catch(e){
  btn.disabled=false;
  const currentError=form.querySelector('.sdept-inline-error');if(currentError)currentError.remove();
  const div=document.createElement('p');div.className='sdept-inline-error';div.textContent=e?.message||'Операция не выполнена';
  form.append(div);
 }
});
el('sdept-back')?.addEventListener('click',back);
})();
