// НДС widget — v2: transaction_pls + plan_money

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
table { width: 100%; border-collapse: collapse; font-size: 11px; }
th, td { white-space: nowrap; }
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

var PID = {
  1:'Кемерово',6:'Десногорск',12:'Киров',23:'Сыктывкар',13:'Барнаул',
  9:'Рузаевка',3:'Ю-Сахалинск',25:'Ю-Сахалинск',7:'Иволгинск',
  10:'Б.Болдино',33:'Голутвинский',
  2:'Центр.договор',18:'Центр.договор',19:'Центр.договор',
  29:'Центр.договор',30:'Центр.договор',31:'Центр.договор',32:'Центр.договор',
  4:'Прочие',17:'Прочие',20:'Прочие',21:'Прочие',22:'Прочие',
  24:'ОХР',26:'ОХР',27:'Трансферы'
};

// ── Квартальный селектор
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

// ── API
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

// ── Расчёт
function calc(pls,pmMap){
  var v={incVat:0,incAmt:0,trVat:0,trAmt:0,expVat:0,expAmt:0,byProj:{}};
  var t={incVat:0,incAmt:0,trVat:0,trAmt:0,expVat:0,expAmt:0,byProj:{}};

  pls.forEach(function(r){
    var oid=r.org_id, pid=r.project_id;
    var inc=parseFloat(r.income)||0, out=parseFloat(r.outcome)||0;
    var pm=pmMap[r.plan_money_id];
    var pmAmt=pm?Math.abs(parseFloat(pm.total)||0):0;
    var isTr=(pid===27);

    if(r.category_id===1000&&inc>0){
      // НДС начисленный: сумма = plan_money.total если есть, иначе vat*122/22 (все трансферы 22%)
      var amt=pmAmt||(inc*122/22);
      if(oid===1){
        if(isTr){v.trVat+=inc;v.trAmt+=amt;}
        else{v.incVat+=inc;v.incAmt+=amt;}
      }else if(oid===2){
        if(isTr){t.trVat+=inc;t.trAmt+=amt;}
        else{t.incVat+=inc;t.incAmt+=amt;}
      }
    }else if(r.category_id===3144&&out>0){
      // НДС к вычету: сумма из plan_money
      var amt=pmAmt;
      var pn=PID[pid]||'Прочие';
      if(oid===1){v.expVat+=out;v.expAmt+=amt;v.byProj[pn]=(v.byProj[pn]||0)+out;}
      if(oid===2){t.expVat+=out;t.expAmt+=amt;t.byProj[pn]=(t.byProj[pn]||0)+out;}
    }
  });

  v.totInc=v.incVat;
  v.totDed=v.trVat+v.expVat;
  v.bal=v.totInc-v.totDed;

  t.totInc=t.trVat+t.incVat;
  t.totDed=t.expVat;
  t.bal=t.totInc-t.totDed;

  return{v:v,t:t};
}

// ── Форматирование
function fmt(v){
  if(!v&&v!==0)return'<span style="color:#ccc">—</span>';
  if(v===0)return'<span style="color:#ccc">—</span>';
  var s=Math.abs(v).toFixed(2).replace(/\\B(?=(\\d{3})+(?!\\d))/g,' ');
  return v<0?'<span style="color:#dc2626">('+s+')</span>':s;
}
function fmtB(v){
  if(!v||Math.abs(v)<0.01)return'<span style="color:#9ca3af">0</span>';
  var s=Math.abs(v).toFixed(2).replace(/\\B(?=(\\d{3})+(?!\\d))/g,' ');
  var c=v>0?'#dc2626':'#059669';
  return'<strong style="color:'+c+'">'+(v<0?'('+s+')':s)+'</strong>';
}

// ── Таблица (точный формат листа Свод)
function build(v,t,label){
  var SEP=';border-left:2px solid #3d5c7a';
  var BT=';border-top:1px solid #e0e7ef';

  function TH(x,s){return'<th style="padding:5px 8px;text-align:right;border-bottom:2px solid #3d5c7a;font-size:10px;font-weight:600'+(s||'')+'">'+(x||'')+'</th>';}
  function THl(x,s){return'<th style="padding:5px 8px;text-align:left;border-bottom:2px solid #3d5c7a;font-size:10px;font-weight:600'+(s||'')+'">'+(x||'')+'</th>';}
  function TD(x,s){return'<td style="padding:3px 8px;text-align:right;border-bottom:1px solid #f0f0f0;white-space:nowrap'+(s||'')+'">'+(x||'')+'</td>';}
  function TDl(x,s){return'<td style="padding:3px 8px;border-bottom:1px solid #f0f0f0;white-space:nowrap'+(s||'')+'">'+(x||'')+'</td>';}

  function SEC(txt,bg,col,bdr){
    return'<tr style="background:'+bg+'"><td colspan="4" style="padding:5px 8px;font-weight:700;font-size:11px;color:'+col+';border-top:2px solid '+bdr+';border-bottom:1px solid '+bdr+'">'+txt+'</td></tr>';
  }
  function ROW(lbl,vv,tt,gg,indent){
    var l=(indent?'<span style="color:#9ca3af;margin-right:4px">▪</span>':'')+lbl;
    return'<tr>'+TDl(l,indent?';padding-left:16px':'')+TD(fmt(vv))+TD(fmt(tt),SEP)+TD(fmt(gg),SEP)+'</tr>';
  }
  function ROWTOT(lbl,vv,tt,gg,bg){
    return'<tr style="background:'+(bg||'#eef4fb')+'">'
      +TDl('<strong>'+lbl+'</strong>',BT)
      +TD('<strong>'+fmt(vv)+'</strong>',BT)
      +TD('<strong>'+fmt(tt)+'</strong>',SEP+BT)
      +TD('<strong>'+fmt(gg)+'</strong>',SEP+BT)
      +'</tr>';
  }
  function BAL(lbl,vv,tt,gg){
    return'<tr style="background:#1e3a5f">'
      +TDl('<strong style="color:#fff">'+lbl+'</strong>',BT)
      +TD(fmtB(vv),';color:#fff'+BT)
      +TD(fmtB(tt),';color:#fff'+SEP+BT)
      +TD(fmtB(gg),';color:#fff'+SEP+BT)
      +'</tr>';
  }

  // Группа = ВСИП + ТТ по каждой строке (как в Excel)
  var g={
    incAmt:v.incAmt+t.trAmt,  // ВСИП выручка + ТТ трансферы
    incVat:v.incVat+t.trVat,
    trAmt:v.trAmt+t.trAmt,    // переводы с обеих сторон
    trVat:v.trVat+t.trVat,
    expAmt:v.expAmt+t.expAmt,
    expVat:v.expVat+t.expVat,
    totDed:v.totDed+t.totDed,
    totInc:v.totInc+t.totInc,
    bal:v.bal+t.bal
  };

  // Разбивка по проектам
  var projs={};
  Object.keys(v.byProj).forEach(function(k){projs[k]=1;});
  Object.keys(t.byProj).forEach(function(k){projs[k]=1;});
  var projRows=Object.keys(projs).sort().map(function(p){
    var pv=v.byProj[p]||0, pt=t.byProj[p]||0;
    return'<tr>'
      +'<td style="padding:2px 8px 2px 20px;border-bottom:1px solid #f8f8f8;font-size:10px;color:#374151">'+p+'</td>'
      +'<td style="padding:2px 8px;text-align:right;border-bottom:1px solid #f8f8f8;font-size:10px">'+fmt(pv)+'</td>'
      +'<td style="padding:2px 8px;text-align:right;border-bottom:1px solid #f8f8f8;font-size:10px'+SEP+'">'+fmt(pt)+'</td>'
      +'<td style="padding:2px 8px;text-align:right;border-bottom:1px solid #f8f8f8;font-size:10px'+SEP+'">'+fmt(pv+pt)+'</td>'
      +'</tr>';
  }).join('');

  var tbl='<table style="width:100%;border-collapse:collapse;font-size:11px">'
    +'<thead>'
    +'<tr style="background:#1e3a5f;color:#fff">'
    +THl('Показатель',';min-width:220px')
    +TH('ВСИП, ₽')
    +TH('ТТ, ₽',SEP)
    +TH('Группа, ₽',SEP)
    +'</tr></thead><tbody>'
    // ДОХОДЫ
    +SEC('ДОХОДЫ','#dce7f5','#1e3a5f','#b8ccdf')
    +ROW('Выручка (поступления с НДС)',v.incAmt,t.trAmt,g.incAmt,true)
    +ROW('НДС с поступлений',v.incVat,t.trVat,g.incVat,true)
    // ПЕРЕВОДЫ
    +SEC('ПЕРЕВОДЫ ВСИП → ТТ','#f0f4ff','#3730a3','#c7d2fe')
    +ROW('Сумма переводов',v.trAmt,t.trAmt,g.trAmt,true)
    +ROW('НДС по переводам',v.trVat,t.trVat,g.trVat,true)
    // РАСХОДЫ
    +SEC('РАСХОДЫ (с НДС)','#fae8e8','#7f1d1d','#fca5a5')
    +ROW('Расходы с НДС',v.expAmt,t.expAmt,g.expAmt,true)
    +ROW('НДС к вычету (прочие)',v.expVat,t.expVat,g.expVat,true)
    +ROWTOT('Итого НДС к вычету',v.totDed,t.totDed,g.totDed,'#fef2f2')
    // РАСШИФРОВКА
    +SEC('НДС К ВЫЧЕТУ ПО ПРОЕКТАМ','#f8f9fd','#374151','#e5e7eb')
    +projRows
    // БАЛАНС
    +SEC('БАЛАНС НДС','#1e3a5f','#a8c4e0','#3d5c7a')
    +ROW('НДС с поступлений (начислен)',v.totInc,t.totInc,g.totInc,true)
    +ROW('НДС к вычету',v.totDed,t.totDed,g.totDed,true)
    +BAL('БАЛАНС (нач. − выч.)',v.bal,t.bal,g.bal)
    +'</tbody></table>';

  // Итоговые карточки
  function card(org,val){
    var pos=val>0, zero=Math.abs(val)<1;
    var bg=zero?'#f9fafb':pos?'#fff5f5':'#f0fdf4';
    var col=zero?'#6b7280':pos?'#dc2626':'#059669';
    var lbl=zero?'—':pos?'к уплате':'к возмещению';
    var s=zero?'0':Math.abs(val).toFixed(2).replace(/\\B(?=(\\d{3})+(?!\\d))/g,' ');
    var w=val<0?'('+s+')':s;
    return'<div class="bal-item" style="background:'+bg+';border:1px solid '+(zero?'#e5e7eb':pos?'#fecaca':'#bbf7d0')+'">'
      +'<div style="font-size:9px;color:#6b7280;text-transform:uppercase;letter-spacing:.05em;margin-bottom:3px">'+org+'</div>'
      +'<div style="font-size:14px;font-weight:700;color:'+col+'">'+w+'</div>'
      +'<div style="font-size:9px;color:'+col+';margin-top:1px">'+lbl+'</div>'
      +'</div>';
  }
  var cards='<div class="bal-box">'+card('ВСИП',v.bal)+card('ТТ',t.bal)+card('ГРУППА',g.bal)+'</div>';

  return'<div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px;padding-bottom:6px;border-bottom:1px solid #e5e7eb">'
    +'<span style="font-size:13px;font-weight:600">НДС — '+label+'</span>'
    +'</div>'
    +tbl+cards;
}

// ── Загрузка
var busy=false;
function load(){
  if(busy)return; busy=true;
  var stEl=document.getElementById('st'), ctEl=document.getElementById('ct');
  var pts=qs.value.split(':'), y=parseInt(pts[0],10), q=parseInt(pts[1],10);
  var rng=getRange(y,q);
  stEl.innerHTML='&#9679; загрузка…'; stEl.style.color='#d97706';
  ctEl.innerHTML='<div style="padding:24px;text-align:center;color:#9ca3af">&#8987; Загружаем данные за '+rng.label+'…</div>';
  var t0=Date.now();
  Promise.all([
    fetchAll('transaction_pls',{
      'filter[date][start_date]':rng.s0,
      'filter[date][end_date]':rng.s1,
      'filter[category_id]':'1000,3144'
    }),
    fetchAll('plan_money',{
      'filter[plan_paid_date][start_date]':rng.s0,
      'filter[plan_paid_date][end_date]':rng.s1
    })
  ]).then(function(res){
    var pls=res[0], pm=res[1];
    var pmMap={};
    pm.forEach(function(r){pmMap[r.id]=r;});
    var c=calc(pls,pmMap);
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
