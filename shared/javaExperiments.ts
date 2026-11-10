import type {Lesson} from "./curriculum.ts";
import type {ErrorExperiment} from "./errorExperiments.ts";
import {javaProgram as program} from "./authoredCourse.ts";
import {bubbleProgram,BUBBLE_INPUT} from "./bubbleSort.ts";
import {javaDepthExperiment} from "./javaDepthExperiments.ts";

export function javaErrorExperiment(lesson:Lesson):ErrorExperiment {
  const depth=javaDepthExperiment(lesson.topic??"");
  if(depth)return {id:`error-v1:${lesson.id}`,...depth,stdin:""};
  let before="",after="",title="",why="",question="";
  const topic=lesson.topic;
  if(topic==="bubble-sort"){
    before=bubbleProgram('java',{values:BUBBLE_INPUT,onePass:true});after=bubbleProgram('java',{values:BUBBLE_INPUT});title="一轮与完整排序";why="一轮只确定一个最大值的位置。";question="两次运行的左半部分有什么不同？";
  }else if(topic==="output"){
    before=program('System.out.println(Hello);');after=program('System.out.println("Hello");');title="文字和名字的区别";why="引号说明这里是文字，不是变量名。";question="为什么去掉引号会报找不到符号？";
  }else if(topic==="arithmetic"){
    before=program('int a=7, b=2;\ndouble result=a / b;\nSystem.out.println(result);');after=before.replace('a / b','(double)a / b');title="结果用double，除法就有小数吗";why="先按操作数类型计算，再赋给结果变量。";question="强制转换发生在计算之前还是之后？";
  }else if(topic==="condition"){
    before=program('int age=18;\nSystem.out.println(age > 18 ? "adult" : "minor");');after=before.replace('age > 18','age >= 18');title="边界值18属于哪边";why="只差一个等号，边界分支就不同。";question="两次比较分别是真还是假？";
  }else if(topic==="array"){
    before=program('int[] values={2,4,6};\nSystem.out.println(values[values.length]);');after=before.replace('values[values.length]','values[values.length - 1]');title="长度不是最后下标";why="数组长度3，合法下标到2。";question="第一份程序在哪一行发生越界？";
  }else if(topic==="java-equality"){
    before=program('String a=new String("code");\nString b=new String("code");\nSystem.out.println(a == b);');after=before.replace('a == b','a.equals(b)');title="引用相等与内容相等";why="两个不同对象可以包含相同文字。";question="同样的两个字符串，为什么比较结果不同？";
  }else if(topic==="class"||topic==="java-reference"){
    const members='static class Box { int value=0; }';before=program('Box a=new Box();\nBox b=a;\nb.value=7;\nSystem.out.println(a.value);',members);after=before.replace('Box b=a','Box b=new Box()');title="复制引用，还是创建对象";why="赋值本身不会复制对象。";question="哪一种情况下两个变量能看到同一处修改？";
  }else if(topic==="function"){
    before=program('int value=4;\nsquare(value);\nSystem.out.println(value);','static int square(int n) { return n*n; }');after=before.replace('    square(value);','    value=square(value);');title="返回值需要使用";why="调用方法不会自动改变调用处的int变量。";question="第一份程序算出16后，谁保存了它？";
  }else if(topic==="practice-array"){
    before=program('int[] values={-5,-2,-8};\nint maximum=0;\nfor(int value:values) if(value>maximum) maximum=value;\nSystem.out.println(maximum);');after=before.replace('int maximum=0','int maximum=values[0]');title="全负数输入检验初始值";why="候选答案应来自真实数据。";question="结果0在原数组里存在吗？";
  }else if(topic==="variable"){
    before=program('int a=2;\nint b=a;\nb+=3;\nSystem.out.println(a+" "+b);');after=before.replace('b+=3','a+=3');title="int赋值复制数值";why="两个int变量各自保存自己的值。";question="改动的究竟是哪个变量？";
  }else{
    before=program('int total=0;\nfor(int i=1;i<4;i++) { total+=i; }\nSystem.out.println(total);');after=before.replace('i<4','i<=4');title="最后一项是否参与";why="先把循环实际处理的值逐个列出来。";question="哪次循环包含4？两次总和相差多少？";
  }
  return {id:`error-v1:${lesson.id}`,title,why,question,before,after,stdin:""};
}
