import {ArrowUpRight,Check} from "lucide-react";
import type {Lesson,RunResult} from "../../shared/curriculum";
import LanguageMark from "./LanguageMark";

/** 运行接口已持久化的结果卡；样例通过只表示练习通过，不代替理解检验。 */
export default function RunReceipt({lesson,result,archived=false,onOpen}:{lesson:Lesson;result:RunResult;archived?:boolean;onOpen:(source:HTMLElement)=>void}) {
  const passed=result.tests.filter(test=>test.passed).length;
  return <section className={`run-receipt ${archived?'is-archived':''}`} data-run-receipt={result.id} aria-label="本次通过的练习">
    <div className="receipt-copy"><span className="receipt-status"><Check size={14}/>{archived?'已记录这次练习':'练习通过'}</span><div className="receipt-title"><LanguageMark language={lesson.language} small/><strong>{lesson.title}</strong></div><span className="receipt-detail">{passed}/{result.tests.length} 个样例通过 · {archived?'可以回看当时的代码与输出':'已保存到学习记录，可继续理解检验'}</span></div>
    <div className="receipt-output"><small>本次输出</small><pre>{result.stdout.trim()||'（无标准输出）'}</pre></div>
    <button type="button" onClick={event=>onOpen(event.currentTarget.closest<HTMLElement>('.run-receipt')!)}>{archived?'查看代码与输出':'在学习记录中查看'}<ArrowUpRight size={16}/></button>
  </section>;
}
