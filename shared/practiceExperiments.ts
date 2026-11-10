import type {Lesson,Language} from "./curriculum.ts";
import type {ErrorExperiment} from "./errorExperiments.ts";
import {javaProgram} from "./authoredCourse.ts";
const wrap=(language:Language,body:string)=>language==="python"?body+"\n":language==="java"?javaProgram(body):`${language==="c"?"#include <stdio.h>":"#include <iostream>"}\nint main() {\n${body}\nreturn 0;\n}\n`;
const print=(language:Language,name:string)=>language==="python"?`print(${name})`:language==="java"?`System.out.println(${name});`:language==="c"?`printf("%d\\n", ${name});`:`std::cout << ${name};`;
export function practiceErrorExperiment(lesson:Lesson):ErrorExperiment {
  const language=lesson.language,py=language==="python",flow=lesson.topic==="practice-flow";
  const before=wrap(language,flow?(py?"total=0\nfor i in range(1,7):\n    if i%2!=0:\n        total+=i\nprint(total)":`int total=0;\nfor(int i=1;i<=6;i++) {\n    if(i%2!=0) total+=i;\n}\n${print(language,'total')}`):(py?"values=[-5,-2,-8]\nmaximum=0\nfor value in values:\n    if value>maximum:\n        maximum=value\nprint(maximum)":`${language==="java"?'int[] values':'int values[]'}={-5,-2,-8};\nint maximum=0;\nfor(int i=1;i<3;i++) if(values[i]>maximum) maximum=values[i];\n${print(language,'maximum')}`));
  return {id:`error-v1:${lesson.id}`,before,after:flow?before.replace('i%2!=0','i%2==0'):before.replace('maximum=0','maximum=values[0]'),stdin:'',title:flow?'循环范围相同，筛选规则不同':'候选初值为什么不能随便选',why:flow?'经过一个数，不代表它参与累加。':'全负数输入可以暴露初始候选选错的问题。',question:flow?'分别列出两次真正加入总和的数字。它们各满足什么条件？':'第一份程序输出的0，是否来自原数组？为什么第二份结果不同？'};
}
