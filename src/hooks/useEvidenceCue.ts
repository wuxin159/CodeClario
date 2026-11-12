import {useEffect,useRef} from "react";

/** 讲解按钮与实际代码行之间的一次性视觉交接；移动端只强调落点，不画跨屏连线。 */
export function useEvidenceCue() {
  const cleanup=useRef<()=>void>(()=>{});
  useEffect(()=>()=>cleanup.current(),[]);
  return (source:HTMLElement|undefined,resolve:()=>HTMLElement|null)=>{
    cleanup.current();
    let frame=0,svg:SVGSVGElement|undefined,target:HTMLElement|null=null,animation:Animation|undefined;
    let disposed=false,start:number|undefined;
    const stop=()=>{disposed=true;cancelAnimationFrame(frame);svg?.remove();animation?.cancel();};
    cleanup.current=stop;
    const tick=(now:number)=>{
      if(disposed)return;
      target??=resolve();
      if(!target?.isConnected){stop();return;}
      start??=now;
      if(matchMedia('(prefers-reduced-motion: reduce)').matches){stop();return;}
      if(!animation){
        const resting=getComputedStyle(target);
        animation=target.animate([{boxShadow:'inset 3px 0 #3075df',backgroundColor:'rgba(74,141,238,.24)'},{boxShadow:resting.boxShadow,backgroundColor:resting.backgroundColor}],{duration:1100,easing:'ease-out'});
      }
      const a=source?.getBoundingClientRect(),b=target.getBoundingClientRect(),elapsed=now-start;
      const visible=a&&a.width&&a.top>=0&&a.bottom<=innerHeight&&b.top>=0&&b.bottom<=innerHeight;
      if(innerWidth>1000&&visible){
        if(!svg){
          svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.classList.add('evidence-connector');svg.setAttribute('aria-hidden','true');
          const path=document.createElementNS(svg.namespaceURI,'path');path.setAttribute('fill','none');path.setAttribute('pathLength','1');svg.append(path);document.body.append(svg);
        }
        const x1=a.right+6,y1=a.top+a.height/2,x2=b.left-5,y2=b.top+b.height/2;
        svg.setAttribute('viewBox',`0 0 ${innerWidth} ${innerHeight}`);
        svg.firstElementChild!.setAttribute('d',`M${x1},${y1} C${x1+28},${y1} ${x2-28},${y2} ${x2},${y2}`);
        (svg.firstElementChild as SVGPathElement).style.strokeDashoffset=String(1-Math.min(1,elapsed/480));
        svg.style.opacity=String(elapsed<650?1:Math.max(0,(1050-elapsed)/400));
      }else {svg?.remove();svg=undefined;}
      if(elapsed<1100)frame=requestAnimationFrame(tick);else stop();
    };
    // 等页签和回放步骤完成React提交；播放器仍使用原来的暂停/定位逻辑。
    frame=requestAnimationFrame(()=>{frame=requestAnimationFrame(tick);});
  };
}
