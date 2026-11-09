import type {Lesson} from "../shared/curriculum.ts";
import type {LearningTask} from "../shared/flow.ts";
import {diagnosticCases,type DiagnosticObservation} from "../shared/diagnostics.ts";
import {AccountError,type LearningDatabase} from "./database.ts";
import {runSandbox} from "./runner.ts";
import {assertNoCredentials,redactCredentials} from "./aiSafety.ts";

export async function runDiagnosticCase(store:LearningDatabase,userId:string,lesson:Lesson,task:LearningTask,args:unknown,signal:AbortSignal):Promise<DiagnosticObservation> {
  const input=args as {caseId?:unknown;reason?:unknown};
  if(!input||typeof input!=="object"||Object.keys(input).some(k=>!["caseId","reason"].includes(k))||typeof input.caseId!=="string"||typeof input.reason!=="string"||!input.reason.trim()||input.reason.length>120)throw new AccountError(400,"诊断参数无效。");
  const example=diagnosticCases(lesson).find(c=>c.id===input.caseId);if(!example)throw new AccountError(400,"只能选择本课提供的验证输入。");
  const owned=store.db.prepare("SELECT task_json FROM ai_tasks WHERE id=? AND user_id=? AND lesson_id=? AND revision=?").get(task.id,userId,lesson.id,task.revision) as {task_json:string}|undefined;
  if(!owned)throw new AccountError(403,"验证任务不属于当前账户或代码版本。");
  const saved=JSON.parse(owned.task_json) as LearningTask;
  if(saved.code!==task.code||saved.stdin!==task.stdin||!task.attemptId)throw new AccountError(409,"先运行当前代码，再依据结果选择额外验证。");
  const attempt=store.attempt(userId,task.attemptId);
  if(!attempt||attempt.code!==task.code||attempt.stdin!==task.stdin||attempt.result.passed)throw new AccountError(409,"当前没有需要补充验证的失败运行。");
  assertNoCredentials(task.code+"\n"+example.input);
  const rows=store.db.prepare("SELECT payload_json FROM ai_task_events WHERE task_id=? AND kind='diagnostic' ORDER BY id").all(task.id) as {payload_json:string}[];
  const prior=rows.map(r=>JSON.parse(r.payload_json)).find(r=>r.revision===task.revision&&r.caseId===example.id);
  if(prior)return {...prior.observation,reused:true};
  const recent=store.db.prepare("SELECT COUNT(*) AS count FROM ai_task_events e JOIN ai_tasks t ON t.id=e.task_id WHERE t.user_id=? AND e.kind='diagnostic' AND e.created_at>?").get(userId,Date.now()-10*60*1000) as {count:number};
  if(rows.length>=2||recent.count>=6)throw new AccountError(429,"本次额外验证已足够，请先根据已有结果继续讲解。");
  // 仅对未改动的学生代码换一个审校输入。既不写attempts，也不更新课程通过状态。
  const result=await runSandbox({language:lesson.language,code:task.code,stdin:example.input,tests:[]},signal);
  const stdout=redactCredentials(String(result.stdout??"")).slice(0,1600),stderr=redactCredentials(String(result.stderr||result.compileOutput||"")).slice(0,1000);
  const observation:DiagnosticObservation={...example,reason:input.reason.trim(),stdout,stderr,status:String(result.status??"error"),durationMs:Number(result.durationMs??0),matches:result.status==="success"?stdout.trim().replace(/\r/g,"")===example.expected.trim():null,reused:false};
  if(signal.aborted)throw new AccountError(499,"验证已停止。");
  store.db.prepare("INSERT INTO ai_task_events(task_id,kind,payload_json,created_at) VALUES(?,?,?,?)").run(task.id,"diagnostic",JSON.stringify({revision:task.revision,caseId:example.id,observation}),Date.now());
  return observation;
}
