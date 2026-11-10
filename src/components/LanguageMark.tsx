import type {Language} from "../../shared/curriculum";

const labels:Record<Language,string>={c:"C",cpp:"C++",python:"Python",java:"Java Duke"};
// 保持原始标识配色，用统一容器约束尺寸；不再用字体或CSS拼出近似图标。
export default function LanguageMark({language,small=false}:{language:Language;small?:boolean}) {
 return <span className={`language-mark language-logo ${language} ${small?'small':''}`}>
   <img src={`/languages/${language}.svg`} width={48} height={48} alt={`${labels[language]}标识`} draggable={false}/>
 </span>;
}
