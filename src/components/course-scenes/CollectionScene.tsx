import { ArrowDown, ArrowRight, Check, X } from "lucide-react";
import { filterResult } from "../../../shared/courseStageModel";
import type { SceneProps } from "./sceneTypes";
import { shown } from "./sceneTypes";

export default function CollectionScene({scene,model:m,progress,inspect}:SceneProps) {
  if(m.kind==="dictionary") {
    const entries=Object.entries(scene.steps[0].values),query=m.values.name,found=m.values.price!==undefined;
    return <><div className="ls-query"><small>当前查询键 name</small><code>{query?`"${query}"`:"尚未指定"}</code></div><div className="ls-key-map"><header><span>键 key</span><span>对应值 value</span></header>{entries.map(([key,value])=><button key={key} className={found&&query===key?"selected":""} onClick={()=>inspect(`键 ${key}`,`这个条目把${key}映射到${value}。${query?`当前程序查询的是${query}。`:"查询尚未开始。"} 字典按键匹配，不使用列表下标。`)}><code>"{key}"</code><ArrowRight size={20}/><b>{value}</b></button>)}</div><div className="ls-get-result"><code>prices.get(name, 0)</code><ArrowDown/><strong>{shown(m.values.price)}</strong><span>{found?"找到了键，返回对应价格":"默认值0只在键不存在时使用"}</span></div><div className="ls-observation">键与值是配对关系。图中上下排布不代表用0、1下标查询。</div></>;
  }
  if(m.kind==="set") {
    const source=m.initialItems, unique=[...new Set(source)],ready=m.index>0;
    return <><div className="ls-sequence-label"><code>numbers</code><small>原列表保留全部{source.length}项</small></div><div className="ls-set-source">{source.map((value,i)=><button key={i} onClick={()=>inspect(`输入中的${value}`,`原列表中${value}出现${source.filter(x=>x===value).length}次；集合只保留一个相等的值。原列表不会被set(numbers)修改。`) }><small>[{i}]</small><b>{value}</b></button>)}</div><div className="ls-deduplicate"><span>相等的值归到同一项</span><ArrowDown size={24}/>{progress>0&&m.index===0&&<i style={{transform:`translate(${progress*24}px,${progress*18}px)`,opacity:Math.sin(progress*Math.PI)}}>2</i>}</div><div className={`ls-set-bowl ${ready?"ready":""}`}><small>unique · 无序集合</small><div>{(ready?unique:[]).map((value,i)=><button key={i} disabled={!ready} onClick={()=>inspect(`集合元素${value}`,`这里只有一个${value}。集合元素没有列表下标；画面中的位置只是为了便于观察。`)}>{ready?value:"?"}</button>)}</div><span>{ready?`${unique.length}个不同值` : "等待去重结果"}</span></div><div className="ls-observation">第二个2没有变成新元素，但原列表numbers仍然有3项。</div></>;
  }
  const source=m.initialItems.map(Number), result=filterResult(m), current=typeof m.from.values.n==="number"?m.from.values.n:undefined, complete=Boolean(m.from.output);
  const seen=m.history.filter(s=>typeof s.values.n==="number").map(s=>Number(s.values.n));
  return <><div className="ls-filter-head"><span>输入 n</span><span>先判断 n &gt; 0</span><span>再计算 n × n</span></div><div className="ls-filter-lanes">{source.map((value,i)=>{
    const processed=seen.includes(value),accepted=value>0;
    return <button key={i} className={`${current===value&&!complete?"current":""} ${processed&&!accepted?"rejected":""}`} onClick={()=>inspect(`输入${value}`,accepted?`${value}>0成立后，才计算${value}×${value}并加入新列表。`:`${value}>0不成立，直接跳过，既不计算平方，也不加入新列表。`)}><b>{value}</b><span>{!processed?"待判断":accepted?<Check size={17}/>:<X size={17}/>}</span><code>{!processed?"—":accepted?`${value} × ${value} = ${value*value}`:"不计算"}</code></button>;
  })}</div><div className="ls-filter-result"><code>squares</code><div>{result.length?result.map((value,i)=><span key={i}>{value}</span>):<small>当前还是空列表</small>}</div></div><div className="ls-reading-route"><code>sum(squares)</code><ArrowRight/><strong>{shown(m.from.values.total)}</strong></div><div className="ls-observation">原输入列表不变；只有通过条件的项，才生成新列表的元素。</div></>;
}
