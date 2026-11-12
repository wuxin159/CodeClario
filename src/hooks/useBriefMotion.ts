import {useLayoutEffect,useRef,useState} from "react";
import {useReducedMotion} from "./useReducedMotion";

/** 只改变呈现，不重建编辑器；相邻两种动画名让快速切换也能重新开始。 */
export function useBriefMotion(key:string,duration=240,enabled=true) {
  const previous=useRef(key),[motion,setMotion]=useState(0),reduced=useReducedMotion();
  useLayoutEffect(()=>{
    if(!enabled||reduced){previous.current=key;setMotion(0);return;}
    if(previous.current===key)return;
    previous.current=key;
    setMotion(value=>value===1?2:1);
    const timer=window.setTimeout(()=>setMotion(0),duration);
    return()=>window.clearTimeout(timer);
  },[key,duration,enabled,reduced]);
  return motion;
}
