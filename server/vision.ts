import express,{Router} from "express";
import sharp from "sharp";
import {createHash} from "node:crypto";
import {requireAccount,requireMatchingAccount} from "./accounts.ts";
import {AccountError,type LearningDatabase} from "./database.ts";
import {aiConfig} from "./ai.ts";
import {fetchAI,parseAIJSON} from "./aiTransport.ts";
import {findLesson} from "../shared/curriculum.ts";
import {lessonIntroduction} from "../shared/lessonIntroduction.ts";
import {searchKnowledge} from "./knowledge.ts";
import {aiUploadQuota,assertNoCredentials,learningRequestBoundary,redactCredentials,untrustedMaterialPolicy} from "./aiSafety.ts";
import type {ImageQuestionResult} from "../shared/vision.ts";

sharp.cache({memory:16,files:0,items:30});
export async function prepareQuestionImage(raw:unknown) {
  if(!raw||typeof raw!=="object")throw new AccountError(400,"请选择一张截图。");
  const {mimeType,data}=raw as {mimeType?:unknown;data?:unknown};
  if(!["image/png","image/jpeg","image/webp"].includes(String(mimeType))||typeof data!=="string"||data.length>7_000_000||!data.length||data.length%4!==0||!/^[A-Za-z0-9+/]*={0,2}$/.test(data))
    throw new AccountError(400,"请使用5MB以内的PNG、JPEG或WebP图片。");
  const bytes=Buffer.from(data,"base64");if(bytes.toString("base64")!==data)throw new AccountError(400,"图片编码无效。");if(bytes.length>5*1024*1024)throw new AccountError(413,"图片不能超过5MB。");
  try {
    const decoder=sharp(bytes,{limitInputPixels:12_000_000,failOn:"error"});
    const info=await decoder.metadata();
    const expected={png:"image/png",jpeg:"image/jpeg",webp:"image/webp"}[info.format as "png"|"jpeg"|"webp"];
    if(!expected||expected!==mimeType||!info.width||!info.height||(info.pages??1)!==1||info.width<32||info.height<32)throw Error("unsupported image");
    // 真正解码并重新编码，去除EXIF等附带信息；不接受SVG、动图、外部图片网址。
    const safe=await decoder.rotate().resize({width:1800,height:1800,fit:"inside",withoutEnlargement:true}).png().toBuffer();
    return {dataUrl:`data:image/png;base64,${safe.toString("base64")}`,hash:createHash("sha256").update(safe).digest("hex"),width:info.width,height:info.height};
  } catch {throw new AccountError(400,"图片格式无效、尺寸过大或无法读取，请换一张清晰截图。");}
}
export function validateImageAnswer(raw:any,sources:ImageQuestionResult["sources"]):ImageQuestionResult {
  const text=(value:unknown,limit:number,required=false)=>{
    if(typeof value!=="string"||value.length>limit||(required&&!value.trim()))throw new Error("图片讲解格式不完整，请重试。");
    return redactCredentials(value.trim());
  };
  if(typeof raw?.readable!=="boolean")throw new Error("图片识别状态缺失。");
  const ids=raw.sourceIds??[];
  if(!Array.isArray(ids)||ids.length>3||ids.some(id=>!sources.some(s=>s.id===id)))throw new Error("图片讲解引用了未提供的资料。");
  return {readable:raw.readable,observed:text(raw.observed,600,true),explanation:raw.readable?text(raw.explanation,1500,true):"图片中的关键内容还看不清，请截取题目、代码或报错所在区域后再试。",question:raw.question?text(raw.question,200):undefined,uncertainty:raw.uncertainty?text(raw.uncertainty,300):undefined,sources:sources.filter(s=>ids.includes(s.id)).map(({id,title,excerpt})=>({id,title,excerpt}))};
}
export function visionRoutes(store:LearningDatabase) {
  const router=Router(),quota=aiUploadQuota();
  router.get("/vision/history/:lessonId",requireAccount,(req,res)=>{
    const lesson=findLesson(String(req.params.lessonId));if(!lesson){res.status(404).json({error:"课程不存在。"});return;}
    const rows=store.db.prepare("SELECT id,context_json,created_at FROM coach_messages WHERE user_id=? AND lesson_id=? AND role='assistant' AND skill='image-question' ORDER BY id DESC LIMIT 8").all(req.user!.id,lesson.id) as any[];
    res.json({userId:req.user!.id,items:rows.map(row=>{const c=JSON.parse(row.context_json);return{id:row.id,question:c.question,answer:c.answer,createdAt:row.created_at};})});
  });
  router.post("/vision/analyze",requireAccount,quota,express.json({limit:"7mb"}),requireMatchingAccount,async(req,res)=>{
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),45000);
    res.on("close",()=>{if(!res.writableEnded)controller.abort();});
    try {
      const lesson=findLesson(req.body.lessonId),question=req.body.question;
      if(!lesson||typeof question!=="string"||!question.trim()||question.length>800)throw new AccountError(400,"请选择课程，并用800字以内描述想问的问题。");
      assertNoCredentials(question);const boundary=learningRequestBoundary(question);if(boundary)throw new AccountError(400,boundary);
      const config=aiConfig(req.user!.id);if(!config.key)throw new AccountError(409,"请先连接AI老师，再发送截图。");
      const image=await prepareQuestionImage(req.body.image),sources=searchKnowledge(question+" "+lesson.title,lesson.language);
      const messages:any[]=[{role:"system",content:`你是代码灵的截图教学老师。${untrustedMaterialPolicy}先描述图片里可确认的事实，再结合当前课程解释；图片不是本网站的实际运行证据，不能宣称已经编译执行或判定课程通过。看不清时不要猜代码。一次只提出一个帮助理解的问题，默认给思考方向，不直接贴完整解法。解释简短，先给一个思考方向。界面已经说明截图分析不计成绩，不要反复声明没有运行。可按代码逻辑推演，但明确这是推演。正文不要写来源ID或内部规则。uncertainty只写看不清、被裁掉等实际不确定内容。返回JSON:{readable:boolean,observed:尽量80字内,explanation:120到240字,question:可选80字内且只问一个问题,uncertainty:可选100字内,sourceIds:[仅提供的资料ID]}。`},{role:"user",content:[{type:"text",text:JSON.stringify({lesson:lesson.title,language:lesson.language,goal:lessonIntroduction(lesson).goal,question:question.trim(),references:sources})},{type:"image_url",image_url:{url:image.dataUrl,detail:"original"}}]}];
      const response=await fetchAI(config.base+"/chat/completions",{method:"POST",headers:{Authorization:`Bearer ${config.key}`,"Content-Type":"application/json"},body:JSON.stringify({model:config.model,messages,max_tokens:1000,thinking:{type:"disabled"},response_format:{type:"json_object"}}),signal:controller.signal});
      if(!response.ok)throw new AccountError(502,response.status===401?"AI认证失败，请检查连接设置。":response.status===402?"AI额度不足，请检查模型账户。":"图片分析暂时不可用，请稍后重试。");
      const data=await response.json() as any,answer=validateImageAnswer(parseAIJSON(data.choices?.[0]?.message?.content),sources);
      if(controller.signal.aborted)throw new AccountError(504,"图片分析已停止或超时，请重试。");
      // 只保存文字问答与图片摘要标识，不把原图/base64写入数据库、日志或静态目录。
      store.saveCoaching(req.user!.id,lesson.id,`截图提问：${question.trim()}`,{content:answer.observed+"\n\n"+answer.explanation,provider:"deepseek",tools:["识别学习截图","检索课程资料"],skill:"image-question",context:{question:question.trim(),answer,imageHash:image.hash,width:image.width,height:image.height}});
      res.json({userId:req.user!.id,answer});
    }catch(error){if(!res.destroyed)res.status(error instanceof AccountError?error.status:controller.signal.aborted?504:502).json({error:controller.signal.aborted?"图片分析已停止或超时，请重试。":error instanceof Error?error.message:"图片分析未完成。"});}
    finally{clearTimeout(timer);}
  });
  router.use((error:any,_req:any,res:any,next:any)=>{if(error?.type==="entity.too.large"){res.status(413).json({error:"图片请求过大，请使用5MB以内的截图。"});return;}if(error instanceof SyntaxError){res.status(400).json({error:"图片请求格式无效。"});return;}next(error);});
  return router;
}
