import java.io.*;
import java.nio.charset.StandardCharsets;
import java.lang.reflect.InvocationTargetException;

/** 回放执行的启动包装；学生源码保持原样，输出先落盘以绑定到每次真正停靠。 */
public class TraceEntry {
    public static void main(String[] args) throws Throwable {
        System.setOut(new PrintStream(new FileOutputStream("/work/java-trace.stdout"), true, StandardCharsets.UTF_8));
        System.setErr(new PrintStream(new FileOutputStream("/work/java-trace.stderr"), true, StandardCharsets.UTF_8));
        try {
            Class.forName("Main").getMethod("main", String[].class).invoke(null, (Object) new String[0]);
        } catch (InvocationTargetException error) {
            throw error.getCause();
        }
    }
}
