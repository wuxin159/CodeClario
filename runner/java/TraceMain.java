import com.sun.jdi.*;
import com.sun.jdi.connect.*;
import com.sun.jdi.event.*;
import com.sun.jdi.request.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.*;

/** 在隔离容器内采集JDI镜像。读取字段而不调用toString等用户方法，防止观察改变程序。 */
public class TraceMain {
    private static final int MAX_STEPS=160, MAX_BYTES=180_000;
    private static int nodes=0, bytes=0;
    private static boolean truncated=false;
    private static final List<Map<String,Object>> steps=new ArrayList<>();
    private static final List<EventRequest> sampling=new ArrayList<>();
    private static final Map<Long,String> identities=new LinkedHashMap<>();
    private static final List<ReferenceType> userTypes=new ArrayList<>();
    private static String id(ObjectReference value) {
        return identities.computeIfAbsent(value.uniqueID(), ignored->"对象"+(identities.size()+1));
    }
    private static Map<String,Object> map(Object... pairs) {
        Map<String,Object> result=new LinkedHashMap<>();
        for(int i=0;i<pairs.length;i+=2)result.put((String)pairs[i],pairs[i+1]);
        return result;
    }
    private static String clip(String text) { return text.length()>100?text.substring(0,100)+"…":text; }
    private static String text(Value value) {
        if(value==null)return "null";
        if(value instanceof StringReference string)return clip(json(string.value()));
        if(value instanceof ObjectReference object&&boxed(object))return object.getValue(object.referenceType().fieldByName("value")).toString();
        if(value instanceof ArrayReference array){
            List<String> elements=new ArrayList<>();
            for(Value item:array.getValues(0,Math.min(8,array.length())))elements.add(item instanceof ArrayReference?"[…]":text(item));
            return "["+String.join(", ",elements)+(array.length()>8?", …":"")+"]";
        }
        if(value instanceof ObjectReference object)return object.referenceType().name()+" · "+id(object);
        return clip(value.toString());
    }
    private static boolean boxed(ObjectReference object){
        return Set.of("java.lang.Integer","java.lang.Long","java.lang.Short","java.lang.Byte","java.lang.Boolean","java.lang.Character","java.lang.Double","java.lang.Float").contains(object.referenceType().name());
    }
    private static Map<String,Object> node(String name, Value value, int depth, Set<Long> path) {
        nodes++;
        String type=value==null?"reference":value.type().name();
        Map<String,Object> result=map("name",name,"type",type,"value",text(value),"kind","scalar");
        if(value==null){result.put("kind","reference");result.put("target","0x0");return result;}
        if(!(value instanceof ObjectReference object))return result;
        String identity=id(object);
        if(value instanceof ArrayReference array){
            result.put("kind","array");result.put("address",identity);result.put("size",array.length());
            List<Object> children=new ArrayList<>();
            if(depth<2&&nodes<100&&!path.contains(object.uniqueID())){
                Set<Long> seen=new HashSet<>(path);seen.add(object.uniqueID());
                for(int i=0;i<Math.min(8,array.length())&&nodes<100;i++)children.add(node("["+i+"]",array.getValue(i),depth+1,seen));
            }
            result.put("children",children);return result;
        }
        result.put("kind","reference");result.put("target",identity);
        List<Object> children=new ArrayList<>();
        Map<String,Object> target=map("name",identity,"type",type,"kind","object","address",identity,"value",type);
        if(value instanceof StringReference string)children.add(map("name","内容","type","String","kind","scalar","value",clip(json(string.value()))));
        else if(boxed(object))children.add(node("值",object.getValue(object.referenceType().fieldByName("value")),depth+1,path));
        else if(type.equals("java.util.ArrayList")&&depth<2){
            // 读取实际size和有效元素，不调用get/toString，不把内部容量冒充逻辑长度。
            int size=((IntegerValue)object.getValue(object.referenceType().fieldByName("size"))).value();
            ArrayReference storage=(ArrayReference)object.getValue(object.referenceType().fieldByName("elementData"));
            children.add(map("name","size","type","int","kind","scalar","value",String.valueOf(size)));
            List<Object> items=new ArrayList<>();List<String> labels=new ArrayList<>();Set<Long> seen=new HashSet<>(path);seen.add(object.uniqueID());
            for(int i=0;i<Math.min(size,8)&&nodes<100;i++){Value item=storage.getValue(i);items.add(node("["+i+"]",item,depth+1,seen));labels.add(text(item));}
            children.add(map("name","元素","type","有效元素","kind","array","size",size,"value","["+String.join(", ",labels)+(size>8?", …":"")+"]","children",items));
        }
        else if(depth<2&&nodes<100&&!path.contains(object.uniqueID())&&!type.startsWith("java.")){
            Set<Long> seen=new HashSet<>(path);seen.add(object.uniqueID());
            for(Field field:object.referenceType().allFields()){
                if(field.isStatic()||field.isSynthetic())continue;
                if(children.size()>=6||nodes>=100)break;
                Map<String,Object> fieldNode=node(field.name(),object.getValue(field),depth+1,seen);fieldNode.put("declaredType",field.typeName());children.add(fieldNode);
            }
        }
        target.put("children",children);result.put("children",List.of(target));return result;
    }
    private static boolean ours(Location location) {
        try{return location.sourceName().equals("Main.java")&&location.lineNumber()>0;}catch(AbsentInformationException error){return false;}
    }
    private static String output() {
        try(InputStream stream=Files.newInputStream(Path.of("/work/java-trace.stdout"))){return new String(stream.readNBytes(64000),StandardCharsets.UTF_8);}catch(IOException error){return "";}
    }
    private static Map<String,Object> frame(StackFrame frame) {
        Location location=frame.location();List<Object> data=new ArrayList<>();Map<String,Object> values=new LinkedHashMap<>();
        try {
            if(frame.thisObject()!=null)data.add(node("this",frame.thisObject(),0,new HashSet<>()));
            for(LocalVariable local:frame.visibleVariables()){
                if(data.size()>=8||nodes>=100)break;
                if(local.name().equals("args"))continue;
                Value value=frame.getValue(local);
                // 不展开标准输入读取器的JDK内部状态，让画面聚焦学生的变量。
                if(value instanceof ObjectReference object&&object.referenceType().name().equals("java.util.Scanner"))continue;
                Map<String,Object> localNode=node(local.name(),value,0,new HashSet<>());localNode.put("declaredType",local.typeName());data.add(localNode);
            }
        }catch(AbsentInformationException ignored){/* 未提供调试元数据时不编造变量。 */}
        for(ReferenceType type:userTypes){
            List<Object> shared=new ArrayList<>();
            for(Field field:type.fields())if(field.isStatic()&&!field.isSynthetic()&&shared.size()<6&&nodes<100)shared.add(node(field.name(),type.getValue(field),0,new HashSet<>()));
            if(!shared.isEmpty()&&data.size()<10)data.add(map("name",type.name()+"（类成员）","type",type.name()+" static","kind","object","address","class:"+type.name(),"value","类共享","children",shared));
        }
        for(Object item:data){Map<?,?> n=(Map<?,?>)item;values.put((String)n.get("name"),n.get("value"));}
        return map("name",location.declaringType().name()+"."+location.method().name(),"line",location.lineNumber(),"values",values,"data",data);
    }
    private static void capture(LocatableEvent event,String kind) throws IncompatibleThreadStateException {
        if(truncated)return;
        if(!ours(event.location())){
            if(!(event instanceof ExceptionEvent error))return;
            // 库内部自行处理的异常不当作学生异常；只映射会传播给学生处理器的调用行。
            if(error.catchLocation()!=null&&!ours(error.catchLocation()))return;
        }
        nodes=0;List<Map<String,Object>> frames=new ArrayList<>();
        for(StackFrame frame:event.thread().frames())if(ours(frame.location())&&frames.size()<5)frames.add(frame(frame));
        if(frames.isEmpty())return;
        Map<String,Object> first=frames.get(0),step=map("line",ours(event.location())?event.location().lineNumber():first.get("line"),"event",kind,"scope",first.get("name"),"values",first.get("values"),"data",first.get("data"),"frames",frames,"stack",frames.stream().map(f->f.get("name")).toList(),"output",output());
        if(event instanceof MethodExitEvent exit&&event.virtualMachine().canGetMethodReturnValues()){
            step.put("returned",text(exit.returnValue()));
            if(exit.returnValue() instanceof ObjectReference object)step.put("returnTarget",id(object));
        }
        if(event instanceof ExceptionEvent exception)step.put("returned",exception.exception().referenceType().name());
        int size=json(step).getBytes(StandardCharsets.UTF_8).length;
        if(steps.size()>=MAX_STEPS||bytes+size>MAX_BYTES){
            truncated=true;for(EventRequest request:sampling)request.disable();return;
        }
        bytes+=size;steps.add(step);
    }
    private static void drain(InputStream stream) {
        Thread thread=new Thread(()->{try{stream.transferTo(OutputStream.nullOutputStream());}catch(IOException ignored){}});
        thread.setDaemon(true);thread.start();
    }
    public static void main(String[] args) {
        VirtualMachine vm=null;Process process=null;
        try {
            LaunchingConnector connector=Bootstrap.virtualMachineManager().defaultConnector();
            Map<String,Connector.Argument> arguments=connector.defaultArguments();
            arguments.get("main").setValue("TraceEntry");
            arguments.get("options").setValue("-Xms8m -Xmx64m -Xss256k -XX:+UseSerialGC -XX:ActiveProcessorCount=1 -XX:MaxMetaspaceSize=64m -XX:ReservedCodeCacheSize=32m -XX:CompressedClassSpaceSize=16m -XX:-UsePerfData -Djava.io.tmpdir=/work -Dfile.encoding=UTF-8 -cp /work:/opt/codewise/java");
            arguments.get("suspend").setValue("true");vm=connector.launch(arguments);process=vm.process();
            drain(process.getInputStream());drain(process.getErrorStream());
            process.getOutputStream().write(Files.readAllBytes(Path.of("/work/trace-input")));process.getOutputStream().close();
            EventRequestManager manager=vm.eventRequestManager();
            ClassPrepareRequest prepare=manager.createClassPrepareRequest();
            prepare.addSourceNameFilter("Main.java");prepare.setSuspendPolicy(EventRequest.SUSPEND_ALL);prepare.enable();sampling.add(prepare);
            ExceptionRequest exception=manager.createExceptionRequest(null,true,true);exception.setSuspendPolicy(EventRequest.SUSPEND_ALL);exception.enable();sampling.add(exception);
            long deadline=System.currentTimeMillis()+8500;boolean finished=false;int classes=0;
            while(!finished&&System.currentTimeMillis()<deadline){
                EventSet events=vm.eventQueue().remove(500);if(events==null)continue;
                for(Event event:events){
                    if(event instanceof ClassPrepareEvent ready){
                        if(++classes>16){truncated=true;continue;}
                        ReferenceType type=ready.referenceType();
                        userTypes.add(type);
                        Set<String> installed=new HashSet<>();
                        try{for(Location location:type.allLineLocations()){
                            String key=location.method().name()+location.method().signature()+":"+location.codeIndex();
                            if(!installed.add(key))continue;
                            BreakpointRequest point=manager.createBreakpointRequest(location);point.setSuspendPolicy(EventRequest.SUSPEND_ALL);point.enable();sampling.add(point);
                        }}catch(AbsentInformationException ignored){}
                        MethodExitRequest exit=manager.createMethodExitRequest();exit.addClassFilter(type);exit.setSuspendPolicy(EventRequest.SUSPEND_ALL);exit.enable();sampling.add(exit);
                    }else if(event instanceof BreakpointEvent point)capture(point,"line");
                    else if(event instanceof MethodExitEvent exit)capture(exit,"return");
                    else if(event instanceof ExceptionEvent error)capture(error,"exception");
                    else if(event instanceof VMDeathEvent||event instanceof VMDisconnectEvent)finished=true;
                }
                try{events.resume();}catch(VMDisconnectedException ignored){finished=true;}
            }
            if(!finished){truncated=true;try{vm.exit(0);}catch(VMDisconnectedException ignored){}}
            System.out.println(json(map("status",steps.isEmpty()?"unavailable":"available","steps",steps,"truncated",truncated,"finalOutput",output(),"provenance","java-jdi-repeat","notice","JDI使用同一份源码与输入另行执行。状态在可停靠源码行执行前采集；一行多条语句可能合并。对象标识只属于本次运行。")));
        }catch(Exception error){
            System.out.println(json(map("status","unavailable","steps",List.of(),"reason","本次Java回放未完成，普通运行结果仍然保留。")));
        }finally{
            if(process!=null&&process.isAlive())process.destroyForcibly();
            if(vm!=null)try{vm.dispose();}catch(Exception ignored){}
        }
    }
    private static String json(Object value) {
        if(value==null)return "null";
        if(value instanceof String string){StringBuilder out=new StringBuilder("\"");for(char c:string.toCharArray()){switch(c){case '"'->out.append("\\\"");case '\\'->out.append("\\\\");case '\n'->out.append("\\n");case '\r'->out.append("\\r");case '\t'->out.append("\\t");default->{if(c<32)out.append(String.format("\\u%04x",(int)c));else out.append(c);}}}return out.append('"').toString();}
        if(value instanceof Map<?,?> map){List<String> parts=new ArrayList<>();map.forEach((k,v)->parts.add(json(k.toString())+":"+json(v)));return "{"+String.join(",",parts)+"}";}
        if(value instanceof Collection<?> collection)return "["+String.join(",",collection.stream().map(TraceMain::json).toList())+"]";
        return value.toString();
    }
}
