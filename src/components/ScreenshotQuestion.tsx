import {useEffect,useRef,useState} from "react";
import {ImagePlus,LoaderCircle,Send,Square,X} from "lucide-react";
import type {Lesson} from "../../shared/curriculum";
import type {ImageQuestionHistory,ImageQuestionResult} from "../../shared/vision";
import TeachingText from "./TeachingText";
import {readScreenshotDraft,saveScreenshotDraft} from "../screenshotDrafts";

export default function ScreenshotQuestion({lesson,userId,configured,onConnect,onClose}:{lesson:Lesson;userId:string;configured:boolean;onConnect:()=>void;onClose:()=>void}) {
  const [initialDraft]=useState(()=>readScreenshotDraft(userId,lesson.id));
  const [file,setFile]=useState<File|undefined>(initialDraft.file),[preview,setPreview]=useState(""),[question,setQuestion]=useState(initialDraft.question),[answer,setAnswer]=useState<ImageQuestionResult>(),[answeredQuestion,setAnsweredQuestion]=useState(""),[history,setHistory]=useState<ImageQuestionHistory[]>([]),[error,setError]=useState(""),[busy,setBusy]=useState(false);
  useEffect(()=>saveScreenshotDraft(userId,lesson.id,{file,question}),[userId,lesson.id,file,question]);
  const controller=useRef<AbortController|null>(null),version=useRef(0),result=useRef<HTMLDivElement>(null);
  useEffect(()=>{if(!file){setPreview("");return;}const url=URL.createObjectURL(file);setPreview(url);return()=>URL.revokeObjectURL(url);},[file]);
  useEffect(()=>{const c=new AbortController();void fetch(`/api/vision/history/${lesson.id}`,{signal:c.signal}).then(async r=>{const d=await r.json();if(!r.ok||d.userId!==userId)throw Error(d.error??"图片问答记录读取失败。");setHistory(d.items);}).catch(e=>{if(!c.signal.aborted)setError(e.message);});return()=>{c.abort();controller.current?.abort();version.current++;};},[lesson.id,userId]);
  async function send() {
    if(!file||!question.trim()||busy)return;
    const current=++version.current,c=new AbortController();controller.current=c;setBusy(true);setError("");setAnswer(undefined);
    try {
      const data=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(",")[1]);reader.onerror=()=>reject(Error("截图读取失败，请重新选择。"));reader.readAsDataURL(file);});
      if(c.signal.aborted)return;
      const response=await fetch("/api/vision/analyze",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({userId,lessonId:lesson.id,question:question.trim(),image:{mimeType:file.type,data}}),signal:c.signal});
      const payload=await response.json();if(!response.ok)throw Error(payload.error??"图片分析未完成，请重试。");
      if(c.signal.aborted||version.current!==current||payload.userId!==userId)return;
      setAnsweredQuestion(question.trim());setAnswer(payload.answer);requestAnimationFrame(()=>result.current?.scrollIntoView({block:"nearest"}));
    } catch(e) {if(!c.signal.aborted&&version.current===current)setError((e as Error).message);}
    finally {if(version.current===current)setBusy(false);}
  }
  const showAnswer=(value:ImageQuestionResult)=><><div className="image-observation"><b>图片中看到的内容</b><TeachingText text={value.observed}/></div><TeachingText text={value.explanation}/>{value.uncertainty&&<p className="image-uncertainty">需要确认：{value.uncertainty}</p>}{value.question&&<p className="teacher-question">{value.question}</p>}{value.sources.length>0&&<details><summary>参考的课程资料</summary>{value.sources.map(s=><p key={s.id}><b>{s.title}</b><br/>{s.excerpt}</p>)}</details>}</>;
  return <section className="image-question-panel" aria-label="截图提问">
    <header><div><b>截图提问</b><small>结合「{lesson.title}」解释图片</small></div><button onClick={onClose} aria-label="返回课程对话"><X size={17}/></button></header>
    <p className="image-question-intro">上传题目、代码或报错截图，说说你想弄清哪一处。</p>
    {!configured?<button className="button secondary" onClick={onConnect}>连接AI老师</button>:<>
      <label className="image-file-picker"><ImagePlus size={18}/>{file?"更换截图":"选择截图"}<input type="file" accept="image/png,image/jpeg,image/webp" aria-label="选择学习截图" disabled={busy} onClick={e=>{e.currentTarget.value="";}} onChange={e=>{const selected=e.target.files?.[0];if(!selected)return;setError("");if(!["image/png","image/jpeg","image/webp"].includes(selected.type)||selected.size>5*1024*1024){setError("请选择5MB以内的PNG、JPEG或WebP图片。");e.currentTarget.value="";return;}controller.current?.abort();version.current++;setFile(selected);setAnswer(undefined);}}/></label>
      {preview&&<figure className="image-question-preview"><img src={preview} alt="待提问的截图"/><figcaption>{file?.name}</figcaption></figure>}
      <label className="image-question-field">想问什么<textarea aria-label="截图问题" value={question} maxLength={800} onChange={e=>setQuestion(e.target.value)} placeholder="例如：图里的两个循环为什么不能只执行一轮？"/></label>
      <p className="image-question-note">关闭面板会保留草稿；刷新后图片需重新选择。请勿上传密码或密钥，历史只保留文字问答。</p>
      {(file||question)&&<button className="image-draft-clear" disabled={busy} onClick={()=>{setFile(undefined);setQuestion("");setAnswer(undefined);setError("");}}>清空本次草稿</button>}
      <div className="image-question-actions"><button className="button primary" disabled={!file||!question.trim()||busy} onClick={()=>void send()}>{busy?<LoaderCircle size={15} className="spin"/>:<Send size={15}/>} {busy?"正在分析截图…":"发送截图提问"}</button>{busy&&<button onClick={()=>{controller.current?.abort();setBusy(false);}}><Square size={14}/>停止</button>}</div>
    </>}
    {error&&<p className="image-question-error" role="alert">{error}</p>}
    {answer&&<div ref={result} className="image-question-answer"><small>AI看图讲解 · 不计课程成绩</small><p>你的问题：{answeredQuestion}</p>{showAnswer(answer)}</div>}
    {history.length>0&&<details className="image-question-history"><summary>本课之前的图片问答</summary>{history.map(item=><article key={item.id}><b>{item.question}</b>{showAnswer(item.answer)}</article>)}</details>}
  </section>;
}
