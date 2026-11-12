import {useLayoutEffect,useRef} from "react";

/** 真实测量选中项；屏幕变窄、标签换行或紧凑侧栏时都不猜坐标。 */
export default function SelectionMarker({selection,selector,variant='pill'}:{selection:string;selector:string;variant?:'pill'|'line'}) {
  const marker=useRef<HTMLSpanElement>(null);
  const remeasure=useRef<(animate:boolean)=>void>(()=>{});
  useLayoutEffect(()=>{
    const node=marker.current,parent=node?.parentElement;
    if(!node||!parent)return;
    let previous:number[]|undefined;
    const measure=(animate=false)=>{
      const item=parent.querySelector<HTMLElement>(selector);
      // 坐标必须以自身栏位为基准，不能借用带入场 transform 的祖先。
      // 意外遇到静态定位或隐藏窗格时退回按钮原样式，避免蓝线逃到内容区。
      if(!item||!item.offsetWidth||!item.offsetHeight||node.offsetParent!==parent||item.offsetParent!==parent){
        node.dataset.ready='false';previous=undefined;return;
      }
      const next=[item.offsetLeft,item.offsetTop+(variant==='line'?item.offsetHeight-2:0),
        item.offsetWidth,variant==='line'?2:item.offsetHeight,parent.clientWidth,parent.clientHeight];
      if(previous&&next.every((value,index)=>value===previous![index]))return;
      // 只对真实选项切换做平移；缩放、换行和重新显示时立即归位。
      const canAnimate=animate&&previous&&next[4]===previous[4]&&next[5]===previous[5]
        &&(variant!=='line'||next[1]===previous[1]);
      node.dataset.animate=canAnimate?'true':'false';
      node.style.setProperty('--marker-x',`${next[0]}px`);
      node.style.setProperty('--marker-y',`${next[1]}px`);
      node.style.setProperty('--marker-width',`${next[2]}px`);
      node.style.setProperty('--marker-height',`${next[3]}px`);
      node.dataset.ready='true';previous=next;
    };
    remeasure.current=measure;
    measure();
    const observer=new ResizeObserver(()=>measure());
    observer.observe(parent);
    // 前面的标签变宽也会改变当前项位置，因此观察所有直接按钮。
    const observeItems=()=>{
      observer.disconnect();observer.observe(parent);
      for(const item of parent.children)if(item instanceof HTMLElement&&item.tagName==='BUTTON')observer.observe(item);
    };
    observeItems();
    const children=new MutationObserver(()=>{observeItems();measure();});
    children.observe(parent,{childList:true,subtree:true,characterData:true});
    return()=>{observer.disconnect();children.disconnect();remeasure.current=()=>{};};
  },[selector,variant]);
  useLayoutEffect(()=>{remeasure.current(true);},[selection]);
  return <span ref={marker} className="workspace-marker" data-variant={variant} aria-hidden="true"/>;
}
