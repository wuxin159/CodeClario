type ScreenshotDraft = { question: string; file?: File };
const drafts = new Map<string, ScreenshotDraft>();
const prefix = "codeclario:image-draft:";
const keyFor = (userId:string, lessonId:string) => `${prefix}${userId}:${lessonId}`;

export function readScreenshotDraft(userId:string, lessonId:string):ScreenshotDraft {
  const key=keyFor(userId,lessonId), cached=drafts.get(key);
  if(cached)return cached;
  try { return {question:sessionStorage.getItem(key)??""}; } catch { return {question:""}; }
}
export function saveScreenshotDraft(userId:string, lessonId:string, draft:ScreenshotDraft) {
  const key=keyFor(userId,lessonId);
  // 图片只在当前页面进程中保留，避免把私人截图写入持久存储；关闭面板不等于丢弃草稿。
  drafts.delete(key);
  if(draft.question||draft.file)drafts.set(key,draft);
  while(drafts.size>6)drafts.delete(drafts.keys().next().value!);
  try { if(draft.question)sessionStorage.setItem(key,draft.question);else sessionStorage.removeItem(key); } catch { /* 存储不可用时保留内存草稿。 */ }
}
export function clearScreenshotDrafts(userId:string) {
  const accountPrefix=`${prefix}${userId}:`;
  for(const key of drafts.keys())if(key.startsWith(accountPrefix))drafts.delete(key);
  try { for(const key of Object.keys(sessionStorage))if(key.startsWith(accountPrefix))sessionStorage.removeItem(key); } catch { /* 退出账户始终可以继续。 */ }
}
