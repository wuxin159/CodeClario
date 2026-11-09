import {useEffect,useRef,useState,type RefObject} from "react";

export default function ConsoleResizeHandle({target,height,onHeight}:{target:RefObject<HTMLDivElement|null>;height:number;onHeight:(height:number)=>void}) {
  const [maximum,setMaximum]=useState(360);
  const drag=useRef<{y:number;height:number}|undefined>(undefined);
  useEffect(()=>{
    const body=target.current?.parentElement;if(!body)return;
    const measure=()=>setMaximum(Math.max(160,Math.floor(body.clientHeight-180)));
    const observer=new ResizeObserver(measure);observer.observe(body);measure();
    return()=>observer.disconnect();
  },[target]);
  const clamp=(next:number)=>Math.max(160,Math.min(maximum,next));
  return <div className="console-resizer" role="separator" tabIndex={0} aria-label="调整运行结果区域高度" aria-orientation="horizontal" aria-valuemin={160} aria-valuemax={maximum} aria-valuenow={clamp(height)} title="拖动调整结果区高度；方向键也可调整"
    onPointerDown={e=>{drag.current={y:e.clientY,height:target.current?.getBoundingClientRect().height??height};e.currentTarget.setPointerCapture(e.pointerId);e.preventDefault();}}
    onPointerMove={e=>{if(drag.current)onHeight(clamp(drag.current.height+drag.current.y-e.clientY));}}
    onPointerUp={e=>{drag.current=undefined;if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);}}
    onPointerCancel={()=>{drag.current=undefined;}}
    onKeyDown={e=>{if(!["ArrowUp","ArrowDown","Home","End"].includes(e.key))return;e.preventDefault();e.stopPropagation();onHeight(e.key==="Home"?160:e.key==="End"?maximum:clamp(height+(e.key==="ArrowUp"?24:-24)));}}
  ><span/></div>;
}
