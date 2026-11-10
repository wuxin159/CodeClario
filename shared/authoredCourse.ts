import type {Lesson,Language} from "./curriculum.ts";
import type {SceneStep} from "./scenes.ts";
import type {Question} from "./teaching.ts";

export type AuthoredCourse = {
  alternate?:{label:string;demo:{code:string;title:string;steps:SceneStep[]}};
  demoLabel?:string;
  lesson:Lesson;
  plan:{version:string;chapter:string;goals:string[];prerequisites:string[];sections:{title:string;text:string}[];questions:Question[];visualTitle:string;takeaway:string};
  demo:{code:string;title:string;steps:SceneStep[]};
};
export const authoredStep=(line:number,note:string,values:SceneStep["values"]={},extra:Partial<SceneStep>={}):SceneStep=>({id:"",line,note,values,phase:"刚执行",output:"",...extra});
export const authoredDemo=(title:string,code:string,steps:SceneStep[])=>({title,code,steps:steps.map((s,i)=>({...s,id:`step-${i}`}))});
export const javaProgram=(body:string,members="")=>`${/\bScanner\b/.test(body+members)?"import java.util.Scanner;\n\n":""}public class Main {\n${members?members.split("\n").map(l=>"    "+l).join("\n")+"\n":""}    public static void main(String[] args) {\n${body.split("\n").map(l=>"        "+l).join("\n")}\n    }\n}\n`;
// 独立类型用于讲授private和继承，避免Main嵌套类的访问特例掩盖本节规则。
export function javaTypesProgram(body:string,types="") {const code=javaProgram(body),at=code.indexOf("public class Main");return code.slice(0,at)+(types?types+"\n\n":"")+code.slice(at);}
export function authoredCourse(d:{language:Language;number:number;order:number;topic:string;title:string;chapter:string;concepts:string[];task:string;starter:string;solution:string;stdin:string;tests:{input:string;expected:string}[];why:string;goal:string;firstStep:string;reading:string;mistake:string;prerequisites:string[];review:Omit<Question,"id">;demo:AuthoredCourse["demo"];practiceLevel?:Lesson["practiceLevel"]}):AuthoredCourse {
  const sections=[{title:"先理解这个概念",text:d.reading},{title:"容易混淆的地方",text:d.mistake},{title:"怎样自己验证",text:d.task}];
  return {lesson:{id:`${d.language}-${d.number}`,language:d.language,index:d.number-1,order:d.order,topic:d.topic,title:d.title,subtitle:d.goal,minutes:d.practiceLevel==="independent"?25:18,concepts:d.concepts,task:d.task,starter:d.starter,solution:d.solution,stdin:d.stdin,tests:d.tests,expected:d.tests[0].expected,explanation:[d.reading,d.mistake],hints:[d.firstStep,d.mistake,"先用题目中的普通输入核对，再验证边界；解释每一段代码负责哪一步。"],practiceLevel:d.practiceLevel??"guided",introduction:{why:d.why,goal:d.goal,firstStep:d.firstStep,analogy:d.why}},
    plan:{version:"intro-v3",chapter:d.chapter,goals:[d.goal,"用不同输入验证结果，并说明关键步骤"],prerequisites:d.prerequisites,sections,questions:[{id:"prediction",...d.review},{id:"review",...d.review}],visualTitle:d.demo.title,takeaway:d.reading},demo:d.demo};
}
