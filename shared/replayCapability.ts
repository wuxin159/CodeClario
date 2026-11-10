import type {Language} from "./curriculum";

export function replayLimitation(language:Language, code:string):string|undefined {
  // 只提前说明已知不支持的语法，最终是否有轨迹仍以执行器实际返回为准。
  if(language==="python" && /^\s*class\s+\w+/m.test(code))
    return "Python类代码可以运行，暂不支持实例的逐步回放。";
  if(language==="python" && /^\s*(?:import\s|from\s|async\s+def\s)/m.test(code))
    return "这段程序包含当前回放尚未支持的语法。可以运行代码，结果仍会按样例核对。";
}
