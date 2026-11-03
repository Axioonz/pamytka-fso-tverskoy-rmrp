import { createClient } from "npm:@supabase/supabase-js@2.57.0";
const URL=Deno.env.get("SUPABASE_URL")??"";
const SERVICE=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")??"";
const STAFF_DOMAIN="@staff.fso-rmrp.example";
const supabase=createClient(URL,SERVICE,{auth:{autoRefreshToken:false,persistSession:false}});
const origins=new Set(["https://axioonz.github.io","http://127.0.0.1:8765","http://localhost:8765"]);
const validLogin=/^[a-z][a-z0-9_-]{2,23}$/;
const operatorRoles=new Set(["admin","hr"]);
type Failure={status:number;message:string};
function fail(status:number,message:string):never{throw {status,message} as Failure}
function respond(req:Request,body:unknown,status=200){
 const origin=req.headers.get("origin")??"";
 return new Response(JSON.stringify(body),{status,headers:{
  "Content-Type":"application/json;charset=utf-8","Cache-Control":"no-store",
  "Access-Control-Allow-Origin":origins.has(origin)?origin:"https://axioonz.github.io",
  "Access-Control-Allow-Methods":"OPTIONS, POST",
  "Access-Control-Allow-Headers":"authorization, apikey, x-client-info, content-type",
  "Vary":"Origin"
 }});
}
function strongPassword(v:unknown){
 return typeof v==="string"&&v.length>=12&&v.length<=72&&
 /[A-ZА-ЯЁ]/.test(v)&&/[a-zа-яё]/.test(v)&&/[0-9]/.test(v);
}
async function verifyUser(req:Request){
 const bearer=req.headers.get("authorization")??"";
 if(!bearer.startsWith("Bearer "))fail(401,"Войдите в личный кабинет");
 const {data,error}=await supabase.auth.getUser(bearer.slice(7));
 if(error||!data.user)fail(401,"Сессия истекла. Войдите заново");
 return data.user;
}
async function getRole(uid:string){
 const {data,error}=await supabase.from("fso_profiles").select("role").eq("user_id",uid).maybeSingle();
 if(error)fail(500,"Не удалось проверить служебную роль");
 return data?.role||"";
}
async function getMember(id:string){
 const {data,error}=await supabase.from("fso_members")
  .select("id,user_id,first_name,last_name,status").eq("id",id).maybeSingle();
 if(error)fail(500,"Не удалось проверить личное дело");
 if(!data)fail(404,"Личное дело не найдено");
 return data;
}
Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return respond(req,{ok:true});
 if(req.method!=="POST")return respond(req,{error:"Метод недоступен"},405);
 try{
  if(!URL||!SERVICE)fail(503,"Служебная авторизация не настроена");
  const actor=await verifyUser(req);
  let body:Record<string,unknown>;
  try{body=await req.json()}catch{fail(400,"Неверный формат запроса")}
  if(!body||typeof body!=="object")fail(400,"Неверный формат запроса");
  const action=String(body.action||"");
  if(action==="issue"){
   if(!operatorRoles.has(await getRole(actor.id)))
    fail(403,"Выдавать учётные записи может только кадровое руководство");
   const id=String(body.member_id||"");
   const login=String(body.login||"").trim().toLowerCase();
   if(!validLogin.test(login)||["admin","root","support","system","security"].includes(login))
    fail(400,"Логин должен содержать 3–24 латинских символа, цифры, _ или - и начинаться с буквы");
   if(!strongPassword(body.password))
    fail(400,"Пароль должен содержать 12–72 символа, строчные и заглавные буквы, цифру");
   const member=await getMember(id);
   if(!["active","cadet"].includes(member.status))fail(400,"Нельзя выдать вход уволенному сотруднику");
   if(member.user_id)fail(409,"У сотрудника уже есть аккаунт");
   const email=login+STAFF_DOMAIN;
   const {data:created,error:createError}=await supabase.auth.admin.createUser({
    email,password:body.password as string,email_confirm:true,
    app_metadata:{staff_managed:true,staff_login:login},
    user_metadata:{display_name:member.first_name+" "+member.last_name,signup_source:"leadership"}
   });
   if(createError||!created.user){
    if(/already|registered|exist|duplicate/i.test(createError?.message??""))fail(409,"Логин уже занят");
    fail(400,"Не удалось создать аккаунт: "+(createError?.message||"ошибка сервера"));
   }
   try{
    const {error:linkedError}=await supabase.rpc("fso_staff_account_bind",{
     p_member:id,p_user:created.user.id,p_actor:actor.id,p_login:login
    });
    if(linkedError)throw linkedError;
   }catch(error){
    const rollback=await supabase.auth.admin.deleteUser(created.user.id);
    if(rollback.error)console.error("Account rollback failed",created.user.id,rollback.error.message);
    fail(409,"Не удалось привязать аккаунт: "+(error instanceof Error?error.message:String(error)));
   }
   return respond(req,{ok:true,member_id:id,login,first_login:true});
  }
  if(action==="reset"){
   if(!operatorRoles.has(await getRole(actor.id)))
    fail(403,"Сбрасывать пароли может только кадровое руководство");
   const member=await getMember(String(body.member_id||""));
   if(!member.user_id)fail(404,"Учётная запись ещё не выдана");
   if(!strongPassword(body.password))
    fail(400,"Новый временный пароль должен содержать 12–72 символа, буквы разного регистра и цифру");
   const {data:managed,error:managedError}=await supabase.auth.admin.getUserById(member.user_id);
   if(managedError||managed.user?.app_metadata?.staff_managed!==true)
    fail(403,"Сброс доступен только для служебных аккаунтов, созданных руководством");
   const {error:lockError}=await supabase.rpc("fso_staff_account_reset",{
    p_member:member.id,p_actor:actor.id
   });
   if(lockError)fail(403,lockError.message);
   const {error:passwordError}=await supabase.auth.admin.updateUserById(member.user_id,{
    password:body.password as string
   });
   if(passwordError)fail(503,"Не удалось заменить пароль. Доступ приостановлен. Повторите выдачу.");
   return respond(req,{ok:true,login:String(managed.user?.app_metadata?.staff_login||""),first_login:true});
  }
  if(action==="activate"){
   if(await getRole(actor.id)!=="employee_pending")
    fail(403,"Аккаунт не ожидает первого входа");
   if(actor.app_metadata?.staff_managed!==true)fail(403,"Это не служебный аккаунт");
   if(!strongPassword(body.password))
    fail(400,"Новый пароль должен содержать 12–72 символа, буквы разного регистра и цифру");
   const {error:updateError}=await supabase.auth.admin.updateUserById(actor.id,{
    password:body.password as string
   });
   if(updateError)fail(400,"Не удалось заменить пароль: "+updateError.message);
   const {data:activation,error:activateError}=await supabase.rpc("fso_staff_account_activate",{p_user:actor.id});
   if(activateError)fail(409,"Пароль заменён, но доступ пока не активирован. Войдите снова и завершите активацию.");
   return respond(req,{ok:true,role:activation.role});
  }
  fail(400,"Неизвестное действие");
 }catch(error){
  const e=error as Partial<Failure>;
  return respond(req,{error:typeof e.message==="string"?e.message:"Служебная операция не выполнена"},e.status||500);
 }
});