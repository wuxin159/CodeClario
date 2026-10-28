"""Bounded observations of a student's Python execution inside the runner container."""
import ast
import io
import json
import sys
import traceback

class BoundedOutput(io.StringIO):
    def __init__(self):
        super().__init__()
        self.byte_count = 0
    def write(self, value):
        size = len(value.encode('utf-8'))
        if self.byte_count + size > 64000:
            raise RuntimeError('输出超过限制')
        self.byte_count += size
        return super().write(value)

def supported(source):
    try:
        tree = ast.parse(source, filename='main.py')
    except SyntaxError:
        return False, '代码存在语法错误，未采集执行回放。'
    forbidden = (ast.Import, ast.ImportFrom, ast.ClassDef, ast.AsyncFunctionDef,
                 ast.Await, ast.Yield, ast.YieldFrom, ast.With, ast.AsyncWith,
                 ast.Global, ast.Nonlocal, ast.Lambda)
    for node in ast.walk(tree):
        if isinstance(node, forbidden):
            return False, '当前回放支持基础语句、条件、循环、容器与普通函数；此程序包含尚未支持的语法。'
        if isinstance(node, ast.Name) and (node.id.startswith('__') or node.id in ('exec','eval','compile','open','globals','locals','vars','getattr','setattr','breakpoint','exit','quit')):
            return False, '当前回放不支持动态执行、反射或文件操作；普通运行仍可使用。'
        if isinstance(node, ast.Attribute) and node.attr.startswith('_'):
            return False, '当前回放不支持访问内部属性。'
    return True, ''

def observe(source):
    ok, reason = supported(source)
    if not ok:
        return None, reason
    output, errors = BoundedOutput(), BoundedOutput()
    steps, truncated = [], False
    def value_text(value, depth=0):
        kind = type(value)
        if kind in (int, float, bool, str, type(None)):
            text = repr(value)
            return text[:90] + ('…' if len(text) > 90 else '')
        if depth < 2 and kind in (list, tuple, set):
            values = list(value)[:8]
            return ('[' if kind is list else '(' if kind is tuple else '{') + ', '.join(value_text(v, depth+1) for v in values) + (', …' if len(value)>8 else '') + (']' if kind is list else ')' if kind is tuple else '}')
        if depth < 2 and kind is dict:
            return '{' + ', '.join(value_text(k,depth+1)+': '+value_text(v,depth+1) for k,v in list(value.items())[:6]) + (', …' if len(value)>6 else '') + '}'
        return '<' + kind.__name__[:30] + '>'
    def trace(frame, event, arg):
        nonlocal truncated
        if frame.f_code.co_filename != 'main.py':
            return trace
        if event not in ('line','return','exception'):
            return trace
        if len(steps) >= 80:
            truncated = True
            return trace
        frames, f = [], frame
        while f is not None and len(frames) < 5:
            if f.f_code.co_filename == 'main.py':
                frames.append(f.f_code.co_name)
            f = f.f_back
        values = {k: value_text(v) for k,v in list(frame.f_locals.items()) if not k.startswith('_') and type(v).__name__ not in ('function','module','type')}
        values = dict(list(values.items())[:8])
        if event == 'return' and frame.f_code.co_name != '<module>':
            values['返回值'] = value_text(arg)
        steps.append({'line':frame.f_lineno,'event':event,'scope':frame.f_code.co_name,
                      'values':values,'stack':list(reversed(frames)), 'output':output.getvalue()[:800]})
        return trace
    previous_out, previous_err = sys.stdout, sys.stderr
    status = 0
    try:
        sys.stdout, sys.stderr = output, errors
        namespace = {'__name__':'__main__','__file__':'main.py'}
        sys.settrace(trace)
        exec(compile(source,'main.py','exec'),namespace,namespace)
    except BaseException:
        sys.settrace(None)
        status = 1
        traceback.print_exc(file=errors)
    finally:
        sys.settrace(None)
        sys.stdout, sys.stderr = previous_out, previous_err
    # Bound the complete JSON envelope, including escaped Unicode/output.
    result = {'stdout':output.getvalue(),'stderr':errors.getvalue()[:8000],'exitCode':status,
              'trace':{'status':'available','truncated':truncated,'steps':steps}}
    while steps and len(json.dumps(result,ensure_ascii=False).encode()) > 180000:
        steps.pop(); result['trace']['truncated']=True
    return result, ''

if __name__ == '__main__':
    with open('main.py',encoding='utf-8') as file:
        source=file.read()
    data, reason = observe(source)
    if data is None:
        print(json.dumps({'unsupported':reason},ensure_ascii=False))
    else:
        print(json.dumps(data,ensure_ascii=False))
