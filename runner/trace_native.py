"""GDB observer for a bounded, isolated replay; never evaluates inferior functions."""
import gdb
import json
import os
import pty
import select
import re

source = os.environ.get('CODECLARIO_SOURCE', '/work/main.c')
steps, seen_frames = [], set()
initialized_loops=set()
with open(source,encoding='utf-8') as f: source_lines=f.read().splitlines()
truncated = False
master, slave = pty.openpty()
os.set_blocking(master, False)
output = bytearray()

def drain():
    while len(output) < 65536:
        try:
            data = os.read(master, min(4096, 65536-len(output)))
            if not data: break
            output.extend(data)
        except OSError:
            break
    return output.decode(errors='replace').replace('\r\n', '\n')

def text(value):
    try: return value.format_string(raw=False, pretty_arrays=False, pretty_structs=False, max_elements=12)[:160]
    except Exception: return str(value)[:160]

def describe(name, value, depth=0):
    t = value.type.strip_typedefs()
    node = {'name':name, 'type':str(value.type), 'value':text(value), 'kind':'scalar'}
    try:
        if value.address is not None: node['address'] = str(value.address).split(' ')[0]
        if t.code in (gdb.TYPE_CODE_REF, gdb.TYPE_CODE_RVALUE_REF):
            target = value.referenced_value()
            node.update(kind='reference', target=str(target.address).split(' ')[0])
            if depth < 2: node['children'] = [describe('所指对象', target, depth+1)]
        elif t.code == gdb.TYPE_CODE_PTR:
            target = int(value)
            node.update(kind='pointer', target=hex(target))
            if target and depth < 2:
                try: node['children'] = [describe('*'+name, value.dereference(), depth+1)]
                except Exception: node['value'] += '（目标不可读）'
        elif t.code == gdb.TYPE_CODE_ARRAY:
            lo, hi = t.range()
            node.update(kind='array', size=hi-lo+1)
            if depth < 2: node['children'] = [describe('['+str(i)+']', value[i], depth+1) for i in range(lo,min(hi+1,lo+12))]
        elif str(t).startswith('std::vector<'):
            start=value['_M_impl']['_M_start'];end=value['_M_impl']['_M_finish'];size=int(end-start)
            node.update(kind='array',size=size,value='['+', '.join(text(start[i]) for i in range(min(size,12)))+('…' if size>12 else '')+']')
            if depth<2: node['children']=[describe('['+str(i)+']',start[i],depth+1) for i in range(min(size,12))]
        elif 'basic_string<' in str(t) or str(t)=='std::string':
            length=int(value['_M_string_length']);node['value']=json.dumps(value['_M_dataplus']['_M_p'].string(length=min(length,80)),ensure_ascii=False)
        elif t.code in (gdb.TYPE_CODE_STRUCT, gdb.TYPE_CODE_UNION):
            node['kind']='object'
            children=[]
            if depth < 2:
                for f in t.fields()[:12]:
                    if f.name and not f.is_base_class:
                        try: children.append(describe(f.name,value[f.name],depth+1))
                        except Exception: pass
            node['children']=children
    except Exception:
        node['unavailable']=True
    return node

def in_source(frame):
    try:
        sal=frame.find_sal()
        return sal.symtab and os.path.realpath(sal.symtab.fullname()) == os.path.realpath(source)
    except Exception: return False

def capture(event='line', returned=None):
    global truncated
    if len(steps)>=80 or len(json.dumps(steps,ensure_ascii=False).encode())>180000:
        truncated=True
        return
    frame=gdb.newest_frame()
    if frame is None or not in_source(frame): return
    line=frame.find_sal().line
    stack, frames=[],[]
    alive=set()
    current=frame
    while current and len(frames)<8:
        if in_source(current):
            identity=(current.name() or '',str(current.read_register('sp')))
            alive.add(identity)
            values, nodes={},[]
            try:
                block=current.block()
                while block and not block.is_global and not block.is_static:
                    for symbol in block:
                        if len(values)>=12: break
                        if (symbol.is_argument or symbol.is_variable) and symbol.name not in values:
                            try:
                                if not symbol.is_argument and symbol.line > current.find_sal().line: continue
                                value=current.read_var(symbol)
                                # A declaration's before-state is not an initialized value.
                                key=identity+(symbol.name,symbol.line)
                                if symbol.line<current.find_sal().line: initialized_loops.add(key)
                                header=source_lines[current.find_sal().line-1] if 0<current.find_sal().line<=len(source_lines) else ''
                                loop_value=bool(re.match(r'\s*for\s*\(',header)) and key in initialized_loops
                                if not symbol.is_argument and symbol.line >= current.find_sal().line and not loop_value:
                                    node={'name':symbol.name,'type':str(value.type),'kind':'scalar','value':'尚未完成声明','unavailable':True}
                                else:
                                    node=describe(symbol.name,value)
                                    fn=(current.name() or '').split('::')
                                    if event!='return' and symbol.name=='this' and len(fn)>1 and fn[-1].split('(')[0]==fn[-2]:
                                        node.pop('children',None);node['value']+='（构造中，成员初始化尚待观察）'
                                values[symbol.name]=node['value'];nodes.append(node)
                            except Exception: pass
                    block=block.superblock
            except Exception: pass
            name=current.name() or '匿名函数'
            stack.append(name);frames.append({'name':name,'line':current.find_sal().line,'values':values,'data':nodes})
        current=current.older()
    if not frames: return
    initialized_loops.intersection_update({k for k in initialized_loops if k[:2] in alive})
    step={'line':line,'event':event,'scope':frames[0]['name'],'values':frames[0]['values'],
          'data':frames[0]['data'],'frames':frames,'stack':stack[::-1],'output':drain()}
    if returned is not None:
        step['returned']=text(returned)
        if returned.type.strip_typedefs().code==gdb.TYPE_CODE_PTR: step['returnTarget']=hex(int(returned))
    if not steps or step!=steps[-1]: steps.append(step)

class Line(gdb.Breakpoint):
    def stop(self):
        capture()
        # Returning False observes source lines without executing debugger commands.
        return False

class Return(gdb.Breakpoint):
    def __init__(self,spec,return_type):
        super().__init__(spec,internal=True)
        self.return_type=return_type
    def stop(self):
        value=None
        try:
            frame=gdb.newest_frame();t=self.return_type.strip_typedefs()
            arch=frame.architecture().name()
            if 'i386' in arch:
                if t.code in (gdb.TYPE_CODE_INT,gdb.TYPE_CODE_BOOL,gdb.TYPE_CODE_ENUM,gdb.TYPE_CODE_PTR):
                    bits=int(frame.read_register('rax')) & ((1 << (int(t.sizeof)*8))-1)
                    value=gdb.Value(bits).cast(self.return_type)
                elif t.code==gdb.TYPE_CODE_FLT and t.sizeof in (4,8): value=frame.read_register('xmm0')['v4_float' if t.sizeof==4 else 'v2_double'][0]
        except Exception: pass
        capture('return',value)
        return False

try:
    gdb.execute('set pagination off')
    gdb.execute('set confirm off')
    gdb.execute('set print elements 12')
    gdb.execute('set print repeats 2')
    gdb.execute('set disable-randomization off')
    gdb.execute('file /work/program')
    table=gdb.lookup_global_symbol('main').symtab.linetable()
    entries=list(table)
    lines=sorted({entry.line for entry in entries if entry.line>0})
    if len(lines)>600: raise RuntimeError('源文件可执行行过多，保留普通运行。')
    for line in lines:
        try: Line(source+':'+str(line),internal=True)
        except Exception: pass
    functions=set()
    arch=gdb.selected_inferior().architecture()
    if 'i386' in arch.name():
        for entry in entries:
            try:
                block=gdb.block_for_pc(entry.pc)
                while block and block.function is None: block=block.superblock
                if not block or block.start in functions: continue
                functions.add(block.start)
                symbol=block.function
                if not symbol.symtab or os.path.realpath(symbol.symtab.fullname())!=os.path.realpath(source): continue
                name=symbol.print_name.replace('\\','\\\\').replace("'","\\'")
                for instruction in arch.disassemble(block.start,block.end):
                    if re.match(r'\s*ret[qwl]?\b',instruction['asm']):
                        Return("*'"+name+"'+"+str(instruction['addr']-block.start),symbol.type.target())
            except Exception: pass
    gdb.execute('run < /work/trace-input > '+os.ttyname(slave)+' 2> /work/trace-error',to_string=True)
    final_output=drain()
    if steps and len(steps)<80:
        steps.append({'line':steps[-1]['line'],'event':'return','scope':'<program>','values':{},'data':[],
                      'frames':[],'stack':[],'output':final_output})
    payload={'status':'available' if steps else 'unavailable','steps':steps,'truncated':truncated,'finalOutput':final_output,
             'provenance':'native-debug-repeat','notice':'同代码和输入的隔离调试回放，输出已核对。地址仅属于本次调试；复合语句可能在同一行多次停靠，一行多个语句时建议分行观察。'}
    if not steps: payload['reason']='未采集到本文件的可执行源码行。'
except Exception as error:
    payload={'status':'unavailable','reason':'调试采集未完成：'+str(error)[:160],'steps':[]}
with open('/work/native-trace.json','w',encoding='utf-8') as f: json.dump(payload,f,ensure_ascii=False)
