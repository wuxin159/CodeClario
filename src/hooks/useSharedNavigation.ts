import {useEffect,useRef} from "react";
import {flushSync} from "react-dom";

type SharedNodes={surface:HTMLElement|null;title?:HTMLElement|null};
type Transition={finished:Promise<void>;ready:Promise<void>;skipTransition:()=>void};

/** 只借用浏览器快照衔接真实页面；账户变化、尺寸改变或不支持时都直接完成普通导航。 */
export function useSharedNavigation(owner:string|undefined) {
  const currentOwner=useRef(owner),ticket=useRef(0),active=useRef<Transition|null>(null);
  const clear=useRef<()=>void>(()=>{});
  const pending=useRef<(()=>void)|null>(null);
  currentOwner.current=owner;
  const cancel=(complete=false)=>{if(complete)pending.current?.();pending.current=null;++ticket.current;active.current?.skipTransition();active.current=null;clear.current();};
  useEffect(()=>{
    cancel();
    const resize=()=>cancel(true);
    const hide=()=>{if(document.hidden)cancel(true);};
    const escape=(event:KeyboardEvent)=>{if(event.key==='Escape')cancel(true);};
    window.addEventListener('resize',resize);document.addEventListener('visibilitychange',hide);window.addEventListener('keydown',escape);
    return()=>{cancel();window.removeEventListener('resize',resize);document.removeEventListener('visibilitychange',hide);window.removeEventListener('keydown',escape);};
  },[owner]);
  const run=(from:SharedNodes,update:()=>void,to:()=>SharedNodes,kind:'lesson'|'record')=>{
    cancel();
    const api=(document as Document&{startViewTransition?:(update:()=>void)=>Transition}).startViewTransition;
    const rect=from.surface?.getBoundingClientRect();
    if(!api||document.hidden||matchMedia('(prefers-reduced-motion: reduce)').matches||!from.surface?.isConnected||!rect?.width||rect.bottom<0||rect.top>innerHeight){flushSync(update);to();return;}
    const id=++ticket.current,initialOwner=currentOwner.current;
    const names=new Map<HTMLElement,string>();
    const assign=({surface,title}:SharedNodes)=>{
      for(const [node,name] of [[surface,'cc-shared-surface'],[title,'cc-shared-title']] as const){
        if(!node||!node.isConnected)continue;
        names.set(node,node.style.viewTransitionName);node.style.viewTransitionName=name;
      }
    };
    const cleanup=()=>{
      for(const [node,name] of names)node.style.viewTransitionName=name;
      names.clear();delete document.documentElement.dataset.sharedNavigation;
    };
    clear.current=cleanup;
    document.documentElement.dataset.sharedNavigation=kind;
    assign(from);
    let committed=false;
    const commit=()=>{
      if(committed||id!==ticket.current||initialOwner!==currentOwner.current)return;
      committed=true;
      pending.current=null;
      // 快照前提交真实页面，再读取目标位置；不创建第二份编辑器或等待假的加载过程。
      flushSync(update);assign(to());
    };
    pending.current=commit;
    try {
      const transition=api.call(document,commit);active.current=transition;
      // 重复名称、浏览器降级等只取消动效，业务更新仍由一次性的commit完成。
      void transition.ready.catch(()=>{});
      void transition.finished.catch(()=>{commit();}).finally(()=>{if(id===ticket.current){cleanup();active.current=null;}});
    }catch{commit();cleanup();}
  };
  return {run,cancel};
}
