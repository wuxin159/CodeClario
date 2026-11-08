import {useEffect,useRef,useState} from "react";
import {ArrowLeft,ArrowRight,X} from "lucide-react";
import {conceptWalk,conceptContrast,contrastForLesson,contrastChoices,type ExplorationObject} from "../../shared/conceptExplorations";

function Objects({objects}:{objects:ExplorationObject[]}) {
  return <div className="explore-objects">{objects.map(object=><section key={object.name} className={object.status?.includes("结束")?"released":""}><header><b>{object.name}</b>{object.status&&<small>{object.status}</small>}</header>{Object.entries(object.fields).map(([name,value])=><div key={name}><code>{name}</code><strong>{value}</strong></div>)}</section>)}</div>;
}

export default function ConceptExploreDialog({lessonId,mode,onClose}:{lessonId:string;mode:"walk"|"contrast";onClose:()=>void}) {
  const ref=useRef<HTMLDialogElement>(null),walk=conceptWalk(lessonId),kind=contrastForLesson(lessonId);
  const [step,setStep]=useState(0),[variant,setVariant]=useState(kind?contrastChoices[kind][0].value:""),[revealed,setRevealed]=useState(false),[guess,setGuess]=useState<string>();
  const contrast=kind?conceptContrast(kind,variant):undefined;
  useEffect(()=>{
    const dialog=ref.current,previous=document.activeElement as HTMLElement|null;
    dialog?.showModal();
    return()=>{dialog?.close();if(previous?.isConnected)previous.focus({preventScroll:true});};
  },[]);
  if(mode==="walk"&&!walk||mode==="contrast"&&!contrast)return null;
  const moment=walk?.moments[step],title=mode==="walk"?walk!.title:contrast!.title;
  const code=mode==="walk"?walk!.code:contrast!.code;
  return <dialog ref={ref} role="dialog" className="concept-explore-dialog" aria-labelledby="concept-explore-title" onKeyDown={e=>e.stopPropagation()} onCancel={e=>{e.preventDefault();onClose();}}>
    <header className="explore-header"><div><small>{mode==="walk"?"概念拆解 · 每次看清一个动作":"受控对照 · 先判断，再揭晓"}</small><h2 id="concept-explore-title">{title}</h2></div><button aria-label="关闭概念探究" onClick={onClose}><X size={20}/></button></header>
    <p className="explore-provenance">这是概念推演，不是调试器回放；不会改动你的代码，也不计入课程成绩。</p>
    {mode==="contrast"&&kind&&<div className="explore-variants" role="group" aria-label="对照条件">{contrastChoices[kind].map(option=><button key={option.value} aria-pressed={variant===option.value} onClick={()=>{setVariant(option.value);setRevealed(false);setGuess(undefined);}}>{option.label}</button>)}</div>}
    <div className="explore-layout"><div className="explore-code"><span>本例代码</span><pre>{code.split("\n").map((line,i)=><div key={i} className={mode==="walk"&&moment?.line===i+1?"active":""}><small>{i+1}</small><code>{line||" "}</code></div>)}</pre></div>
      <div className="explore-stage">{mode==="walk"&&moment?<>
        <div className="explore-moment-title"><span>{step+1} / {walk!.moments.length}</span><b>{moment.title}</b></div>
        {lessonId==="python-10"&&<div className="explore-snapshot"><small>右侧值快照</small><strong>{moment.snapshot?`(${moment.snapshot.join(", ")})`:"尚未求值"}</strong></div>}
        {moment.calculation&&<div className="explore-calculation">{moment.calculation}</div>}
        <div className="explore-object-space"><Objects objects={moment.objects}/>{moment.moving&&<span key={step} className="explore-moving-value" aria-hidden="true">{moment.moving}</span>}</div>
        <p className="explore-explanation" aria-live="polite">{moment.note}</p>
      </>:contrast&&<>
        <h3>{contrast.question}</h3><div className="explore-guesses" role="group" aria-label="我的判断">{contrast.answers.map(answer=><button key={answer} aria-pressed={guess===answer} onClick={()=>setGuess(answer)} disabled={revealed}>{answer}</button>)}</div>
        {!revealed?<button className="explore-reveal" onClick={()=>setRevealed(true)}>揭晓这组条件<ArrowRight size={16}/></button>:<div className="explore-result" aria-live="polite">
          {guess&&<p className="explore-guess-feedback">{guess===contrast.answer?"你的判断与本例一致。":"这次结果与你的判断不同，看看变化落在哪里。"}</p>}
          {!!contrast.bindings.length&&<div className="explore-bindings">{contrast.bindings.map(binding=><code key={binding}>{binding}</code>)}</div>}
          <Objects objects={contrast.objects}/><div className="explore-output"><small>本例标准输出</small><pre>{contrast.output||"（没有输出）"}</pre></div><p className="explore-explanation">{contrast.note}</p>
        </div>}
      </>}</div></div>
    <footer className="explore-footer">{mode==="walk"?<><button disabled={step===0} onClick={()=>setStep(i=>i-1)}><ArrowLeft size={16}/>前一个动作</button><span>每次点击都停在完整动作后</span><button disabled={step===walk!.moments.length-1} onClick={()=>setStep(i=>i+1)}>下一个动作<ArrowRight size={16}/></button></>:<span>可以换一个条件，重新判断；结果由本例确定的规则推演。</span>}<button onClick={onClose}>回到课程演示</button></footer>
  </dialog>;
}
