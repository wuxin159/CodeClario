import {useLayoutEffect,useRef} from "react";
import {languages,languageName,type Language} from "../../shared/curriculum";
import {MotionText} from "./MotionText";

export default function HomeLanguageSwitch({language,onChange}:{language:Language;onChange:(value:Language)=>void}) {
  const root=useRef<HTMLDivElement>(null);
  useLayoutEffect(()=>{
    const list=root.current,active=list?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if(!list||!active)return;
    const measure=()=>{
      list.style.setProperty('--language-x',`${active.offsetLeft}px`);
      list.style.setProperty('--language-y',`${active.offsetTop}px`);
      list.style.setProperty('--language-width',`${active.offsetWidth}px`);
      list.style.setProperty('--language-height',`${active.offsetHeight}px`);
    };
    measure();
    const observer=new ResizeObserver(measure);observer.observe(list);observer.observe(active);
    return()=>observer.disconnect();
  },[language]);
  return <div ref={root} className="bubble-languages" role="group" aria-label="排序演示语言">
    <span className="language-active-shape" aria-hidden="true"/>
    {languages.map(({id})=><button key={id} aria-pressed={language===id} onClick={()=>onChange(id)}><MotionText text={languageName(id)}/></button>)}
  </div>;
}
