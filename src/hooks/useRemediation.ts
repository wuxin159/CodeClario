import {useCallback,useEffect,useRef,useState} from 'react';
import type {RemediationSnapshot} from '../../shared/remediation';

export function useRemediation(userId:string|undefined,lessonId:string){
  const [data,setData]=useState<(RemediationSnapshot&{lessonId:string})|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const context=useRef({userId,lessonId}),sequence=useRef(0),live=useRef(true);
  context.current={userId,lessonId};
  useEffect(()=>{live.current=true;return()=>{live.current=false;};},[]);
  const refresh=useCallback(async()=>{
    if(!userId){setData(null);return;}
    const order=++sequence.current;
    try{const res=await fetch('/api/adaptive/'+encodeURIComponent(lessonId));const body=await res.json();
      if(!res.ok)throw Error(body.error||'补学记录读取失败');
      if(live.current&&order===sequence.current&&context.current.userId===userId&&context.current.lessonId===lessonId&&body.userId===userId)setData({...body,lessonId});
    }catch(e){if(live.current&&order===sequence.current)setError((e as Error).message);}
  },[userId,lessonId]);
  useEffect(()=>{setError('');setBusy(false);void refresh();return()=>{sequence.current++;};},[refresh]);
  const act=async(path:string,body:object)=>{
    if(!userId||busy)return null;const snapshot=context.current;setBusy(true);setError('');
    try{const res=await fetch('/api/adaptive/'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({userId,...body})});const value=await res.json();if(!res.ok)throw Error(value.error||'补学操作未完成');
      if(!live.current||snapshot.userId!==context.current.userId||snapshot.lessonId!==context.current.lessonId||value.userId!==userId)return null;
      ++sequence.current;setData({...value,lessonId});return value as RemediationSnapshot&{returnLessonId?:string};
    }catch(e){if(live.current&&context.current.userId===userId)setError((e as Error).message);return null;}
    finally{if(live.current&&context.current.userId===userId)setBusy(false);}
  };
  const owned=data?.userId===userId?data:null;
  return {session:owned?.session??null,suggestion:owned?.lessonId===lessonId?owned.suggestion:null,busy,error,refresh,
    start:(missionId:string,conceptId:string)=>act('start',{lessonId,missionId,conceptId}),
    dismiss:(missionId:string,conceptId:string)=>act('dismiss',{lessonId,missionId,conceptId}),
    finish:(sessionId:string,complete:boolean)=>act('return',{sessionId,complete})};
}
export type Remediation=ReturnType<typeof useRemediation>;
