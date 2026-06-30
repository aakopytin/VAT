// НДС — свод · v8
// Методология (соответствует Excel ДДС, раздел "НДС — свод"):
//   Источник: transaction_pls, name IN ("Налог 22%","Налог 5%","Налог 20%")
//   Доходы ВСИП  : cat=3147, org=1, excl. crm=250 proj=27 (то — обратный трансфер ТТ→ВСИП)
//   Доходы ТТ    : cat=3147, org=2, excl. crm=837 proj=27 (то — трансфер ВСИП→ТТ)
//   Трансфер ВСИП→ТТ: cat=3144 org=1 crm=250 proj=27  /  cat=3147 org=2 crm=837 proj=27
//   Трансфер ТТ→ВСИП: cat=3144 org=2 crm=837 proj=27  /  cat=3147 org=1 crm=250 proj=27
//   Расходы ВСИП : cat=3144, org=1, excl. crm=250 proj=27
//   Расходы ТТ   : cat=3144, org=2, excl. crm=837 proj=27
//   Сумма с НДС  : НДС × (100+ставка)/ставка

const HTML = `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>НДС — свод</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:11px;background:#f8f9fd;padding:12px;color:#111827}
.hdr{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;padding-bottom:8px;border-bottom:1px solid #e5e7eb;flex-wrap:wrap;gap:6px}
.ttl{font-size:14px;font-weight:700}
.ctl{display:flex;gap:6px;align-items:center}
select{font-size:11px;border:1px solid #d1d5db;border-radius:4px;padding:3px 8px;color:#374151;background:#fff;cursor:pointer}
#rb{background:none;border:1px solid #d1d5db;color:#6b7280;font-size:11px;padding:2px 8px;border-radius:4px;cursor:pointer}
#st{font-size:10px;color:#d97706;white-space:nowrap}
#ct{overflow-x:auto}
.cards{display:flex;gap:8px;margin-top:10px;flex-wrap:wrap}
.card{flex:1;min-width:150px;border-radius:6px;padding:8px 12px}
table{width:100%;border-collapse:collapse;font-size:11px;min-width:580px}
th,td{padding:4px 10px;border-bottom:1px solid #eef2f7;white-space:nowrap}
th{font-size:10px;font-weight:600;color:#fff;text-align:right}
th.lbl{text-align:left}
td{text-align:right}
td.lbl{text-align:left}
.sec td,.sec th{background:#1e3a5f;color:#fff;font-weight:700;border-top:2px solid #1e3a5f;border-bottom:1px solid #3d6b9f;text-align:left;padding:4px 10px;font-size:10px}
.tot td{font-weight:700;background:#eef4fb}
.warn{padding:4px 10px;background:#fffbeb;border:1px solid #fde68a;border-radius:4px;font-size:10px;color:#92400e;margin-bottom:6px}
</style>
</head>
<body>
<div class="hdr">
  <div>
    <span class="ttl">&#9783; НДС — свод</span>
    <span style="font-size:10px;color:#9ca3af;margin-left:8px">ВСИП + ТИМ-ТРЕЙД · Aspro Cloud</span>
  </div>
  <div class="ctl">
    <select id="qs"></select>
    <span id="st">&#9679; инициализация…</span>
    <button id="rb" title="Обновить">&#8635;</button>
  </div>
</div>
<div id="ct"><div style="padding:24px;text-align:center;color:#9ca3af">&#8987; Загрузка…</div></div>

<script>
(function(){
'use strict';

/* ── Квартальный селектор ─────────────────────────────────────────────────── */
var now=new Date(),curY=now.getFullYear(),curQ=Math.ceil((now.getMonth()+1)/3);
var qs=document.getElementById('qs');
for(var y=curY;y>=curY-1;y--){
  for(var q=4;q>=1;q--){
    if(y===curY&&q>curQ)continue;
    var o=document.createElement('option');
    o.value=y+':'+q; o.textContent='К'+q+' '+y;
    if(y===curY&&q===curQ)o.selected=true;
    qs.appendChild(o);
  }
}
function getRange(y,q){
  var s0=[y+'-01-01',y+'-04-01',y+'-07-01',y+'-10-01'][q-1];
  var s1=[y+'-03-31',y+'-06-30',y+'-09-30',y+'-12-31'][q-1];
  return{s0:s0,s1:s1,label:'К'+q+' '+y};
}

/* ── Запросы к API ────────────────────────────────────────────────────────── */
function fetchPage(p){
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
    return fetchPage(p.toString()).then(function(d){
      all=all.concat(d.items);
      if(all.length>=d.total||d.items.length<100)return all;
      page++;return next();
    });
  }
  return next();
}

/* ── Ставка → коэффициент брутто ─────────────────────────────────────────── */
function rateF(name){
  var m=(name||'').match(/(\\d+)\\s*%/);
  var pct=m?parseInt(m[1],10):22;
  return(100+pct)/pct;
}

/* ── Классификация записей ────────────────────────────────────────────────── */
function calc(pls){
  // Фильтр: только НДС-записи с правильным именем
  var ndsPls=pls.filter(function(r){
    return/Налог\\s*(22|5|20)%/.test(r.name||'');
  });

  var v={incNds:0,incAmt:0, trOutNds:0,trOutAmt:0, expNds:0,expAmt:0, trInNds:0,trInAmt:0};
  var t={incNds:0,incAmt:0, trInNds:0,trInAmt:0,  expNds:0,expAmt:0, trOutNds:0,trOutAmt:0};
  var warn20=[];

  ndsPls.forEach(function(r){
    var oid=parseInt(r.org_id)||0;
    var cat=parseInt(r.category_id)||0;
    var crm=parseInt(r.crm_account_id)||0;
    var pid=parseInt(r.project_id)||0;
    var inc=parseFloat(r.income)||0;
    var out=parseFloat(r.outcome)||0;
    var rf=rateF(r.name);
    var isVsipToTt=(oid===1&&cat===3144&&crm===250&&pid===27);
    var isTtToVsip=(oid===2&&cat===3144&&crm===837&&pid===27);
    var isVsipFromTt=(oid===1&&cat===3147&&crm===250&&pid===27);
    var isTtFromVsip=(oid===2&&cat===3147&&crm===837&&pid===27);

    if(/20%/.test(r.name))warn20.push('id='+r.id+' '+r.name+' '+out.toFixed(0));

    if(cat===3147&&inc>0){
      if(oid===1){
        if(isVsipFromTt){v.trInNds+=inc;v.trInAmt+=inc*rf;}   // трансфер ТТ→ВСИП (доход)
        else{v.incNds+=inc;v.incAmt+=inc*rf;}                  // реальный доход ВСИП
      } else if(oid===2){
        if(isTtFromVsip){t.trInNds+=inc;t.trInAmt+=inc*rf;}   // трансфер ВСИП→ТТ (доход ТТ)
        else{t.incNds+=inc;t.incAmt+=inc*rf;}                  // реальный доход ТТ
      }
    } else if(cat===3144&&out>0){
      if(oid===1){
        if(isVsipToTt){v.trOutNds+=out;v.trOutAmt+=out*rf;}   // трансфер ВСИП→ТТ (расход)
        else{v.expNds+=out;v.expAmt+=out*rf;}                  // реальные расходы ВСИП
      } else if(oid===2){
        if(isTtToVsip){t.trOutNds+=out;t.trOutAmt+=out*rf;}   // трансфер ТТ→ВСИП (расход)
        else{t.expNds+=out;t.expAmt+=out*rf;}                  // реальные расходы ТТ
      }
    }
  });

  // Проверка симметрии трансферов
  var warn=warn20.length?['⚠ Ставка 20%: '+warn20.join(', ')]:[];
  var trDiff=Math.abs(v.trOutNds-t.trInNds);
  if(trDiff>5) warn.push('⚠ Асимметрия ВСИП→ТТ: Δ='+Math.round(trDiff)
    +' (ВСИП '+Math.round(v.trOutNds)+' ≠ ТТ '+Math.round(t.trInNds)+')');

  return{v:v,t:t,warn:warn,n:ndsPls.length,total:pls.length};
}

/* ── Форматирование ───────────────────────────────────────────────────────── */
function R(v){return Math.round(v);}
function fmt(v,cls){
  if(!v||Math.abs(v)<0.5)return'<span style="color:#d1d5db">—</span>';
  var s=Math.abs(R(v)).toLocaleString('ru-RU');
  var str=v<0?'('+s+')':s;
  return cls?'<span class="'+cls+'">'+str+'</span>':str;
}
function fmtBal(v){
  if(!v||Math.abs(v)<0.5)return'<span style="color:#d1d5db">—</span>';
  var s=Math.abs(R(v)).toLocaleString('ru-RU');
  var c=v>0?'#dc2626':'#059669';
  var lbl=v>0?' к уплате':' к возм.';
  return'<strong style="color:'+c+'">'+(v<0?'('+s+')':s)+'</strong>'
    +'<small style="color:'+c+'">'+lbl+'</small>';
}
function card(lbl,nds){
  var c=nds>0?'#dc2626':nds<0?'#059669':'#6b7280';
  var bg=nds>0?'#fff5f5':nds<0?'#f0fdf4':'#f9fafb';
  var bc=nds>0?'#fca5a5':nds<0?'#86efac':'#e5e7eb';
  var s=Math.abs(R(nds)).toLocaleString('ru-RU');
  return'<div class="card" style="background:'+bg+';border:1px solid '+bc+'">'
    +'<div style="font-size:9px;color:#6b7280;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">'+lbl+'</div>'
    +'<div style="font-size:15px;font-weight:700;color:'+c+'">'+(nds<0?'('+s+')':s)+'</div>'
    +'<div style="font-size:9px;color:'+c+';margin-top:2px">'+(nds>0?'к уплате':nds<0?'к возмещению':'—')+'</div>'
    +'</div>';
}

/* ── Построение таблицы ───────────────────────────────────────────────────── */
function build(v,t,label){
  var vBal=v.incNds-v.expNds;
  var tBal=t.incNds-t.expNds;
  var gInc=v.incNds+t.incNds;
  var gExp=v.expNds+t.expNds;
  var gBal=gInc-gExp;

  function HDR(txt){
    return'<tr class="sec"><td colspan="4">'+txt+'</td></tr>';
  }
  function ROW(lbl,vv,tv,gv,tot){
    var cls=tot?'tot':'';
    return'<tr class="'+cls+'">'
      +'<td class="lbl">'+(tot?'<strong>':'')+lbl+(tot?'</strong>':'')+'</td>'
      +'<td>'+fmt(vv)+'</td>'
      +'<td>'+fmt(tv)+'</td>'
      +'<td>'+fmt(gv)+'</td>'
    +'</tr>';
  }
  function ROWAMT(lbl,va,ta,ga){
    return'<tr><td class="lbl" style="color:#6b7280;font-size:10px">'+lbl+'</td>'
      +'<td style="color:#6b7280;font-size:10px">'+fmt(va)+'</td>'
      +'<td style="color:#6b7280;font-size:10px">'+fmt(ta)+'</td>'
      +'<td style="color:#6b7280;font-size:10px">'+fmt(ga)+'</td></tr>';
  }
  function ROWBAL(lbl,vv,tv,gv){
    return'<tr style="background:#f0f4ff;border-top:3px solid #1e3a5f">'
      +'<td class="lbl"><strong style="color:#1e3a5f">'+lbl+'</strong></td>'
      +'<td>'+fmtBal(vv)+'</td>'
      +'<td>'+fmtBal(tv)+'</td>'
      +'<td>'+fmtBal(gv)+'</td>'
    +'</tr>';
  }

  var tbl='<table>'
    +'<thead><tr style="background:#1e3a5f">'
    +'<th class="lbl">Показатель — '+label+'</th>'
    +'<th>ВСИП, ₽</th>'
    +'<th>ТИМ-ТРЕЙД, ₽</th>'
    +'<th>Группа, ₽</th>'
    +'</tr></thead><tbody>'

    // I. Поступления
    +HDR('I. ПОСТУПЛЕНИЯ С НДС (клиенты)')
    +ROW('НДС с поступлений (к уплате)', v.incNds, t.incNds, gInc, true)
    +ROWAMT('в т.ч. сумма с НДС', v.incAmt, t.incAmt, v.incAmt+t.incAmt)

    // II. Трансферы
    +HDR('II. ТРАНСФЕРЫ ВСИП ↔ ТТ')
    +ROW('ВСИП→ТТ: НДС в переводах', v.trOutNds, t.trInNds, v.trOutNds, false)
    +ROWAMT('  сумма переводов с НДС', v.trOutAmt, t.trInAmt, v.trOutAmt)
    +ROW('ТТ→ВСИП: НДС в обратных переводах', v.trInNds, t.trOutNds, t.trOutNds, false)
    +ROWAMT('  сумма обратных с НДС', v.trInAmt, t.trOutAmt, t.trOutAmt)

    // III. Расходы
    +HDR('III. РАСХОДЫ С НДС (без трансферов)')
    +ROW('НДС с оплат (к возмещению)', v.expNds, t.expNds, gExp, true)
    +ROWAMT('в т.ч. сумма с НДС', v.expAmt, t.expAmt, v.expAmt+t.expAmt)

    // IV. Свод НДС
    +HDR('IV. НДС — СВОД (Excel раздел 5)')
    +ROW('НДС с поступлений', v.incNds, t.incNds, gInc, false)
    +ROW('НДС с оплат', v.expNds, t.expNds, gExp, false)
    +ROWBAL('ИТОГО НДС (+ к уплате, − к возм.)', vBal, tBal, gBal)

    +'</tbody></table>'
    +'<div class="cards">'+card('ВСИП',vBal)+card('ТИМ-ТРЕЙД',tBal)+card('ГРУППА',gBal)+'</div>';

  return tbl;
}

/* ── Загрузка данных ─────────────────────────────────────────────────────── */
var busy=false;
function load(){
  if(busy)return;busy=true;
  var stEl=document.getElementById('st'),ctEl=document.getElementById('ct');
  var pts=qs.value.split(':'),y=parseInt(pts[0],10),q=parseInt(pts[1],10);
  var rng=getRange(y,q);
  stEl.innerHTML='&#9679; загрузка…';stEl.style.color='#d97706';
  ctEl.innerHTML='<div style="padding:24px;text-align:center;color:#9ca3af">&#8987; '+rng.label+'…</div>';
  var t0=Date.now();
  var df={'filter[date][start_date]':rng.s0,'filter[date][end_date]':rng.s1};
  Promise.all([
    fetchAll('transaction_pls',Object.assign({'filter[category_id]':'3147'},df)),
    fetchAll('transaction_pls',Object.assign({'filter[category_id]':'3144'},df))
  ]).then(function(res){
    var pls=res[0].concat(res[1]);
    var c=calc(pls);
    var wHtml=c.warn.length
      ?'<div class="warn">'+c.warn.join(' · ')+'</div>':'' ;
    ctEl.innerHTML=wHtml+build(c.v,c.t,rng.label);
    stEl.innerHTML='&#9679; live · '+((Date.now()-t0)/1000).toFixed(1)+'с · '+c.n+' НДС-записей'
      +(c.warn.length?' ⚠'+c.warn.length:'');
    stEl.style.color=c.warn.length?'#d97706':'#059669';
    busy=false;
  }).catch(function(e){
    ctEl.innerHTML='<div style="padding:16px;color:#dc2626">&#10060; '+e.message+'</div>';
    stEl.textContent='● ошибка';stEl.style.color='#dc2626';
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
