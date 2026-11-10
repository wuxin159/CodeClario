import type {Lesson,Language} from "../shared/curriculum.ts";
import type {Retest} from "../shared/flow.ts";
import {javaProgram as program} from "../shared/authoredCourse.ts";
import {bubbleProgram} from "../shared/bubbleSort.ts";
import {javaDepthRetests} from "./javaDepthRetests.ts";

type Entry=Retest & {correct:number;explanation:string;language:Language;expected:string;topic:string};
const bank:Entry[]=[];
function add(topic:string,title:string,body:string,expected:string,wrong:string[],explanation:string,members="") {
  const options=[...new Set([wrong[0],expected,...wrong.slice(1)])];
  bank.push({id:`java-${topic}-check-v1`,language:"java",topic,title,prompt:"先解释关键步骤，再判断这段新程序的输出。",code:program(body,members),expected,options,correct:options.indexOf(expected),explanation});
}
add('output','换行与连续输出','System.out.print("A");\nSystem.out.println("B");\nSystem.out.println("C");','AB\nC',['A\nB\nC','ABC'],'print不自动换行；println会在内容之后换行。');
add('variable','整数副本与后续赋值','int a=3;\nint b=a;\na=8;\nSystem.out.println(b);','3',['8','11'],'b保存赋值当时的整数值，后续修改a不改变b。');
add('arithmetic','另一组商与余数','int n=181;\nSystem.out.println(n/60);\nSystem.out.println(n%60);','3\n1',['3\n3','1\n3'],'181包含三整份60，还剩1。');
add('condition','边界之外的分支','int n=9;\nSystem.out.println(n>=10 ? "yes" : "no");','no',['yes','yes\nno'],'9>=10为false，只取后一条结果。');
add('for','循环的起点也影响总和','int total=0;\nfor(int i=2;i<=4;i++) total+=i;\nSystem.out.println(total);','9',['10','6'],'实际加入的是2、3、4，共9。');
add('while','更新后再判断','int i=1;\nint total=0;\nwhile(i<4) { total+=i; i++; }\nSystem.out.println(total+" "+i);','6 4',['6 3','10 5'],'加入1、2、3后i更新到4，再判断为false。');
add('array','数组赋值后再读取','int[] a={2,4,6};\na[1]=a[0]+a[2];\nSystem.out.println(a[1]);','8',['4','12'],'下标1被更新为2+6，而不是整个数组总和。');
const bubble=bubbleProgram('java',{values:[3,1,2],onePass:true});
bank.push({id:'java-bubble-sort-check-v1',language:'java',topic:'bubble-sort',title:'三项的一轮冒泡',prompt:'先不运行，判断一轮之后的数组输出。',code:bubble,expected:'1\n2\n3',options:['1\n3\n2','1\n2\n3','3\n2\n1'],correct:1,explanation:'3先与1交换，再与2交换；这个特定输入一轮后恰好全部有序，不代表所有输入都只需要一轮。'});
add('function','返回值参与后续计算','int answer=square(3)+1;\nSystem.out.println(answer);','10',['9','7'],'先取得square(3)返回的9，再在调用处加1。','static int square(int n) { return n*n; }');
add('class','不同实例的状态','Box a=new Box();\nBox b=new Box();\na.value=5;\nSystem.out.println(b.value);','0',['5','10'],'两次new创建两个对象，修改a不会改变b。','static class Box { int value=0; }');
add('java-reference','引用副本与修改字段','Box a=new Box();\nBox b=a;\nb.value=5;\nb=new Box();\nSystem.out.println(a.value+" "+b.value);','5 0',['0 0','5 5'],'b最初与a共享对象；改字段使原对象为5，之后b才改指向新对象。','static class Box { int value=0; }');
add('java-equality','同内容的两个对象','String a=new String("hi");\nString b=new String("hi");\nSystem.out.println(a==b);\nSystem.out.println(a.equals(b));','false\ntrue',['true\ntrue','false\nfalse'],'两个对象身份不同，字符内容相同。');
add('practice-flow','改变筛选条件','int total=0;\nfor(int i=1;i<=5;i++) if(i%2!=0) total+=i;\nSystem.out.println(total);','9',['6','15'],'本次筛选奇数，实际加入1、3、5。');
add('practice-array','候选最大值逐步更新','int[] a={-7,-2,-5};\nint maximum=a[0];\nfor(int i=1;i<a.length;i++) if(a[i]>maximum) maximum=a[i];\nSystem.out.println(maximum);','-2',['0','-7'],'候选从-7更新为-2，再遇到-5时保持不变。');
bank.push(...javaDepthRetests);
export const javaRetestBank=bank;
export const javaRetestsFor=(lesson:Lesson)=>bank.filter(r=>r.topic===lesson.topic);
