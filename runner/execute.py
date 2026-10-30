"""Single-use, container-isolated execution worker. Input and output are JSON."""
import json
import os
import resource
import signal
import subprocess
import sys
import tempfile
import time

LIMIT = 64 * 1024


def limits(file_limit=256*1024):
    resource.setrlimit(resource.RLIMIT_FSIZE, (file_limit, file_limit))
    resource.setrlimit(resource.RLIMIT_CORE, (0, 0))
    resource.setrlimit(resource.RLIMIT_CPU, (3, 3))


def execute(command, stdin="", timeout=6, output_limit=LIMIT, file_limit=256*1024):
    # 输出先落到受限临时文件再有界读取，避免学生程序把宿主进程的内存缓冲区写满。
    with tempfile.TemporaryFile() as out, tempfile.TemporaryFile() as err:
        process = subprocess.Popen(command, stdin=subprocess.PIPE, stdout=out,
                                   stderr=err, preexec_fn=lambda: limits(file_limit), start_new_session=True)
        timed_out = False
        try:
            process.communicate(stdin.encode(), timeout=timeout)
        except subprocess.TimeoutExpired:
            timed_out = True
            # 编译器可能启动子进程，超时需终止整个进程组，不能只杀掉最外层 gcc/g++。
            try:
                os.killpg(process.pid, signal.SIGKILL)
            except ProcessLookupError:
                pass
            process.communicate()
        out.seek(0)
        err.seek(0)
        return {"stdout": out.read(output_limit).decode(errors="replace"),
                "stderr": err.read(LIMIT).decode(errors="replace"),
                "exitCode": process.returncode, "timedOut": timed_out}


def interruption(result, phase):
    # 保留阶段与已知终止方式；负退出码只证明收到信号，不据此断言是内存不足。
    if result['timedOut']:
        return {'phase': phase, 'kind': 'timeout'}
    if result['exitCode'] < 0:
        return {'phase': phase, 'kind': 'terminated', 'signal': -result['exitCode']}
    return None


def main():
    request = json.load(sys.stdin)
    language, code = request["language"], request["code"]
    if language not in ("c", "cpp", "python") or len(code) > 24000:
        raise ValueError("Unsupported language or oversized source")
    start = time.monotonic()
    filename = "main.py" if language == "python" else "main." + language
    with open(filename, "w", encoding="utf-8") as source:
        source.write(code)
    compile_output = ""
    if language != "python":
        compiler = "gcc" if language == "c" else "g++"
        standard = "-std=c17" if language == "c" else "-std=c++17"
        result = execute([compiler, standard, "-Wall", "-Wextra", "-O0", "-g", filename, "-o", "/work/program"], timeout=12,file_limit=8*1024*1024)
        compile_output = result["stderr"]
        if result["exitCode"] != 0 or result["timedOut"]:
            failure = interruption(result, 'compile')
            return {**result, "status": "compile_timeout" if result['timedOut'] else "compile_terminated" if failure else "compile_error", "failure": failure, "compileOutput": compile_output,
                    "durationMs": round((time.monotonic() - start) * 1000), "trace": []}
    command = ["python3", "-I", filename] if language == "python" else ["/work/program"]
    trace = {'status':'unavailable','reason':'程序尚未正常运行完成，先检查错误；课程示例仍可查看。','steps':[]}
    result = None
    if language == 'python':
        traced = execute(['python3','-I','/opt/codewise/trace_python.py'], str(request.get('stdin','')), timeout=4, output_limit=200000)
        try:
            payload = json.loads(traced['stdout'])
            if 'unsupported' in payload:
                trace = {'status':'unsupported','reason':payload['unsupported'],'steps':[]}
            elif 'trace' in payload:
                trace = payload.pop('trace')
                result = {**payload,'timedOut':False}
        except (ValueError, KeyError):
            trace = {'status':'unavailable','reason':'本次回放未完成（可能超时或超过资源限制）。','steps':[]}
            if traced['timedOut'] or traced['exitCode'] != 0:
                result = {**traced,'stdout':''}
    if result is None:
        result = execute(command, str(request.get("stdin", "")), timeout=4)
    if language in ('c','cpp') and result['exitCode']==0 and not result['timedOut']:
        # GDB 是同源码、同输入的另一次隔离执行；只有输出一致时才提供调试状态用于观察。
        with open('/work/trace-input','w',encoding='utf-8') as f: f.write(str(request.get('stdin','')))
        env_source = os.path.abspath(filename)
        os.environ['CODECLARIO_SOURCE']=env_source
        observed=execute(['gdb','-q','-nx','-batch','-x','/opt/codewise/trace_native.py'],timeout=7)
        try:
            with open('/work/native-trace.json',encoding='utf-8') as f: trace=json.load(f)
            observed_output=trace.pop('finalOutput',trace['steps'][-1]['output'] if trace.get('steps') else '')
            if trace.get('status')=='available' and observed_output.replace('\r','') != result['stdout'].replace('\r',''):
                trace={'status':'unavailable','reason':'调试回放与普通运行输出不同，不能据此核对变量。普通运行与样例结果保留。','steps':[]}
        except (OSError,ValueError):
            trace={'status':'unavailable','reason':'本次调试回放未完成，普通运行与样例结果保留。','steps':[]}
    test_results = []
    if result["exitCode"] == 0 and not result["timedOut"]:
        # 样例逐个独立执行；函数课通过额外探针调用目标函数，避免仅检查主程序的固定输出。
        check_command = command
        check_error = ""
        if request.get("functionCheck"):
            if language == "python":
                with open("probe.py", "w", encoding="utf-8") as probe:
                    probe.write('import contextlib, io, runpy, sys\n'
                                'with contextlib.redirect_stdout(io.StringIO()):\n'
                                '    namespace = runpy.run_path("main.py", run_name="__learning_check__")\n'
                                'function = namespace.get("square")\n'
                                'if not callable(function):\n'
                                '    raise ValueError("需要定义可调用的square函数")\n'
                                'print(function(int(sys.stdin.read())))\n')
                check_command = ["python3", "-I", "probe.py"]
            else:
                probe_name = "probe." + language
                with open(probe_name, "w", encoding="utf-8") as probe:
                    probe.write('#include <stdio.h>\n#define main student_main\n'
                                '#include "' + filename + '"\n#undef main\n'
                                'int main(void) { int n; if (scanf("%d", &n) != 1) return 1; '
                                'printf("%d\\n", square(n)); return 0; }\n')
                compiled = execute([compiler, standard, "-Wall", "-Wextra", "-O0", probe_name, "-o", "/work/check"], timeout=12,file_limit=8*1024*1024)
                if compiled["exitCode"] != 0 or compiled["timedOut"]:
                    check_error = "函数检查未通过：需要定义接收整数并返回平方的square函数。\n" + compiled["stderr"][:2000]
                check_command = ["/work/check"]
        for test in request.get("tests", [])[:6]:
            test_run = execute(check_command, str(test["input"]), timeout=3) if not check_error else {"exitCode": 1, "timedOut": False, "stdout": check_error}
            test_results.append({"input": str(test["input"]), "expected": str(test["expected"]),
                                 "actual": test_run["stdout"] or test_run.get("stderr", "")[:2000],
                                 "passed": test_run["exitCode"] == 0 and not test_run["timedOut"]
                                 and test_run["stdout"].replace("\r", "").strip() == str(test["expected"]).strip()})
    result.update({"status": "timeout" if result["timedOut"] else "success" if result["exitCode"] == 0 else "runtime_error",
                   "failure": interruption(result, 'run'),
                   "compileOutput": compile_output,
                   "durationMs": round((time.monotonic() - start) * 1000), "trace": trace, "tests": test_results})
    return result


try:
    print(json.dumps(main(), ensure_ascii=False))
except Exception as error:
    print(json.dumps({"status": "error", "stderr": str(error), "stdout": "", "trace": []}))
