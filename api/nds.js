// НДС Свод — v6
// Методология:
//   ВСИП ДОХОДЫ: cat=1000 org=1 (все, вкл. обратные переводы ТТ→ВСИП)
//   ТТ ДОХОДЫ:   cat=1000 или cat=3147, org=2 proj=27 (переводы ВСИП→ТТ)
//   ПЕРЕВОДЫ ВСИП→ТТ: ВСИП = cat=3144 org=1 proj=27 / ТТ = cat=1000 org=2 proj=27
//   РАСХОДЫ ВСИП: cat=3144 org=1 proj!=27
//   РАСХОДЫ ТТ:   cat=3144 org=2 (все, вкл. обратный перевод ТТ→ВСИП)
//   Суммы = НДС × (100+rate)/rate из поля name ("Налог 22%" → 122/22)

const HTML = `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>НДС — Свод</title>
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
table { width: 100%; border-collapse: collapse; font-size: 11px; min-width: 620px; }
</style>
</head>
<body>
<div class="hdr">
  <div>
    <span class="ttl">&#9783; Свод НДС</span>
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

// Ставка из названия: "Налог 22%" → factor=122/22
function rateF(name){
  var m=(name||'').match(/(\\d+)\\s*%/);
  var pct=m?parseInt(m[1]):22;
  return(100+pct)/pct;
}

/*
  Методология (Свод НДС):
  ДОХОДЫ:
    ВСИП: cat=1000 org=1 (все поступления: клиенты + обратные переводы ТТ→ВСИП)
    ТТ:   cat=1000 org=2, proj=27 (переводы ВСИП→ТТ = выручка ТТ)
  ПЕРЕВОДЫ ВСИП→ТТ:
    ВСИП: cat=3144 org=1, proj=27 (НДС к вычету по переводам ВСИП→ТТ)
    ТТ:   cat=1000 org=2, proj=27 (те же переводы со стороны ТТ = совпадает с ТТ ДОХОДЫ)
    Примечание: обратный перевод ТТ→ВСИП (cat=3144 org=2 proj=27) учтён в РАСХОДЫ ТТ.
  РАСХОДЫ:
    ВСИП: cat=3144 org=1, proj!=27 (прочие расходы ВСИП)
    ТТ:   cat=3144 org=2 (все расходы ТТ: прочие + обратный перевод ТТ→ВСИП)
  ИТОГО К ВЫЧЕТУ:
    ВСИП: cat=3144 org=1 (все = переводы + прочие)
    ТТ:   cat=3144 org=2 (все)
  БАЛАНС:
    ВСИП: cat=1000 org=1 (все) - cat=3144 org=1 (все)
    ТТ:   cat=1000 org=2 proj=27 - cat=3144 org=2 (все)
*/
function calc(pls){
  var v={incVat:0,incAmt:0, trVat:0,trAmt:0, expVat:0,expAmt:0};
  var t={trVat:0,trAmt:0, expVat:0,expAmt:0};
  var warn=[];

  pls.forEach(function(r){
    var oid=r.org_id, pid=r.project_id, cat=r.category_id;
    var inc=parseFloat(r.income)||0, out=parseFloat(r.outcome)||0;
    var rf=rateF(r.name);

    var pm=parseInt(r.plan_money_id)||0;
    var crm=parseInt(r.crm_account_id)||0;
    // Зеркальный перевод ВСИП↔ТТ идентифицируется с двух сторон:
    //   ВСИП-сторона: crm_account_id=250 (ТТ — контрагент в CRM ВСИП)
    //   ТТ-сторона:   cat=1000, org=2, proj=27, crm=837 (ВСИП — контрагент в CRM ТТ)
    var isVsipTransfer=(crm===250);
    // ТТ-сторона: cat=1000 (основной) или cat=3147 (используется для ряда платежей)
    var isTtIncoming=(oid===2&&(cat===1000||cat===3147)&&pid===27);

    // Правило включения: pm>0 и pm≠980, ИЛИ pm=0 при зеркальном переводе ВСИП↔ТТ
    if(pm===980) return;
    if(pm===0 && !isVsipTransfer && !isTtIncoming) return;

    // Флаг нестандартной ставки
    if((r.name||'').indexOf('20%')>-1) warn.push('⚠ Ставка 20%: PLS #'+r.id+' '+out.toFixed(0));

    if(cat===1000&&inc>0){
      if(oid===1){
        // ВСИП: поступления с НДС (cat=1000)
        v.incVat+=inc; v.incAmt+=inc*rf;
      } else if(oid===2&&pid===27){
        // ТТ: поступления от ВСИП (proj=27, crm=837 в CRM ТТ)
        t.trVat+=inc; t.trAmt+=inc*rf;
      }
    } else if(cat===3147&&inc>0&&oid===2&&pid===27){
      // ТТ: поступления от ВСИП, записаны как cat=3147 (Налог НДС)
      t.trVat+=inc; t.trAmt+=inc*rf;
    } else if(cat===3144&&out>0){
      if(oid===1&&isVsipTransfer){
        // ВСИП: НДС по переводам ВСИП→ТТ (crm=250)
        v.trVat+=out; v.trAmt+=out*rf;
      } else if(oid===1){
        // ВСИП: прочие расходы
        v.expVat+=out; v.expAmt+=out*rf;
      } else if(oid===2){
        // ТТ: расходы
        t.expVat+=out; t.expAmt+=out*rf;
      }
    }
  });

  v.totDed=v.trVat+v.expVat;
  v.bal=v.incVat-v.totDed;
  t.totDed=t.expVat;
  t.bal=t.trVat-t.totDed;

  // Проверка симметрии переводов: ВСИП НДС по переводам = ТТ НДС с поступлений
  var trDiff=Math.abs(v.trVat-t.trVat);
  if(trDiff>1){
    warn.push('⚠ Асимметрия переводов ВСИП↔ТТ: Δ='+trDiff.toFixed(2)
      +' (ВСИП '+v.trVat.toFixed(2)+' ≠ ТТ '+t.trVat.toFixed(2)+')');
  }

  return{v:v,t:t,warn:warn};
}

function fmt(v,bold){
  if(!v||Math.abs(v)<0.01)return'<span style="color:#d1d5db">—</span>';
  var s=Math.abs(v).toFixed(2).replace(/\\B(?=(\\d{3})+(?!\\d))/g,' ');
  var txt=v<0?'('+s+')':s;
  return bold?'<strong>'+txt+'</strong>':txt;
}
function fmtC(v){
  if(!v||Math.abs(v)<0.01)return'<span style="color:#9ca3af">0</span>';
  var s=Math.abs(v).toFixed(2).replace(/\\B(?=(\\d{3})+(?!\\d))/g,' ');
  var c=v>0?'#dc2626':'#059669';
  var lbl=v>0?' (к уплате)':' (к возм.)';
  return'<strong style="color:'+c+'">'+(v<0?'('+s+')':s)+'</strong>'
    +'<span style="font-size:9px;color:'+c+'">'+lbl+'</span>';
}

// Строим таблицу в формате листа "Свод НДС Июнь" (4 колонки)
function build(v,t,label){
  var g={
    incVat:v.incVat+t.trVat, incAmt:v.incAmt+t.trAmt,
    trVat:v.trVat+t.trVat,   trAmt:v.trAmt+t.trAmt,
    expVat:v.expVat+t.expVat, expAmt:v.expAmt+t.expAmt,
    totDed:v.totDed+t.totDed, bal:v.bal+t.bal
  };

  var S=';border-left:2px solid #3d6b9f';
  var BT=';border-top:1px solid #c3d4e8';
  var P='padding:3px 10px;border-bottom:1px solid #eef2f7;white-space:nowrap';

  function TH(x,s){return'<th style="padding:4px 10px;text-align:right;color:#fff;font-size:10px;font-weight:600'+(s||'')+'">'+(x||'')+'</th>';}
  function THl(x){return'<th style="padding:4px 10px;text-align:left;color:#fff;font-size:10px;font-weight:600">'+x+'</th>';}
  function TD(x,s,bg){return'<td style="'+P+';text-align:right'+(s||'')+(bg?';background:'+bg:'')+'">'+(x||'—')+'</td>';}
  function TDl(x,s,bg){return'<td style="'+P+(s||'')+(bg?';background:'+bg:'')+'">'+(x||'')+'</td>';}

  // Секция-заголовок
  function SEC(txt,c1,c2){
    return'<tr style="background:'+c1+'">'
      +'<td colspan="4" style="padding:4px 10px;font-size:11px;font-weight:700;color:'+c2
      +';border-top:2px solid '+c2+';border-bottom:1px solid '+c2+'">'+txt+'</td></tr>';
  }
  // Строка с суммой (два значения: сумма и НДС → показываем в 3 колонках)
  // Колонки: Показатель | ВСИП | ТТ | Группа
  function ROW(lbl, va, ta, ga, indent, bold){
    var l=(indent?'<span style="padding-left:12px;display:inline-block"></span>':'')+lbl;
    return'<tr>'
      +TDl(bold?'<strong>'+l+'</strong>':l)
      +TD(fmt(va,bold),S)
      +TD(fmt(ta,bold),S)
      +TD(fmt(ga,bold),S)
      +'</tr>';
  }
  // Строка баланса (цветная)
  function ROWBAL(lbl, va, ta, ga){
    return'<tr style="background:#f0f4ff;border-top:3px solid #1e3a5f">'
      +TDl('<strong style="color:#1e3a5f">'+lbl+'</strong>',BT)
      +'<td style="'+P+';text-align:right'+S+BT+'">'+fmtC(va)+'</td>'
      +'<td style="'+P+';text-align:right'+S+BT+'">'+fmtC(ta)+'</td>'
      +'<td style="'+P+';text-align:right'+S+BT+'">'+fmtC(ga)+'</td>'
      +'</tr>';
  }

  var tbl='<table>'
    // Шапка: Показатель | ВСИП | ТТ | Группа
    +'<thead><tr style="background:#1e3a5f">'
    +THl('Показатель — '+label)
    +TH('ВСИП, ₽',S)
    +TH('ТИМ-ТРЕЙД, ₽',S)
    +TH('Группа, ₽',S)
    +'</tr></thead><tbody>'

    // ДОХОДЫ
    +SEC('I. ДОХОДЫ (поступления с НДС)','#dbe9f8','#1e4080')
    +ROW('Сумма поступлений', v.incAmt, t.trAmt, g.incAmt, true)
    +ROW('НДС с поступлений', v.incVat, t.trVat, g.incVat, true)

    // ПЕРЕВОДЫ
    +SEC('II. ПЕРЕВОДЫ ВСИП → ТТ','#eff2ff','#3730a3')
    +ROW('Сумма переводов', v.trAmt, t.trAmt, g.trAmt, true)
    +ROW('НДС по переводам', v.trVat, t.trVat, g.trVat, true)

    // РАСХОДЫ
    +SEC('III. РАСХОДЫ (с НДС)','#fef2f2','#991b1b')
    +ROW('Расходы с НДС', v.expAmt, t.expAmt, g.expAmt, true)
    +ROW('НДС к вычету', v.expVat, t.expVat, g.expVat, true)
    +ROW('Итого НДС к вычету', v.totDed, t.totDed, g.totDed, false, true)

    // БАЛАНС НДС
    +SEC('IV. БАЛАНС НДС','#1e3a5f','#ffffff')
    +ROW('НДС начисленный', v.incVat, t.trVat, g.incVat, true)
    +ROW('НДС к вычету', v.totDed, t.totDed, g.totDed, true)
    +ROWBAL('БАЛАНС (нач. − выч.)', v.bal, t.bal, g.bal)

    +'</tbody></table>';

  function card(org,val){
    var c=val>0?'#dc2626':val<0?'#059669':'#6b7280';
    var bg=val>0?'#fff5f5':val<0?'#f0fdf4':'#f9fafb';
    var bc=val>0?'#fca5a5':val<0?'#86efac':'#e5e7eb';
    var s=Math.abs(val).toFixed(2).replace(/\\B(?=(\\d{3})+(?!\\d))/g,' ');
    var lbl=val>0?'к уплате':val<0?'к возмещению':'—';
    return'<div class="bal-item" style="background:'+bg+';border:1px solid '+bc+'">'
      +'<div style="font-size:9px;color:#6b7280;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">'+org+'</div>'
      +'<div style="font-size:15px;font-weight:700;color:'+c+'">'+(val<0?'('+s+')':s)+'</div>'
      +'<div style="font-size:9px;color:'+c+';margin-top:2px">'+lbl+'</div>'
      +'</div>';
  }
  var cards='<div class="bal-box">'+card('ВСИП',v.bal)+card('ТИМ-ТРЕЙД',t.bal)+card('ГРУППА',g.bal)+'</div>';

  return tbl+cards;
}

var busy=false;
function load(){
  if(busy)return; busy=true;
  var stEl=document.getElementById('st'), ctEl=document.getElementById('ct');
  var pts=qs.value.split(':'), y=parseInt(pts[0],10), q=parseInt(pts[1],10);
  var rng=getRange(y,q);
  stEl.innerHTML='&#9679; загрузка…'; stEl.style.color='#d97706';
  ctEl.innerHTML='<div style="padding:24px;text-align:center;color:#9ca3af">&#8987; '+rng.label+'…</div>';
  var t0=Date.now();
  var dateF={'filter[date][start_date]':rng.s0,'filter[date][end_date]':rng.s1};
  // Три запроса: cat=1000 (поступления), cat=3144 (расходы/переводы), cat=3147 (ТТ НДС alt)
  Promise.all([
    fetchAll('transaction_pls',Object.assign({'filter[category_id]':'1000'},dateF)),
    fetchAll('transaction_pls',Object.assign({'filter[category_id]':'3144'},dateF)),
    fetchAll('transaction_pls',Object.assign({'filter[category_id]':'3147'},dateF))
  ]).then(function(results){
    var pls=results[0].concat(results[1]).concat(results[2]);
    var c=calc(pls);
    var warnHtml=c.warn.length
      ?'<div style="padding:4px 10px;background:#fffbeb;border:1px solid #fde68a;border-radius:4px;font-size:10px;color:#92400e;margin-bottom:6px">'
        +c.warn.join(' · ')+'</div>'
      :'';
    ctEl.innerHTML=warnHtml+build(c.v,c.t,rng.label);
    stEl.innerHTML='&#9679; live · '+((Date.now()-t0)/1000).toFixed(1)+'с · '+pls.length+' PLS'
      +(c.warn.length?' ⚠'+c.warn.length:'');
    stEl.style.color=c.warn.length?'#d97706':'#059669';
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
