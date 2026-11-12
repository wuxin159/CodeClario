import {useEffect,useId,useLayoutEffect,useRef,useState,type ReactNode,type KeyboardEvent} from "react";
import {createPortal} from "react-dom";
import {Check,ChevronDown} from "lucide-react";

export type SelectOption={value:string;label:string;description?:string;icon?:ReactNode;disabled?:boolean};
type Placement={left:number;top?:number;bottom?:number;width:number;maxHeight:number;side:'top'|'bottom'};

/** 选项浮到body层，避免被代码区或弹窗内的overflow裁切；焦点始终留在触发框。 */
export default function SelectControl({value,options,onValueChange,label,disabled=false,full=false,compact=false}:{
  value:string;options:SelectOption[];onValueChange:(value:string)=>void;label:string;disabled?:boolean;full?:boolean;compact?:boolean;
}) {
  const id='choice-'+useId().replaceAll(':',''),trigger=useRef<HTMLButtonElement>(null),popup=useRef<HTMLDivElement>(null);
  const [open,setOpen]=useState(false),[active,setActive]=useState(0),[placement,setPlacement]=useState<Placement>();
  const buffer=useRef({text:'',at:0});
  const selected=options.find(o=>o.value===value),selectedIndex=options.findIndex(o=>o.value===value);
  const measure=()=>{
    const box=trigger.current?.getBoundingClientRect();if(!box)return;
    const below=window.innerHeight-box.bottom-10,above=box.top-10;
    const side=below>=Math.min(200,options.length*44+12)||below>=above?'bottom':'top';
    const desired=options.some(o=>o.description||o.label.length>12)?280:160;
    const width=Math.min(Math.max(box.width,desired),window.innerWidth-16);
    setPlacement({left:Math.max(8,Math.min(box.left,window.innerWidth-width-8)),width,maxHeight:Math.max(40,Math.min(336,(side==='bottom'?below:above)-6)),side,...(side==='bottom'?{top:box.bottom+6}:{bottom:window.innerHeight-box.top+6})});
  };
  const close=()=>{buffer.current={text:'',at:0};setOpen(false);};
  const show=(index=selectedIndex)=>{
    if(disabled||trigger.current?.matches(':disabled')||!options.some(o=>!o.disabled))return;
    const next=index>=0&&!options[index]?.disabled?index:options.findIndex(o=>!o.disabled);
    setActive(next);measure();setOpen(true);
  };
  const choose=(index:number)=>{
    const option=options[index];if(!option||option.disabled)return;
    close();trigger.current?.focus({preventScroll:true});
    if(option.value!==value)onValueChange(option.value);
  };
  useEffect(()=>{if(disabled)setOpen(false);},[disabled]);
  useEffect(()=>{if(open)setActive(selectedIndex<0?0:selectedIndex);},[value]);
  useLayoutEffect(()=>{
    if(!open)return;
    measure();
    const outside=(event:PointerEvent)=>{if(!trigger.current?.contains(event.target as Node)&&!popup.current?.contains(event.target as Node))close();};
    // 滚动选项自身不关闭；滚动外层阅读区域时收起，避免浮层悬在错误位置。
    const scroll=(event:Event)=>{if(!popup.current?.contains(event.target as Node))close();};
    document.addEventListener('pointerdown',outside,true);window.addEventListener('resize',measure);document.addEventListener('scroll',scroll,true);
    const observer=new ResizeObserver(measure);if(trigger.current)observer.observe(trigger.current);
    return()=>{document.removeEventListener('pointerdown',outside,true);window.removeEventListener('resize',measure);document.removeEventListener('scroll',scroll,true);observer.disconnect();};
  },[open,options.length]);
  useLayoutEffect(()=>{
    if(!open)return;
    const row=popup.current?.querySelector<HTMLElement>(`[data-index="${active}"]`),list=popup.current;
    if(row&&list&&(row.offsetTop<list.scrollTop||row.offsetTop+row.offsetHeight>list.scrollTop+list.clientHeight))list.scrollTo({top:row.offsetTop-list.clientHeight/2,behavior:'instant'});
  },[open,active]);
  const keyDown=(event:KeyboardEvent<HTMLButtonElement>)=>{
    if(event.key==='Tab'){close();return;}
    if(event.key==='Escape'&&open){event.preventDefault();event.stopPropagation();close();return;}
    if(['ArrowDown','ArrowUp','Home','End','Enter',' '].includes(event.key)){
      event.preventDefault();event.stopPropagation();
      if(!open){show(event.key==='Home'?0:event.key==='End'?options.length-1:selectedIndex);return;}
      if(event.key==='Enter'||event.key===' '){choose(active);return;}
      let next=event.key==='Home'?0:event.key==='End'?options.length-1:(active+(event.key==='ArrowDown'?1:-1)+options.length)%options.length;
      for(let count=0;count<options.length&&options[next]?.disabled;count++)next=(next+(event.key==='ArrowUp'||event.key==='End'?-1:1)+options.length)%options.length;
      setActive(next);return;
    }
    if(event.key.length===1&&!event.ctrlKey&&!event.metaKey&&!event.altKey){
      const now=Date.now(),letter=event.key.toLocaleLowerCase(),prefix=now-buffer.current.at<700?buffer.current.text:'';
      // 连按同一字母循环浏览同首字母项；Esc后新输入不继承旧的检索片段。
      const query=prefix&&Array.from(prefix).every(c=>c===letter)?letter:prefix+letter;
      buffer.current={text:query,at:now};
      const start=query.length===1?(open?active:selectedIndex)+1:0;
      const index=Array.from({length:options.length},(_,i)=>(start+i+options.length)%options.length).find(i=>!options[i].disabled&&options[i].label.toLocaleLowerCase().startsWith(query))??-1;
      if(index>=0){event.preventDefault();event.stopPropagation();if(!open)show(index);else setActive(index);}
    }
  };
  return <div className="cc-select" data-full={full} data-compact={compact}>
    <button ref={trigger} type="button" role="combobox" className="cc-select-trigger" aria-label={label} aria-expanded={open} aria-haspopup="listbox" aria-controls={open?id:undefined} aria-activedescendant={open?`${id}-${active}`:undefined} disabled={disabled||!options.length} onClick={()=>open?close():show()} onKeyDown={keyDown} onBlur={close}>
      <span className="cc-select-value">{selected?.icon&&<span className="cc-select-icon" aria-hidden="true">{selected.icon}</span>}<span>{selected?.label??'请选择'}</span></span><ChevronDown className="cc-select-caret" size={16} aria-hidden="true"/>
    </button>
    {open&&placement&&createPortal(<div ref={popup} id={id} className="cc-select-menu" role="listbox" aria-label={label} data-side={placement.side} style={{position:'fixed',left:placement.left,top:placement.top,bottom:placement.bottom,width:placement.width,maxHeight:placement.maxHeight}}>
      {options.map((option,index)=><div key={option.value} id={`${id}-${index}`} data-index={index} className={`cc-select-option ${active===index?'is-active':''}`} role="option" aria-selected={value===option.value} aria-disabled={option.disabled||undefined} onPointerMove={()=>{if(!option.disabled)setActive(index);}} onPointerDown={event=>event.preventDefault()} onClick={()=>choose(index)}>
        {option.icon&&<span className="cc-select-icon" aria-hidden="true">{option.icon}</span>}<span className="cc-option-copy"><span>{option.label}</span>{option.description&&<small>{option.description}</small>}</span><span className="cc-option-check" aria-hidden="true">{value===option.value&&<Check size={16}/>}</span>
      </div>)}
    </div>,document.body)}
  </div>;
}
