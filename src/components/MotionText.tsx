import {ArrowRight,ArrowUpRight} from "lucide-react";
import type {CSSProperties} from "react";

/** 双层文字共用同一网格，不因悬停改变按钮宽度；装饰副本不进入无障碍名称。 */
export function MotionText({text}:{text:string}) {
  return <span className="control-label"><span>{text}</span><span aria-hidden="true">{text}</span></span>;
}

export function MotionArrow({diagonal=false,size=18}:{diagonal?:boolean;size?:number}) {
  const Icon=diagonal?ArrowUpRight:ArrowRight;
  return <span className={`motion-arrow ${diagonal?'is-diagonal':''}`} aria-hidden="true" style={{'--arrow-size':`${size}px`} as CSSProperties}>
    <span><Icon size={size}/></span><span><Icon size={size}/></span>
  </span>;
}

export function RevealWords({words,start=0}:{words:string[];start?:number}) {
  return <>{words.map((word,index)=><span className="motion-word" key={index} style={{'--word-delay':`${(start+index)*85}ms`} as CSSProperties}><span>{word}</span></span>)}</>;
}
