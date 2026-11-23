const fs = require("node:fs");
const vm = require("node:vm");
const assert = require("node:assert/strict");

const html = fs.readFileSync("index.html", "utf8");
const scripts = [...html.matchAll(/<script>([\\s\\S]*?)<\\/script>/g)].map(x => x[1]);
assert.ok(scripts.length, "index.html precisa conter script");
for (const source of scripts) new Function(source);

assert.match(html, /id="ma1on" type="checkbox" checked/, "EMA 9 deve iniciar ativada");
assert.match(html, /id="ma1tf"[\\s\\S]*?<option value="chart" selected>/, "EMA 9 deve iniciar no timeframe do gráfico");
assert.match(html, /if\\(period==="1W"\\)\\{let weekly=await fetchB3Raw\\("1wk","10y"\\)/, "gráfico semanal deve pedir candles semanais nativos");
assert.match(html, /if\\(tf==="1W"\\)return fetchB3Raw\\("1wk","10y"\\)/, "média semanal deve usar a mesma granularidade semanal");
assert.match(html, /let key="data-v3:"/, "cache deve invalidar dados da versão anterior");

function section(start, end) {
  const a = html.indexOf(start);
  assert.notEqual(a, -1, "função ausente: " + start);
  const b = html.indexOf(end, a);
  assert.notEqual(b, -1, "fim da seção ausente: " + end);
  return html.slice(a, b);
}

const ctx = vm.createContext({ bars: [], period: "1H", Date, Map, Math });
vm.runInContext(section("function ema(", "function boll("), ctx);
vm.runInContext(section("function aggregateCalendarWeeks(", "function projectAverage("), ctx);
vm.runInContext(section("function projectAverage(", "const candleCache"), ctx);

const daily = [];
const monday = Date.UTC(2024, 0, 1) / 1000;
for (let week = 0; week < 4; week++) {
  for (let day = 0; day < 5; day++) {
    const close = 100 + week * 10 + day;
    daily.push({ time: monday + (week * 7 + day) * 86400, open: close - 1, high: close + 2, low: close - 2, close, volume: 1000 });
  }
}
const weekly = vm.runInContext("aggregateCalendarWeeks(" + JSON.stringify(daily) + ")", ctx);
assert.equal(weekly.length, 4, "20 pregões devem formar 4 candles semanais");
assert.equal(weekly[0].open, daily[0].open);
assert.equal(weekly[0].close, daily[4].close);
assert.equal(weekly[0].volume, 5000);
assert.equal(Math.round((weekly[1].time - weekly[0].time) / 86400), 7);

ctx.bars = weekly;
ctx.period = "1W";
const projected = vm.runInContext('projectAverage(weekly, 2, "EMA", "1W")', vm.createContext({ ...ctx, weekly }));
assert.equal(projected.length, weekly.length - 1, "EMA 2 deve ter pontos nos candles semanais a partir do segundo");
assert.equal(projected.at(-1).time, weekly.at(-1).time, "EMA semanal deve alinhar com o candle semanal correspondente");

console.log("PASS: sintaxe JavaScript, padrão EMA 9, fonte semanal nativa, cache versionado, agregação semanal e alinhamento da média.");
