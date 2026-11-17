import {lessons,coursePosition,type Lesson} from './curriculum.ts';

export const REMEDIATION_THRESHOLD=3;
export type ReviewConcept={id:string;label:string;description:string;lessonId:string;lessonTitle:string};
// 依赖只指向当前语言已经排在前面的基础课，课程ID由目录解析，不交给模型自由编造。
export function reviewConcepts(lesson:Lesson):ReviewConcept[] {
  const basics=[
    ['output','程序输出','区分打印和计算结果','output'],
    ['assignment','变量赋值与更新','先计算右侧，再更新变量','variable'],
    ['condition','条件判断与边界','比较符号、相等情况和分支条件','condition'],
    ['loop-boundary','循环范围与累加','循环参与范围、终止条件与累加器','for'],
    ['array-index','数组下标与长度','从0开始的下标、有效范围与元素访问','array'],
    ['parameters','函数参数与返回值','实参、形参、返回值及调用顺序','function'],
    ['object-state','对象与实例状态','类、实例及独立成员状态','class'],
  ];
  const targets=basics.map(([id,label,description,topic])=>({id,label,description,target:lessons.find(l=>l.language===lesson.language&&l.topic===topic)}));
  const reference=lessons.find(l=>l.language===lesson.language&&(l.topic==='java-reference'||l.title==='列表引用与浅拷贝'||l.title==='引用与参数传递'||l.title==='指针：取址与解引用'));
  targets.push({id:'references',label:'引用与共享修改',description:'变量名称、对象身份和修改传播的区别',target:reference});
  return targets.flatMap(c=>c.target&&coursePosition(c.target)<coursePosition(lesson)?[{id:c.id,label:c.label,description:c.description,lessonId:c.target.id,lessonTitle:c.target.title}]:[]);
}
export type ReviewSuggestion=ReviewConcept&{count:number;threshold:number;reasons:string[]};
export type ReviewSession={id:string;sourceMissionId:string;sourceLessonId:string;sourceTitle:string;targetLessonId:string;targetTitle:string;conceptId:string;conceptLabel:string;createdAt:number;ready:boolean;practiceReady:boolean;understandingReady:boolean};
export type RemediationSnapshot={userId:string;suggestion:ReviewSuggestion|null;session:ReviewSession|null};
