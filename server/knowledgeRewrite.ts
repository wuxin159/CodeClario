import {createHash} from "node:crypto";
import type {Language} from "../shared/curriculum.ts";
import {aiConfig} from "./ai.ts";
import {fetchAI,parseAIJSON} from "./aiTransport.ts";
import {searchKnowledgeDetailed,knowledgeVersion} from "./knowledge.ts";
import {conceptCards} from "./knowledgeCards.ts";
import {assertNoCredentials,untrustedMaterialPolicy} from "./aiSafety.ts";

const cache=new Map<string,{query:string;expires:number}>();
export async function retrieveKnowledge({query,language,userId,signal,lessonTitle=""}:{query:string;language:Language;userId:string;signal:AbortSignal;lessonTitle?:string}) {
  const original=query.trim().slice(0,800),initial=searchKnowledgeDetailed(original,language),config=aiConfig(userId);
  if(initial.concepts.length||original.length<8||!/[?？]|为什么|怎么|不懂|区别|什么意思/.test(original)||!config.key)return {...initial,rewritten:false};
  assertNoCredentials(original);
  const key=createHash("sha256").update([userId,config.model,knowledgeVersion,language,lessonTitle,original].join("\0")).digest("hex");
  const saved=cache.get(key);let expanded=saved&&saved.expires>Date.now()?saved.query:undefined;
  if(!expanded)try {
    const response=await fetchAI(config.base+"/chat/completions",{method:"POST",headers:{Authorization:`Bearer ${config.key}`,"Content-Type":"application/json"},body:JSON.stringify({model:config.model,thinking:{type:"disabled"},max_tokens:160,response_format:{type:"json_object"},messages:[{role:"system",content:`把初学者的问题改写为课程检索词，不回答问题、不生成代码。保留语言和关键标识符，最多80字。${untrustedMaterialPolicy}返回JSON:{query:string}。可参考的概念：${conceptCards.filter(c=>c.languages.includes(language)).map(c=>c.title).join("、")}`},{role:"user",content:JSON.stringify({language,currentLesson:lessonTitle,question:original})}]}),signal:AbortSignal.any([signal,AbortSignal.timeout(6500)])});
    if(response.ok){const body=await response.json() as any,value=parseAIJSON(body.choices?.[0]?.message?.content);if(typeof value.query==="string"&&value.query.trim()&&value.query.length<=160){assertNoCredentials(value.query);const rewritten=value.query.trim();expanded=rewritten;if(cache.size>=128)cache.delete(cache.keys().next().value!);cache.set(key,{query:rewritten,expires:Date.now()+10*60*1000});}}
  }catch{if(signal.aborted)throw signal.reason;/* 查询改写不可用时保留确定性的本地检索。 */}
  if(!expanded)return {...initial,rewritten:false};
  return {...searchKnowledgeDetailed(original+" "+expanded,language),rewritten:true};
}
