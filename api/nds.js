// НДС — свод · v9
// Структура виджета точно соответствует Excel ДДС (разделы 1–3 + НДС свод)
//
// Источник: transaction_pls, cat=3147 (доходы) + cat=3144 (расходы)
// Фильтр: name IN ("Налог 22%", "Налог 5%", "Налог 20%")
//
// ВСИП (org=1) доходы       : cat=3147, excl. crm=250 proj=27
// ВСИП трансфер ← ТТ (вход.): cat=3147, crm=250, proj=27
// ВСИП трансфер → ТТ (расх.): cat=3144, crm=250, proj=27
// ВСИП реальные расходы     : cat=3144, excl. crm=250 proj=27
//   Классификация по crm: 345,301→СМР | 836→МАТ | 296→СМР/МАТ | прочие→ПР
//
// ТТ (org=2) трансфер ← ВСИП: cat=3147, crm=837, proj=27
// ТТ (org=2) реальные доходы: cat=3147, excl. crm=837 proj=27
// ТТ трансфер → ВСИП (расх.): cat=3144, crm=837, proj=27
// ТТ реальные расходы       : cat=3144, excl. crm=837 proj=27  →  все Материалы
//
// Gross = НДС × (100+ставка)/ставка

const HTML = `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>НДС — свод</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:11px;background:#f0f4f8;padding:12px;color:#111827}
.hdr{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;padding-bottom:8px;border-bottom:2px solid #1e3a5f;flex-wrap:wrap;gap:6px}
.ttl{font-size:14px;font-weight:700;color:#1e3a5f}
.sub{font-size:10px;color:#6b7280;margin-left:8px}
.ctl{display:flex;gap:6px;align-items:center}
select{font-size:11px;border:1px solid #c3d4e8;border-radius:4px;padding:3px 8px;color:#374151;background:#fff;cursor:pointer}
#rb{background:#fff;border:1px solid #c3d4e8;color:#6b7280;font-size:11px;padding:2px 8px;border-radius:4px;cursor:pointer}
#rb:hover{background:#f0f4f8}
#st{font-size:10px;color:#d97706;white-space:nowrap}
#ct{overflow-x:auto}
.warn-box{padding:6px 10px;background:#fffbeb;border:1px solid #fde68a;border-radius:4px;font-size:10px;color:#92400e;margin-bottom:8px}
.spinner{padding:32px;text-align:center;color:#9ca3af}

/* Карточки НДС баланса */
.cards{display:flex;gap:8px;margin-top:12px;flex-wrap:wrap}
.card{flex:1;min-width:160px;border-radius:6px;padding:10px 14px;border:1px solid}

/* Таблица */
table{width:100%;border-collapse:collapse;min-width:660px;background:#fff;border:1px solid #c3d4e8;border-radius:4px;overflow:hidden}
thead th{padding:5px 10px;font-size:10px;font-weight:600;color:#fff;background:#1e3a5f;text-align:right;white-space:nowrap}
thead th.lbl{text-align:left;min-width:180px}
thead th.org{background:#2e5897;text-align:center;font-size:9px;letter-spacing:.05em;text-transform:uppercase}

/* Section header */
tr.sec td{background:#1f3864;color:#fff;font-weight:700;font-size:10px;letter-spacing:.04em;padding:4px 10px;border-top:3px solid #1f3864;text-align:left}
tr.sec.income td{background:#2e75b6}
tr.sec.transfer td{background:#375623}
tr.sec.expense td{background:#833c00}
tr.sec.nds td{background:#7030a0}

/* Data rows */
td{padding:4px 10px;border-bottom:1px solid #e8eef5;text-align:right;white-space:nowrap}
td.lbl{text-align:left;color:#374151}
td.lbl.ind{padding-left:22px}
tr.tot td{background:#deeaf1;font-weight:700;border-top:1px solid #2e75b6}
tr.tot td.lbl{color:#1e3a5f}
tr.neto td{background:#e2efda;font-weight:700}
tr.neto td.lbl{color:#375623}
tr.nds-row td{background:#fff2cc}
tr.nds-total td{background:#ffd966;font-weight:700}
td.pos{color:#1a7f37;font-weight:600}
td.neg{color:#c0392b;font-weight:600}
td.dim{color:#9ca3af;font-size:10px}
td.zero{color:#d1d5db}
td.border-l{border-left:2px solid #c3d4e8}
td.org-hdr{background:#deeaf1;font-size:10px;font-weight:600;color:#2e75b6;text-align:center;border-bottom:1px solid #2e75b6}
</style>
</head>
<body>

<div class="hdr">
  <div>
    <span class="ttl">НДС ВСИП + ТИМ-ТРЕЙД</span>
    <span class="sub">Источник: Аспро Cloud · transaction_pls</span>
  </div>
  <div class="ctl">
    <select id="qs"></select>
    <span id="st">&#9679; инициализация…</span>
    <button id="rb" title="Обновить">&#8635;</button>
  </div>
</div>

<div id="ct"><div class="spinner">&#8987; Загрузка…</div></div>

<script>
(function(){
'use strict';

/* ─── Квартальный селектор ─────────────────────────────────────────────── */
var now=new Date(), cY=now.getFullYear(), cQ=Math.ceil((now.getMonth()+1)/3);
var qs=document.getElementById('qs');
for(var y=cY;y>=cY-1;y--){
  for(var q=4;q>=1;q--){
    if(y===cY&&q>cQ)continue;
    var o=document.createElement('option');
    o.value=y+':'+q; o.textContent='К'+q+' '+y;
    if(y===cY&&q===cQ)o.selected=true;
    qs.appendChild(o);
  }
}
function qRange(y,q){
  var s0=[y+'-01-01',y+'-04-01',y+'-07-01',y+'-10-01'][q-1];
  var s1=[y+'-03-31',y+'-06-30',y+'-09-30',y+'-12-31'][q-1];
  return{s0:s0,s1:s1,lbl:'К'+q+' '+y};
}

/* ─── API helpers ──────────────────────────────────────────────────────── */
function apiFetch(p){
  return fetch('/api/data?'+p).then(function(r){
    if(!r.ok)throw new Error('HTTP '+r.status);
    return r.json();
  }).then(function(d){
    if(d.error)throw new Error(JSON.stringify(d.error));
    return{items:(d.response&&d.response.items)||[],total:(d.response&&d.response.total)||0};
  });
}
function fetchAll(entity,extra){
  var all=[],page=1;
  function next(){
    var p=new URLSearchParams(extra);
    p.set('entity',entity);p.set('limit','100');p.set('page',String(page));
    return apiFetch(p.toString()).then(function(d){
      all=all.concat(d.items);
      if(all.length>=d.total||d.items.length<100)return all;
      page++;return next();
    });
  }
  return next();
}

/* ─── Ставка → gross-коэффициент ──────────────────────────────────────── */
function gf(name){
  var m=(name||'').match(/(\\d+)\\s*%/);
  var r=m?parseInt(m[1],10):22;
  return(100+r)/r;
}

/* ─── Классификация расходов ВСИП (по crm, как в Excel) ───────────────── */
// Правила верифицированы по транзакциям за К2 2026:
//   crm=250, proj=27  → трансфер (исключить)
//   crm=345, 301      → СМР (cat 3150)
//   crm=836           → Материалы (cat 3143)
//   crm=296, proj=3   → СМР (cat 3150, tx 2493)
//   crm=296, proj=1   → СМР кроме 2-го вхождения amount=23809.52 → Материалы (cat 3126)
//   остальные crm     → Прочие
var _cnt296={};
function classifyVsipExp(crm,proj,amount){
  if(crm===250&&proj===27)return null;        // трансфер
  if(crm===345||crm===301)return'СМР';
  if(crm===836)return'МАТ';
  if(crm===296){
    if(proj===3)return'СМР';
    if(proj===1){
      var key='296:1:'+amount.toFixed(2);
      _cnt296[key]=(_cnt296[key]||0)+1;
      if(amount>23809&&amount<23810&&_cnt296[key]===2)return'МАТ';
      return'СМР';
    }
  }
  return'ПР';
}

/* ─── Расчёт всех показателей ─────────────────────────────────────────── */
function calc(pls){
  _cnt296={};

  // Фильтр: только записи "Налог 22%/5%/20%"
  var recs=pls.filter(function(r){return/Налог\\s*(22|5|20)%/.test(r.name||'');});

  var V={
    incNds:0, incAmt:0,           // ВСИП доходы (клиенты)
    trInNds:0, trInAmt:0,         // ВСИП ← ТТ трансфер (доход)
    trOutNds:0, trOutAmt:0,       // ВСИП → ТТ трансфер (расход)
    matNds:0, matAmt:0,           // ВСИП Материалы
    smrNds:0, smrAmt:0,           // ВСИП СМР
    prNds:0,  prAmt:0             // ВСИП Прочие
  };
  var T={
    trInNds:0, trInAmt:0,         // ТТ ← ВСИП трансфер (доход)
    incNds:0, incAmt:0,           // ТТ реальные доходы
    trOutNds:0, trOutAmt:0,       // ТТ → ВСИП трансфер (расход)
    matNds:0, matAmt:0            // ТТ Материалы (всё)
  };
  var warn20=[];

  recs.forEach(function(r){
    var oid=parseInt(r.org_id)||0;
    var cat=parseInt(r.category_id)||0;
    var crm=parseInt(r.crm_account_id)||0;
    var pid=parseInt(r.project_id)||0;
    var inc=parseFloat(r.income)||0;
    var out=parseFloat(r.outcome)||0;
    var rf=gf(r.name);

    if(/20%/.test(r.name))warn20.push('PLS#'+r.id);

    if(cat===3147&&inc>0){
      if(oid===1){
        if(crm===250&&pid===27){V.trInNds+=inc;V.trInAmt+=inc*rf;}
        else{V.incNds+=inc;V.incAmt+=inc*rf;}
      } else if(oid===2){
        if(crm===837&&pid===27){T.trInNds+=inc;T.trInAmt+=inc*rf;}
        else{T.incNds+=inc;T.incAmt+=inc*rf;}
      }
    } else if(cat===3144&&out>0){
      if(oid===1){
        var cls=classifyVsipExp(crm,pid,out);
        if(cls===null){V.trOutNds+=out;V.trOutAmt+=out*rf;}
        else if(cls==='МАТ'){V.matNds+=out;V.matAmt+=out*rf;}
        else if(cls==='СМР'){V.smrNds+=out;V.smrAmt+=out*rf;}
        else{V.prNds+=out;V.prAmt+=out*rf;}
      } else if(oid===2){
        if(crm===837&&pid===27){T.trOutNds+=out;T.trOutAmt+=out*rf;}
        else{T.matNds+=out;T.matAmt+=out*rf;}
      }
    }
  });

  // Итоги
  V.expNds=V.matNds+V.smrNds+V.prNds;
  V.expAmt=V.matAmt+V.smrAmt+V.prAmt;
  T.expNds=T.matNds;
  T.expAmt=T.matAmt;

  var trDiff=Math.abs(V.trOutNds-T.trInNds);
  var warns=warn20.length?['⚠ Ставка 20%: '+warn20.join(', ')]:[];
  if(trDiff>5)warns.push('⚠ Асимметрия трансферов ВСИП↔ТТ: Δ='+Math.round(trDiff)+' руб.');

  return{V:V,T:T,warns:warns,n:recs.length,total:pls.length};
}

/* ─── Форматирование ───────────────────────────────────────────────────── */
function N(v){return Math.round(v);}
function f(v){
  if(!v||Math.abs(v)<0.5)return'<span class="zero">—</span>';
  return N(Math.abs(v)).toLocaleString('ru-RU')+(v<0?' <small style="color:#c0392b">(−)</small>':'');
}
function fb(v){   // баланс (цветной)
  if(!v||Math.abs(v)<0.5)return'<span class="zero">—</span>';
  var s=N(Math.abs(v)).toLocaleString('ru-RU');
  var c=v>0?'pos':'neg';
  return'<span class="'+c+'">'+(v<0?'('+s+')':s)+'</span>'
    +'<small style="color:'+(v>0?'#1a7f37':'#c0392b')+'"> '+(v>0?'к уплате':'к возм.')+'</small>';
}

/* ─── Построение HTML-таблицы ─────────────────────────────────────────── */
function build(V,T,lbl){

  function SEC(txt,cls){
    return'<tr class="sec '+cls+'"><td colspan="6">'+txt+'</td></tr>';
  }
  // Строка: Статья | V.amt | V.nds | T.amt | T.nds
  function ROW(lbl,va,vn,ta,tn,cls){
    var rc=cls||'';
    var td=function(v){return'<td>'+f(v)+'</td>';};
    return'<tr class="'+rc+'">'
      +'<td class="lbl'+(rc?' ind':'')+'">'+(rc==='tot'||rc==='neto'?'<strong>'+lbl+'</strong>':lbl)+'</td>'
      +td(va)+'<td class="border-l">'+f(vn)+'</td>'
      +td(ta)+'<td class="border-l">'+f(tn)+'</td>'
      +'</tr>';
  }
  // Строка с только НДС-колонками (для свода НДС, раздел 4)
  function ROWNDS(lbl,vn,tn,cls){
    var net=N(vn)+N(tn);
    var rc=cls||'nds-row';
    return'<tr class="'+rc+'">'
      +'<td class="lbl">'+lbl+'</td>'
      +'<td class="zero">—</td><td class="border-l">'+f(vn)+'</td>'
      +'<td class="zero">—</td><td class="border-l">'+f(tn)+'</td>'
      +'<td class="border-l">'+f(net)+'</td>'
      +'</tr>';
  }
  function ROWNDSBAL(lbl,vn,tn){
    var net=N(vn)+N(tn);
    return'<tr class="nds-total">'
      +'<td class="lbl"><strong>'+lbl+'</strong></td>'
      +'<td class="zero">—</td><td class="border-l">'+fb(vn)+'</td>'
      +'<td class="zero">—</td><td class="border-l">'+fb(tn)+'</td>'
      +'<td class="border-l">'+fb(net)+'</td>'
      +'</tr>';
  }

  // Итоги разделов
  var V1amt=V.incAmt+V.trInAmt, V1nds=V.incNds+V.trInNds;
  var T1amt=T.trInAmt+T.incAmt, T1nds=T.trInNds+T.incNds;
  var V3amt=V.expAmt, V3nds=V.expNds;
  var T3amt=T.expAmt, T3nds=T.expNds;

  var html='<table>'
    // ── ШАПКА ───────────────────────────────────────────────────────────
    +'<thead>'
    +'<tr>'
    +'<th class="lbl" rowspan="2">Статья — '+lbl+'</th>'
    +'<th colspan="2" class="org">ВСИП</th>'
    +'<th colspan="2" class="org border-l">ТИМ-ТРЕЙД</th>'
    +'<th class="org border-l" rowspan="2" style="min-width:90px">Нетто НДС, ₽</th>'
    +'</tr>'
    +'<tr>'
    +'<th>Сумма, ₽</th><th class="border-l">НДС, ₽</th>'
    +'<th class="border-l">Сумма, ₽</th><th class="border-l">НДС, ₽</th>'
    +'</tr>'
    +'</thead>'
    +'<tbody>'

    // ── РАЗДЕЛ 1: ПОСТУПЛЕНИЯ ────────────────────────────────────────────
    +SEC('1. ПОСТУПЛЕНИЯ С НДС','income')
    +ROW('  Оказание услуг (реальные клиенты)', V.incAmt, V.incNds, T.incAmt, T.incNds)
    +ROW('  Трансферы (входящие)', V.trInAmt, V.trInNds, T.trInAmt, T.trInNds)
    +ROW('ИТОГО поступлений', V1amt, V1nds, T1amt, T1nds, 'tot')

    // ── РАЗДЕЛ 2: ТРАНСФЕРЫ ──────────────────────────────────────────────
    +SEC('2. ТРАНСФЕРЫ  ВСИП ↔ ТИМ-ТРЕЙД','transfer')
    +ROW('  ВСИП → ТТ (прямые переводы)', V.trOutAmt, V.trOutNds, T.trInAmt, T.trInNds)
    +ROW('  ТТ → ВСИП (обратные переводы)', V.trInAmt, V.trInNds, T.trOutAmt, T.trOutNds)
    +ROW('НЕТТО (ВСИП → ТТ)',
         V.trOutAmt-V.trInAmt, V.trOutNds-V.trInNds,
         T.trInAmt-T.trOutAmt, T.trInNds-T.trOutNds, 'neto')

    // ── РАЗДЕЛ 3: РАСХОДЫ ────────────────────────────────────────────────
    +SEC('3. РАСХОДЫ С НДС','expense')
    +ROW('  Материалы', V.matAmt, V.matNds, T.matAmt, T.matNds)
    +ROW('  СМР', V.smrAmt, V.smrNds, 0, 0)
    +ROW('  Прочие', V.prAmt, V.prNds, 0, 0)
    +ROW('ИТОГО расходов', V3amt, V3nds, T3amt, T3nds, 'tot')

    // ── РАЗДЕЛ 4: НДС — СВОД ─────────────────────────────────────────────
    +SEC('НДС — свод  (из transaction_pls)','nds')
    +'<tr style="background:#f5f0ff">'
    +'<td class="lbl" style="color:#9ca3af;font-size:10px">Статья НДС</td>'
    +'<td class="zero dim">—</td>'
    +'<td class="border-l dim">ВСИП НДС, ₽</td>'
    +'<td class="zero dim">—</td>'
    +'<td class="border-l dim">ТТ НДС, ₽</td>'
    +'<td class="border-l dim">Нетто, ₽</td>'
    +'</tr>'
    +ROWNDS('НДС с Поступлений (к уплате)', V.incNds, T.incNds)
    +ROWNDS('НДС с Оплат (к возмещению)', V.expNds, T.expNds)
    +ROWNDSBAL('ИТОГО НДС (+ к уплате, − к возм.)', V.incNds-V.expNds, T.incNds-T.expNds)

    +'</tbody></table>';

  // Карточки баланса
  function card(org,nds){
    var c=nds>0?'#c0392b':nds<0?'#1a7f37':'#6b7280';
    var bg=nds>0?'#fff5f5':nds<0?'#f0fdf4':'#f9fafb';
    var bc=nds>0?'#fca5a5':nds<0?'#86efac':'#e5e7eb';
    var s=Math.abs(N(nds)).toLocaleString('ru-RU');
    return'<div class="card" style="background:'+bg+';border-color:'+bc+'">'
      +'<div style="font-size:9px;color:#6b7280;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">'+org+'</div>'
      +'<div style="font-size:16px;font-weight:700;color:'+c+'">'+(nds<0?'('+s+')':s)+'</div>'
      +'<div style="font-size:9px;color:'+c+';margin-top:3px">'+(nds>0?'к уплате':nds<0?'к возмещению':'—')+'</div>'
      +'</div>';
  }
  var vBal=V.incNds-V.expNds, tBal=T.incNds-T.expNds;
  html+='<div class="cards">'+card('ВСИП',vBal)+card('ТИМ-ТРЕЙД',tBal)+card('ГРУППА',vBal+tBal)+'</div>';

  return html;
}

/* ─── Загрузка данных ──────────────────────────────────────────────────── */
var busy=false;
function load(){
  if(busy)return; busy=true;
  var stEl=document.getElementById('st'), ctEl=document.getElementById('ct');
  var pts=qs.value.split(':'), y=parseInt(pts[0],10), q=parseInt(pts[1],10);
  var rng=qRange(y,q);
  stEl.innerHTML='&#9679; загрузка…'; stEl.style.color='#d97706';
  ctEl.innerHTML='<div class="spinner">&#8987; '+rng.lbl+'…</div>';
  var t0=Date.now();
  var df={'filter[date][start_date]':rng.s0,'filter[date][end_date]':rng.s1};
  Promise.all([
    fetchAll('transaction_pls',Object.assign({'filter[category_id]':'3147'},df)),
    fetchAll('transaction_pls',Object.assign({'filter[category_id]':'3144'},df))
  ]).then(function(res){
    var pls=res[0].concat(res[1]);
    var c=calc(pls);
    var wHtml=c.warns.length
      ?'<div class="warn-box">'+c.warns.join(' · ')+'</div>':'';
    ctEl.innerHTML=wHtml+build(c.V,c.T,rng.lbl);
    var dt=((Date.now()-t0)/1000).toFixed(1);
    stEl.innerHTML='&#9679; live · '+dt+'с · '+c.n+'/'+c.total+' PLS'
      +(c.warns.length?' ⚠'+c.warns.length:'');
    stEl.style.color=c.warns.length?'#d97706':'#059669';
    busy=false;
  }).catch(function(e){
    ctEl.innerHTML='<div style="padding:16px;color:#dc2626">&#10060; '+e.message+'</div>';
    stEl.textContent='● ошибка'; stEl.style.color='#dc2626';
    busy=false;
  });
}
document.getElementById('rb').addEventListener('click',function(){busy=false;load();});
qs.addEventListener('change',function(){busy=false;load();});
load();
})();
</script>
</body>
</html>`;

module.exports = function handler(req, res) {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Frame-Options', 'ALLOWALL');
  res.setHeader('Content-Security-Policy', "frame-ancestors *");
  res.end(HTML);
};
