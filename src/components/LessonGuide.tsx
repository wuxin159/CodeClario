import {ArrowRight} from "lucide-react";
import type {Lesson} from "../../shared/curriculum";
import {lessonIntroduction} from "../../shared/lessonIntroduction";

export default function LessonGuide({lesson,mode,hasReplay=false,replayNote,onPractice,onObserve}:{
  lesson:Lesson;mode:"visual"|"code"|"replay"|"experiment";hasReplay?:boolean;replayNote?:string;onPractice:()=>void;onObserve:()=>void;
}) {
  const intro=lessonIntroduction(lesson);
  const title=mode==="visual"?"先理解这个过程":mode==="code"?(lesson.practiceLevel==="independent"?"从空白组织程序":lesson.practiceLevel==="partial"?"补全关键步骤":"现在动手练习"):mode==="replay"?(hasReplay?"对照自己的执行过程":"回放状态"):"试一个变化";
  const text=mode==="visual"?intro.firstStep:mode==="code"?lesson.task:mode==="replay"?(hasReplay?"这是你自己的代码和输入产生的回放。逐步观察变量，再和最终输出对照。":replayNote??"本次还没有可用执行轨迹。先检查运行结果，也可以回到课程示例理解知识点。" ):"这里的代码与主练习分开；只改一处，观察它带来的影响。";
  return <section className="lesson-guide" aria-label="当前学习引导">
    <div><b>{title}</b><p>{text}</p></div>
    {mode==="visual"?<button onClick={onPractice}>进入练习<ArrowRight size={15}/></button>:mode==="code"?<button onClick={onObserve}>回看演示</button>:mode==="replay"&&!hasReplay?<button onClick={onObserve}>看课程演示</button>:null}
  </section>;
}
