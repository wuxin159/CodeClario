import {useLayoutEffect,useRef} from "react";
import {useReducedMotion} from "./useReducedMotion";

/** 每批进入视野的内容依次呈现；不包裹或重建课堂、编辑器和输入框。 */
export function useArrivalMotion(key:string,selector:string) {
  const root=useRef<HTMLDivElement>(null),reduced=useReducedMotion();
  useLayoutEffect(()=>{
    const scope=root.current;
    if(!scope||reduced)return;
    let live=true;
    const seen=new Set<HTMLElement>(),pending=new Set<HTMLElement>();
    const observer=new IntersectionObserver(entries=>{
      if(!live)return;
      const incoming=entries.filter(entry=>entry.isIntersecting);
      const batches=new Map<string,number>();
      incoming.forEach(entry=>{
        const node=entry.target as HTMLElement;
        if(seen.has(node))return;
        seen.add(node);pending.delete(node);observer.unobserve(node);
        // 跨页共享快照负责这次入场，避免快照结束后再触发一次错峰导致内容闪回。
        if(document.documentElement.dataset.sharedNavigation)return;
        // 延时按本次可见的一批计算，89课不会累积成长时间等待。
        const group=node.matches('.course-card')?'cards':node.matches('.lesson-row')?'rows':'regions';
        const order=batches.get(group)??0;
        batches.set(group,order+1);
        node.style.setProperty('--arrival-delay',`${(group==='cards'?100:0)+Math.min(order,4)*80}ms`);
        node.dataset.arrival='true';
      });
    },{threshold:.08});
    const watch=(node:HTMLElement)=>{
      if(seen.has(node)||pending.has(node))return;
      pending.add(node);observer.observe(node);
    };
    scope.querySelectorAll<HTMLElement>(selector).forEach(watch);
    // 筛选或异步恢复新增的行也能入场；文本更新不重复播放整片内容。
    const additions=new MutationObserver(records=>{
      for(const record of records){
        for(const node of record.removedNodes)if(node instanceof HTMLElement){
          const removed=[node,...node.querySelectorAll<HTMLElement>(selector)];
          for(const item of removed)if(pending.has(item)){observer.unobserve(item);pending.delete(item);}
        }
        for(const node of record.addedNodes)if(node instanceof HTMLElement){
          if(node.matches(selector))watch(node);
          node.querySelectorAll<HTMLElement>(selector).forEach(watch);
        }
      }
    });
    additions.observe(scope,{subtree:true,childList:true});
    return()=>{
      live=false;
      observer.disconnect();additions.disconnect();
      for(const node of seen){delete node.dataset.arrival;node.style.removeProperty('--arrival-delay');}
    };
  },[key,selector,reduced]);
  return root;
}
