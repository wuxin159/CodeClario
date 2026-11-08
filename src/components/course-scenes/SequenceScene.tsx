import { ArrowDown, ArrowRight, CornerDownLeft } from "lucide-react";
import { sequenceLimit } from "../../../shared/courseStageModel";
import type { SceneProps } from "./sceneTypes";
import { shown } from "./sceneTypes";

export default function SequenceScene({lesson,scene,model:m,progress,inspect}:SceneProps) {
  if(m.kind==="matrix") {
    const entries=Object.entries(scene.steps[0].values),chosen=m.index>0;
    return <><div className="ls-instruction"><code>grid[行][列]</code><small>先定位行，再定位列</small></div><div className="ls-matrix"><span/><small>列0</small><small>列1</small>{[0,1].map(row=><div className="ls-matrix-row" key={row}><small>行{row}</small>{[0,1].map(col=><button key={col} className={chosen&&row===col?"selected":""} onClick={()=>inspect(`grid[${row}][${col}]`,`先找到第${row}行，再找到第${col}列，值是${entries.find(([key])=>key===`[${row}][${col}]`)?.[1]}。${row===col?"这个位置在本次主对角线上。":"这个位置不参与本次求和。"}`)}><b>{entries.find(([key])=>key===`[${row}][${col}]`)?.[1]}</b><code>[{row}][{col}]</code></button>)}</div>)}</div><div className="ls-reading-route"><code>grid[0][0]</code><span>+</span><code>grid[1][1]</code><ArrowRight size={18}/><strong>{shown(m.values.sum)}</strong></div><div className="ls-observation">对角线由行列下标相等确定，不是把整行或全部四项相加。</div></>;
  }
  if(m.kind==="unpack") {
    const old=scene.steps[0].values,ready=m.index>0;
    return <><div className="ls-instruction"><code>x, y = y, x</code><small>{progress>0&&m.index===0?(progress<.5?"先固定右侧的旧值":"再绑定左侧的名字"):"右侧先求值，左侧后绑定"}</small></div><div className="ls-unpack-source"><span><small>旧 y</small><b>{old.y}</b></span><span><small>旧 x</small><b>{old.x}</b></span></div><div className="ls-unpack-snapshot"><small>右侧快照</small><code>({old.y}, {old.x})</code><span>先保留两个旧值</span></div><div className="ls-unpack-wires"><ArrowDown/><ArrowDown/></div><div className="ls-unpack-target"><button onClick={()=>inspect("x的新绑定","x接收右侧快照中的第一项，也就是旧的y，不会读取刚刚修改过的y。") }><code>x</code><b>{m.from.values.x}</b></button><button onClick={()=>inspect("y的新绑定","y接收右侧快照中的第二项，也就是旧的x，不会被新的x覆盖。") }><code>y</code><b>{m.from.values.y}</b></button></div><div className="ls-observation">{ready?"两次绑定都使用同一份右侧快照。":"初始绑定保留在下方；执行交换时先固定上方的两个值。"}</div></>;
  }
  if(m.kind==="slice") {
    const original=m.initialItems,result=m.index>0?String(m.values.prefix):"";
    return <><div className="ls-sequence-label"><code>text = "{original.join("")}"</code><small>原字符串保留</small></div><div className="ls-cells slice">{original.map((char,i)=><button key={i} className={i<2?"selected":"excluded"} onClick={()=>inspect(`下标${i}`,i<2?"属于[0,2)选区，会进入新字符串。":"右边界2不包含在切片中，这个字符继续留在原字符串里。") }><small>{i}</small><b>{char}</b></button>)}</div><div className="ls-slice-bracket"><span>包含0</span><code>[0, 2)</code><span>不包含2</span></div><div className="ls-copy-lane"><ArrowDown/><span>复制选中内容，原字符不被移走</span></div><div className="ls-new-string"><code>prefix</code><strong>{result?`"${result}"`:"等待切片结果"}</strong>{progress>0&&m.index===0&&<span className="ls-slice-ghost" style={{transform:`translateY(${progress*20}px)`,opacity:Math.sin(progress*Math.PI)}}>p y</span>}</div><div className="ls-observation">字符串不可变：切片产生新结果，text仍然是完整的“python”。</div></>;
  }
  const cstring=m.kind==="cstring", offset=m.kind==="offset", append=m.kind==="append", record=lesson.id==="c-18";
  const items=m.items,originalCount=m.initialItems.length;
  const count=items.length,limit=sequenceLimit(lesson,scene,count);
  const active=m.from.active;
  const sumLine=scene.code.split("\n").findIndex(line=>/\btotal\s*\+=/.test(line))+1;
  // 读取到0或负数仍算一次累加，不能用“总和变大了”来判断是否访问。
  const accumulated=m.history.flatMap(s=>s.line===sumLine&&s.active!==undefined?[s.active]:[]);
  const label=cstring?"word[4]":offset?"numbers":record?"students":lesson.id==="cpp-9"?"word":lesson.id==="cpp-10"?"values":"numbers";
  const advancing=active!==undefined&&m.to.active!==undefined&&active!==m.to.active;
  return <>
    <div className="ls-sequence-label"><code>{label}</code><small>{cstring?"4个字符存储位置":record?"每个格子都是一个Student对象":append?"逻辑序列，不推测底层容量":lesson.language==="python"?"列表中的元素":"数组中的元素"}</small></div>
    <div className={`ls-cells ${record?"records":""} ${cstring?"cstring":""}`}>{items.map((value,i)=>{
      const end=cstring&&value==="\\0",excluded=!cstring&&!offset&&!append&&!record&&i>=limit;
      return <button key={i} className={`${active===i?"selected":""} ${excluded?"excluded":""} ${end?"terminator":""} ${append&&i>=originalCount?"new-item":""}`} onClick={()=>inspect(end?"结束符":`${label}[${i}]`,end?"\\0占据一个存储位置。strlen遇到它停止，不把它计入长度。":record?`先选students[${i}]对象，再读取score=${value}，随后才加入total。`:offset?`这里是第${i}个偏移位置，偏移的单位是int元素，不是字节。`:excluded?"元素仍然存在，但不在这次遍历范围内，所以没有参与累加。":`下标${i}保存${value}。${append&&i>=originalCount?"它由追加操作加入，后续遍历可以读取。":"数值与所在的位置是两件事。"}`)}><small>{record?`Student [${i}]`:`[${i}]`}</small>{record&&<code>score</code>}<b>{value}</b><span>{end?"停止计数":excluded?"未遍历":append&&i>=originalCount?"新增":accumulated.includes(i)?"已累加":active===i?"当前访问":""}</span></button>;
    })}{append&&m.index===0&&<div className="ls-pending-slot"><span>下一次追加</span><b>{scene.steps[1]?.items?.at(-1)}</b></div>}</div>
    {cstring&&m.index===0&&progress>0&&<div className="ls-cursor-track ls-string-scanner" aria-hidden="true"><i style={{left:`${(Math.min(3,progress*4)+.5)/4*100}%`}}>↑</i><small>strlen扫描到结束符就停止</small></div>}
    {advancing&&progress>0&&<div className="ls-cursor-track" aria-hidden="true"><i style={{left:`${((active+(m.to.active!-active)*progress)+.5)/count*100}%`}}>↑</i></div>}
    {cstring ? <><div className="ls-length-bars"><div><span>存储位置</span><i style={{width:"100%"}}/><b>4</b></div><div><span>逻辑长度</span><i style={{width:m.index>0?"75%":"0%"}}/><b>{shown(m.values.length)}</b></div></div><div className="ls-observation">c、a、t计入长度；结束符占空间，但不计入strlen的结果。</div></> : offset ? <><div className="ls-offset-path"><div><code>p</code><ArrowRight size={17}/><b>numbers[0]</b><small>{m.index===0?"尚未执行指针初始化":"p始终指向首元素"}</small></div><div className={m.index>=2?"selected":""}><code>p + 2</code><span>跨过2个元素</span><ArrowRight size={17}/><b>numbers[2]</b></div></div><div className="ls-reading-route"><code>*(p + 2)</code><ArrowRight size={20}/><strong>{shown(m.values.result)}</strong></div><div className="ls-observation">{m.index===0?"初始化后p将指向首元素。":"p本身仍指向首元素。"}p+2是偏移后的地址表达式，*再读取那里的值。</div></> : lesson.id==="cpp-9" ? <><div className="ls-size-equation"><code>word.size()</code><strong>{m.values.size}</strong><small>{m.index>0?"原来的cat保留，s追加到末尾":"追加前有3个字符"}</small></div><div className="ls-observation">string的逻辑长度随内容变化；这里没有把C字符串结束符计入size。</div></> : <>
      {append&&<div className="ls-vector-growth"><code>size: {originalCount} → {count}</code><span>{count>originalCount?"追加后遍历包含新项":"等待push_back"}</span></div>}
      <div className="ls-read-add"><div><small>{record?`students[${active??"i"}].score`:lesson.language==="python"?"当前取到的 number":lesson.id==="cpp-10"?"范围for取到的 value":"当前访问 numbers[i]"}</small><b>{active===undefined?"—":items[active]}</b></div><ArrowRight/><div><small>total</small><b>{shown(m.from.values.total)}</b></div></div>
      <div className="ls-observation"><CornerDownLeft size={15}/>{record?"先选对象，再选成员，最后把字段值加入总分。":lesson.language==="python"?`直接取元素，不创建i变量；本次范围包含${limit}项。`:`数组长度${count}，本次遍历${limit}项。`}</div>
    </>}
  </>;
}
