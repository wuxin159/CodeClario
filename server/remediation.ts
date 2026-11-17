import {Router} from 'express';
import {createHash,randomUUID} from 'node:crypto';
import {AccountError,type LearningDatabase} from './database.ts';
import {requireAccount,requireMatchingAccount} from './accounts.ts';
import {findLesson,type Lesson,type RunResult} from '../shared/curriculum.ts';
import type {LearningTask,TeachingDecision} from '../shared/flow.ts';
import {reviewConcepts,REMEDIATION_THRESHOLD,type ReviewSession,type ReviewSuggestion} from '../shared/remediation.ts';

const digest=(text:string)=>createHash('sha256').update(text).digest('hex');
const mission=(store:LearningDatabase,userId:string)=>store.db.prepare("SELECT id,lesson_id,created_at FROM learning_missions WHERE user_id=? AND status='active'").get(userId) as {id:string;lesson_id:string;created_at:number}|undefined;
type Evidence={key:string;kind:'run'|'answer'|'assessment';detail:string};
function eligibleEvidence(store:LearningDatabase,userId:string,task:LearningTask,result?:RunResult):Evidence|null {
  if(task.viewContext?.kind==='experiment')return null;
  if(task.trigger==='run'&&task.attemptId&&result){
    const attempt=store.attempt(userId,task.attemptId);
    if(!attempt||attempt.code!==task.code||attempt.stdin!==task.stdin)return null;
    // 输入变化和重复点击不把同一份错误程序累计成多个知识薄弱证据。
    const lesson=findLesson(task.lessonId);
    const isStarter=lesson&&task.code.replace(/\r/g,'').trim()===lesson.starter.replace(/\r/g,'').trim();
    if(!isStarter&&!result.passed&&['success','runtime_error'].includes(result.status)&&!result.failure&&!result.timedOut)
      return {key:'run:'+digest(task.code.replace(/\r/g,'').trim()),kind:'run',detail:'本次代码未通过样例，需依据具体输出或错误确定知识点'};
    if(task.comparison?.matches===false)return {key:'prediction:'+digest(task.code+'\0'+task.stdin+'\0'+JSON.stringify(task.prediction)),kind:'assessment',detail:'运行结果与学生此前明确记录的预测不同'};
  }
  if(task.trigger==='retest'&&task.retest&&task.retestResult&&!task.retestResult.correct)
    return {key:'retest:'+task.retest.id,kind:'assessment',detail:'当前迁移题作答错误：'+task.retest.prompt};
  if(task.trigger==='study'){
    const row=store.db.prepare("SELECT correct FROM learning_events WHERE user_id=? AND lesson_id=? AND kind='review' AND created_at>=? ORDER BY id DESC LIMIT 1").get(userId,task.lessonId,task.createdAt) as {correct:number}|undefined;
    if(row?.correct===0)return {key:'review:'+task.lessonId,kind:'assessment',detail:'当前课程理解题作答错误'};
  }
  if(['answer','discussion','prediction_reply'].includes(task.trigger)){
    const answer=task.answers.at(-1);
    if(answer?.question&&answer.answer.trim()&&!/^(不知道|不确定|不懂|没懂|不会|跳过|继续)[。！!？?\s]*$/.test(answer.answer.trim()))
      return {key:'answer:'+digest(answer.question.trim()+'\0'+answer.answer.trim()),kind:'answer',detail:'需由老师核实的回答：'+answer.answer.slice(0,300)};
  }
  return null;
}
function cutoff(store:LearningDatabase,userId:string,missionId:string,conceptId:string){
  const row=store.db.prepare("SELECT MAX(updated_at) AS at FROM adaptive_reviews WHERE user_id=? AND source_mission_id=? AND concept_id=? AND status IN ('completed','returned','dismissed')").get(userId,missionId,conceptId) as {at:number|null};
  return Math.max(Date.now()-14*86400000,row.at??0);
}
function recentIssues(store:LearningDatabase,userId:string,missionId:string,lessonId:string,conceptId:string){
  const reviewSuccess=store.db.prepare("SELECT MAX(created_at) AS at FROM learning_events WHERE user_id=? AND lesson_id=? AND kind='review' AND correct=1").get(userId,lessonId) as {at:number|null};
  const retestSuccess=store.db.prepare("SELECT MAX(e.created_at) AS at FROM ai_task_events e JOIN ai_tasks t ON t.id=e.task_id WHERE t.user_id=? AND json_extract(t.task_json,'$.missionId')=? AND e.kind='retest' AND json_extract(e.payload_json,'$.correct')=1").get(userId,missionId) as {at:number|null};
  const since=Math.max(cutoff(store,userId,missionId,conceptId),reviewSuccess.at??0,retestSuccess.at??0);
  const lastRun=store.db.prepare('SELECT MAX(created_at) AS at FROM attempts WHERE user_id=? AND lesson_id=? AND passed=1').get(userId,lessonId) as {at:number|null};
  return store.db.prepare("SELECT reason,kind,created_at FROM adaptive_evidence WHERE user_id=? AND mission_id=? AND concept_id=? AND created_at>? AND (kind!='run' OR created_at>?) ORDER BY created_at DESC LIMIT 12").all(userId,missionId,conceptId,since,lastRun.at??0) as {reason:string;kind:string;created_at:number}[];
}
export function activeReview(store:LearningDatabase,userId:string):ReviewSession|null {
  const active=mission(store,userId);if(!active)return null;
  const row=store.db.prepare("SELECT * FROM adaptive_reviews WHERE user_id=? AND source_mission_id=? AND status='active'").get(userId,active.id) as any;
  if(!row)return null;
  const source=findLesson(row.source_lesson_id),target=findLesson(row.target_lesson_id);if(!source||!target)return null;
  const latest=store.db.prepare('SELECT task_json FROM ai_tasks WHERE user_id=? AND lesson_id=? ORDER BY updated_at DESC,rowid DESC LIMIT 1').get(userId,target.id) as {task_json:string}|undefined;
  const task:LearningTask|undefined=latest&&JSON.parse(latest.task_json);
  const attempt=task?.attemptId?store.attempt(userId,task.attemptId):null;
  const run=task?.attemptId?store.db.prepare('SELECT created_at FROM attempts WHERE user_id=? AND id=?').get(userId,task.attemptId) as {created_at:number}|undefined:undefined;
  const draft=store.db.prepare('SELECT code,stdin FROM drafts WHERE user_id=? AND lesson_id=?').get(userId,target.id) as {code:string;stdin:string}|undefined;
  const checked=store.db.prepare("SELECT correct FROM learning_events WHERE user_id=? AND lesson_id=? AND kind='review' AND created_at>=? ORDER BY id DESC LIMIT 1").get(userId,target.id,row.created_at) as {correct:number}|undefined;
  const retestChecked=task&&store.db.prepare("SELECT 1 FROM ai_task_events WHERE task_id=? AND kind='retest' AND json_extract(payload_json,'$.correct')=1 AND created_at>=? LIMIT 1").get(task.id,row.created_at);
  const practiceReady=!!(task&&run&&run.created_at>=row.created_at&&attempt?.result.passed&&attempt.code===task.code&&attempt.stdin===task.stdin&&(!draft||(draft.code===task.code&&draft.stdin===task.stdin)));
  const understandingReady=checked?.correct===1||!!retestChecked;
  return {id:row.id,sourceMissionId:active.id,sourceLessonId:source.id,sourceTitle:source.title,targetLessonId:target.id,targetTitle:target.title,conceptId:row.concept_id,conceptLabel:row.concept_label,createdAt:row.created_at,ready:practiceReady&&understandingReady,practiceReady,understandingReady};
}
export function reviewSuggestion(store:LearningDatabase,userId:string,lesson:Lesson):ReviewSuggestion|null {
  const active=mission(store,userId);if(!active||active.lesson_id!==lesson.id||activeReview(store,userId))return null;
  const choices=reviewConcepts(lesson).map(c=>({c,rows:recentIssues(store,userId,active.id,lesson.id,c.id)})).filter(c=>c.rows.length>=REMEDIATION_THRESHOLD).sort((a,b)=>b.rows[0].created_at-a.rows[0].created_at);
  const best=choices[0];return best?{...best.c,count:best.rows.length,threshold:REMEDIATION_THRESHOLD,reasons:[...new Set(best.rows.map(r=>r.reason))].slice(0,2)}:null;
}
export function learningReviewContext(store:LearningDatabase,userId:string,lesson:Lesson,task:LearningTask,result?:RunResult){
  const active=mission(store,userId),session=activeReview(store,userId);
  const evidence=active?.lesson_id===lesson.id&&active.id===task.missionId&&!session?eligibleEvidence(store,userId,task,result):null;
  const recent=active?.lesson_id===lesson.id?store.db.prepare("SELECT target_lesson_id,concept_label,status,updated_at FROM adaptive_reviews WHERE user_id=? AND source_mission_id=? AND status IN ('completed','returned','dismissed') ORDER BY updated_at DESC LIMIT 1").get(userId,active.id) as {target_lesson_id:string;concept_label:string;status:string;updated_at:number}|undefined:undefined;
  const recentReview=recent?{lessonTitle:findLesson(recent.target_lesson_id)?.title,concept:recent.concept_label,status:recent.status,at:recent.updated_at}:null;
  return {threshold:REMEDIATION_THRESHOLD,session:session?.targetLessonId===lesson.id?session:null,recentReview,evidence,candidates:evidence?reviewConcepts(lesson).map(c=>({ ...c,priorCount:recentIssues(store,userId,active!.id,lesson.id,c.id).length,alreadyCounted:!!store.db.prepare('SELECT 1 FROM adaptive_evidence WHERE user_id=? AND mission_id=? AND concept_id=? AND evidence_key=?').get(userId,active!.id,c.id,evidence.key)})):[],existingSuggestion:reviewSuggestion(store,userId,lesson)};
}
export function recordLearningIssue(store:LearningDatabase,userId:string,lesson:Lesson,task:LearningTask,decision:TeachingDecision){
  const issue=decision.learningIssue;if(!issue)return;
  const result=task.attemptId?store.attempt(userId,task.attemptId)?.result:undefined;
  const context=learningReviewContext(store,userId,lesson,task,result);
  if(!context.evidence||issue.evidenceKey!==context.evidence.key||!context.candidates.some(c=>c.id===issue.conceptId))return;
  store.db.prepare('INSERT OR IGNORE INTO adaptive_evidence(user_id,mission_id,lesson_id,concept_id,evidence_key,kind,reason,created_at) VALUES (?,?,?,?,?,?,?,?)').run(userId,task.missionId!,lesson.id,issue.conceptId,issue.evidenceKey,context.evidence.kind,issue.reason,Date.now());
}
export function remediationRoutes(store:LearningDatabase){
  const router=Router();
  const snapshot=(userId:string,lessonId:string)=>({userId,session:activeReview(store,userId),suggestion:findLesson(lessonId)?reviewSuggestion(store,userId,findLesson(lessonId)!):null});
  router.get('/adaptive/:lessonId',requireAccount,(req,res)=>res.json(snapshot(req.user!.id,String(req.params.lessonId))));
  router.post('/adaptive/start',requireMatchingAccount,(req,res)=>{
    try{
      const userId=req.user!.id,lesson=findLesson(req.body.lessonId),active=mission(store,userId);
      if(!lesson||!active||active.lesson_id!==lesson.id||active.id!==req.body.missionId)throw new AccountError(409,'当前任务已变化，请刷新后再选择补学。');
      const existing=activeReview(store,userId);if(existing){res.json(snapshot(userId,lesson.id));return;}
      const suggestion=reviewSuggestion(store,userId,lesson);
      if(!suggestion||suggestion.id!==req.body.conceptId)throw new AccountError(409,'这条补学建议已更新，请依据最新学习记录查看。');
      store.db.exec('BEGIN IMMEDIATE');
      try{
        store.db.prepare("UPDATE adaptive_reviews SET status='cancelled',updated_at=? WHERE user_id=? AND status='active'").run(Date.now(),userId);
        const now=Date.now();
        store.db.prepare("INSERT INTO adaptive_reviews(id,user_id,source_mission_id,source_lesson_id,target_lesson_id,concept_id,concept_label,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,'active',?,?)").run(randomUUID(),userId,active.id,lesson.id,suggestion.lessonId,suggestion.id,suggestion.label,now,now);
        store.db.exec('COMMIT');
      }catch(e){store.db.exec('ROLLBACK');throw e;}
      // 原learning_missions保持active；补学不会暂停、替换或完成原任务。
      res.json(snapshot(userId,suggestion.lessonId));
    }catch(e){res.status(e instanceof AccountError?e.status:500).json({error:e instanceof Error?e.message:'暂时不能开始补学'});}
  });
  router.post('/adaptive/return',requireMatchingAccount,(req,res)=>{
    try{
      const session=activeReview(store,req.user!.id);
      if(!session||session.id!==req.body.sessionId)throw new AccountError(409,'补学记录已变化，请刷新后查看。');
      if(req.body.complete===true&&!session.ready)throw new AccountError(409,'先完成本次补学的运行和理解检查，或选择直接返回原课。');
      store.db.prepare("UPDATE adaptive_reviews SET status=?,updated_at=? WHERE id=? AND user_id=? AND status='active'").run(req.body.complete===true?'completed':'returned',Date.now(),session.id,req.user!.id);
      res.json({...snapshot(req.user!.id,session.sourceLessonId),returnLessonId:session.sourceLessonId});
    }catch(e){res.status(e instanceof AccountError?e.status:500).json({error:e instanceof Error?e.message:'暂时不能返回原课'});}
  });
  router.post('/adaptive/dismiss',requireMatchingAccount,(req,res)=>{
    const active=mission(store,req.user!.id),lesson=findLesson(req.body.lessonId);
    const suggestion=lesson&&reviewSuggestion(store,req.user!.id,lesson);
    if(!active||active.id!==req.body.missionId||!suggestion||suggestion.id!==req.body.conceptId){res.status(409).json({error:'建议已更新，请刷新后查看。'});return;}
    const now=Date.now();store.db.prepare("INSERT INTO adaptive_reviews(id,user_id,source_mission_id,source_lesson_id,target_lesson_id,concept_id,concept_label,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,'dismissed',?,?)").run(randomUUID(),req.user!.id,active.id,lesson!.id,suggestion.lessonId,suggestion.id,suggestion.label,now,now);
    res.json(snapshot(req.user!.id,lesson!.id));
  });
  return router;
}
