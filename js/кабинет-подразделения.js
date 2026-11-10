/* Private subdivision pages. Server determines access using fso_members.department. */
(()=>{'use strict';
const safe=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const catalog=['АС','УЛО','Академия'];
const date=v=>v?new Date(v).toLocaleDateString('ru-RU',{day:'numeric',month:'long',year:'numeric'}):'';
const textLinks=v=>String(v||'').split(/(https:\/\/[^\s]+)/g).map(part=>{
 if(!/^https:\/\//.test(part))return safe(part);
 try{const u=new URL(part);return '<a href="'+safe(u.href)+'" target="_blank" rel="noopener noreferrer">'+safe(part)+'</a>'}
 catch{return safe(part)}
}).join('');
const active=m=>m&&['active','cadet'].includes(m.status);
let pages=[],selected='',error='';
const canEdit=ctx=>['admin','hr'].includes(ctx.role);
const own=ctx=>ctx.members.find(m=>m.user_id===ctx.userId&&active(m));
function clear(){pages=[];selected='';error=''}
async function load(api){
 const {data, error:failure}=await api.rpc('fso_subdivisions_read');
 if(failure){pages=[];error='Не удалось загрузить материалы подразделений: '+failure.message;return}
 pages=Array.isArray(data)?data:[];error='';
}
function material(title,body,empty){
 return '<section class="section sub-material"><div class="sub-section-heading"><span class="sub-material-mark"></span><h2>'+safe(title)+'</h2></div>'+
 (body?'<div class="sub-text">'+textLinks(body)+'</div>':
 '<p class="sub-empty">'+safe(empty||'Информация пока не опубликована.')+'</p>')+'</section>';
}
function render(ctx){
 const editable=canEdit(ctx);
 const myDepartment=own(ctx)?.department||'';
 if(!selected||(!editable&&!pages.some(p=>p.department===selected)))
  selected=editable?catalog[0]:(pages[0]?.department||myDepartment||catalog[0]);
 const page=pages.find(p=>p.department===selected);
 const access=!!page;
 const cards=catalog.map(dep=>{
  const permitted=pages.some(p=>p.department===dep);
  const current=dep===selected;
  return '<button type="button" class="sub-department'+(current?' is-active':'')+
   (permitted?'':' is-locked')+'" data-sub-department="'+safe(dep)+'" aria-pressed="'+current+'">'+
   '<span class="sub-department-symbol">'+safe(dep==='Академия'?'АК':dep)+'</span>'+
   '<span class="sub-department-copy"><strong>'+safe(dep)+'</strong><small>'+
   (permitted?'Материалы доступны':'Доступ по назначению')+'</small></span>'+
   '<span class="sub-department-arrow" aria-hidden="true">'+(permitted?'↗':'◦')+'</span></button>';
 }).join('');
 const header='<div class="sub-page-heading"><div><span class="sub-eyebrow">ВНУТРЕННИЕ МАТЕРИАЛЫ ФСО</span>'+
  '<h1>Служебные подразделения</h1><p class="head-subtitle">Порядок службы, система повышения, форма и объявления руководства.</p></div>'+
  '<span class="sub-access-chip">'+(editable?'Управление материалами':'Ваше подразделение · '+safe(myDepartment||'Не назначено'))+'</span></div>';
 const directory='<div class="sub-directory" role="group" aria-label="Выбор подразделения">'+cards+'</div>';
 if(error)return header+directory+'<div class="message error">'+safe(error)+'</div>';
 if(!access)return header+directory+'<section class="section sub-locked"><h2>Материалы '+safe(selected)+'</h2>'+
   '<p>Доступ к этому подразделению определяется записью в личном деле сотрудника. Для изменения подразделения используется установленный порядок перевода.</p>'+
   (!myDepartment&&!editable?'<p class="hint">К вашей учётной записи не привязано действующее личное дело с подразделением.</p>':'')+'</section>';
 const notes=Array.isArray(page.announcements)?page.announcements:[];
 const renderedNotes=notes.length?notes.map(n=>
  '<article class="sub-notice"><div class="sub-notice-top"><div><span class="sub-notice-date">'+safe(date(n.published_at))+
  '</span><h3>'+safe(n.title)+'</h3></div>'+
  (editable?'<button class="btn small sub-delete" type="button" data-sub-del="'+safe(n.id)+'">Удалить</button>':'')+
  '</div><p class="sub-notice-author">Опубликовал · '+safe(n.author||'Руководство')+'</p>'+
  '<div class="sub-text">'+textLinks(n.body)+'</div></article>').join(''):
  '<p class="sub-empty">Объявлений пока нет.</p>';
 const blocks=material('Основная информация',page.essentials)+
  material('Система повышения',page.promotion_rules)+
  material('Установленная форма',page.uniform_rules)+
  material('Связь и служебные материалы',page.service_contacts);
 const editor=editable?'<details class="section sub-editor" id="sub-editor"><summary>Редактировать материалы '+safe(selected)+'</summary>'+
  '<p class="hint">Текст доступен только сотрудникам этого подразделения и руководству. Ссылки HTTPS становятся активными автоматически.</p>'+
  '<form id="sub-material-form" class="sub-edit-form">'+
  '<label>Основная информация<textarea name="essentials" maxlength="8000" rows="5" placeholder="Основные задачи, порядок службы и важные правила">'+safe(page.essentials)+'</textarea></label>'+
  '<label>Система повышения<textarea name="promotion" maxlength="8000" rows="5" placeholder="Условия повышения и требования к подтверждающим материалам">'+safe(page.promotion_rules)+'</textarea></label>'+
  '<label>Установленная форма<textarea name="uniform" maxlength="8000" rows="4" placeholder="Требования к форме, ссылки на образцы и исключения">'+safe(page.uniform_rules)+'</textarea></label>'+
  '<label>Связь и служебные материалы<textarea name="contacts" maxlength="8000" rows="4" placeholder="Контакты, служебные ссылки, порядок обращения к руководству">'+safe(page.service_contacts)+'</textarea></label>'+
  '<div class="actions"><button class="btn primary" type="submit">Сохранить материалы</button></div></form></details>': '';
 const posting=editable?'<details class="sub-publish"><summary>+ Опубликовать объявление</summary>'+
  '<form id="sub-announcement-form" class="sub-edit-form">'+
  '<label>Заголовок<input name="title" required minlength="4" maxlength="180" placeholder="Тема объявления"></label>'+
  '<label>Текст объявления<textarea name="body" required minlength="10" maxlength="6000" rows="5" placeholder="Содержание сообщения руководства"></textarea></label>'+
  '<div class="actions"><button class="btn primary" type="submit">Опубликовать</button></div></form></details>':'';
 return header+directory+'<div class="sub-content-head"><div><span class="sub-eyebrow">МАТЕРИАЛЫ ПОДРАЗДЕЛЕНИЯ</span>'+
   '<h2>'+safe(selected)+'</h2></div><span class="sub-updated">Обновлено · '+safe(date(page.updated_at))+'</span></div>'+
   '<div class="sub-material-grid">'+blocks+'</div>'+editor+
   '<section class="section sub-announcements"><div class="sub-section-heading sub-news-heading"><div><span class="sub-eyebrow">ИНФОРМАЦИЯ РУКОВОДСТВА</span>'+
   '<h2>Объявления подразделения</h2></div>'+posting+'</div>'+
   '<div class="sub-notices">'+renderedNotes+'</div></section>';
}
function bind(api,ctx,refresh,rerender){
 const errorNode=document.createElement('p');
 errorNode.className='message error';
 errorNode.hidden=true;
 const dir=document.querySelector('.sub-directory');
 if(dir)dir.after(errorNode);
 const inform=err=>{errorNode.textContent=err?.message||'Не удалось выполнить действие';errorNode.hidden=false};
 document.querySelectorAll('[data-sub-department]').forEach(btn=>btn.onclick=()=>{
  selected=btn.dataset.subDepartment;
  rerender();
 });
 const form=document.getElementById('sub-material-form');
 if(form)form.onsubmit=async ev=>{
  ev.preventDefault();const button=form.querySelector('[type=submit]');button.disabled=true;
  const fields=new FormData(form);
  try{
   const {error}=await api.rpc('fso_subdivision_save',{
    p_department:selected,p_essentials:String(fields.get('essentials')||''),
    p_promotion:String(fields.get('promotion')||''),p_uniform:String(fields.get('uniform')||''),
    p_contacts:String(fields.get('contacts')||'')
   });
   if(error)throw error;
   await refresh();
  }catch(err){inform(err);button.disabled=false}
 };
 const publish=document.getElementById('sub-announcement-form');
 if(publish)publish.onsubmit=async ev=>{
  ev.preventDefault();const button=publish.querySelector('[type=submit]');button.disabled=true;
  const fields=new FormData(publish);
  try{
   const {error}=await api.rpc('fso_subdivision_announcement_publish',{
    p_department:selected,p_title:String(fields.get('title')||''),p_body:String(fields.get('body')||'')
   });
   if(error)throw error;
   await refresh();
  }catch(err){inform(err);button.disabled=false}
 };
 document.querySelectorAll('[data-sub-del]').forEach(btn=>btn.onclick=async()=>{
  if(!window.confirm('Удалить объявление подразделения?'))return;
  btn.disabled=true;
  try{
   const {error}=await api.rpc('fso_subdivision_announcement_delete',{p_id:btn.dataset.subDel});
   if(error)throw error;
   await refresh();
  }catch(err){inform(err);btn.disabled=false}
 });
}
window.FSO_SUBDIVISIONS={load,clear,render,bind};
})();