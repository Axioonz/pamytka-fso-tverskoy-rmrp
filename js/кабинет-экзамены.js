/* Archive cleanup and detailed exam reports for the FSO staff portal. */
(()=>{'use strict';
const h=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=s=>s?new Date(s).toLocaleString('ru-RU',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}):'Не указано';
const who=(id,staff)=>id?(staff.find(x=>x.user_id===id)?.display_name||'Пользователь не найден'):'Не указан';
const person=m=>m?m.first_name+' '+m.last_name:'Сотрудник не найден';
const roleAdmin=s=>s.role==='admin';
const status=(a,t)=>{
 const last=t[0];
 if(a.status==='revoked')return 'Отозван';
 if(last?.completed_at)return (last.passed?'Сдан':'Не сдан')+' · '+last.correct_count+'/'+last.total_count;
 if(last)return 'В процессе';
 return 'Не проходил';
};
const attemptsFor=(all,id)=>all.filter(x=>x.assignment_id===id)
 .sort((a,b)=>new Date(b.started_at)-new Date(a.started_at));
const rate=t=>t.total_count>0?Math.round(Number(t.correct_count||0)/t.total_count*100):0;
const message=(id,text,bad=true)=>{
 const target=document.getElementById(id);
 if(target)target.innerHTML='<div class="message '+(bad?'error':'good')+'" role="status">'+h(text)+'</div>';
};
async function perform(api,btn,name,args,refresh,errorId){
 if(btn.disabled)return;
 btn.disabled=true;
 try{
  const {data,error}=await api.rpc(name,args);
  if(error)throw error;
  await refresh();
  return data;
 }catch(err){message(errorId,err.message||'Сервер не выполнил действие');}
 finally{btn.disabled=false;}
}
function archiveToolbar(members,role){
 if(role!=='admin')return '';
 return '<div class="archive-manage">'+
 '<div><strong>Очистка архива</strong><p>Удаление без восстановления. Вместе с личным делом удаляются его взыскания и назначенные экзамены с результатами. История самого удаления останется в журнале аудита.</p></div>'+
 '<button class="btn danger" type="button" id="clear-full-archive" '+(!members.length?'disabled':'')+'>Очистить весь архив</button>'+
 '</div><div id="archive-action-status"></div>';
}
function bindArchive(api,members,refresh){
 const parent=document.getElementById('roster-rows');
 if(parent)parent.addEventListener('click',async event=>{
  const btn=event.target.closest('[data-archive-delete]');
  if(!btn)return;
  const m=members.find(x=>x.id===btn.dataset.archiveDelete);
  if(!m)return;
  if(!window.confirm('Удалить дело '+person(m)+' из архива?\n\nИсчезнут связанные взыскания и результаты экзаменов. Действие нельзя отменить.'))return;
  await perform(api,btn,'fso_admin_archive_delete',{p_member:m.id,p_all:false},refresh,'archive-action-status');
 });
 const clear=document.getElementById('clear-full-archive');
 if(clear)clear.onclick=async()=>{
  if(window.prompt('Будут удалены все '+members.length+' архивных дел и связанные результаты экзаменов. Для подтверждения введите УДАЛИТЬ АРХИВ')!=='УДАЛИТЬ АРХИВ')return;
  await perform(api,clear,'fso_admin_archive_delete',{p_member:null,p_all:true},refresh,'archive-action-status');
 };
}
function examPanels(s){
 const admin=roleAdmin(s);
 const rowsExams=s.exams.map(ex=>{
  const linked=s.assignments.filter(a=>a.exam_id===ex.id);
  const running=linked.some(a=>attemptsFor(s.attempts,a.id).some(t=>!t.completed_at));
  return '<tr><td><strong>'+h(ex.title)+'</strong><small class="table-subline">Создан '+h(fmt(ex.created_at))+'</small></td>'+
   '<td>'+h(who(ex.created_by,s.staff))+'</td><td>'+h(ex.pass_percent)+'% · '+h(ex.duration_minutes||'Без ограничения')+' мин.</td>'+
   '<td>'+linked.length+'</td><td>'+h(ex.status==='published'?'Опубликован':'В архиве')+'</td>'+
   '<td>'+(admin?'<button class="btn danger small" type="button" data-exam-delete="'+h(ex.id)+'" '+(running?'disabled title="Есть незавершённые попытки"':'')+'>Удалить</button>':'')+'</td></tr>';
 }).join('');
 const rowsResults=s.assignments.map(a=>{
  const ex=s.exams.find(x=>x.id===a.exam_id),m=s.members.find(x=>x.id===a.member_id);
  const attempts=attemptsFor(s.attempts,a.id),running=attempts.some(t=>!t.completed_at);
  const label=person(m);
  return '<tr data-exam-search="'+h((label+' '+(m?.employee_number||'')+' '+(ex?.title||'')).toLocaleLowerCase('ru-RU'))+'">'+
   '<td><strong>'+h(label)+'</strong><small class="table-subline">ID '+h(m?.employee_number||'неизвестен')+'</small></td>'+
   '<td>'+h(ex?.title||'Удалённый экзамен')+'</td>'+
   '<td>'+h(status(a,attempts))+'</td>'+
   '<td>'+attempts.length+'</td>'+
   '<td>'+h(who(a.issued_by,s.staff))+'</td>'+
   '<td>'+h(fmt(a.assigned_at))+'</td>'+
   '<td><div class="exam-actions"><button class="btn small" type="button" data-exam-detail="'+h(a.id)+'">Результаты</button>'+
   (admin?'<button class="btn danger small" data-attempt-clear="'+h(a.id)+'" type="button" '+(!attempts.length||running?'disabled':'')+'>Очистить</button>'+
   '<button class="btn danger small" data-assignment-delete="'+h(a.id)+'" type="button" '+(running?'disabled':'')+'>Удалить</button>':'')+
   '</div></td></tr>';
 }).join('');
 return '<section class="section exam-management">'+
 '<div class="section-heading"><div><span class="form-step">НАСТРОЙКИ И УЧЁТ</span><h2>Созданные экзамены</h2></div></div>'+
 '<p class="hint">Указан автор каждого экзамена. Удаление экзамена также удаляет все его назначения и результаты. Вопросы в общем банке сохраняются.</p>'+
 '<div class="table-wrap"><table class="exam-table"><thead><tr><th>Экзамен</th><th>Создал</th><th>Порог / время</th><th>Назначений</th><th>Статус</th><th></th></tr></thead>'+
 '<tbody>'+ (rowsExams||'<tr><td colspan="6">Экзамены не созданы.</td></tr>')+'</tbody></table></div><div id="exam-manage-message"></div></section>'+
 '<section class="section exam-management">'+
 '<div class="section-heading"><div><span class="form-step">АТТЕСТАЦИЯ СОТРУДНИКОВ</span><h2>Результаты назначенных экзаменов</h2></div><span class="sort-note">'+s.assignments.length+' назначений</span></div>'+
 '<p class="hint">Экзаменатор в таблице это сотрудник, который назначил экзамен. Ответы проверяются системой автоматически.</p>'+
 '<div class="member-toolbar"><input id="exam-history-filter" type="search" aria-label="Поиск результатов экзаменов" placeholder="Поиск по сотруднику, ID или экзамену"></div>'+
 '<div class="table-wrap"><table class="exam-table"><thead><tr><th>Сотрудник</th><th>Экзамен</th><th>Итог</th><th>Попыток</th><th>Назначил</th><th>Дата назначения</th><th></th></tr></thead>'+
 '<tbody id="exam-history-rows">'+(rowsResults||'<tr><td colspan="7" class="subtle">Назначений пока нет.</td></tr>')+'</tbody></table></div>'+
 '<div id="exam-manage-result" role="status"></div><div id="exam-review" aria-live="polite"></div></section>';
}
async function showDetail(api,s,id){
 const area=document.getElementById('exam-review');if(!area)return;
 const a=s.assignments.find(x=>x.id===id);if(!a)return;
 const ex=s.exams.find(x=>x.id===a.exam_id),m=s.members.find(x=>x.id===a.member_id);
 const attempts=attemptsFor(s.attempts,a.id);
 area.innerHTML='<div class="section review-section">Загрузка результатов...</div>';
 try{
  const ids=attempts.map(x=>x.id);
  const [questions,answers]=await Promise.all([
   api.from('fso_exam_items').select('ordinal,question_snapshot').eq('exam_id',a.exam_id).order('ordinal',{ascending:true}),
   ids.length?api.from('fso_exam_answers').select('attempt_id,ordinal,chosen').in('attempt_id',ids):
     Promise.resolve({data:[],error:null})
  ]);
  if(questions.error)throw questions.error;
  if(answers.error)throw answers.error;
  const snapshots=questions.data||[],responses=answers.data||[];
  const htmlAttempts=attempts.length?attempts.map((t,i)=>{
   const complete=!!t.completed_at;
   const selected=responses.filter(x=>x.attempt_id===t.id);
   const answerRows=complete?snapshots.map(q=>{
    const row=selected.find(x=>x.ordinal===q.ordinal);
    const source=q.question_snapshot||{},chosen=Array.isArray(row?.chosen)?row.chosen:[],
      correct=Array.isArray(source.correct)?source.correct:[],
      options=Array.isArray(source.options)?source.options:[];
    const picked=chosen.length?chosen.map(n=>options[n]||'Нет варианта').join(', '):'Нет ответа';
    const expected=correct.map(n=>options[n]||'Нет варианта').join(', ')||'Неизвестно';
    const good=chosen.length===correct.length&&correct.every((n,j)=>n===chosen[j]);
    return '<div class="review-answer"><div><strong>Вопрос '+h(q.ordinal)+' · '+h(source.prompt||'Вопрос')+'</strong>'+
     '<span class="'+(good?'review-correct':'review-wrong')+'">'+(good?'Верно':'Неверно')+'</span></div>'+
     '<p>Ответ сотрудника · '+h(picked)+'</p><p>Правильный ответ · '+h(expected)+'</p></div>';
   }).join(''):'<p class="hint">Попытка ещё не завершена. Ответы появятся после сдачи.</p>';
   return '<details class="review-attempt" '+(i===0?'open':'')+'><summary><span>Попытка '+(attempts.length-i)+'</span><strong>'+
    h(!complete?'В процессе':t.passed?'Сдан':'Не сдан')+'</strong>'+
    (complete?'<span>'+h(t.correct_count)+' / '+h(t.total_count)+' · '+rate(t)+'%</span>':'')+
    '<small>'+h(fmt(t.completed_at||t.started_at))+'</small></summary><div class="review-answers">'+answerRows+'</div></details>';
  }).join(''):'<p class="hint">Сотрудник ещё не приступал к этому экзамену.</p>';
  area.innerHTML='<section class="section review-section"><div class="section-heading"><div><span class="form-step">ЛИЧНЫЙ РЕЗУЛЬТАТ</span>'+
   '<h2>'+h(person(m))+'</h2></div><button type="button" class="btn small" id="exam-review-close">Закрыть</button></div>'+
   '<div class="review-meta"><span>Экзамен · '+h(ex?.title||'Неизвестен')+'</span>'+
   '<span>Назначил · '+h(who(a.issued_by,s.staff))+'</span>'+
   '<span>Автор экзамена · '+h(who(ex?.created_by,s.staff))+'</span>'+
   '<span>Проверка · автоматическая</span><span>Назначен · '+h(fmt(a.assigned_at))+'</span></div>'+
   htmlAttempts+'</section>';
  document.getElementById('exam-review-close').onclick=()=>area.replaceChildren();
  area.scrollIntoView({behavior:'smooth',block:'nearest'});
 }catch(error){message('exam-review','Не удалось загрузить ответы: '+(error.message||'Ошибка'));}
}
function bindExams(api,s,refresh){
 const filter=document.getElementById('exam-history-filter'),rows=document.querySelectorAll('#exam-history-rows [data-exam-search]');
 if(filter)filter.oninput=()=>{
  const q=filter.value.trim().toLocaleLowerCase('ru-RU');
  rows.forEach(row=>{row.hidden=!row.dataset.examSearch.includes(q)});
 };
 document.querySelectorAll('[data-exam-detail]').forEach(btn=>btn.onclick=()=>showDetail(api,s,btn.dataset.examDetail));
 if(!roleAdmin(s))return;
 document.querySelectorAll('[data-exam-delete]').forEach(btn=>btn.onclick=async()=>{
  const ex=s.exams.find(x=>x.id===btn.dataset.examDelete);if(!ex)return;
  const count=s.assignments.filter(a=>a.exam_id===ex.id).length;
  if(!window.confirm('Удалить экзамен «'+ex.title+'»?\n\nБудут удалены '+count+' назначений и все результаты этих назначений. Восстановление невозможно.'))return;
  await perform(api,btn,'fso_admin_exam_delete',{p_exam:ex.id},refresh,'exam-manage-message');
 });
 document.querySelectorAll('[data-attempt-clear]').forEach(btn=>btn.onclick=async()=>{
  const a=s.assignments.find(x=>x.id===btn.dataset.attemptClear);
  if(!a)return;
  const n=attemptsFor(s.attempts,a.id).length;
  if(!window.confirm('Очистить '+n+' попыток сотрудника по выбранному экзамену?\n\nРезультаты и ответы будут удалены. Назначение и код сохранятся. Восстановление невозможно.'))return;
  await perform(api,btn,'fso_admin_assignment_delete',{p_assignment:a.id,p_mode:'results'},refresh,'exam-manage-result');
 });
 document.querySelectorAll('[data-assignment-delete]').forEach(btn=>btn.onclick=async()=>{
  const a=s.assignments.find(x=>x.id===btn.dataset.assignmentDelete);if(!a)return;
  if(!window.confirm('Удалить назначение экзамена?\n\nИндивидуальный код перестанет действовать, все попытки и ответы будут удалены.'))return;
  await perform(api,btn,'fso_admin_assignment_delete',{p_assignment:a.id,p_mode:'assignment'},refresh,'exam-manage-result');
 });
}
window.FSO_ADMIN_TOOLS={archiveToolbar,bindArchive,examPanels,bindExams};
})();