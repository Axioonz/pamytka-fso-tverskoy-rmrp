/* Issued staff credentials remain in memory until page refresh; passwords are never stored in personnel records. */
(()=>{'use strict';
 let issued=null,lastError=null;
 const h=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const VALID_LOGIN=/^[a-z][a-z0-9_-]{2,23}$/;
 const STRENGTH=/^(?=.{12,72}$)(?=.*[A-ZА-ЯЁ])(?=.*[a-zа-яё])(?=.*[0-9]).+$/;
 function generate(){
  const abc='ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const bytes=new Uint8Array(22);
  crypto.getRandomValues(bytes);
  const str=Array.from(bytes,b=>abc[b%abc.length]).join('');
  return 'K7'+str.slice(2,12)+'a'+str.slice(13)+'4';
 }
 function loginFor(no){return 'fso_'+String(no||'').replace(/[^0-9]/g,'').slice(0,12)}
 function formFields(prefix,defaultLogin=''){
  return '<div class="staff-credential-fields" data-staff-credentials="'+h(prefix)+'">'+
   '<label>Служебный логин<input id="'+prefix+'-login" class="staff-login" type="text" autocomplete="off" pattern="[a-z][a-z0-9_-]{2,23}" minlength="3" maxlength="24" value="'+h(defaultLogin)+'" placeholder="fso_0007" required></label>'+
   '<label>Временный пароль<input id="'+prefix+'-password" class="staff-password" type="text" autocomplete="off" minlength="12" maxlength="72" spellcheck="false" required></label>'+
   '<button type="button" class="btn small" data-staff-generate="'+h(prefix)+'">Создать надёжный пароль</button>'+
   '<p class="hint">Пароль показывается только при выдаче. Не сохраняйте его в личном деле. При первом входе сотрудник установит собственный пароль.</p>'+
   '</div>';
 }
 function newFields(){
  return '<section class="staff-issue-start"><h3>Учётная запись сотрудника</h3>'+
    '<p class="hint">Логин и временный пароль оформляются при добавлении личного дела. Передайте их сотруднику лично.</p>'+
    formFields('new-staff')+'</section>';
 }
 function issuedCard(member){
  if(!issued||issued.memberId!==member.id)return '';
  return '<div class="notice staff-issued" role="status"><strong>Служебные данные для выдачи</strong>'+
   '<p>Передайте сотруднику лично. После закрытия страницы этот пароль больше не отобразится.</p>'+
   '<dl><dt>Логин</dt><dd id="staff-issued-login">'+h(issued.login)+'</dd>'+
   '<dt>Временный пароль</dt><dd id="staff-issued-password">'+h(issued.password)+'</dd></dl>'+
   '<div class="actions"><button type="button" class="btn primary" id="copy-staff-issued">Скопировать для выдачи</button>'+
   '<button type="button" class="btn" id="staff-issued-done">Скрыть пароль</button></div></div>';
 }
 function accountPanel(member,role){
  if(!['admin','hr'].includes(role)||!['active','cadet'].includes(member.status))return '';
  const linked=!!member.user_id;
  const msg=lastError?.memberId===member.id?'<div class="message error" role="alert">'+h(lastError.message)+'</div>':'';
  return '<section class="section staff-account-section"><div class="section-heading"><div><h2>Доступ сотрудника</h2></div>'+
    '<span class="staff-account-status">'+(linked?'Аккаунт привязан':'Аккаунт не выдан')+'</span></div>'+
   '<p class="hint">'+(linked?'У сотрудника есть учётная запись. Для забытого временного пароля выдайте новый.':
    'Задайте служебный логин и временный пароль, чтобы сотрудник мог войти в свой кабинет и подать рапорт.')+'</p>'+
   issuedCard(member)+msg+
   '<form id="staff-account-form" class="lead-form" data-member-id="'+h(member.id)+'">'+
   (linked?
    '<div class="staff-credential-fields"><label>Новый временный пароль<input id="staff-reset-password" type="text" autocomplete="off" spellcheck="false" minlength="12" maxlength="72" required></label>'+
    '<button type="button" class="btn small" data-staff-generate="staff-reset">Создать надёжный пароль</button></div>':
    formFields('staff-account',loginFor(member.employee_number)))+
   '<div class="actions"><button class="btn primary" type="submit">'+(linked?'Сбросить пароль':'Создать служебный аккаунт')+'</button></div>'+
   '</form></section>';
 }
 function validate(login,password){
  if(login!==null&&(!VALID_LOGIN.test(login)||['admin','root','support','system','security'].includes(login)))
   throw new Error('Логин должен начинаться с латинской буквы, содержать от 3 до 24 символов, цифры, _ или -');
  if(!STRENGTH.test(password))throw new Error('Пароль должен содержать от 12 до 72 символов, строчные и заглавные буквы, цифру');
 }
 async function invoke(api,body){
  const {data,error}=await api.functions.invoke('fso-staff-account',{body});
  if(error){
   let message=error.message||'Не удалось выполнить действие';
   try{const json=await error.context?.json?.();message=json?.error||message}catch{}
   throw new Error(message);
  }
  if(!data?.ok)throw new Error(data?.error||'Не удалось выполнить действие');
  return data;
 }
 async function issue(api,member,login,password){
  login=String(login||'').trim().toLowerCase();
  validate(login,password);
  const payload=await invoke(api,{action:'issue',member_id:member.id,login,password});
  issued={memberId:member.id,login,password};
  lastError=null;
  return payload;
 }
 async function reset(api,member,password){
  validate(null,password);
  const payload=await invoke(api,{action:'reset',member_id:member.id,password});
  issued={memberId:member.id,login:payload.login,password};
  lastError=null;
  return payload;
 }
 function forget(){issued=null;lastError=null}
 function failed(memberId,error){
  lastError={memberId,message:String(error?.message||error||'Не удалось выдать доступ')};
 }
 function wireGenerators(){
  document.querySelectorAll('[data-staff-generate]').forEach(btn=>{
   const prefix=btn.dataset.staffGenerate;
   const field=document.getElementById(prefix==='staff-reset'?'staff-reset-password':prefix+'-password');
   if(!field)return;
   btn.onclick=()=>{field.value=generate();field.dispatchEvent(new Event('input'))};
   if(!field.value)field.value=generate();
  });
 }
 function bindNewForm(){
  wireGenerators();
  const number=document.getElementById('member-no'),login=document.getElementById('new-staff-login');
  if(number&&login){
   let customized=false;
   login.addEventListener('input',()=>{customized=true});
   number.addEventListener('input',()=>{if(!customized)login.value=loginFor(number.value)});
   if(number.value&&!login.value)login.value=loginFor(number.value);
  }
 }
 function newValues(){
  const login=document.getElementById('new-staff-login')?.value.trim().toLowerCase()||'';
  const password=document.getElementById('new-staff-password')?.value||'';
  validate(login,password);
  return {login,password};
 }
 function bindAccount(api,member,refresh){
  wireGenerators();
  const form=document.getElementById('staff-account-form');
  if(form)form.onsubmit=async ev=>{
   ev.preventDefault();
   const btn=form.querySelector('[type="submit"]');
   if(btn.disabled)return;
   btn.disabled=true;
   try{
    if(member.user_id){
     const pw=document.getElementById('staff-reset-password').value;
     if(!confirm('Сбросить пароль сотрудника? Текущий доступ будет приостановлен до установки нового пароля.'))return;
     await reset(api,member,pw);
    }else{
     const login=document.getElementById('staff-account-login').value;
     const pw=document.getElementById('staff-account-password').value;
     await issue(api,member,login,pw);
    }
    await refresh();
   }catch(error){
    failed(member.id,error);
    const area=form.parentElement;
    let notice=area.querySelector('.staff-inline-error');
    if(!notice){notice=document.createElement('div');notice.className='message error staff-inline-error';area.append(notice)}
    notice.textContent=lastError.message;
   }finally{btn.disabled=false}
  };
  const copy=document.getElementById('copy-staff-issued');
  if(copy)copy.onclick=async()=>{
   const text='Личный кабинет ФСО\n'+location.origin+location.pathname+'\nЛогин: '+issued.login+'\nВременный пароль: '+issued.password+'\nПосле входа смените пароль.';
   try{await navigator.clipboard.writeText(text);copy.textContent='Скопировано'}catch{copy.textContent='Скопируйте данные вручную'}
  };
  const hide=document.getElementById('staff-issued-done');
  if(hide)hide.onclick=()=>{issued=null;document.querySelector('.staff-issued')?.remove()};
 }
 function firstLogin(api,refresh,logout,root){
  root.innerHTML='<div class="auth-layout"><div class="eyebrow">FSO / СЛУЖЕБНЫЙ ПОРТАЛ</div>'+
   '<h1>Первый вход</h1><p class="head-subtitle">Учётная запись создана руководством. Установите личный пароль, чтобы открыть кабинет.</p>'+
   '<section class="section"><h2>Новый пароль</h2><form id="staff-activate-form" class="auth-form">'+
   '<label>Новый пароль<input id="staff-activate-password" type="password" minlength="12" maxlength="72" autocomplete="new-password" required></label>'+
   '<label>Повторите пароль<input id="staff-activate-repeat" type="password" minlength="12" maxlength="72" autocomplete="new-password" required></label>'+
   '<p class="hint">Не менее 12 символов, заглавная и строчная буквы, цифра. Не используйте временный пароль.</p>'+
   '<button class="btn primary" type="submit">Сохранить пароль и войти</button>'+
   '<div id="staff-activate-error" role="alert"></div></form>'+
   '<div class="actions"><button id="staff-activate-logout" type="button" class="btn">Выйти</button></div></section></div>';
  root.querySelector('#staff-activate-logout').onclick=logout;
  const form=root.querySelector('#staff-activate-form');
  form.onsubmit=async ev=>{
   ev.preventDefault();
   const password=root.querySelector('#staff-activate-password').value;
   const repeated=root.querySelector('#staff-activate-repeat').value;
   const output=root.querySelector('#staff-activate-error');
   const button=form.querySelector('[type="submit"]');
   if(password!==repeated){output.textContent='Пароли не совпадают';return}
   try{
    validate(null,password);button.disabled=true;
    await invoke(api,{action:'activate',password});
    await refresh();
   }catch(error){output.textContent=error?.message||'Не удалось изменить пароль'}
   finally{button.disabled=false}
  };
 }
 window.FSO_STAFF_ACCOUNTS={newFields,bindNewForm,newValues,accountPanel,bindAccount,issue,reset,
  firstLogin,issuedCard,failed,forget,wireGenerators};
})();