import type {Language} from "./curriculum.ts";
import {authoredCourse,authoredDemo as demo,authoredStep as step,javaProgram,type AuthoredCourse} from "./authoredCourse.ts";

function program(language:Language,body:string){
  if(language==="java")return javaProgram(body);
  if(language==="python")return body+"\n";
  return `${language==="c"?"#include <stdio.h>":"#include <iostream>"}\n\nint main(${language==="c"?"void":""}) {\n${body.split("\n").map(l=>"    "+l).join("\n")}\n    return 0;\n}\n`;
}
const print=(language:Language,value:string)=>language==="python"?`print(${value})`:language==="c"?`printf("%d\\n", ${value});`:language==="java"?`System.out.println(${value});`:`std::cout << ${value} << '\\n';`;
const read=(language:Language)=>language==="python"?'n = int(input())':language==="c"?'int n;\nscanf("%d", &n);':language==="java"?'Scanner input = new Scanner(System.in);\nint n = input.nextInt();':'int n;\nstd::cin >> n;';
const result:AuthoredCourse[]=[];
for(const language of ["c","cpp","python","java"] as const){
  const py=language==="python",j=language==="java",comment=py?"#":"//";
  const evenBody=py?'total = 0\nfor i in range(1, n + 1):\n    if i % 2 == 0:\n        total += i':'int total = 0;\nfor (int i = 1; i <= n; i++) {\n    if (i % 2 == 0) {\n        total += i;\n    }\n}';
  const evenDemo=evenBody.replace(py?'n + 1':'<= n',py?'7':'<= 6')+'\n'+print(language,'total');
  const evenSteps=[step(1,"先建立总和0。",{total:0,i:1},{phase:"初始化"})];let sum=0;
  for(let i=1;i<=6;i++){evenSteps.push(step(3,`${i}%2 ${i%2===0?"等于0，加入总和":"不等于0，跳过"}。`,{i,total:sum,even:i%2===0?1:0},{phase:"判断条件"}));if(i%2===0){sum+=i;evenSteps.push(step(4,`只加入偶数${i}。`,{i,total:sum,even:1}));}}
  evenSteps.push(step(evenDemo.split('\n').length,"最终只累加了2、4、6。",{total:sum},{output:"12\n",phase:"循环结束"}));
  result.push(authoredCourse({language,number:j?13:20,order:65,topic:"practice-flow",title:"独立实践：只累加符合条件的数",chapter:"独立编码实践",concepts:["拆解任务","循环与条件","边界验证"],practiceLevel:"independent",
    task:"从零组织代码：输入0到20的整数n，输出1到n中所有偶数的和，包含n本身（若n是偶数）。n=0时输出0。请自己完成输入、循环、条件和输出。",starter:program(language,`${comment} 先写下：输入是什么？哪些数参与累加？\n${comment} 在这里独立完成程序`),solution:program(language,read(language)+'\n'+evenBody+'\n'+print(language,'total')),stdin:"6",tests:[["6","12"],["0","0"],["2","2"],["3","2"],["20","110"]].map(([input,expected])=>({input,expected})),
    why:"能改正别人的程序之后，还需要自己把多个步骤组织成一个完整解法。",goal:"独立组合输入、条件和循环，并解释为什么只处理偶数。",firstStep:"先列出n=6时哪些数该参与，再决定循环范围和筛选条件。",prerequisites:["整数输入、余数、条件判断和循环"],reading:"先明确输入和输出，再列出中间步骤：建立总和、逐个取数、判断偶数、按条件累加、输出。先用一个小输入手算，再把相同规则写成代码。",mistake:"不要把测试示例12直接写成输出；不要把奇数一起相加；n为偶数时应包含最后一项。",review:{prompt:"n=5时，为什么不把5加入总和？",options:["因为循环应始终少处理一项","因为5不满足偶数条件","因为输入只能是偶数"],correct:1,explanation:"范围仍是1到5；循环中的筛选条件让5不参与累加。"},demo:demo("先走过范围，再筛选参与者",evenDemo,evenSteps)}));
  const arrayRead=py?'numbers = []\nfor i in range(5):\n    numbers.append(int(input()))':`${j?'Scanner input = new Scanner(System.in);\nint[] numbers = new int[5];':'int numbers[5];'}\nfor (int i = 0; i < 5; i++) {\n    ${j?'numbers[i] = input.nextInt();':language==='c'?'scanf("%d", &numbers[i]);':'std::cin >> numbers[i];'}\n}`;
  const maxBody=py?'maximum = numbers[0]\nfor i in range(1, len(numbers)):\n    if numbers[i] > maximum:\n        maximum = numbers[i]':'int maximum = numbers[0];\nfor (int i = 1; i < 5; i++) {\n    if (numbers[i] > maximum) {\n        maximum = numbers[i];\n    }\n}';
  const items=[-3,-8,-1,-9,-2];const maxDemo=(py?'numbers = [-3, -8, -1, -9, -2]':j?'int[] numbers = {-3, -8, -1, -9, -2};':'int numbers[] = {-3, -8, -1, -9, -2};')+'\n'+maxBody+'\n'+print(language,'maximum');
  const maxSteps=[step(1,"所有输入都是负数。",{},{items}),step(2,"候选最大值取第一项，而不是凭空取0。",{maximum:items[0]},{items,active:0})];let maximum=items[0];
  for(let i=1;i<items.length;i++){maxSteps.push(step(4,`比较候选${maximum}和新值${items[i]}。`,{i,maximum,candidate:items[i]},{items,active:i}));if(items[i]>maximum){maximum=items[i];maxSteps.push(step(5,"新值更大，更新候选。",{i,maximum,candidate:items[i]},{items,active:i}));}}
  maxSteps.push(step(maxDemo.split('\n').length,"所有元素核对完，最大值是-1。",{maximum},{items,output:"-1\n"}));
  result.push(authoredCourse({language,number:j?14:21,order:76,topic:"practice-array",title:"独立实践：找出数组中的最大值",chapter:"独立编码实践",concepts:["数组遍历","候选更新","负数边界"],practiceLevel:"independent",
    task:"输入五个整数，每行一个，独立编写程序找出最大值并输出。需要处理全负数、重复值和最大值位于末尾的情况，不调用现成排序或最大值函数。",starter:program(language,`${comment} 自己完成读取五个数、维护候选值、遍历比较与输出\n${comment} 想一想：全部都是负数时，初始候选应该来自哪里？`),solution:program(language,arrayRead+'\n'+maxBody+'\n'+print(language,'maximum')),stdin:items.join('\n'),tests:[items,[1,2,3,4,9],[5,5,5,5,5],[8,1,2,3,4],[0,-2,0,-7,-1]].map(a=>({input:a.join('\n'),expected:String(Math.max(...a))})),
    why:"把遍历与条件判断合起来，学会维护一个随处理过程更新的答案。",goal:"独立完成最大值查找，并解释全负数时的初始化。",firstStep:"把第一个真实元素作为候选，再依次比较后面的四项。",prerequisites:["数组输入、遍历与条件判断"],reading:"候选最大值必须来自已经看过的数据。先取第一项，再依次比较剩余元素，遇到更大的值才更新。循环结束时，候选覆盖了全部已处理元素。",mistake:"把maximum固定初始化为0，会在全负数输入下出错。不要漏掉最后一项，也不需要为重复最大值额外增加结果。",review:{prompt:"数组全部是负数时，把maximum初始设为0有什么问题？",options:["没有问题","0可能根本不在数组中，并且比所有输入都大","会导致数组越界"],correct:1,explanation:"候选应从真实数据中取值，通常用首元素初始化。"},demo:demo("比较新元素，更新当前候选",maxDemo,maxSteps)}));
}
export const practiceExtensions=result;
