// 这里只识别支持的单一时长；多个不同数值不擅自取舍，复杂语言意图不在此处推断。
export function statedDailyMinutes(message: string): number | undefined {
  const values = [...message.matchAll(/(三十五|二十|十|\d+)\s*(?:分钟|minutes?\b|min\b)/gi)]
    .map((match) => ({ "十": 10, "二十": 20, "三十五": 35 }[match[1]] ?? Number(match[1])));
  const unique = [...new Set(values)];
  return unique.length === 1 && [10, 20, 35].includes(unique[0]) ? unique[0] : undefined;
}
