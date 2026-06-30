// НДС — свод · v10
// Структура виджета точно соответствует Excel ДДС (разделы 1–3 + НДС свод)
//
// Источник данных: transaction_pls
//   cat=1000  — доходы (план-фактные записи)
//   cat=3144  — расходы / уплата НДС (outcome > 0)
//   cat=3147  — НДС возврат / доход (income > 0)
//
// Фильтр по name: только записи с "Налог 22%", "Налог 5%", "Налог 20%"
//
// ВСИП (org=1) доходы       : cat=1000 или cat=3147, income>0, excl. crm=250 proj=27
// ВСИП трансфер ← ТТ        : cat=3147, crm=250, proj=27, income>0
// ВСИП трансфер → ТТ        : cat=3144, crm=250, proj=27, outcome>0
// ВСИП реальные расходы      : cat=3144, excl. crm=250 proj=27, outcome>0
//
// ТТ (org=2) трансфер ← ВСИП: cat=1000 или cat=3147, proj=27, income>0
// ТТ реальные доходы         : cat=1000 или cat=3147, excl. proj=27, income>0
// ТТ трансфер → ВСИП         : cat=3144, crm=837, proj=27, outcome>0
// ТТ реальные расходы         : cat=3144, excl. crm=837 proj=27, outcome>0  → Материалы
//
// Gross = НДС × (100+ставка)/ставка
// Ставка берётся из name: "Налог 22%" → 22, "Налог 5%" → 5, "Налог 20%" → 20

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
#rb:hover{background:#eef4fb}
#st{font-size:10px;color:#d97706;white-space:nowrap}
#ct{overflow-x:auto}
.warn-box{padding:6px 10px;background:#fffbeb;border:1px solid #fde68a;border-radius:4px;font-size:10px;color:#92400e;margin-bottom:8px}
.spinner{padding:32px;text-align:center;color:#9ca3af}
.cards{display:flex;gap:8px;margin-top:12px;flex-wrap:wrap}
.card{flex:1;min-width:160px;border-radius:6px;padding:10px 14px}

table{width:100%;border-collapse:collapse;min-width:680px;background:#fff;border:1px solid #c3d4e8;margin-bottom:2px}
thead tr.org-hdr th{padding:3px 10px;font-size:10px;color:#fff;background:#1e3a5f;text-align:center;letter-spacing:.05em;text-transform:uppercase}
thead tr.org-hdr th.lbl{text-align:left;min-width:200px;background:#1e3a5f}
thead tr.col-hdr th{padding:4px 10px;font-size:10px;font-weight:600;color:#fff;background:#2e5897;text-align:right;white-space:nowrap}
thead tr.col-hdr th.lbl{text-align:left;background:#2e5897}

tr.sec td{padding:4px 10px;font-weight:700;font-size:10px;letter-spacing:.04em;text-align:left}
tr.sec.s1 td{background:#2e75b6;color:#fff}
tr.sec.s2 td{background:#375623;color:#fff}
tr.sec.s3 td{background:#833c00;color:#fff}
tr.sec.s4 td{background:#7030a0;color:#fff}
tr.sec td span.cnt{font-weight:400;font-size:9px;opacity:.7;margin-left:6px}

td{padding:4px 10px;border-bottom:1px solid #e8eef5;text-align:right;white-space:nowrap}
td.lbl{text-align:left;color:#374151;padding-left:20px}
td.lbl.h{padding-left:10px;font-weight:600;color:#1e3a5f}
td.lbl.nds-lbl{padding-left:10px;color:#6b7280;font-size:10px}
td.bl{border-left:2px solid #c3d4e8}
td.zero{color:#d1d5db}
td.dim{color:#9ca3af;font-size:10px}

tr.tot td{background:#deeaf1;font-weight:700}
tr.tot td.lbl{color:#1e3a5f}
tr.neto td{background:#e2efda;font-weight:700}
tr.neto td.lbl{color:#375623}
tr.nds-r td{background:#fff2cc}
tr.nds-t td{background:#ffd966;font-weight:700}
tr.nds-sub td{background:#f5f0ff;color:#6b7280;font-size:10px}
</style>
</head>
<body>

<div class="hdr">
  <div>
    <span class="ttl">НДС ВСИП + ТИМ-ТРЕЙД</span>
    <span class="sub">Aspro Cloud · transaction_pls</span>
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
var now=new Date(),cY=now.getFullYear(),cQ=Math.ceil((now.getMonth()+1)/3);
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

/* ─── API ──────────────────────────────────────────────────────────────── */
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

/* ─── Утилиты ──────────────────────────────────────────────────────────── */
function rateF(name){
  var m=(name||'').match(/(\\d+)\\s*%/);
  var r=m?parseInt(m[1],10):22;
  return(100+r)/r;
}
function isNdsName(name){
  return/Налог\\s*(22|5|20)%/.test(name||'');
}

/* ─── Расчёт ───────────────────────────────────────────────────────────── */
function calc(pls){
  // Только записи с именем НДС-налога
  var recs=pls.filter(function(r){return isNdsName(r.name);});

  var V={
    incNds:0, incAmt:0,          // реальный доход (клиенты)
    trInNds:0, trInAmt:0,        // трансфер ← ТТ (доход ВСИП)
    trOutNds:0, trOutAmt:0,      // трансфер → ТТ (расход ВСИП)
    expNds:0, expAmt:0           // реальные расходы ВСИП
  };
  var T={
    trInNds:0, trInAmt:0,        // трансфер ← ВСИП (доход ТТ)
    incNds:0, incAmt:0,          // реальный доход ТТ (прочие клиенты)
    trOutNds:0, trOutAmt:0,      // трансфер → ВСИП (расход ТТ)
    expNds:0, expAmt:0           // реальные расходы ТТ
  };
  var warn20=[];

  recs.forEach(function(r){
    var oid=parseInt(r.org_id)||0;
    var cat=parseInt(r.category_id)||0;
    var crm=parseInt(r.crm_account_id)||0;
    var pid=parseInt(r.project_id)||0;
    var inc=parseFloat(r.income)||0;
    var out=parseFloat(r.outcome)||0;
    var rf=rateF(r.name);

    if(/20%/.test(r.name))warn20.push('PLS#'+r.id+' ('+r.name+')');

    // ── ДОХОДЫ: cat=1000 или cat=3147 ─────────────────────────────────
    if((cat===1000||cat===3147)&&inc>0){
      if(oid===1){
        // ВСИП: трансфер ← ТТ или реальный доход
        if(cat===3147&&crm===250&&pid===27){
          V.trInNds+=inc; V.trInAmt+=inc*rf;
        } else {
          V.incNds+=inc; V.incAmt+=inc*rf;
        }
      } else if(oid===2){
        // ТТ: трансфер ← ВСИП (proj=27) или реальный доход
        if(pid===27){
          T.trInNds+=inc; T.trInAmt+=inc*rf;
        } else {
          T.incNds+=inc; T.incAmt+=inc*rf;
        }
      }
    }

    // ── РАСХОДЫ: cat=3144 ─────────────────────────────────────────────
    if(cat===3144&&out>0){
      if(oid===1){
        if(crm===250&&pid===27){
          V.trOutNds+=out; V.trOutAmt+=out*rf;  // трансфер → ТТ
        } else {
          V.expNds+=out; V.expAmt+=out*rf;       // реальный расход
        }
      } else if(oid===2){
        if(crm===837&&pid===27){
          T.trOutNds+=out; T.trOutAmt+=out*rf;  // трансфер → ВСИП
        } else {
          T.expNds+=out; T.expAmt+=out*rf;       // реальный расход (Материалы)
        }
      }
    }
  });

  var warns=warn20.length?['⚠ Ставка 20%: '+warn20.join(', ')]:[];
  var trDiff=Math.abs(V.trOutNds-T.trInNds);
  if(trDiff>10){
    warns.push('⚠ Асимметрия ВСИП→ТТ: Δ='
      +Math.round(trDiff).toLocaleString('ru-RU')
      +' (ВСИП '+Math.round(V.trOutNds).toLocaleString('ru-RU')
      +' / ТТ '+Math.round(T.trInNds).toLocaleString('ru-RU')+')');
  }

  return{V:V,T:T,warns:warns,n:recs.length,total:pls.length};
}

/* ─── Форматирование ───────────────────────────────────────────────────── */
function N(v){return Math.round(v);}
function f(v){
  if(!v||Math.abs(v)<0.5)return'<span class="zero">—</span>';
  return N(Math.abs(v)).toLocaleString('ru-RU');
}
function fb(v){
  if(!v||Math.abs(v)<0.5)return'<span class="zero">—</span>';
  var s=N(Math.abs(v)).toLocaleString('ru-RU');
  var c=v>0?'#c0392b':'#1a7f37';
  var lbl=v>0?' к уплате':' к возм.';
  return'<span style="font-weight:700;color:'+c+'">'+(v<0?'('+s+')':s)+'</span>'
    +'<small style="color:'+c+'"> '+lbl+'</small>';
}
function card(lbl,nds){
  var c=nds>0?'#c0392b':nds<0?'#1a7f37':'#6b7280';
  var bg=nds>0?'#fff5f5':nds<0?'#f0fdf4':'#f9fafb';
  var bc=nds>0?'#fca5a5':nds<0?'#86efac':'#e5e7eb';
  var s=N(Math.abs(nds)).toLocaleString('ru-RU');
  return'<div class="card" style="background:'+bg+';border:1px solid '+bc+'">'
    +'<div style="font-size:9px;color:#6b7280;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">'+lbl+'</div>'
    +'<div style="font-size:16px;font-weight:700;color:'+c+'">'+(nds<0?'('+s+')':s)+'</div>'
    +'<div style="font-size:9px;color:'+c+';margin-top:2px">'+(nds>0?'к уплате':nds<0?'к возмещению':'—')+'</div>'
    +'</div>';
}

/* ─── Построение таблицы ───────────────────────────────────────────────── */
function build(V,T,lbl){

  // Итоговые суммы для разделов
  // Трансферы в секции 1 = нетто (входящие − исходящие)
  var VtrNetNds=V.trInNds-V.trOutNds, VtrNetAmt=V.trInAmt-V.trOutAmt;
  var TtrNetNds=T.trInNds-T.trOutNds, TtrNetAmt=T.trInAmt-T.trOutAmt;
  var V1n=V.incNds+VtrNetNds, V1a=V.incAmt+VtrNetAmt;
  var T1n=T.incNds+TtrNetNds, T1a=T.incAmt+TtrNetAmt;
  var V3n=V.expNds, V3a=V.expAmt;
  var T3n=T.expNds, T3a=T.expAmt;
  // НДС свод: ВСИП Оплаты = нетто-отток трансферов + расходы; ТТ Поступления = доход + нетто-приток
  var VoplNds=(-VtrNetNds)+V.expNds;   // (trOut−trIn) + expNds
  var TpstNds=T.incNds+TtrNetNds;      // incNds + (trIn−trOut)

  function SEC(txt,cls,cnt){
    var cntHtml=cnt!=null?' <span class="cnt">'+cnt+'</span>':'';
    return'<tr class="sec '+cls+'"><td colspan="6">'+txt+cntHtml+'</td></tr>';
  }
  // Строка с 4 числовыми колонками: vAmt | vNds | tAmt | tNds
  function ROW(lab,va,vn,ta,tn,cls,ind){
    var lc='lbl'+(ind?' ':'  ')+(cls==='tot'||cls==='neto'?'h':'');
    return'<tr class="'+(cls||'')+'">'
      +'<td class="'+lc.trim()+'">'+lab+'</td>'
      +'<td>'+f(va)+'</td>'
      +'<td class="bl">'+f(vn)+'</td>'
      +'<td class="bl">'+f(ta)+'</td>'
      +'<td class="bl">'+f(tn)+'</td>'
      +'<td class="bl">—</td>'   // колонка Нетто НДС (для разделов 1-3)
      +'</tr>';
  }
  // Строка НДС-свода: только D и F, плюс нетто G
  function ROWNDS(lab,vn,tn,cls){
    var net=N(vn)+N(tn);
    return'<tr class="'+(cls||'nds-r')+'">'
      +'<td class="nds-lbl">'+lab+'</td>'
      +'<td class="zero dim">—</td>'
      +'<td class="bl">'+f(vn)+'</td>'
      +'<td class="bl zero dim">—</td>'
      +'<td class="bl">'+f(tn)+'</td>'
      +'<td class="bl">'+f(net)+'</td>'
      +'</tr>';
  }
  function ROWNDSBAL(lab,vn,tn){
    return'<tr class="nds-t">'
      +'<td class="lbl h">'+lab+'</td>'
      +'<td class="zero">—</td>'
      +'<td class="bl">'+fb(vn)+'</td>'
      +'<td class="bl zero">—</td>'
      +'<td class="bl">'+fb(tn)+'</td>'
      +'<td class="bl">'+fb(vn+tn)+'</td>'
      +'</tr>';
  }

  return'<table>'
    // ── ШАПКА ──────────────────────────────────────────────────────────
    +'<thead>'
    +'<tr class="org-hdr">'
    +'<th class="lbl" rowspan="2">Статья — '+lbl+'</th>'
    +'<th colspan="2">ВСИП</th>'
    +'<th colspan="2" class="bl">ТИМ-ТРЕЙД</th>'
    +'<th class="bl" rowspan="2" style="min-width:90px">Нетто НДС, ₽</th>'
    +'</tr>'
    +'<tr class="col-hdr">'
    +'<th>Сумма, ₽</th><th class="bl">НДС, ₽</th>'
    +'<th class="bl">Сумма, ₽</th><th class="bl">НДС, ₽</th>'
    +'</tr>'
    +'</thead>'
    +'<tbody>'

    // ── 1. ПОСТУПЛЕНИЯ ──────────────────────────────────────────────────
    +SEC('1. ПОСТУПЛЕНИЯ С НДС','s1')
    +ROW('  Поступления + возвраты',V.incAmt,V.incNds,T.incAmt,T.incNds,null,true)
    +ROW('  Трансферы (нетто)',VtrNetAmt,VtrNetNds,TtrNetAmt,TtrNetNds,null,true)
    +ROW('ИТОГО поступлений',V1a,V1n,T1a,T1n,'tot')

    // ── 2. ТРАНСФЕРЫ ────────────────────────────────────────────────────
    +SEC('2. ТРАНСФЕРЫ  ВСИП ↔ ТИМ-ТРЕЙД','s2')
    +ROW('  ВСИП → ТТ (прямые переводы)',V.trOutAmt,V.trOutNds,T.trInAmt,T.trInNds,null,true)
    +ROW('  ТТ → ВСИП (обратные переводы)',V.trInAmt,V.trInNds,T.trOutAmt,T.trOutNds,null,true)
    +ROW('НЕТТО (ВСИП → ТТ)',
         V.trOutAmt-V.trInAmt,V.trOutNds-V.trInNds,
         T.trInAmt-T.trOutAmt,T.trInNds-T.trOutNds,'neto')

    // ── 3. РАСХОДЫ ──────────────────────────────────────────────────────
    +SEC('3. РАСХОДЫ С НДС  (без трансферов)','s3')
    +ROW('  Материалы+СМР+Прочие',V.expAmt,V.expNds,T.expAmt,T.expNds,null,true)
    // ТТ расходы — все Материалы по данным. ВСИП — суммарно без разбивки (разбивка в Excel)
    +ROW('ИТОГО расходов',V3a,V3n,T3a,T3n,'tot')

    // ── НДС — СВОД ──────────────────────────────────────────────────────
    +SEC('НДС — свод  (из transaction_pls)','s4')
    +'<tr class="nds-sub">'
    +'<td class="nds-lbl">Статья НДС</td>'
    +'<td class="zero dim">—</td><td class="bl dim">ВСИП НДС, ₽</td>'
    +'<td class="bl zero dim">—</td><td class="bl dim">ТТ НДС, ₽</td>'
    +'<td class="bl dim">Нетто НДС, ₽</td>'
    +'</tr>'
    // ВСИП: Поступления = incNds; Оплаты = (trOut−trIn) + expNds
    // ТТ:   Поступления = incNds + (trIn−trOut); Оплаты = expNds
    +ROWNDS('НДС с Поступлений',V.incNds,TpstNds)
    +ROWNDS('НДС с Оплат',VoplNds,T.expNds)
    +ROWNDSBAL('ИТОГО НДС (+ к уплате, − к возм.)',
               V.incNds-VoplNds,
               TpstNds-T.expNds)

    +'</tbody></table>'

    // ── КАРТОЧКИ ────────────────────────────────────────────────────────
    +'<div class="cards">'
    +card('ВСИП',V.incNds-VoplNds)
    +card('ТИМ-ТРЕЙД',TpstNds-T.expNds)
    +card('ГРУППА',(V.incNds-VoplNds)+(TpstNds-T.expNds))
    +'</div>';
}

/* ─── Загрузка ─────────────────────────────────────────────────────────── */
var busy=false;
function load(){
  if(busy)return; busy=true;
  var stEl=document.getElementById('st'),ctEl=document.getElementById('ct');
  var pts=qs.value.split(':'),y=parseInt(pts[0],10),q=parseInt(pts[1],10);
  var rng=qRange(y,q);
  stEl.innerHTML='&#9679; загрузка…'; stEl.style.color='#d97706';
  ctEl.innerHTML='<div class="spinner">&#8987; '+rng.lbl+'…</div>';
  var t0=Date.now();
  var df={'filter[date][start_date]':rng.s0,'filter[date][end_date]':rng.s1};
  Promise.all([
    fetchAll('transaction_pls',Object.assign({'filter[category_id]':'1000'},df)),
    fetchAll('transaction_pls',Object.assign({'filter[category_id]':'3144'},df)),
    fetchAll('transaction_pls',Object.assign({'filter[category_id]':'3147'},df))
  ]).then(function(res){
    var pls=res[0].concat(res[1]).concat(res[2]);
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
