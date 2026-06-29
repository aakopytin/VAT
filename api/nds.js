// НДС widget v3 — исправленная методология
// ВСИП ПЕРЕВОДЫ: cat=3144 proj=27 (а не cat=1000 proj=27)
// Суммы: VAT × rate_factor (без plan_money)
// ТТ расходы: исключаем cat=3144 proj=27

const HTML = `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Расчёт НДС</title>
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 11px; background: #f8f9fd; padding: 12px; color: #111827; }
.hdr { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; padding-bottom: 8px; border-bottom: 1px solid #e5e7eb; flex-wrap: wrap; gap: 6px; }
.ttl { font-size: 14px; font-weight: 700; }
.ctl { display: flex; gap: 6px; align-items: center; }
select { font-size: 11px; border: 1px solid #d1d5db; border-radius: 4px; padding: 3px 8px; color: #374151; background: #fff; cursor: pointer; }
#rb { background: none; border: 1px solid #d1d5db; color: #6b7280; font-size: 11px; padding: 2px 8px; border-radius: 4px; cursor: pointer; }
#st { font-size: 10px; color: #d97706; white-space: nowrap; }
#ct { overflow-x: auto; }
.bal-box { display: flex; gap: 8px; margin-top: 10px; flex-wrap: wrap; }
.bal-item { flex: 1; min-width: 140px; border-radius: 6px; padding: 8px 12px; font-size: 11px; }
</style>
</head>
<body>
<div class="hdr">
  <div>
    <span class="ttl">&#9783; Расчёт НДС</span>
    <span style="font-size:10px;color:#9ca3af;margin-left:8px">ВСИП + ТТ · Aspro Cloud</span>
  </div>
  <div class="ctl">
    <select id="qs"></select>
    <span id="st">&#9679; инициализация...</span>
    <button id="rb" title="Обновить">&#8635;</button>
  </div>
</div>
<div id="ct"><div style="padding:24px;text-align:center;color:#9ca3af">&#8987; Загрузка...</div></div>
<script>
(function(){
'use strict';

// Квартальный селектор
var now=new Date(), curY=now.getFullYear(), curQ=Math.ceil((now.getMonth()+1)/3);
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

// API
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

// Ставка НДС из названия: "Налог 22%" → 22, "Налог 5%" → 5, "Налог 20%" → 20
function rateF(name){
  var m=(name||'').match(/(\\d+)\\s*%/);
  var pct=m?parseInt(m[1]):22;
  return(100+pct)/pct; // 122/22, 105/5, 120/20
}

// Расчёт
// Правила маппинга:
//   ВСИП ДОХОДЫ (incVat/incAmt):   cat=1000, org=1, proj≠27
//   ВСИП ПЕРЕВОДЫ исх. (trVat/trAmt): cat=3144, org=1, proj=27
//   ВСИП РАСХОДЫ (expVat/expAmt):  cat=3144, org=1, proj≠27
//   ТТ ДОХОДЫ/ПЕРЕВОДЫ вх. (trVat/trAmt): cat=1000, org=2, proj=27
//   ТТ РАСХОДЫ (expVat/expAmt):    cat=3144, org=2, proj≠27
//   Остальные записи — исключаются
function calc(pls){
  var v={incVat:0,incAmt:0,trVat:0,trAmt:0,expVat:0,expAmt:0};
  var t={trVat:0,trAmt:0,expVat:0,expAmt:0};

  pls.forEach(function(r){
    var oid=r.org_id, pid=r.project_id, cat=r.category_id;
    var inc=parseFloat(r.income)||0, out=parseFloat(r.outcome)||0;
    var rf=rateF(r.name);

    if(cat===1000&&inc>0){
      if(oid===1&&pid!==27){
        // ВСИП: поступления от клиентов с НДС
        v.incVat+=inc; v.incAmt+=inc*rf;
      }else if(oid===2&&pid===27){
        // ТТ: поступления от переводов ВСИП→ТТ
        t.trVat+=inc; t.trAmt+=inc*rf;
      }
      // oid=1, proj=27 → обратный перевод ТТ→ВСИП, не в Своде
      // oid=2, proj≠27 → прочая выручка ТТ, не в Своде

    }else if(cat===3144&&out>0){
      if(oid===1&&pid===27){
        // ВСИП: НДС к вычету по переводам ВСИП→ТТ
        v.trVat+=out; v.trAmt+=out*rf;
      }else if(oid===1&&pid!==27){
        // ВСИП: НДС к вычету по прочим расходам
        v.expVat+=out; v.expAmt+=out*rf;
      }else if(oid===2&&pid!==27){
        // ТТ: НДС к вычету по расходам (excl. proj=27 — обратный перевод)
        t.expVat+=out; t.expAmt+=out*rf;
      }
      // oid=2, proj=27 → обратный перевод ТТ→ВСИП, не в Своде
    }
  });

  v.totDed=v.trVat+v.expVat;
  v.bal=v.incVat-v.totDed;
  t.totDed=t.expVat;
  t.bal=t.trVat-t.totDed;
  return{v:v,t:t};
}

// Форматирование
function fmt(v){
  if(!v||Math.abs(v)<0.01)return'<span style="color:#ccc">—</span>';
  var s=Math.abs(v).toFixed(2).replace(/\\B(?=(\\d{3})+(?!\\d))/g,' ');
  return v<0?'<span style="color:#dc2626">('+s+')</span>':s;
}
function fmtBal(v){
  if(!v||Math.abs(v)<0.01)return'<span style="color:#9ca3af">0</span>';
  var s=Math.abs(v).toFixed(2).replace(/\\B(?=(\\d{3})+(?!\\d))/g,' ');
  var c=v>0?'#dc2626':'#059669'; // >0 = к уплате (красный), <0 = к возмещению (зеленый)
  return'<strong style="color:'+c+'">'+(v<0?'('+s+')':s)+'</strong>';
}

// Таблица
function build(v,t,label){
  var SEP=';border-left:2px solid #3d5c7a';
  var BT=';border-top:1px solid #b8ccdf';
  var F='padding:3px 8px;border-bottom:1px solid #f0f4f8;white-space:nowrap';

  function TH(x,s){return'<th style="padding:5px 8px;text-align:right;background:#1e3a5f;color:#fff;font-size:10px;font-weight:600'+(s||'')+'">'+(x||'')+'</th>';}
  function THl(x){return'<th style="padding:5px 8px;text-align:left;background:#1e3a5f;color:#fff;font-size:10px;font-weight:600">'+x+'</th>';}
  function TD(x,s){return'<td style="'+F+';text-align:right'+(s||'')+'">'+(x||'')+'</td>';}
  function TDl(x,s){return'<td style="'+F+(s||'')+'">'+(x||'')+'</td>';}

  function SEC(txt,bg,col){
    return'<tr style="background:'+bg+'">'
      +'<td colspan="7" style="padding:4px 8px;font-weight:700;font-size:11px;color:'+col+';border-top:2px solid '+col+';border-bottom:1px solid '+col+'">'+txt+'</td>'
      +'</tr>';
  }
  function ROW(lbl,va,aa,vt,at,vg,ag){
    var l='<span style="color:#9ca3af;margin-right:4px">▸</span>'+lbl;
    return'<tr>'+TDl(l,';padding-left:16px')+TD(fmt(va))+TD(fmt(aa),SEP)+TD(fmt(vt),SEP)+TD(fmt(at))+TD(fmt(vg),SEP)+TD(fmt(ag))+'</tr>';
  }
  function ROWTOT(lbl,v1,v2,v3){
    return'<tr style="background:#eef4fb">'
      +TDl('<strong>'+lbl+'</strong>',''+BT)+TD('',BT)+TD('<strong>'+fmt(v1)+'</strong>',SEP+BT)+TD('',BT)+TD('<strong>'+fmt(v2)+'</strong>',SEP+BT)+TD('',BT)+TD('<strong>'+fmt(v3)+'</strong>',SEP+BT)
      +'</tr>';
  }
  function ROWBAL(lbl,v1,v2,v3){
    return'<tr style="background:#1e3a5f">'
      +TDl('<strong style="color:#fff">'+lbl+'</strong>',BT)
      +'<td colspan="2" style="'+F+';text-align:right;color:#fff'+SEP+BT+'">'+fmtBal(v1)+'</td>'
      +'<td colspan="2" style="'+F+';text-align:right;color:#fff'+SEP+BT+'">'+fmtBal(v2)+'</td>'
      +'<td colspan="2" style="'+F+';text-align:right;color:#fff'+SEP+BT+'">'+fmtBal(v3)+'</td>'
      +'</tr>';
  }
  function ROWVAT(lbl,v1,v2,v3){
    return'<tr>'
      +TDl('<span style="color:#9ca3af;margin-right:4px">▸</span>'+lbl,';padding-left:16px')
      +'<td colspan="2" style="'+F+';text-align:right'+SEP+'">'+fmt(v1)+'</td>'
      +'<td colspan="2" style="'+F+';text-align:right'+SEP+'">'+fmt(v2)+'</td>'
      +'<td colspan="2" style="'+F+';text-align:right'+SEP+'">'+fmt(v3)+'</td>'
      +'</tr>';
  }

  // GROUP values
  var gIncVat=v.incVat, gIncAmt=v.incAmt;   // ВСИП выручка (ТТ в ДОХОДЫ не включаем)
  // На самом деле Группа в ДОХОДЫ = ВСИП выручка + ТТ трансферы полученные
  gIncVat+=t.trVat; gIncAmt+=t.trAmt;
  var gTrVat=v.trVat+t.trVat, gTrAmt=v.trAmt+t.trAmt; // перевода: обе стороны
  var gExpVat=v.expVat+t.expVat, gExpAmt=v.expAmt+t.expAmt;
  var gTotDed=v.totDed+t.totDed;
  var gBal=v.bal+t.bal;

  var tbl='<table style="width:100%;border-collapse:collapse;font-size:11px">'
    +'<thead><tr>'
    +THl('Показатель')
    +TH('НДС, ₽')+TH('Сумма, ₽',SEP)
    +TH('НДС, ₽',SEP)+TH('Сумма, ₽')
    +TH('НДС, ₽',SEP)+TH('Сумма, ₽')
    +'</tr>'
    +'<tr>'
    +'<th style="padding:2px 8px;text-align:left;background:#0f2240;color:#8ba8c4;font-size:9px;font-weight:400;border-bottom:2px solid #3d5c7a">'+label+'</th>'
    +'<th colspan="2" style="padding:2px 8px;text-align:center;background:#0f2240;color:#8ba8c4;font-size:9px;font-weight:400;border-left:2px solid #3d5c7a;border-bottom:2px solid #3d5c7a">ВСИП</th>'
    +'<th colspan="2" style="padding:2px 8px;text-align:center;background:#0f2240;color:#8ba8c4;font-size:9px;font-weight:400;border-left:2px solid #3d5c7a;border-bottom:2px solid #3d5c7a">ТТ</th>'
    +'<th colspan="2" style="padding:2px 8px;text-align:center;background:#0f2240;color:#8ba8c4;font-size:9px;font-weight:400;border-left:2px solid #3d5c7a;border-bottom:2px solid #3d5c7a">Группа</th>'
    +'</tr></thead><tbody>'
    +SEC('ДОХОДЫ (поступления с НДС)','#dce8f5','#1e4080')
    +ROW('Выручка',v.incVat,v.incAmt,t.trVat,t.trAmt,gIncVat,gIncAmt)
    +SEC('ПЕРЕВОДЫ ВСИП → ТТ','#f0f4ff','#3730a3')
    +ROW('Сумма переводов (НДС)',v.trVat,v.trAmt,t.trVat,t.trAmt,gTrVat,gTrAmt)
    +SEC('РАСХОДЫ (с НДС)','#fdf2f2','#991b1b')
    +ROW('Расходы',v.expVat,v.expAmt,t.expVat,t.expAmt,gExpVat,gExpAmt)
    +ROWTOT('Итого НДС к вычету',v.totDed,t.totDed,gTotDed)
    +SEC('БАЛАНС НДС','#1e3a5f','#8ba8c4')
    +ROWVAT('НДС с поступлений',v.incVat,t.trVat,v.incVat+t.trVat)
    +ROWVAT('НДС к вычету',v.totDed,t.totDed,gTotDed)
    +ROWBAL('БАЛАНС (нач. − выч.)',v.bal,t.bal,gBal)
    +'</tbody></table>';

  // Карточки итога
  function card(org,val){
    var c=val>0?'#dc2626':val<0?'#059669':'#6b7280';
    var bg=val>0?'#fff5f5':val<0?'#f0fdf4':'#f9fafb';
    var bc=val>0?'#fecaca':val<0?'#bbf7d0':'#e5e7eb';
    var s=Math.abs(val).toFixed(2).replace(/\\B(?=(\\d{3})+(?!\\d))/g,' ');
    var w=val<0?'('+s+')':val>0?s:'0';
    var lbl=val>0?'к уплате':val<0?'к возмещению':'—';
    return'<div class="bal-item" style="background:'+bg+';border:1px solid '+bc+'">'
      +'<div style="font-size:9px;color:#6b7280;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">'+org+'</div>'
      +'<div style="font-size:15px;font-weight:700;color:'+c+'">'+w+'</div>'
      +'<div style="font-size:9px;color:'+c+';margin-top:2px">'+lbl+'</div>'
      +'</div>';
  }
  var cards='<div class="bal-box">'+card('ВСИП',v.bal)+card('ТИМ-ТРЕЙД',t.bal)+card('ГРУППА',gBal)+'</div>';

  return'<div style="margin-bottom:6px;padding-bottom:6px;border-bottom:1px solid #e5e7eb;font-size:12px;font-weight:600">'+label+'</div>'
    +tbl+cards;
}

// Загрузка
var busy=false;
function load(){
  if(busy)return; busy=true;
  var stEl=document.getElementById('st'), ctEl=document.getElementById('ct');
  var pts=qs.value.split(':'), y=parseInt(pts[0],10), q=parseInt(pts[1],10);
  var rng=getRange(y,q);
  stEl.innerHTML='&#9679; загрузка…'; stEl.style.color='#d97706';
  ctEl.innerHTML='<div style="padding:24px;text-align:center;color:#9ca3af">&#8987; '+rng.label+'…</div>';
  var t0=Date.now();
  fetchAll('transaction_pls',{
    'filter[date][start_date]':rng.s0,
    'filter[date][end_date]':rng.s1,
    'filter[category_id]':'1000,3144'
  }).then(function(pls){
    var c=calc(pls);
    ctEl.innerHTML=build(c.v,c.t,rng.label);
    stEl.innerHTML='&#9679; live · '+((Date.now()-t0)/1000).toFixed(1)+'с · '+pls.length+' PLS';
    stEl.style.color='#059669';
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
  res.setHeader('Content-Security-Policy', 'frame-ancestors *');
  res.end(HTML);
};
