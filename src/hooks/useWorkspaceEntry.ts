import {useEffect,useRef,useState} from "react";

type Phase='idle'|'leaving'|'arriving';
export function useWorkspaceEntry(owner:{current:string|null|undefined}) {
  const [phase,setPhase]=useState<Phase>('idle');
  const active=useRef<Phase>('idle');
  const timers=useRef<ReturnType<typeof setTimeout>[]>([]);
  const clearTimers=()=>{timers.current.forEach(clearTimeout);timers.current=[];};
  const change=(next:Phase)=>{active.current=next;setPhase(next);};
  const cancel=()=>{clearTimers();change('idle');};
  useEffect(()=>()=>{clearTimers();active.current='idle';},[]);
  const enter=(commit:()=>void)=>{
    if(active.current!=='idle')return;
    const initialOwner=owner.current;
    if(matchMedia("(prefers-reduced-motion: reduce)").matches){commit();return;}
    change('leaving');
    timers.current.push(setTimeout(()=>{
      // 登录回调可能先于React的新账户渲染；真正切页前重新核对身份，退出或换号就撤销。
      if(!owner.current||(initialOwner&&initialOwner!==owner.current)){cancel();return;}
      commit();change('arriving');
      timers.current.push(setTimeout(()=>{
        cancel();
        // 不抢走进入后已开始输入的用户焦点。
        if(document.activeElement===document.body){
          const heading=document.querySelector<HTMLElement>('.main-shell h1');
          if(heading){heading.tabIndex=-1;heading.focus({preventScroll:true});}
        }
      },520));
    },150));
  };
  return{phase,enter,cancel,cancelPending:()=>{if(active.current==='leaving')cancel();}};
}
