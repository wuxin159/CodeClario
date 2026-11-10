import {javaTypesProgram as program} from "./authoredCourse.ts";
type Comparison={title:string;why:string;question:string;before:string;after:string};
const bank:Record<string,Comparison>={};
function add(topic:string,title:string,why:string,question:string,body:string,types:string,from:string,to:string){
 const before=program(body,types),after=before.replace(from,to);
 if(before===after)throw Error(`Java对照没有产生改动：${topic}`);
 bank[topic]={title,why,question,before,after};
}
add('java-constructor','参数赋给自己，还是写入字段','同名参数遮住字段，需要this明确选择接收对象。','为什么第一个对象的字段仍是0？','Point p=new Point(6);\nSystem.out.println(p.x);','class Point {int x;Point(int x){x=x;}}','x=x','this.x=x');
add('java-static','实例数据误写成类数据','static只有一份类共享状态。','创建b为什么覆盖了a看到的value？','Ticket a=new Ticket(3);\nTicket b=new Ticket(8);\nSystem.out.println(a.value+" "+b.value);','class Ticket {static int value;Ticket(int n){value=n;}}','static int value','int value');
add('java-encapsulation','字段隐藏之后还要检查入口','private不能替代业务约束。','同样是调用public方法，为什么一次应拒绝？','Account a=new Account();\na.deposit(-4);\nSystem.out.println(a.get());','class Account {private int balance=10;public void deposit(int n){balance+=n;}public int get(){return balance;}}','balance+=n','if(n>0)balance+=n');
add('java-object-array','有数组位置，但没有实例','new Box[2]的元素初始为null。','异常发生时，究竟哪个引用还没有对象？','Box[] a=new Box[2];\na[0]=new Box();\na[1].v=7;\nSystem.out.println(a[1].v);','class Box {int v;}','a[1].v=7','a[1]=new Box();\n        a[1].v=7');
add('java-list','remove按位置，还是按数值','remove(int)与remove(Object)是不同的重载。','想删除数值1，为什么第一份删除了9？','java.util.ArrayList<Integer> a=new java.util.ArrayList<>();\na.add(1);a.add(9);a.add(2);\na.remove(1);\nSystem.out.println(a);','','a.remove(1)','a.remove(Integer.valueOf(1))');
add('java-inheritance','同名局部变量没有初始化父类字段','构造参数和字段必须明确区分。','bonus相同，为什么两次总分不同？','Student s=new Student(5);\nSystem.out.println(s.total());','class Person {protected int score;Person(int score){score=score;}}\nclass Student extends Person {int bonus=2;Student(int n){super(n);}int total(){return score+bonus;}}','score=score','this.score=score');
add('java-dispatch','名字相似不等于重写','大小写不同的方法不会参与同一次重写分派。','父类型引用最终调用了谁？','Animal a=new Dog();\nSystem.out.println(a.sound());','class Animal {String sound(){return "animal";}}\nclass Dog extends Animal {String Sound(){return "dog";}}','String Sound()','@Override String sound()');
add('java-interface','实现接口还需要满足可访问性','接口普通抽象方法的实现应为public。','第一份为什么在运行前就被编译器拒绝？','Area a=new Square();\nSystem.out.println(a.area());','interface Area {int area();}\nclass Square implements Area {int area(){return 9;}}','{int area(){return 9;}','{public int area(){return 9;}');
add('java-exception','收尾只写在成功路径中','try内语句可能被异常跳过，finally用于这段路径收尾。','输入无效时，done在哪份程序中仍会打印？','try {\n int n=Integer.parseInt("x");\n System.out.println(n);\n System.out.println("done");\n} catch(NumberFormatException e) {\n System.out.println("invalid");\n}','','\n         System.out.println("done");','');
// 对照只移动收尾语句，不改变转换或catch的语义。
bank['java-exception'].after=bank['java-exception'].after.replace('System.out.println("invalid");\n        }','System.out.println("invalid");\n        } finally {\n            System.out.println("done");\n        }');
add('java-immutable','忽略了大小写转换的返回值','String方法不能原地改写原内容。','第一份算出的结果被谁保存了？','String text="code";\ntext.toUpperCase(java.util.Locale.ROOT);\nSystem.out.println(text);','','text.toUpperCase(java.util.Locale.ROOT);','text=text.toUpperCase(java.util.Locale.ROOT);');
add('java-list-objects','加入同一对象，还是加入两个对象','集合保存引用，不会自动复制对象。','两个元素在哪份程序中共享value？','Box b=new Box();\njava.util.ArrayList<Box> a=new java.util.ArrayList<>();\na.add(b);a.add(b);\na.get(0).v=7;\nSystem.out.println(a.get(1).v);','class Box {int v=1;}','a.add(b);a.add(b)','a.add(b);a.add(new Box())');
add('java-parameters','修改之前就把形参改了方向','引用值副本重新赋值不会改变调用方变量。','哪次写入真正落在调用方的原对象上？','Box b=new Box();\nChange.run(b);\nSystem.out.println(b.v);','class Box {int v=1;}\nclass Change {static void run(Box p){p=new Box();p.v=7;}}','p=new Box();p.v=7','p.v=7;p=new Box()');
export const javaDepthExperiment=(topic:string)=>bank[topic];
