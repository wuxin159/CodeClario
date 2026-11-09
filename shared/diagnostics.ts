import type {Lesson} from "./curriculum";
export type DiagnosticCase={id:string;title:string;input:string;expected:string};
export type DiagnosticObservation=DiagnosticCase & {reason:string;stdout:string;stderr:string;status:string;durationMs:number;matches:boolean|null;reused:boolean};
export function diagnosticCases(lesson:Lesson):DiagnosticCase[] {
  const number=Number(lesson.id.split("-")[1]);let cases:DiagnosticCase[]=[];
  if(number===8)cases=[{id:"short-positive",title:"只累加到2",input:"2",expected:"3"},{id:"inclusive-four",title:"最后一项是4",input:"4",expected:"10"},{id:"upper-bound",title:"允许范围的上界20",input:"20",expected:"210"}];
  if(number===7)cases=[{id:"one-minute-plus-one",title:"一整份再余1秒",input:"61",expected:"1\n1"},{id:"three-minutes",title:"恰好三整分钟",input:"180",expected:"3\n0"},{id:"two-minutes-plus-one",title:"两整份再余1秒",input:"121",expected:"2\n1"}];
  if(number===19)cases=[{id:"mixed-duplicates",title:"负数与重复项",input:"9\n-1\n4\n4\n0",expected:"-1\n0\n4\n4\n9"},{id:"ordered-five",title:"已经有序的五项",input:"0\n2\n4\n6\n8",expected:"0\n2\n4\n6\n8"},{id:"two-inversions",title:"两处相邻逆序",input:"2\n1\n4\n3\n5",expected:"1\n2\n3\n4\n5"}];
  // 诊断补充新的输入，不重复收费执行已经在正式样例中核对过的同一输入。
  return cases.filter(c=>!lesson.tests?.some(t=>t.input.trim()===c.input.trim()));
}
