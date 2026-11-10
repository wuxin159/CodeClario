import type {Language} from "../shared/curriculum.ts";
import type {Retest} from "../shared/flow.ts";
import {javaTypesProgram as program} from "../shared/authoredCourse.ts";

type Reviewed=Retest & {correct:number;explanation:string;language:Language;expected:string;topic:string};
// 新输入与新调用顺序用来检查概念迁移，不复用当前练习的正确输出作答案。
function check(topic:string,title:string,body:string,types:string,expected:string,wrong:string[],explanation:string):Reviewed {
 const options=[wrong[0],expected,...wrong.slice(1)];
 return {id:`java-${topic}-check-v1`,language:'java',topic,title,prompt:'先解释对象、状态或路径，再判断这个新例子的输出。',code:program(body,types),expected,options,correct:1,explanation};
}
export const javaDepthRetests:Reviewed[]=[
 check('java-constructor','同名参数与两个对象','Point a=new Point(4);\nPoint b=new Point(8);\nSystem.out.println(a.x+" "+b.x);','class Point { int x; Point(int x){ this.x=x; } }','4 8',['8 8','0 0'],'每次new把各自参数存入各自字段。'),
 check('java-static','共享计数与独立字段','Ticket a=new Ticket(2);\nTicket b=new Ticket(7);\na.value++;\nSystem.out.println(a.value+" "+b.value+" "+Ticket.count);','class Ticket { static int count; int value; Ticket(int v){value=v;count++;} }','3 7 2',['8 8 2','3 7 1'],'实例value独立；count由整个类共享。'),
 check('java-encapsulation','拒绝修改之后再合法修改','Account a=new Account();\na.deposit(-4);\na.deposit(3);\nSystem.out.println(a.get());','class Account { private int balance=8; public void deposit(int n){if(n>0)balance+=n;} public int get(){return balance;} }','11',['7','3'],'负数请求不写入；后面的正数在原余额8上累加。'),
 check('java-object-array','一个对象、两个位置','Box[] a=new Box[2];\na[0]=new Box();\na[1]=a[0];\na[1].v=6;\nSystem.out.println(a[0].v);','class Box { int v; }','6',['0','null'],'两个位置保存同一引用，访问的是同一个Box。'),
 check('java-list','插入后按位置删除','java.util.ArrayList<Integer> a=new java.util.ArrayList<>();\na.add(3);a.add(8);\na.add(1,5);a.remove(2);\nSystem.out.println(a);','','[3, 5]',['[3, 8]','[5, 8]'],'插入后是[3,5,8]，再删除下标2对应的8。'),
 check('java-inheritance','父类字段和子类字段合起来','Student s=new Student(4);\nSystem.out.println(s.total());','class Person { protected int score; Person(int n){score=n;} }\nclass Student extends Person { int bonus=3; Student(int n){super(n);} int total(){return score+bonus;} }','7',['3','4'],'super先初始化score=4，再用同一对象的bonus=3求和。'),
 check('java-dispatch','父类型变量引用另一种对象','Animal a=new Cat();\nSystem.out.println(a.sound());','class Animal { String sound(){return "animal";} }\nclass Cat extends Animal { @Override String sound(){return "cat";} }','cat',['animal','编译错误'],'重写实例方法根据实际Cat对象分派。'),
 check('java-interface','共同操作的另一种实现','Area a=new Rectangle(3,4);\nSystem.out.println(a.area());','interface Area { int area(); }\nclass Rectangle implements Area { int w,h; Rectangle(int w,int h){this.w=w;this.h=h;} public int area(){return w*h;} }','12',['7','编译错误'],'接口引用可以调用具体对象提供的实现。'),
 check('java-exception','异常后跳过语句并收尾','try {\n int n=Integer.parseInt("x");\n System.out.println(n+1);\n} catch(NumberFormatException e) {\n System.out.println("bad");\n} finally {\n System.out.println("end");\n}','','bad\nend',['1\nbad\nend','end'],'转换抛出异常，赋值未完成且不执行n+1的打印，再进入catch和finally。'),
 check('java-immutable','忽略返回值与保存返回值','String a="cat";\na.toUpperCase(java.util.Locale.ROOT);\nString b=a.toUpperCase(java.util.Locale.ROOT);\nSystem.out.println(a+" "+b);','','cat CAT',['CAT CAT','cat cat'],'原String不被修改，只有b接收了转换结果。'),
 check('java-list-objects','移除位置并不复制剩余对象','Box b=new Box();\njava.util.ArrayList<Box> a=new java.util.ArrayList<>();\na.add(b);a.add(b);a.remove(0);\nb.v=9;\nSystem.out.println(a.size()+" "+a.get(0).v);','class Box {int v=1;}','1 9',['1 1','2 9'],'剩余元素仍指向b所引用的原对象。'),
 check('java-parameters','形参改向与字段更新的顺序','Box b=new Box();\nChange.run(b);\nSystem.out.println(b.v);','class Box {int v=2;}\nclass Change {static void run(Box p){p.v=5;p=new Box();p.v=9;}}','5',['9','2'],'第一次写入原对象；重新赋形参后只修改新对象，调用方仍指向原对象。'),
];
