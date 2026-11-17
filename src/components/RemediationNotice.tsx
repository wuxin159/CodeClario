import {ArrowRight,CornerUpLeft,BookOpen} from 'lucide-react';
import type {Remediation} from '../hooks/useRemediation';

export function RemediationSuggestion({review,onStart,onDismiss,disabled=false}:{review:Remediation;onStart:()=>void;onDismiss:()=>void;disabled?:boolean}){
  const suggestion=review.suggestion;if(!suggestion)return null;
  return <section className="remediation-suggestion" aria-label="补学建议">
    <span className="remediation-eyebrow"><BookOpen size={14}/>这个知识点再巩固一下</span>
    <h3>{suggestion.label}</h3><p>近期记录到 {suggestion.count} 次相关错误。建议先补学这节课，再回来继续。</p>
    <details><summary>为什么推荐</summary>{suggestion.reasons.map((reason,i)=><p key={i}>{reason}</p>)}</details>
    <strong>{suggestion.lessonTitle}</strong>
    <div className="remediation-actions"><button disabled={disabled||review.busy} onClick={onStart}>{review.busy?'正在准备…':'去补习这节课'}<ArrowRight size={14}/></button><button disabled={disabled||review.busy} onClick={onDismiss}>继续当前课</button></div>
    <small>当前任务和代码会保留</small>{review.error&&<p role="alert">{review.error}</p>}
  </section>;
}
export function RemediationBanner({review,currentLessonId,onResume,onReturn,onCheck}:{review:Remediation;currentLessonId?:string;onResume:()=>void;onReturn:(complete:boolean)=>void;onCheck?:()=>void}){
  const s=review.session;if(!s)return null;
  return <section className="remediation-banner" aria-label="当前补学路径"><div><span>补学中 · {s.conceptLabel}</span><strong>{s.targetTitle}</strong><small>原任务「{s.sourceTitle}」已保留 · {s.ready?'本次练习与理解检查已通过':!s.practiceReady?'先完成本次补学的编程练习':'练习已通过，再检查一下理解'}</small></div><div className="remediation-actions">{currentLessonId!==s.targetLessonId&&<button disabled={review.busy} onClick={onResume}>继续补学<ArrowRight size={14}/></button>}{s.practiceReady&&!s.understandingReady&&onCheck&&<button disabled={review.busy} onClick={onCheck}>补学理解检查<ArrowRight size={14}/></button>}{s.ready&&<button disabled={review.busy} onClick={()=>onReturn(true)}>完成补学并返回<CornerUpLeft size={14}/></button>}<button disabled={review.busy} onClick={()=>onReturn(false)}>返回原课</button></div>{review.error&&<p role="alert">{review.error}</p>}</section>;
}
