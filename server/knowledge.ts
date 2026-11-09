import {lessons,type Language} from "../shared/curriculum.ts";
import {teachingPlan} from "../shared/teaching.ts";
import {lessonIntroduction} from "../shared/lessonIntroduction.ts";
import {conceptCards} from "./knowledgeCards.ts";

export const knowledgeVersion="course-kb-20261109-v2";
export type KnowledgeHit={id:string;lessonId:string;title:string;excerpt:string;score:number;kind:"lesson"|"concept";concepts:string[]};
const stop=new Set(["代码","当前","学生","问题","运行","结果","什么","一个","为什么","怎么","这个","那个","应该","可以","需要","理解"]);
export function knowledgeTokens(text:string) {
  const value=text.toLowerCase(),words:string[]=value.match(/[a-z_][a-z_0-9+]*|<=|>=|==|!=|\+\+|->/g)??[];
  for(const group of value.match(/[\u4e00-\u9fff]+/g)??[])for(let i=0;i<group.length-1;i++)words.push(group.slice(i,i+2));
  // 单字母变量名在许多课程重复出现，不能比真正的概念术语更重要。
  return words.filter(t=>!stop.has(t)&&!(/^[a-z]$/.test(t)));
}
export function knowledgeCorpus(language:Language):KnowledgeHit[] {
  const course=lessons.filter(l=>l.language===language).flatMap(lesson=>[
    ...teachingPlan(lesson).sections.map((section,i)=>({id:`${lesson.id}/intro-v3/${i}`,lessonId:lesson.id,title:`${lesson.title} · ${section.title}`,excerpt:section.text,score:0,kind:"lesson" as const,concepts:lesson.concepts})),
    {id:`${lesson.id}/purpose-v1`,lessonId:lesson.id,title:`${lesson.title} · 学习用途`,excerpt:`${lessonIntroduction(lesson).why} 目标：${lessonIntroduction(lesson).goal}`,score:0,kind:"lesson" as const,concepts:lesson.concepts},
  ]);
  return [...course,...conceptCards.filter(c=>c.languages.includes(language)).map(c=>({id:`${language}/concept-v1/${c.key}`,lessonId:`${language}-${c.lessonNumber}`,title:c.title,excerpt:c.text,score:0,kind:"concept" as const,concepts:[c.key,...c.aliases]}))];
}
const indexes=new Map<Language,{docs:KnowledgeHit[];terms:Map<string,number>[];df:Map<string,number>;lengths:number[];average:number}>();
function index(language:Language) {
  if(indexes.has(language))return indexes.get(language)!;
  const docs=knowledgeCorpus(language),df=new Map<string,number>();
  const terms=docs.map(d=>{const tf=new Map<string,number>();for(const token of knowledgeTokens(d.title+" "+d.title+" "+d.excerpt))tf.set(token,(tf.get(token)??0)+1);for(const t of tf.keys())df.set(t,(df.get(t)??0)+1);return tf;});
  const lengths=terms.map(tf=>[...tf.values()].reduce((a,b)=>a+b,0)),average=lengths.reduce((a,b)=>a+b,0)/docs.length;
  const result={docs,terms,df,lengths,average};indexes.set(language,result);return result;
}
export function searchKnowledgeDetailed(query:string,language:Language,limit=3,mode:"hybrid"|"lexical"="hybrid") {
  const normalized=query.toLowerCase().slice(0,1000),idx=index(language),tokens=[...new Set(knowledgeTokens(normalized))];
  const codeConcepts=new Set<string>();
  if(language==="python"&&/\.copy\s*\(/.test(normalized)&&/\]\s*\[/.test(normalized))codeConcepts.add("python-shallow");
  if(language==="python"&&/\[[^\]\n]{0,20}:[^\]\n]{0,20}\]/.test(normalized))codeConcepts.add("slice-stop");
  if(language==="cpp"&&/\b(vector|reserve|capacity|push_back)\b/.test(normalized))codeConcepts.add("vector-size");
  const concepts=conceptCards.filter(c=>c.languages.includes(language)&&(codeConcepts.has(c.key)||c.aliases.some(a=>normalized.includes(a.toLowerCase()))));
  const lexical=idx.docs.map((doc,i)=>({doc,rankScore:tokens.reduce((sum,t)=>{const tf=idx.terms[i].get(t)??0;if(!tf)return sum;const idf=Math.log(1+(idx.docs.length-(idx.df.get(t)??0)+.5)/((idx.df.get(t)??0)+.5));return sum+idf*tf*2.2/(tf+1.2*(.25+.75*idx.lengths[i]/idx.average));},0)})).filter(x=>x.rankScore>0).sort((a,b)=>b.rankScore-a.rankScore||a.doc.id.localeCompare(b.doc.id)).slice(0,18);
  // 概念同义表达形成第二路候选，和BM25按排名融合；它不是向量模型或掌握概率。
  const semantic=mode==="lexical"?[]:idx.docs.map(doc=>({doc,rankScore:concepts.reduce((n,c)=>n+(doc.id.endsWith('/'+c.key)?4:doc.lessonId===`${language}-${c.lessonNumber}`?1:0),0)})).filter(x=>x.rankScore>0).sort((a,b)=>b.rankScore-a.rankScore||a.doc.id.localeCompare(b.doc.id)).slice(0,12);
  const merged=new Map<string,KnowledgeHit>();
  for(const [list,weight] of [[lexical,1],[semantic,1.15]] as const)list.forEach((item,i)=>{const current=merged.get(item.doc.id)??{...item.doc,score:0};current.score+=weight/(50+i+1);merged.set(item.doc.id,current);});
  const counts=new Map<string,number>(),hits:KnowledgeHit[]=[];
  for(const hit of [...merged.values()].sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id))){if((counts.get(hit.lessonId)??0)>=2)continue;hits.push(hit);counts.set(hit.lessonId,(counts.get(hit.lessonId)??0)+1);if(hits.length>=Math.max(1,Math.min(6,limit)))break;}
  return {hits,version:knowledgeVersion,concepts:concepts.map(c=>c.key),strategy:"bm25+concept-expansion+rrf"};
}
export function searchKnowledge(query:string,language:Language) { return searchKnowledgeDetailed(query,language).hits; }
