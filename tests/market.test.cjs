const fs = require("node:fs");
const vm = require("node:vm");
const assert = require("node:assert/strict");

const html = fs.readFileSync("index.html", "utf8");
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(x => x[1]);
assert.ok(scripts.length, "index.html precisa conter script");
for (const source of scripts) new Function(source);

assert.match(html, /id="ma1on" type="checkbox" checked/, "EMA 9 deve iniciar ativada");
assert.match(html, /id="ma1tf"[\s\S]*?<option value="chart" selected>/, "EMA 9 deve iniciar no timeframe do gráfico");
assert.ok(html.includes('if(period==="1W"){let weekly=await fetchB3Raw("1wk","10y")'), "gráfico semanal deve pedir candles semanais nativos");
assert.ok(html.includes('if(tf==="1W")return fetchB3Raw("1wk","10y")'), "média semanal deve usar a mesma granularidade semanal");
assert.match(html, /let key="data-v4:"/, "cache deve invalidar dados da versão anterior");
assert.ok(html.includes('const seed=[["BTC","Bitcoin"],["ETH","Ethereum"]]'), "cripto deve conter somente BTC e ETH");
assert.ok(html.includes('"PSSA3","AXIA3","BBSE3","ITSA4","ABCB4","BBDC4","CPFE3","SBSP3","ISAE4","ALOS3","EGIE3","ALUP4","SAPR4","KLBN4","PETR4","VALE3"'), "ações devem limitar-se à carteira informada");
assert.ok(!html.includes("api.coingecko.com"), "não deve pesquisar universo externo de criptomoedas");
assert.ok(html.includes('id="fii"') && html.includes('id="etf"'), "abas de FIIs e ETFs devem permanecer disponíveis");
assert.ok(html.includes('const fiis=[["HGLG11","Patria Logística"],["BTLG11","BTG Pactual Logística"],["GGRC11","GGR Covepi Renda"],["XPML11","XP Malls"],["PMLL11","Patria Malls"],["KNUQ11","Kinea Unique HY CDI"],["MXRF11","Maxi Renda"]]'), "lista original de FIIs deve ser preservada");
assert.ok(html.includes('const etfs=[["XBCI11","ETF de crédito privado"],["LFTB11","ETF Tesouro Selic"],["FIXX11","ETF de renda fixa"],["GPUS11","ETF de ações globais"],["SPYI11","ETF S&P 500"],["MUND11","ETF global"],["GDIV11","ETF de dividendos"],["QQQI11","ETF Nasdaq 100 Income"],["TECK11","ETF tecnologia"]]'), "lista original de ETFs deve ser preservada");
assert.ok(html.includes('if(!["b3","fii","etf","crypto"].includes(which))return'), "seletor deve reconhecer as quatro categorias");
assert.ok(html.includes("localStorage.setItem(key"), "cache persistente deve reduzir consultas repetidas");

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
ctx.weekly = weekly;
const projected = vm.runInContext('projectAverage(weekly, 2, "EMA", "1W")', ctx);
assert.equal(projected.length, weekly.length - 1, "EMA 2 deve ter pontos nos candles semanais a partir do segundo");
assert.equal(projected.at(-1).time, weekly.at(-1).time, "EMA semanal deve alinhar com o candle semanal correspondente");

console.log("PASS: sintaxe JavaScript, padrão EMA 9, fonte semanal nativa, cache versionado, agregação semanal e alinhamento da média.");
