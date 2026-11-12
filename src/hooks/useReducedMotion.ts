import {useEffect,useState} from "react";

/** 自动跟随系统偏好，界面无需再放一个设置开关。 */
export function useReducedMotion() {
  const [reduced,setReduced]=useState(()=>typeof matchMedia!=="undefined"&&matchMedia("(prefers-reduced-motion: reduce)").matches);
  useEffect(()=>{
    const media=matchMedia("(prefers-reduced-motion: reduce)");
    const update=()=>setReduced(media.matches);
    update();media.addEventListener('change',update);
    return()=>media.removeEventListener('change',update);
  },[]);
  return reduced;
}
