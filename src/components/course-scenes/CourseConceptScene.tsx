import {useEffect,useState,type CSSProperties} from "react";
import type {Lesson} from "../../../shared/curriculum";
import type {Scene} from "../../../shared/scenes";
import {courseStageModel} from "../../../shared/courseStageModel";
import {visualLesson,type VisualKind} from "../../../shared/visualLessons";
import FundamentalsScene from "./FundamentalsScene";
import SequenceScene from "./SequenceScene";
import FlowScene from "./FlowScene";
import CollectionScene from "./CollectionScene";
import ObjectScene from "./ObjectScene";

const titles:Partial<Record<VisualKind,string>>={
  output:"输出流：写入之后继续追加",assignment:"求值与赋值",division:"完整分组和剩余部分",branch:"条件决定执行路径",
  array:"位置、读取与累加",cstring:"结束符划定字符串边界",matrix:"用行与列定位",offset:"按元素偏移，再解引用",append:"从逻辑末尾追加",slice:"保留原串，生成切片",unpack:"先保存右侧，再绑定左侧",
  character:"字符和它的编码",scope:"值副本与显式写回",pointer:"地址跨越函数边界",exception:"异常改变执行路径",
  dictionary:"用键找到对应值",set:"重复值归到同一项",filter:"先筛选，再计算",
  record:"类型、对象与成员",constructor:"本次参数初始化本次对象",encapsulation:"方法是受控的修改入口",composition:"对象里还包含另一个对象",instances:"同一种类型，独立的状态",copy:"新列表与独立的外层结构",
};
const basic=new Set<VisualKind>(["output","assignment","division","branch"]);
const sequence=new Set<VisualKind>(["array","cstring","matrix","offset","append","slice","unpack"]);
const flow=new Set<VisualKind>(["character","scope","pointer","exception"]);
const collection=new Set<VisualKind>(["dictionary","set","filter"]);
export const coveredCourseKinds = new Set(Object.keys(titles));

export default function CourseConceptScene({lesson,scene,time,reduced=false,onInspect,onAsk}:{lesson:Lesson;scene:Scene;time:number;reduced?:boolean;onInspect:()=>void;onAsk?:(text:string)=>void}) {
  const model=courseStageModel(lesson,scene,time),[selection,setSelection]=useState<{title:string;explanation:string}>();
  useEffect(()=>setSelection(undefined),[scene.id,model.index]);
  const inspect=(title:string,explanation:string)=>{onInspect();setSelection({title,explanation});};
  const progress=reduced?0:model.progress;
  const props={lesson,scene,model,progress,inspect};
  const title=lesson.id==="c-18"?"先选Student对象，再读score":lesson.id==="cpp-10"?"追加之后，新元素也参与遍历":lesson.id==="cpp-9"?"string在末尾保留新增字符":lesson.id==="c-17"?"先解引用结构体，再选择成员":lesson.id==="python-16"?"self连接方法与接收实例":lesson.id==="cpp-13"?"成员函数读取本对象的数据":titles[model.kind];
  if(!title)throw new Error(`课程场景尚未设计：${lesson.id}`);
  // 图形样式可以复用，语义仍由各类概念组件控制；状态变化只来自当前审校快照。
  const nextModel=courseStageModel(lesson,scene,Math.min(model.index+1,scene.steps.length-1));
  // 稀疏快照省略字段不代表字段被改写；只有同一对象的实际字段差异才播放写入光点。
  const changing=model.links.some((link,i)=>nextModel.links[i]&&Object.keys(link.fields).some(key=>link.fields[key]!==nextModel.links[i].fields[key]));
  return <div className={`lesson-scene lesson-kind-${model.kind}`} data-course={lesson.id} data-kind={model.kind} data-step={model.index} data-changing={changing} style={{"--lesson-progress":progress,"--lesson-opacity":Math.sin(progress*Math.PI)} as CSSProperties}>
    <header className="ls-scene-heading"><b>{title}</b><small>概念示意</small></header>
    <div className="ls-scene-content">{basic.has(model.kind)?<FundamentalsScene {...props}/>:sequence.has(model.kind)?<SequenceScene {...props}/>:flow.has(model.kind)?<FlowScene {...props}/>:collection.has(model.kind)?<CollectionScene {...props}/>:<ObjectScene {...props}/>}</div>
    <aside className={`ls-inspection ${selection?"selected":""}`} aria-live="polite">{selection?<><b>{selection.title}</b><p>{selection.explanation}</p>{onAsk&&<button onClick={()=>onAsk(`请结合当前课程示例第${model.index+1}步，解释「${selection.title}」在这段代码中的作用。`)}>向AI问这一处</button>}</>:<p>{visualLesson(lesson).insight}<span>选中画面中的对象，可暂停查看含义。</span></p>}</aside>
  </div>;
}
