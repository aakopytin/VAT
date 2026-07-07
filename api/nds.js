function readBody(req) {
return new Promise(function(resolve) {
var d = '';
req.on('data', function(c) { d += c.toString(); });
req.on('end', function() { resolve(d); });
req.on('error',function() { resolve(''); });
});
}

function parseForm(body) {
var r = {};
if (!body) return r;
body.split('&').forEach(function(pair) {
var i = pair.indexOf('=');
if (i < 0) return;
r[decodeURIComponent(pair.slice(0, i).replace(/\+/g,' '))] =
decodeURIComponent(pair.slice(i+1).replace(/\+/g,' '));
});
return r;
}

async function handler(req, res) {
res.setHeader('X-Frame-Options', 'ALLOWALL');
res.setHeader('Content-Security-Policy', "frame-ancestors *");
res.setHeader('Content-Type', 'text/html; charset=utf-8');

if (req.method === 'POST') {
var raw = await readBody(req);
var fields = parseForm(raw);
var domain = fields['domain'] || '';
var accountId = fields['account[id]'] || '';
var accessToken = fields['auth[access_token]'] || '';
var vercelHost = req.headers['host'] || '';
console.log('[DDS] POST | domain:', domain, '| account:', accountId, '| hasToken:', !!accessToken, '| host:', vercelHost);
return res.status(200).send(html(domain, accountId, accessToken, vercelHost));
}

return res.status(200).send('<html><body style="font-family:sans-serif;padding:20px"><h3>&#x2713; ДДС виджет работает</h3></body></html>');
}

handler.config = { api: { bodyParser: false } };
module.exports = handler;

function esc(s) {
return String(s||'').replace(/\\/g,'\\\\').replace(/`/g,'\\`').replace(/\$/g,'\\$');
}

function html(domain, accountId, accessToken, vercelHost) {
var d=domain,a=accountId,t=accessToken,h=vercelHost;
return `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>ДДС</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;font-size:13px;background:#f8f9fd;color:#111827;padding:4px 6px;overflow-x:hidden}
table{border-collapse:collapse}
td{padding:1px 2px}
details summary{font-size:11px;color:#9ca3af;cursor:pointer;padding:4px 0}
details table td{font-size:11px;color:#555;padding:2px 4px}
</style>
</head>
<body>
<div id="filters" style="display:flex;gap:6px;align-items:center;margin-bottom:8px;padding-bottom:8px;border-bottom:1px solid #e5e7eb">
<select id="qs" style="font-size:12px;border:1px solid #d1d5db;border-radius:3px;padding:2px 6px;color:#374151;background:#fff;cursor:pointer"></select>
</div>
<div id="root" style="color:#9ca3af">ДДС — загрузка…</div>
<script>
(function(){
var DOMAIN="${esc(d)}";
var ACCOUNT_ID="${esc(a)}";
var TOKEN="${esc(t)}";
var API_BASE="${esc(h)}"?"https://${esc(h)}":(location.origin||"");

var VSIP={2:1,4:1,5:1,6:1,7:1,8:1};
var TT={18:1,26:1};
var OFF={24:1};
var PN={1:"Кемерово",3:"Южно-Сахалинск",10:"Большое Болдино",25:"Южно-Сахалинск",13:"Барнаул",12:"Киров",23:"Сыктывкар",9:"Рузаевка",7:"Иволгинск",6:"Десногорск",102:"Голутвинский",100:"Центральный договор",101:"Прочие проекты"};
var PO=[1,3,10,13,12,23,9,7,6,102,100,101];
var PG={2:100,4:101,18:100,19:100,21:101,29:100,30:100,31:100,32:100,33:102,17:101,20:101,22:101,28:101};
var AC={
"Перевод между счетами (поступление)":"tr","Перевод между счетами (списание)":"tr",
"Получение кредита":"skIn","Выплата кредита":"skOut",
"Оказание услуг":"pjIn","Оказание услуг проекту":"pjIn","Возврат ДС. за заказы":"refund",
"Проценты к получению":"pr","НДС исходящий":"pr","Налог - НДС":"pr",
"Зарплата":"zp","Налоги с зарплаты":"zp","Командировки":"km","Страхование":"ins",
"Расходы на услуги банков":"bk","Банковские услуги":"bk","Расходы на лизинг":"lz",
"Аренда":"ar","Бухгалтерия":"buh","Налоги и взносы":"ntax","Налоги - НДС":"ntax",
"Прочее":"po","Интернет и связь":"po","Проценты к уплате":"pct","Оборудование":"po",
"Возвраты клиентам":"pjOut","Нераспределенные":"po","Нераспределенные (списание)":"po","Офис":"po",
"СМР (Без детализации)":"pjOut","СМР Вент+кондиц":"pjOut",
"Материалы (Вентиляция)":"pjOut","Материалы (Отопление)":"pjOut","Материалы (Потолки)":"pjOut",
"Материалы (Проемы)":"pjOut","Материалы (Стены)":"pjOut","Материалы (Транспорт, Логистика)":"pjOut",
"Материалы (Электрика)":"pjOut","Материалы черновые":"pjOut",
"Проектирование-Изыскание":"pjOut","Составление исполнительной документации":"svc",
"Услуги по сертификации":"svc","Тесты и испытания":"svc","Банковские гарантии":"bg"
};

function fmt(v){if(v===null||v===undefined||v===0)return"—";return new Intl.NumberFormat("ru-RU",{minimumFractionDigits:0,maximumFractionDigits:0}).format(Math.round(v));}
function fmtI(v){return new Intl.NumberFormat("ru-RU",{minimumFractionDigits:0,maximumFractionDigits:0}).format(v||0);}
function _ddsNum(s){if(!s&&s!==0)return 0;return parseFloat(String(s).replace(/[^0-9.-]/g,""))||0;}
function getRange(){
  var qs=document.getElementById("qs");
  var val=qs?qs.value:"";
  var now=new Date(),y=now.getFullYear(),q=Math.ceil((now.getMonth()+1)/3);
  if(val){var pts=val.split(":");y=parseInt(pts[0],10);q=parseInt(pts[1],10);}
  var s0=[y+"-01-01",y+"-04-01",y+"-07-01",y+"-10-01"][q-1];
  var s1=[y+"-03-31",y+"-06-30",y+"-09-30",y+"-12-31"][q-1];
  var d0=s0.slice(8)+"."+s0.slice(5,7)+"."+s0.slice(0,4);
  var d1=s1.slice(8)+"."+s1.slice(5,7)+"."+s1.slice(0,4);
  return{s0:s0,s1:s1,d0:d0,d1:d1,label:"К"+q+" "+y,ymd:s0.slice(0,7)};
}

function getCurrMonth(rng){
  var now=new Date();
  var nowYM=now.getFullYear()*100+(now.getMonth()+1);
  var qStart=parseInt(rng.s0.slice(0,4))*100+parseInt(rng.s0.slice(5,7));
  var qEnd=parseInt(rng.s1.slice(0,4))*100+parseInt(rng.s1.slice(5,7));
  if(nowYM<qStart)return rng.s0.slice(0,7);
  if(nowYM>qEnd)return rng.s1.slice(0,7);
  var m=now.getMonth()+1;
  return now.getFullYear()+"-"+String(m).padStart(2,"0");
}
function monthEnd(ym){
  var y=parseInt(ym.slice(0,4)),m=parseInt(ym.slice(5,7));
  return ym+"-"+String(new Date(y,m,0).getDate()).padStart(2,"0");
}
var MONTHS_RU=["","Январь","Февраль","Март","Апрель","Май","Июнь","Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь"];

var lk=function(ym){return"dds_"+ACCOUNT_ID+"_"+ym;};
function clrF(ym){try{localStorage.removeItem(lk(ym));}catch(e){}}
var adjPrev={v:0,t:0},adjCurr={v:0,t:0},lastVatBalV=0,lastVatBalT=0;

function loadAll(entity,extra){
  var all=[],page=1;
  function next(){
    var p=new URLSearchParams(extra||{});
    p.set('entity',entity);p.set('limit','100');p.set('page',String(page));
    return fetch(API_BASE+'/api/data?'+p.toString()).then(function(r){
      if(!r.ok)throw new Error('HTTP '+r.status);
      return r.json();
    }).then(function(d){
      if(d.error)throw new Error(JSON.stringify(d.error));
      var items=(d.response&&d.response.items)||[];
      var total=(d.response&&d.response.total)||0;
      all=all.concat(items);
      if(all.length>=total||items.length===0)return all;
      page++;return next();
    });
  }
  return next();
}

function calc(txMonth,txAll,cats,plsData,rng){
  var cMap={};
  cats.forEach(function(c){cMap[c.id]=c.name||"";});

  var vSt=0,tSt=0,vEnd=0,tEnd=0;
  txAll.forEach(function(tx){
    if(!tx.date)return;
    var aid=tx.org_account_id;
    var inc=_ddsNum(tx.income)||0,out=_ddsNum(tx.outcome)||0;
    if(tx.date<rng.s0){if(VSIP[aid])vSt+=inc-out;if(TT[aid])tSt+=inc-out;}
    if(tx.date<=rng.s1){if(VSIP[aid])vEnd+=inc-out;if(TT[aid])tEnd+=inc-out;}
  });

  var vPr=0,tPr=0,vPjIn=0,tPjIn=0,piP_v={},piP_t={};
  var vRefund=0,tRefund=0,vPoIn=0,tPoIn=0;
  var refPG_v={},refPG_t={};
  var vPjOut=0,tPjOut=0,vPjOutOff=0,tPjOutOff=0,poP_v={},poP_t={};
  var vPjBg=0,tPjBg=0,vPjDesign=0,tPjDesign=0,vPjMat=0,tPjMat=0,vPjSmr=0,tPjSmr=0;
  var vZp=0,tZp=0,vKm=0,tKm=0,vIns=0,tIns=0,vBk=0,tBk=0;
  var vLz=0,tLz=0,vAr=0,tAr=0,vBuh=0,tBuh=0,vNtax=0,tNtax=0;
  var vPo=0,tPo=0,vPct=0,tPct=0,vBg=0,tBg=0;
  var trIn_v=0,trOut_v=0,trIn_t=0,trOut_t=0;
  var vSkIn=0,tSkIn=0,vSkOut=0,tSkOut=0;
  var poDet=[];

  // Pre-pass: determine which transfer reference_ids are internal (both legs same org)
  var trRef={};
  txMonth.forEach(function(tx){
    var ref=tx.reference_id;if(!ref)return;
    var aid=tx.org_account_id,cn=cMap[tx.category_id]||"";
    if(AC[cn]!=="tr")return;
    var isV=!!VSIP[aid],isT=!!TT[aid];if(!isV&&!isT)return;
    if(!trRef[ref])trRef[ref]={vIn:0,vOut:0,tIn:0,tOut:0};
    var inc=_ddsNum(tx.income)||0,out=_ddsNum(tx.outcome)||0;
    if(isV){trRef[ref].vIn+=inc;trRef[ref].vOut+=out;}
    if(isT){trRef[ref].tIn+=inc;trRef[ref].tOut+=out;}
  });

  txMonth.forEach(function(tx){
    var aid=tx.org_account_id,cn=cMap[tx.category_id]||"";
    var pid=tx.project_id||0;
    var inc=_ddsNum(tx.income)||0,out=_ddsNum(tx.outcome)||0;
    var isV=!!VSIP[aid],isT=!!TT[aid];
    if(!isV&&!isT)return;
    var rp=pid,gp=(rp&&PG[rp])?PG[rp]:rp;
    var pOk=gp&&!!PN[gp],pOff=rp&&!!OFF[rp];
    var cat=AC[cn];

    if(cat==="tr"){
      var ref=tx.reference_id,rf=ref?trRef[ref]:null;
      // skip internal transfers: both legs of same org present in period
      var intV=rf&&rf.vIn>0&&rf.vOut>0&&!rf.tIn&&!rf.tOut;
      var intT=rf&&rf.tIn>0&&rf.tOut>0&&!rf.vIn&&!rf.vOut;
      if(isV&&!intV){trIn_v+=inc;trOut_v+=out;}
      if(isT&&!intT){trIn_t+=inc;trOut_t+=out;}
      return;
    }
    if(inc>0){
      if(cat==="pr"){if(isV)vPr+=inc;if(isT)tPr+=inc;}
      else if(cat==="pjIn"&&pOk){if(isV){vPjIn+=inc;piP_v[gp]=(piP_v[gp]||0)+inc;}if(isT){tPjIn+=inc;piP_t[gp]=(piP_t[gp]||0)+inc;}}
      else if(cat==="refund"){if(isV){vRefund+=inc;if(pOk||pOff)refPG_v[gp]=1;}if(isT){tRefund+=inc;if(pOk||pOff)refPG_t[gp]=1;}}
      else if(cat==="skIn"){if(isV)vSkIn+=inc;if(isT)tSkIn+=inc;}
      else{if(isV)vPoIn+=inc;if(isT)tPoIn+=inc;}
    }
    if(out>0){
      if(cat==="zp"){if(isV)vZp+=out;if(isT)tZp+=out;}
      else if(cat==="km"){if(isV)vKm+=out;if(isT)tKm+=out;}
      else if(cat==="ins"){if(isV)vIns+=out;if(isT)tIns+=out;}
      else if(cat==="bk"){if(isV)vBk+=out;if(isT)tBk+=out;}
      else if(cat==="lz"){if(isV)vLz+=out;if(isT)tLz+=out;}
      else if(cat==="ar"){if(isV)vAr+=out;if(isT)tAr+=out;}
      else if(cat==="buh"){if(isV)vBuh+=out;if(isT)tBuh+=out;}
      else if(cat==="ntax"){if(isV)vNtax+=out;if(isT)tNtax+=out;}
      else if(cat==="pct"){if(isV)vPct+=out;if(isT)tPct+=out;}
      else if(cat==="bg"){
        if(pOff){if(isV)vBg+=out;if(isT)tBg+=out;}
        else{if(isV){vPjOut+=out;if(gp&&pOk){poP_v[gp]=(poP_v[gp]||0)+out;vPjBg+=out;}}if(isT){tPjOut+=out;if(gp&&pOk){poP_t[gp]=(poP_t[gp]||0)+out;tPjBg+=out;}}}
      }
      else if(cat==="skOut"){if(isV)vSkOut+=out;if(isT)tSkOut+=out;}
      else if(cat==="svc"){
        if(pOk){if(isV){vPjOut+=out;vPjDesign+=out;if(gp)poP_v[gp]=(poP_v[gp]||0)+out;}if(isT){tPjOut+=out;tPjDesign+=out;if(gp)poP_t[gp]=(poP_t[gp]||0)+out;}}
        else{if(isV)vPo+=out;if(isT)tPo+=out;poDet.push({date:tx.date,cat:cn,out:out});}
      }
      else if(cat==="po"){if(isV)vPo+=out;if(isT)tPo+=out;poDet.push({date:tx.date,cat:cn,out:out});}
      else if(cat==="pjOut"){
        if(pOk&&!pOff){
          var isDes_=cn==="Проектирование-Изыскание";var isMat_=/^Материалы/.test(cn);var isSmr_=/^СМР/.test(cn);
          if(isV){vPjOut+=out;if(isDes_)vPjDesign+=out;else if(isMat_)vPjMat+=out;else if(isSmr_)vPjSmr+=out;if(gp)poP_v[gp]=(poP_v[gp]||0)+out;}
          if(isT){tPjOut+=out;if(isDes_)tPjDesign+=out;else if(isMat_)tPjMat+=out;else if(isSmr_)tPjSmr+=out;if(gp)poP_t[gp]=(poP_t[gp]||0)+out;}
        }
        else{if(isV)vPjOutOff+=out;if(isT)tPjOutOff+=out;}
      }
      else if(pOff){if(isV)vPjOutOff+=out;if(isT)tPjOutOff+=out;}
      else{if(isV){vPjOut+=out;if(gp&&pOk)poP_v[gp]=(poP_v[gp]||0)+out;}if(isT){tPjOut+=out;if(gp&&pOk)poP_t[gp]=(poP_t[gp]||0)+out;}}
    }
  });

  // ─── НДС из transaction_pls ──────────────────────────────────────────────
  // 3147 income → доходные строки per-project (piP) или Возвраты (refPG)
  // 3144 outcome → расходные строки per-project (poP) или офисные (vVatOffV)
  // !pOk + pid=27 → vVatTr; !pOk + прочие → vVatOffV (3144) / vVatTr (3147)

  // ref_id → AC-категория расходной транзакции (для разбивки офисного НДС по строкам)
  var refCat_v={},refCat_t={};
  txMonth.forEach(function(tx){
    if(!tx.reference_id)return;
    var aid=tx.org_account_id,cn=cMap[tx.category_id]||"",cat=AC[cn];
    if(!cat)return;
    if(VSIP[aid])refCat_v[tx.reference_id]=cat;
    if(TT[aid])refCat_t[tx.reference_id]=cat;
  });
  // ref_id → подкатегория проектных расходов (bg/design/mat/smr/other) для VAT breakdown
  var refSubCat_v={},refSubCat_t={};
  txMonth.forEach(function(tx){
    if(!tx.reference_id)return;
    var aid=tx.org_account_id,cn=cMap[tx.category_id]||"",cat=AC[cn];
    if(!cat)return;
    if(cat==="bg"||cat==="svc"||cat==="pjOut"){
      var pid=tx.project_id||0,gp2=(pid&&PG[pid])?PG[pid]:pid,pOk2=gp2&&!!PN[gp2],pOff2=pid&&!!OFF[pid];
      if(pOk2&&!pOff2){
        var sub=cat==="bg"?"bg":cat==="svc"?"design":cn==="Проектирование-Изыскание"?"design":/^Материалы/.test(cn)?"mat":/^СМР/.test(cn)?"smr":"other";
        if(VSIP[aid])refSubCat_v[tx.reference_id]=sub;
        if(TT[aid])refSubCat_t[tx.reference_id]=sub;
      }
    }
  });

  var vVatPiP={},tVatPiP={},vVatPoP={},tVatPoP={};
  var vVatTr=0,tVatTr=0,vVatTrIn=0,tVatTrIn=0,vVatTrOut=0,tVatTrOut=0;
  var vVatRefV=0,tVatRefV=0;
  var vVatOffV=0,tVatOffV=0;
  var vVatTotalIn=0,tVatTotalIn=0,vVatTotalOut=0,tVatTotalOut=0;
  var vVatZp=0,tVatZp=0,vVatKm=0,tVatKm=0,vVatBk=0,tVatBk=0;
  var vVatIns=0,tVatIns=0,vVatLz=0,tVatLz=0,vVatAr=0,tVatAr=0;
  var vVatBuh=0,tVatBuh=0,vVatNtax=0,tVatNtax=0,vVatPo=0,tVatPo=0;
  var vVatPct=0,tVatPct=0,vVatBg=0,tVatBg=0,vVatPjOutOff=0,tVatPjOutOff=0;
  var vVatPjBg=0,tVatPjBg=0,vVatPjDesign=0,tVatPjDesign=0,vVatPjMat=0,tVatPjMat=0,vVatPjSmr=0,tVatPjSmr=0;

  (plsData||[]).forEach(function(p){
    if(!p.date||p.date<rng.s0||p.date>rng.s1)return;
    var is3144=p.category_id===3144,is3147=p.category_id===3147;
    if(!is3144&&!is3147)return;
    var pid=p.project_id||0;
    var gp=(pid&&PG[pid])?PG[pid]:pid;
    var pOk=gp&&!!PN[gp];
    if(is3147){
      // НДС поступлений: pid=27 всегда→trIn; per-project→piP; refund→refV; else→vVatTr
      var inc47=_ddsNum(p.income)||0;if(!inc47)return;
      // pid=27 must be checked BEFORE pOk — project 27 may exist in PN
      if(pid===27){
        if(p.org_id===1){var rf27a=p.reference_id?trRef[p.reference_id]:null;var intV27a=rf27a&&rf27a.vIn>0&&rf27a.vOut>0&&!rf27a.tIn&&!rf27a.tOut;if(!intV27a){vVatTrIn+=inc47;vVatTr+=inc47;}}
        else if(p.org_id===2){tVatTrIn+=inc47;tVatTr+=inc47;}
        return;
      }
      if(!pOk){if(p.org_id===1){if(refPG_v[gp]){vVatRefV+=inc47;vVatTotalIn+=inc47;}else{vVatTr+=inc47;}}else if(p.org_id===2){if(refPG_t[gp]){tVatRefV+=inc47;tVatTotalIn+=inc47;}else{tVatTr+=inc47;}}return;}
      if(p.org_id===1){
        if((piP_v[gp]||0)>0){vVatPiP[gp]=(vVatPiP[gp]||0)+inc47;}
        else if(refPG_v[gp]){vVatRefV+=inc47;}
        else{vVatTr+=inc47;}
        vVatTotalIn+=inc47;
      }else if(p.org_id===2){
        if((piP_t[gp]||0)>0){tVatPiP[gp]=(tVatPiP[gp]||0)+inc47;}
        else if(refPG_t[gp]){tVatRefV+=inc47;}
        else{tVatTr+=inc47;}
        tVatTotalIn+=inc47;
      }
    }
    if(is3144){
      // НДС платежей: pid=27 всегда→trOut; per-project→poP; прочие→vVatOffV
      var out44=_ddsNum(p.outcome)||0;if(!out44)return;
      // pid=27 must be checked BEFORE pOk — project 27 may exist in PN
      if(pid===27){
        if(p.org_id===1){var rf27b=p.reference_id?trRef[p.reference_id]:null;var intV27b=rf27b&&rf27b.vIn>0&&rf27b.vOut>0&&!rf27b.tIn&&!rf27b.tOut;if(!intV27b){vVatTrOut+=out44;vVatTr+=out44;}}
        else if(p.org_id===2){tVatTrOut+=out44;tVatTr+=out44;}
        return;
      }
      if(!pOk){
        {
          if(p.org_id===1){
            vVatOffV+=out44;vVatTotalOut+=out44;
            var oc=refCat_v[p.reference_id]||"po";
            if(oc==="zp")vVatZp+=out44;else if(oc==="km")vVatKm+=out44;else if(oc==="bk")vVatBk+=out44;
            else if(oc==="ins")vVatIns+=out44;else if(oc==="lz")vVatLz+=out44;else if(oc==="ar")vVatAr+=out44;
            else if(oc==="buh")vVatBuh+=out44;else if(oc==="ntax")vVatNtax+=out44;
            else if(oc==="pct")vVatPct+=out44;else if(oc==="bg")vVatBg+=out44;else if(oc==="pjOut")vVatPjOutOff+=out44;else vVatPo+=out44;
          }else if(p.org_id===2){
            tVatOffV+=out44;tVatTotalOut+=out44;
            var oc2=refCat_t[p.reference_id]||"po";
            if(oc2==="zp")tVatZp+=out44;else if(oc2==="km")tVatKm+=out44;else if(oc2==="bk")tVatBk+=out44;
            else if(oc2==="ins")tVatIns+=out44;else if(oc2==="lz")tVatLz+=out44;else if(oc2==="ar")tVatAr+=out44;
            else if(oc2==="buh")tVatBuh+=out44;else if(oc2==="ntax")tVatNtax+=out44;
            else if(oc2==="pct")tVatPct+=out44;else if(oc2==="bg")tVatBg+=out44;else if(oc2==="pjOut")tVatPjOutOff+=out44;else tVatPo+=out44;
          }
        }
        return;
      }
      if(p.org_id===1){
        vVatPoP[gp]=(vVatPoP[gp]||0)+out44;vVatTotalOut+=out44;
        var sv=refSubCat_v[p.reference_id]||"other";
        if(sv==="bg")vVatPjBg+=out44;else if(sv==="design")vVatPjDesign+=out44;else if(sv==="mat")vVatPjMat+=out44;else if(sv==="smr")vVatPjSmr+=out44;
      }
      else if(p.org_id===2){
        tVatPoP[gp]=(tVatPoP[gp]||0)+out44;tVatTotalOut+=out44;
        var sv2=refSubCat_t[p.reference_id]||"other";
        if(sv2==="bg")tVatPjBg+=out44;else if(sv2==="design")tVatPjDesign+=out44;else if(sv2==="mat")tVatPjMat+=out44;else if(sv2==="smr")tVatPjSmr+=out44;
      }
    }
  });

  // Привязка НДС поступлений к категориям ДДС через reference_id
  var vVatIncPr=0,tVatIncPr=0,vVatIncRef=0,tVatIncRef=0,vVatIncPoIn=0,tVatIncPoIn=0;
  (plsData||[]).forEach(function(p2){
    if(!p2.date||p2.date<rng.s0||p2.date>rng.s1)return;
    if(p2.category_id!==3147)return;
    var inc2=_ddsNum(p2.income)||0;if(!inc2)return;
    if(p2.org_id===1){
      var ic=refCat_v[p2.reference_id]||"";
      if(ic==="pr")vVatIncPr+=inc2;else if(ic==="refund")vVatIncRef+=inc2;else if(ic==="pjIn"){}else vVatIncPoIn+=inc2;
    }else if(p2.org_id===2){
      var ic2=refCat_t[p2.reference_id]||"";
      if(ic2==="pr")tVatIncPr+=inc2;else if(ic2==="refund")tVatIncRef+=inc2;else if(ic2==="pjIn"){}else tVatIncPoIn+=inc2;
    }
  });

  // Зеркалирование НДС трансферов: Аспро пишет только одну сторону ВСИП↔ТТ
  var tVatTrInD=tVatTrIn||vVatTrOut, tVatTrOutD=tVatTrOut||vVatTrIn;
  var vVatTrInD=vVatTrIn||tVatTrOut, vVatTrOutD=vVatTrOut||tVatTrIn;

  var vVatIncPjIn=Object.keys(vVatPiP).reduce(function(s,k){return s+(vVatPiP[k]||0);},0);
  var tVatIncPjIn=Object.keys(tVatPiP).reduce(function(s,k){return s+(tVatPiP[k]||0);},0);
  var pjIn=vPjIn+tPjIn,pr=vPr+tPr,refund=vRefund+tRefund,poIn=vPoIn+tPoIn;
  var tot=pjIn+pr+refund+poIn;
  var pjOut=vPjOut+tPjOut;
  var pjOutOff=vPjOutOff+tPjOutOff;
  var zp=vZp+tZp,km=vKm+tKm,bk=vBk+tBk,ins=vIns+tIns;
  var lz=vLz+tLz,ar=vAr+tAr,buh=vBuh+tBuh,ntax=vNtax+tNtax;
  var po=vPo+tPo,pct=vPct+tPct,bg=vBg+tBg;
  var te=pjOut+pjOutOff+zp+km+bk+ins+lz+ar+buh+ntax+po+pct+bg;
  var skIn=vSkIn+tSkIn,skOut=vSkOut+tSkOut;
  var trNetto=(trIn_v+trIn_t)-(trOut_v+trOut_t);
  var tS=vSt+tSt,tE=vEnd+tEnd;
  var ctrl=tS+tot+skIn-(te+skOut-trNetto)-tE;
  var vCtrl=vSt+(vPjIn+vPr+vRefund+vPoIn+vSkIn+trIn_v)-(vPjOut+vPjOutOff+vZp+vKm+vBk+vIns+vLz+vAr+vBuh+vNtax+vPo+vPct+vBg+vSkOut+trOut_v)-vEnd;
  var tCtrl=tSt+(tPjIn+tPr+tRefund+tPoIn+tSkIn+trIn_t)-(tPjOut+tPjOutOff+tZp+tKm+tBk+tIns+tLz+tAr+tBuh+tNtax+tPo+tPct+tBg+tSkOut+trOut_t)-tEnd;
  var cOk=Math.abs(ctrl)<1;

  return{vSt:vSt,tSt:tSt,vEnd:vEnd,tEnd:tEnd,tS:tS,tE:tE,
    vPr:vPr,tPr:tPr,pr:pr,vPjIn:vPjIn,tPjIn:tPjIn,piP_v:piP_v,piP_t:piP_t,pjIn:pjIn,
    vRefund:vRefund,tRefund:tRefund,refund:refund,vPoIn:vPoIn,tPoIn:tPoIn,poIn:poIn,tot:tot,
    vPjOut:vPjOut,tPjOut:tPjOut,pjOut:pjOut,vPjOutOff:vPjOutOff,tPjOutOff:tPjOutOff,pjOutOff:pjOutOff,poP_v:poP_v,poP_t:poP_t,
    vPjBg:vPjBg,tPjBg:tPjBg,vPjDesign:vPjDesign,tPjDesign:tPjDesign,vPjMat:vPjMat,tPjMat:tPjMat,vPjSmr:vPjSmr,tPjSmr:tPjSmr,
    vZp:vZp,tZp:tZp,zp:zp,vKm:vKm,tKm:tKm,km:km,vIns:vIns,tIns:tIns,ins:ins,
    vBk:vBk,tBk:tBk,bk:bk,vLz:vLz,tLz:tLz,lz:lz,vAr:vAr,tAr:tAr,ar:ar,
    vBuh:vBuh,tBuh:tBuh,buh:buh,vNtax:vNtax,tNtax:tNtax,ntax:ntax,
    vPo:vPo,tPo:tPo,po:po,vPct:vPct,tPct:tPct,pct:pct,vBg:vBg,tBg:tBg,bg:bg,te:te,
    trIn_v:trIn_v,trOut_v:trOut_v,trIn_t:trIn_t,trOut_t:trOut_t,trNetto:trNetto,
    vSkIn:vSkIn,tSkIn:tSkIn,skIn:skIn,vSkOut:vSkOut,tSkOut:tSkOut,skOut:skOut,
    vVatPiP:vVatPiP,tVatPiP:tVatPiP,vVatPoP:vVatPoP,tVatPoP:tVatPoP,
    vVatTr:vVatTr,tVatTr:tVatTr,vVatTrIn:vVatTrIn,tVatTrIn:tVatTrIn,vVatTrOut:vVatTrOut,tVatTrOut:tVatTrOut,
    vVatTrInD:vVatTrInD,tVatTrInD:tVatTrInD,vVatTrOutD:vVatTrOutD,tVatTrOutD:tVatTrOutD,
    vVatRefV:vVatRefV,tVatRefV:tVatRefV,
    vVatOffV:vVatOffV,tVatOffV:tVatOffV,
    vVatZp:vVatZp,tVatZp:tVatZp,vVatKm:vVatKm,tVatKm:tVatKm,vVatBk:vVatBk,tVatBk:tVatBk,
    vVatIns:vVatIns,tVatIns:tVatIns,vVatLz:vVatLz,tVatLz:tVatLz,vVatAr:vVatAr,tVatAr:tVatAr,
    vVatBuh:vVatBuh,tVatBuh:tVatBuh,vVatNtax:vVatNtax,tVatNtax:tVatNtax,vVatPo:vVatPo,tVatPo:tVatPo,
    vVatPct:vVatPct,tVatPct:tVatPct,vVatBg:vVatBg,tVatBg:tVatBg,vVatPjOutOff:vVatPjOutOff,tVatPjOutOff:tVatPjOutOff,
    vVatPjBg:vVatPjBg,tVatPjBg:tVatPjBg,vVatPjDesign:vVatPjDesign,tVatPjDesign:tVatPjDesign,vVatPjMat:vVatPjMat,tVatPjMat:tVatPjMat,vVatPjSmr:vVatPjSmr,tVatPjSmr:tVatPjSmr,
    vVatIncPr:vVatIncPr,tVatIncPr:tVatIncPr,vVatIncRef:vVatIncRef,tVatIncRef:tVatIncRef,vVatIncPoIn:vVatIncPoIn,tVatIncPoIn:tVatIncPoIn,
    vVatTotalIn:vVatTotalIn,tVatTotalIn:tVatTotalIn,vVatTotalOut:vVatTotalOut,tVatTotalOut:tVatTotalOut,
    vVatIncPjIn:vVatIncPjIn,tVatIncPjIn:tVatIncPjIn,
    ctrl:ctrl,vCtrl:vCtrl,tCtrl:tCtrl,cOk:cOk,poDet:poDet,cnt:txMonth.length,d0:rng.d0,d1:rng.d1,label:rng.label,ymd:rng.ymd};
}

function HDR(){
  var sb="width:9px;padding:1px 2px;font-size:11px;font-weight:700;color:#374151;border-bottom:2px solid #9ca3af;text-align:right;white-space:nowrap;overflow:hidden";
  var sn="width:7px;padding:1px 2px;font-size:11px;font-weight:700;color:#9ca3af;border-bottom:2px solid #9ca3af;text-align:right;white-space:nowrap;overflow:hidden";
  var sl="width:14px;padding:1px 2px;font-size:11px;font-weight:700;color:#374151;border-bottom:2px solid #9ca3af;overflow:hidden;white-space:nowrap;text-overflow:ellipsis";
  return"<tr><td style='"+sl+"'></td><td style='"+sb+"'>Итого</td><td style='"+sb+"'>ВСИП</td><td style='"+sn+"'>НДС</td><td style='"+sb+"'>ТТ</td><td style='"+sn+"'>НДС</td></tr>";
}
function TR6(l,tot,v,nv,t,nt,cls,ind){
  var cn="";if(cls==="g"&&(tot||0)>0)cn="color:#16a34a";if(cls==="r"&&(tot||0)<0)cn="color:#dc2626";if(cls==="m")cn="color:#6b7280";
  var sl="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:1px 2px;color:#1f2937;font-size:12px"+(ind?";padding-left:8px":"");
  var sr="padding:1px 2px;text-align:right;white-space:nowrap;font-size:12px;color:#1f2937";
  var sc=sr+(cn?";"+cn:"");
  var sn="padding:1px 2px;text-align:right;white-space:nowrap;font-size:11px;color:#6b7280";
  return"<tr><td style='"+sl+"'>"+l+"</td><td style='"+sc+"'>"+fmt(tot)+"</td><td style='"+sr+"'>"+fmt(v)+"</td><td style='"+sn+"'>"+fmt(nv)+"</td><td style='"+sr+"'>"+fmt(t)+"</td><td style='"+sn+"'>"+fmt(nt)+"</td></tr>";
}
function SEP6(l,tot,v,nv,t,nt,cls){
  var cn="";if(cls==="g"&&(tot||0)>0)cn="color:#16a34a";if(cls==="r"&&(tot||0)<0)cn="color:#dc2626";
  var s="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:1px 2px;font-weight:700;font-size:12px;color:#111827;border-top:1px solid #d1d5db";
  var sr=s+";text-align:right;white-space:nowrap";var sc=sr+(cn?";"+cn:"");var sn=sr+";color:#6b7280;font-weight:400;font-size:11px";
  return"<tr><td style='"+s+"'>"+l+"</td><td style='"+sc+"'>"+fmt(tot)+"</td><td style='"+sr+"'>"+fmt(v)+"</td><td style='"+sn+"'>"+fmt(nv)+"</td><td style='"+sr+"'>"+fmt(t)+"</td><td style='"+sn+"'>"+fmt(nt)+"</td></tr>";
}
function SEC(l){return"<tr><td colspan='6' style='padding:5px 4px 1px;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.07em;color:#6b7280;border-top:1px solid #e5e7eb'>"+l+"</td></tr>";}

// ─── Свод НДС — вспомогательные функции ──────────────────────────────────
function VSPH(){
  var s="width:55px;padding:1px 2px;font-size:13px;font-weight:700;color:#374151;border-bottom:2px solid #9ca3af;text-align:right;white-space:nowrap";
  var sl="padding:1px 2px;font-size:13px;font-weight:700;color:#374151;border-bottom:2px solid #9ca3af";
  return"<tr><td style='"+sl+"'></td><td style='"+s+"'>ВСИП</td><td style='"+s+"'>ТТ</td><td style='"+s+"'>Итого</td></tr>";
}
function VSPR(l,v,t,bold,cls){
  var tot=(v||0)+(t||0);
  var brd=bold?";border-top:1px solid #d1d5db":"";
  var fw=bold?";font-weight:700":"";
  var sl="padding:1px 2px;font-size:14px;color:#1f2937"+fw+brd;
  var sr="padding:1px 2px;text-align:right;font-size:14px;white-space:nowrap;color:#1f2937"+fw+brd;
  var cn="";
  if(bold&&cls==="r")cn=";color:#dc2626";
  else if(bold&&cls==="g")cn=";color:#16a34a";
  else if(!bold){cn=cls==="r"&&tot>0?";color:#dc2626":cls==="g"&&tot<0?";color:#16a34a":"";}
  return"<tr><td style='"+sl+cn+"'>"+l+"</td><td style='"+sr+cn+"'>"+fmt(v||0)+"</td><td style='"+sr+cn+"'>"+fmt(t||0)+"</td><td style='"+sr+cn+"'>"+fmt(tot)+"</td></tr>";
}
function VSPB(){return"<tr><td colspan='4' style='height:3px'></td></tr>";}
function VSPH2(label){
  var s="width:55px;padding:1px 2px;font-size:12px;font-weight:700;color:#374151;border-bottom:1px solid #9ca3af;text-align:right;white-space:nowrap";
  var sl="padding:1px 2px;font-size:12px;font-weight:700;color:#6b7280;border-bottom:1px solid #9ca3af";
  return"<tr><td style='"+sl+"'>"+label+"</td><td style='"+s+"'>Факт</td><td style='"+s+"'>План</td><td style='"+s+"'>Δ</td></tr>";
}
function VSPR2(l,fact,plan,bold,cls){
  var delta=(fact||0)-(plan||0);
  var fw=bold?";font-weight:700":"";
  var brd=bold?";border-top:1px solid #e5e7eb":"";
  var sl="padding:1px 2px;font-size:12px;color:#6b7280"+fw+brd;
  var sr="padding:1px 2px;text-align:right;font-size:12px;white-space:nowrap;color:#374151"+fw+brd;
  var sd="padding:1px 2px;text-align:right;font-size:12px;white-space:nowrap"+fw+brd;
  var dc=delta>0?";color:#dc2626":delta<0?";color:#16a34a":";color:#d1d5db";
  var dv=delta?fmt(delta):"—";
  return"<tr><td style='"+sl+"'>"+l+"</td><td style='"+sr+"'>"+fmt(fact||0)+"</td><td style='"+sr+"'>"+fmt(plan||0)+"</td><td style='"+sd+dc+"'>"+dv+"</td></tr>";
}
function VSPKUP(l,v,t){
  var tot=(v||0)+(t||0);
  var sl="padding:1px 2px;font-size:12px;color:#6b7280";
  var sr="padding:1px 2px;text-align:right;font-size:12px;white-space:nowrap";
  function cell(val){
    if(!val||val<=0)return'<td style="'+sr+'"><span style="color:#d1d5db">—</span></td>';
    return'<td style="'+sr+';font-weight:700;color:#dc2626">'+fmt(val)+'</td>';
  }
  return'<tr><td style="'+sl+'">'+l+'</td>'+cell(v)+cell(t)+cell(tot)+'</tr>';
}
function VSPKREF(l,v,t){
  var tot=(v||0)+(t||0);
  var sl="padding:1px 2px;font-size:12px;color:#6b7280";
  var sr="padding:1px 2px;text-align:right;font-size:12px;white-space:nowrap";
  function cell(val){
    if(!val||val>=0)return'<td style="'+sr+'"><span style="color:#d1d5db">—</span></td>';
    return'<td style="'+sr+';font-weight:700;color:#16a34a">'+fmt(Math.abs(val))+'</td>';
  }
  return'<tr><td style="'+sl+'">'+l+'</td>'+cell(v)+cell(t)+cell(tot)+'</tr>';
}
function VSPCORR(l,v,t){
  var tot=(v||0)+(t||0);
  var sl="padding:1px 2px;font-size:13px;color:#1f2937";
  var sr="padding:1px 2px;text-align:right;font-size:13px;white-space:nowrap;color:#1f2937";
  return'<tr><td style="'+sl+'">'+l+'</td>'
    +'<td style="'+sr+'">'+fmt(v||0)+'</td>'
    +'<td style="'+sr+'">'+fmt(t||0)+'</td>'
    +'<td style="'+sr+'">'+fmt(tot)+'</td>'
    +'</tr>';
}
function VSPITOG(l,idv,idt,idg){
  var brd=";border-top:1px solid #d1d5db";
  var sl="padding:1px 2px;font-size:13px;font-weight:700;color:#111827"+brd;
  var sr="padding:1px 2px;text-align:right;font-size:13px;font-weight:700;white-space:nowrap"+brd;
  return'<tr><td style="'+sl+'">'+l+'</td>'
    +'<td id="'+idv+'" style="'+sr+'">—</td>'
    +'<td id="'+idt+'" style="'+sr+'">—</td>'
    +'<td id="'+idg+'" style="'+sr+'">—</td>'
    +'</tr>';
}
function VSPROWID(l,idv,idt,idg){
  var sl="padding:1px 2px;font-size:12px;color:#6b7280";
  var sr="padding:1px 2px;text-align:right;font-size:12px;white-space:nowrap";
  return'<tr><td style="'+sl+'">'+l+'</td>'
    +'<td id="'+idv+'" style="'+sr+'">—</td>'
    +'<td id="'+idt+'" style="'+sr+'">—</td>'
    +'<td id="'+idg+'" style="'+sr+'">—</td>'
    +'</tr>';
}
function updateAdj(){
  var iv=lastVatBalV+adjPrev.v+adjCurr.v;
  var it=lastVatBalT+adjPrev.t+adjCurr.t;
  var ig=iv+it;
  function setH(id,html){var el=document.getElementById(id);if(el)el.innerHTML=html;}
  function fmtR(v){return v>0?'<span style="font-weight:700;color:#dc2626">'+fmt(v)+'</span>':'<span style="color:#d1d5db">—</span>';}
  function fmtG(v){return v<0?'<span style="font-weight:700;color:#16a34a">'+fmt(Math.abs(v))+'</span>':'<span style="color:#d1d5db">—</span>';}
  setH('itog-pay-v',fmtR(iv));setH('itog-pay-t',fmtR(it));setH('itog-pay-g',fmtR(ig));
  setH('itog-ref-v',fmtG(iv));setH('itog-ref-t',fmtG(it));setH('itog-ref-g',fmtG(ig));
}
function attachAdj(){updateAdj();}

function buildDataTable(r,title){
  function eff(nds,sum){
    if(!sum)return'<span style="color:#d1d5db">—</span>';
    if(!nds)return'0%';
    if(sum<=nds)return'<span style="color:#d1d5db">—</span>';
    return Math.round(nds/(sum-nds)*100)+'%';
  }
  function cellV(v){
    if(!v)return'<td style="padding:1px 5px;text-align:right;font-size:11px"><span style="color:#d1d5db">—</span></td>';
    return'<td style="padding:1px 5px;text-align:right;font-size:11px">'+fmt(v)+'</td>';
  }
  function ROW(lbl,sum,nds,ind){
    var sc='padding:1px 5px'+(ind?';padding-left:14px':'')+';font-size:11px;color:#374151;white-space:nowrap;overflow:hidden;text-overflow:ellipsis';
    return'<tr><td style="'+sc+'">'+lbl+'</td>'+cellV(sum)+cellV(nds)+'<td style="padding:1px 5px;text-align:right;font-size:11px;color:#6b7280">'+eff(nds,sum)+'</td></tr>';
  }
  function SEP(lbl,sum,nds){
    var sc='padding:2px 5px;font-size:11px;font-weight:700;color:#111827;border-top:1px solid #d1d5db;white-space:nowrap';
    var sr='padding:2px 5px;text-align:right;font-size:11px;font-weight:700;border-top:1px solid #d1d5db';
    return'<tr><td style="'+sc+'">'+lbl+'</td>'+
      '<td style="'+sr+'">'+(sum?fmt(sum):'<span style="color:#d1d5db">—</span>')+'</td>'+
      '<td style="'+sr+'">'+(nds?fmt(nds):'<span style="color:#d1d5db">—</span>')+'</td>'+
      '<td style="'+sr+';color:#6b7280">'+eff(nds,sum)+'</td></tr>';
  }
  function SECR(lbl){
    return'<tr><td colspan="4" style="padding:5px 5px 2px;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.07em;color:#6b7280;border-top:1px solid #e5e7eb">'+lbl+'</td></tr>';
  }
  var pjInVat=(r.vVatIncPjIn||0)+(r.tVatIncPjIn||0);
  var prVat=(r.vVatIncPr||0)+(r.tVatIncPr||0);
  var refVat=(r.vVatIncRef||0)+(r.tVatIncRef||0)+(r.vVatRefV||0)+(r.tVatRefV||0);
  var poInVat=(r.vVatIncPoIn||0)+(r.tVatIncPoIn||0);
  var projVat=(r.vVatTotalOut-r.vVatOffV)+(r.tVatTotalOut-r.tVatOffV);
  var offSum=r.zp+r.km+r.bk+(r.ins||0)+r.lz+r.ar+r.buh+r.ntax+r.pct+(r.bg||0)+r.po+(r.pjOutOff||0);
  var offVat=r.vVatOffV+r.tVatOffV;
  var pjBg=(r.vPjBg||0)+(r.tPjBg||0);
  var pjDesign=(r.vPjDesign||0)+(r.tPjDesign||0);
  var pjMat=(r.vPjMat||0)+(r.tPjMat||0);
  var pjSmr=(r.vPjSmr||0)+(r.tPjSmr||0);
  var pjBgVat=(r.vVatPjBg||0)+(r.tVatPjBg||0);
  var pjDesignVat=(r.vVatPjDesign||0)+(r.tVatPjDesign||0);
  var pjMatVat=(r.vVatPjMat||0)+(r.tVatPjMat||0);
  var pjSmrVat=(r.vVatPjSmr||0)+(r.tVatPjSmr||0);
  var hth='padding:1px 5px;font-size:10px;font-weight:700;color:#374151;border-bottom:2px solid #9ca3af;text-align:right;white-space:nowrap';
  var htl='padding:1px 5px;font-size:10px;font-weight:700;color:#374151;border-bottom:2px solid #9ca3af';
  var rows=[];
  rows.push('<tr><td style="'+htl+'"></td><td style="'+hth+'">Сумма</td><td style="'+hth+'">НДС</td><td style="'+hth+'">Ставка</td></tr>');
  rows.push(SECR('Поступления'));
  if(r.pjIn)rows.push(ROW('Поступления по проектам',r.pjIn,pjInVat,true));
  if(r.poIn)rows.push(ROW('Прочие проекты',r.poIn,poInVat,true));
  if(r.pr)rows.push(ROW('Процентные доходы',r.pr,prVat,true));
  if(r.refund)rows.push(ROW('Возвраты',r.refund,refVat,true));
  rows.push(SEP('Итого поступлений',r.tot,r.vVatTotalIn+r.tVatTotalIn));
  rows.push(SECR('Расходы по проектам'));
  if(pjBg)rows.push(ROW('Банковские гарантии',pjBg,pjBgVat,true));
  if(pjDesign)rows.push(ROW('Проектирование и изыскание',pjDesign,pjDesignVat,true));
  if(pjMat)rows.push(ROW('Материалы',pjMat,pjMatVat,true));
  if(pjSmr)rows.push(ROW('СМР',pjSmr,pjSmrVat,true));
  rows.push(SEP('Итого проекты',r.pjOut||0,projVat||0));
  rows.push(SECR('Офисные расходы'));
  if(r.zp)rows.push(ROW('Зарплата',r.zp,r.vVatZp+r.tVatZp,true));
  if(r.km)rows.push(ROW('Командировочные',r.km,r.vVatKm+r.tVatKm,true));
  if(r.bk)rows.push(ROW('Банковские комиссии',r.bk,r.vVatBk+r.tVatBk,true));
  if(r.lz)rows.push(ROW('Лизинг',r.lz,r.vVatLz+r.tVatLz,true));
  if(r.ar)rows.push(ROW('Аренда',r.ar,r.vVatAr+r.tVatAr,true));
  if(r.buh)rows.push(ROW('Бухгалтерия',r.buh,r.vVatBuh+r.tVatBuh,true));
  if(r.ntax)rows.push(ROW('Налоги и взносы',r.ntax,r.vVatNtax+r.tVatNtax,true));
  if(r.pct)rows.push(ROW('Проценты к уплате',r.pct,r.vVatPct+r.tVatPct,true));
  if(r.bg)rows.push(ROW('Банковские гарантии',r.bg,r.vVatBg+r.tVatBg,true));
  if(r.pjOutOff)rows.push(ROW('Возвр. клиентам',r.pjOutOff,r.vVatPjOutOff+r.tVatPjOutOff,true));
  if(r.po)rows.push(ROW('Прочие офисные',r.po,r.vVatPo+r.tVatPo,true));
  rows.push(SEP('Итого офисные',offSum,offVat));
  var totalExpVat=projVat+offVat;
  rows.push(SEP('ВСЕГО расходов НДС',r.pjOut+offSum,totalExpVat));
  return'<div style="margin-top:10px">'
    +'<div style="font-size:13px;font-weight:700;color:#374151;border-bottom:2px solid #9ca3af;padding:1px 2px 2px">'+(title||'Расчет эффективной ставки')+'</div>'
    +'<table style="border-collapse:collapse;width:100%">'+rows.join('')+'</table>'
    +'</div>';
}

function render(r,live){
  var rows=[];rows.push(HDR());
  rows.push(TR6("Остаток "+r.d0+" · ВСИП",r.vSt,r.vSt,null,null,null,"",""));
  rows.push(TR6("Остаток "+r.d0+" · ТТ",r.tSt,null,null,r.tSt,null,r.tSt<0?"r":"",""));
  rows.push(SEP6("ИТОГО на "+r.d0,r.tS,r.vSt,null,r.tSt,null,""));
  rows.push(TR6("Остаток "+r.d1+" · ВСИП",r.vEnd,r.vEnd,null,null,null,"",""));
  rows.push(TR6("Остаток "+r.d1+" · ТТ",r.tEnd,null,null,r.tEnd,null,r.tEnd<0?"r":"",""));
  rows.push(SEP6("ИТОГО на "+r.d1,r.tE,r.vEnd,null,r.tEnd,null,r.tE>=0?"g":"r"));

  rows.push(SEC("Поступления"));
  var hasPi=Object.keys(r.piP_v).length>0||Object.keys(r.piP_t).length>0;
  if(hasPi){
    PO.forEach(function(p){
      var pv=r.piP_v[p]||0,pt=r.piP_t[p]||0;
      if(pv||pt)rows.push(TR6(PN[p],pv+pt,pv,pv>0?r.vVatPiP[p]||0:null,pt,pt>0?r.tVatPiP[p]||0:null,"g",1));
    });
  }else if(r.pjIn){
    rows.push(TR6("Поступления по проектам",r.pjIn,r.vPjIn,null,r.tPjIn,null,"g",1));
  }
  if(r.pr)rows.push(TR6("Процентные доходы",r.pr,r.vPr,null,r.tPr,null,"g",1));
  if(r.refund)rows.push(TR6("Возвраты",r.refund,r.vRefund,r.vVatRefV||null,r.tRefund,r.tVatRefV||null,"g",1));
  if(r.poIn)rows.push(TR6("Прочие поступления",r.poIn,r.vPoIn,null,r.tPoIn,null,"g",1));
  rows.push(SEP6("Итого поступлений",r.tot,r.vPjIn+r.vPr+r.vRefund+r.vPoIn,r.vVatTotalIn,r.tPjIn+r.tPr+r.tRefund+r.tPoIn,r.tVatTotalIn,"g"));

  rows.push(SEC("Расходы по проектам"));
  var hasPo=Object.keys(r.poP_v).length>0||Object.keys(r.poP_t).length>0;
  if(hasPo){
    PO.forEach(function(p){
      var pv=r.poP_v[p]||0,pt=r.poP_t[p]||0;
      if(pv||pt)rows.push(TR6(PN[p],pv+pt,pv,r.vVatPoP[p]||0,pt,r.tVatPoP[p]||0,"",1));
    });
  }
  rows.push(SEP6("Итого проекты",r.pjOut,r.vPjOut,r.vVatTotalOut-r.vVatOffV||null,r.tPjOut,r.tVatTotalOut-r.tVatOffV||null,""));

  rows.push(SEC("Офисные расходы"));
  if(r.zp)rows.push(TR6("Зарплата",r.zp,r.vZp,r.vVatZp||null,r.tZp,r.tVatZp||null,"",1));
  if(r.km)rows.push(TR6("Командировочные",r.km,r.vKm,r.vVatKm||null,r.tKm,r.tVatKm||null,"",1));
  if(r.ins)rows.push(TR6("Страхование",r.ins,r.vIns,r.vVatIns||null,r.tIns,r.tVatIns||null,"",1));
  if(r.bk)rows.push(TR6("Банковские комиссии",r.bk,r.vBk,r.vVatBk||null,r.tBk,r.tVatBk||null,"",1));
  if(r.lz)rows.push(TR6("Лизинг",r.lz,r.vLz,r.vVatLz||null,r.tLz,r.tVatLz||null,"",1));
  if(r.ar)rows.push(TR6("Аренда",r.ar,r.vAr,r.vVatAr||null,r.tAr,r.tVatAr||null,"",1));
  if(r.buh)rows.push(TR6("Бухгалтерия",r.buh,r.vBuh,r.vVatBuh||null,r.tBuh,r.tVatBuh||null,"",1));
  if(r.ntax)rows.push(TR6("Налоги и взносы",r.ntax,r.vNtax,r.vVatNtax||null,r.tNtax,r.tVatNtax||null,"",1));
  if(r.pct)rows.push(TR6("Проценты к уплате",r.pct,r.vPct,r.vVatPct||null,r.tPct,r.tVatPct||null,"",1));
  if(r.bg)rows.push(TR6("Банковские гарантии",r.bg,r.vBg,r.vVatBg||null,r.tBg,r.tVatBg||null,"",1));
  if(r.pjOutOff)rows.push(TR6("Возвр. клиентам",r.pjOutOff,r.vPjOutOff,r.vVatPjOutOff||null,r.tPjOutOff,r.tVatPjOutOff||null,"",1));
  if(r.po)rows.push(TR6("Прочие офисные",r.po,r.vPo,r.vVatPo||null,r.tPo,r.tVatPo||null,"",1));
  var offV=r.vZp+r.vKm+r.vBk+r.vIns+r.vLz+r.vAr+r.vBuh+r.vNtax+r.vPo+r.vPct+r.vBg+r.vPjOutOff;
  var offT=r.tZp+r.tKm+r.tBk+r.tIns+r.tLz+r.tAr+r.tBuh+r.tNtax+r.tPo+r.tPct+r.tBg+r.tPjOutOff;
  rows.push(SEP6("Итого офисные",r.zp+r.km+r.bk+r.ins+r.lz+r.ar+r.buh+r.ntax+r.po+r.pct+r.bg+(r.pjOutOff||0),offV,r.vVatOffV||null,offT,r.tVatOffV||null,""));

  rows.push(SEC("Переводы между счетами"));
  if(r.trIn_v||r.trIn_t){
    rows.push(TR6("Получено",r.trIn_v+r.trIn_t,r.trIn_v,r.vVatTrInD||null,r.trIn_t,r.tVatTrInD||null,"g",1));
  }
  if(r.trOut_v||r.trOut_t){
    rows.push(TR6("Списано",r.trOut_v+r.trOut_t,r.trOut_v,r.vVatTrOutD||null,r.trOut_t,r.tVatTrOutD||null,"",1));
  }
  rows.push(SEP6("Нетто переводы",r.trNetto,(r.trIn_v-r.trOut_v),(r.vVatTrInD-r.vVatTrOutD)||null,(r.trIn_t-r.trOut_t),(r.tVatTrInD-r.tVatTrOutD)||null,r.trNetto>0?"g":r.trNetto<0?"r":""));

  if(r.skIn||r.skOut){
    rows.push(SEC("Финансирование (займы)"));
    if(r.skIn)rows.push(TR6("Получение займов",r.skIn,r.vSkIn,null,r.tSkIn,null,"g",1));
    if(r.skOut)rows.push(TR6("Погашение займов",r.skOut,r.vSkOut,null,r.tSkOut,null,"",1));
    rows.push(SEP6("Нетто займы",r.skIn-r.skOut,r.vSkIn-r.vSkOut,null,r.tSkIn-r.tSkOut,null,r.skIn-r.skOut>0?"g":r.skIn-r.skOut<0?"r":""));
  }

  rows.push(SEP6("ВСЕГО РАСХОДОВ",r.te+r.skOut-r.trNetto,null,r.vVatTotalOut||null,null,r.tVatTotalOut||null,""));
  rows.push(SEP6(r.cOk?"Контрольная сумма":"Контрольная сумма ⚠",r.ctrl,r.vCtrl,null,r.tCtrl,null,r.cOk?"g":"r"));

  // ─── Свод НДС (справа) ──────────────────────────────────────────────────
  // К уплате  = vVatTotalIn (3147 project income)
  // К возмещению = vVatTotalOut (3144 project+office; vVatOffV уже внутри)
  //              + vVatTrNet (нетто НДС по трансферам: уплачено − получено)
  // БАЛАНС = К уплате − К возмещению (>0 красный = к уплате; <0 зелёный = возмещение)
  var vVatTrNet=r.vVatTrOut-r.vVatTrIn;   // >0 = нетто отток ВСИП
  var tVatTrNet=r.tVatTrOut-r.tVatTrIn;
  var vatTotOut_v=r.vVatTotalOut+vVatTrNet;
  var vatTotOut_t=r.tVatTotalOut+tVatTrNet;
  var vatBalV=r.vVatTotalIn-vatTotOut_v;
  var vatBalT=r.tVatTotalIn-vatTotOut_t;
  var vst=[];
  vst.push(VSPH());
  vst.push(VSPR("НДС проекты",(r.vVatIncPjIn||0),(r.tVatIncPjIn||0),false,""));
  vst.push(VSPR("НДС прочие поступления",r.vVatTotalIn-(r.vVatIncPjIn||0),r.tVatTotalIn-(r.tVatIncPjIn||0),false,""));
  vst.push(VSPR("К уплате",r.vVatTotalIn,r.tVatTotalIn,true,"r"));
  vst.push(VSPB());
  vst.push(VSPR("НДС проекты",r.vVatTotalOut-r.vVatOffV,r.tVatTotalOut-r.tVatOffV,false,""));
  vst.push(VSPR("НДС офисные",r.vVatOffV,r.tVatOffV,false,""));
  vst.push(VSPR("НДС трансф.",vVatTrNet,tVatTrNet,false,""));
  vst.push(VSPR("К возмещению",vatTotOut_v,vatTotOut_t,true,"g"));
  vst.push(VSPB());
  var bCls=vatBalV>0?"r":vatBalV<0?"g":"";
  lastVatBalV=vatBalV;lastVatBalT=vatBalT;
  vst.push(VSPR("Баланс",vatBalV,vatBalT,true,bCls));
  vst.push(VSPKUP("  К уплате",vatBalV,vatBalT));
  vst.push(VSPKREF("  К возмещению",vatBalV,vatBalT));
  vst.push(VSPB());
  vst.push(VSPCORR("Корр. прош. кв.",adjPrev.v,adjPrev.t));
  vst.push(VSPCORR("Корр. тек. кв.",adjCurr.v,adjCurr.t));
  vst.push(VSPITOG("Итоговый Баланс","itog-v","itog-t","itog-g"));
  vst.push(VSPROWID("  К уплате","itog-pay-v","itog-pay-t","itog-pay-g"));
  vst.push(VSPROWID("  К возмещению","itog-ref-v","itog-ref-t","itog-ref-g"));
  if(r.planInc||r.planOut||r.estPlanVatIn||r.estPlanVatOut){
    var planVatIn=r.pVatIn||r.estPlanVatIn||0;
    var planVatOut=r.pVatOut||r.estPlanVatOut||0;
    vst.push(VSPB());
    vst.push(VSPH2("Прогноз (буд. мес. квартала)"));
    vst.push(VSPR2("НДС поступления",0,planVatIn,false,""));
    vst.push(VSPR2("НДС расходы",0,planVatOut,false,""));
    vst.push(VSPR2("Баланс",0,planVatIn-planVatOut,true,""));
  }

  var st=live?'<span style="color:#16a34a">● live · '+r.cnt+' тр.</span>':'<span style="color:#9ca3af">данные на '+r.d1+'</span>';
  return'<div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:8px;padding-bottom:6px;border-bottom:1px solid #e5e7eb;">'
    +'<div><div style="font-size:14px;font-weight:600">ДДС — '+r.label+'</div>'
    +'<div style="font-size:11px;color:#9ca3af;margin-top:1px">'+r.d0+' — '+r.d1+'</div></div>'
    +'<div style="display:flex;align-items:center;gap:5px;flex-shrink:0">'
    +'<span id="st" style="font-size:11px">'+st+'</span>'
    +'<button id="btn" style="background:none;border:1px solid #d1d5db;color:#6b7280;font-size:11px;padding:1px 6px;border-radius:3px;cursor:pointer">↻</button>'
    +'<button id="rst" style="background:none;border:1px solid #d1d5db;color:#9ca3af;font-size:11px;padding:1px 5px;border-radius:3px;cursor:pointer">⟳₀</button>'
    +'</div></div>'
    +'<div style="display:flex;gap:8px;align-items:flex-start">'
    +'<div style="flex:1;min-width:0;overflow:hidden"><table style="table-layout:fixed;width:100%">'+rows.join('')+'</table></div>'
    +'<div style="flex-shrink:0">'
    +'<div style="font-size:10px;font-weight:700;color:#374151;border-bottom:2px solid #9ca3af;padding:1px 2px 2px">Свод НДС</div>'
    +'<table style="border-collapse:collapse;table-layout:fixed">'+vst.join('')+'</table>'
    +(r.prevR?buildDataTable(r.prevR,'Эффективная ставка — прошлый квартал'):'')
    +'</div></div>'
    +'<div style="margin-top:5px;font-size:11px;color:#9ca3af">обновлено: '+new Date().toLocaleTimeString("ru-RU")+'</div>';
}

function renderPoDet(poDet){
  if(!poDet||!poDet.length)return;
  var d=document.createElement("details"),s=document.createElement("summary");
  var tot=poDet.reduce(function(a,p){return a+p.out;},0);
  s.textContent="Прочие расходы ("+poDet.length+" тр. на "+fmtI(tot)+" р.)";
  d.appendChild(s);
  var t=document.createElement("table");t.style.cssText="width:100%;border-collapse:collapse;margin-top:4px";
  poDet.sort(function(a,b){return b.out-a.out;}).forEach(function(p){
    var tr=document.createElement("tr");
    tr.innerHTML="<td style='padding:2px 4px;font-size:10px;color:#666'>"+p.date+"</td><td style='padding:2px 4px;font-size:10px;color:#666'>"+p.cat+"</td><td style='padding:2px 4px;font-size:10px;text-align:right'>"+fmtI(p.out)+"</td>";
    t.appendChild(tr);
  });
  d.appendChild(t);document.getElementById("root").appendChild(d);
}

function load(reset){
  var el=document.getElementById("root"),rng=getRange();
  if(reset)clrF(rng.ymd);
  var s=document.getElementById("st");
  if(s){s.textContent="загрузка…";s.style.color="#9ca3af";}
  Promise.all([
    loadAll("transaction"),
    loadAll("categories"),
    loadAll("transaction_pls",{"filter[category_id]":"3144,3147"}).catch(function(){return[];}),
    loadAll("plan_money").catch(function(){return[];}),
    loadAll("transaction",{"filter[org_account_id]":"149,150","filter[category_id]":"3144,3147"}).catch(function(){return[];})
  ]).then(function(res){
    var txAll=res[0],cats=res[1],pls=res[2];
    var rng=getRange();
    // Предыдущий квартал
    var currY=parseInt(rng.s0.slice(0,4),10),currQ=Math.ceil(parseInt(rng.s0.slice(5,7),10)/3);
    var prevQ=currQ-1,prevY=currY;
    if(prevQ===0){prevQ=4;prevY=currY-1;}
    var pqS0=[prevY+"-01-01",prevY+"-04-01",prevY+"-07-01",prevY+"-10-01"][prevQ-1];
    var pqS1=[prevY+"-03-31",prevY+"-06-30",prevY+"-09-30",prevY+"-12-31"][prevQ-1];
    // Корректировки НДС (счета 149=ВСИП, 150=ТТ)
    var corrTx=res[4]||[];
    function sumCorr(list,accId,s0,s1){
      var sum=0;
      (list||[]).forEach(function(tx){
        if(+tx.org_account_id!==accId)return;
        if(!tx.date||tx.date<s0||tx.date>s1)return;
        sum+=(_ddsNum(tx.income)||0)-(_ddsNum(tx.outcome)||0);
      });
      return sum;
    }
    adjPrev.v=sumCorr(corrTx,149,pqS0,pqS1)*(-1);
    adjPrev.t=sumCorr(corrTx,150,pqS0,pqS1)*(-1);
    adjCurr.v=sumCorr(corrTx,149,rng.s0,rng.s1);
    adjCurr.t=sumCorr(corrTx,150,rng.s0,rng.s1);
    var currMon=getCurrMonth(rng);
    var m0=currMon+"-01",m1=monthEnd(currMon);
    // Фактический НДС текущего месяца
    var mVatIn=0,mVatOut=0;
    (pls||[]).forEach(function(p){
      if(!p.date||p.date<m0||p.date>m1)return;
      if(p.org_id!==1&&p.org_id!==2)return;
      if(p.category_id===3147)mVatIn+=_ddsNum(p.income)||0;
      if(p.category_id===3144)mVatOut+=_ddsNum(p.outcome)||0;
    });
    // Плановые данные из plan_money — только для будущих месяцев квартала
    var planMs=res[3]||[];
    var planInc=0,planOut=0,pVatIn=0,pVatOut=0;
    var _pNow=new Date(),_pNowYM=_pNow.getFullYear()*100+(_pNow.getMonth()+1);
    planMs.forEach(function(pm){
      if(!pm.pls_date)return;
      var pmYM=parseInt(pm.pls_date.slice(0,4))*100+parseInt(pm.pls_date.slice(5,7));
      if(pmYM<=_pNowYM)return; // только строго будущие месяцы
      var pmM=pm.pls_date.slice(0,7);
      if(pmM<rng.s0.slice(0,7)||pmM>rng.s1.slice(0,7))return; // в пределах квартала
      if(pm.org_id!==3&&pm.org_account_id!==36)return;
      if(pm.type===30){planInc+=pm.total||0;pVatIn+=pm.vat_total||0;}
      if(pm.type===40){planOut+=pm.total||0;pVatOut+=pm.vat_total||0;}
    });
    // Расчёт прошлого квартала для таблицы эффективной ставки
    var txPrevM=txAll.filter(function(tx){return tx.date&&tx.date>=pqS0&&tx.date<=pqS1;});
    var prevRng={s0:pqS0,s1:pqS1,d0:pqS0,d1:pqS1,label:"К"+prevQ+" "+prevY,ymd:pqS0.slice(0,7)};
    var rPrev=txPrevM.length?calc(txPrevM,txAll,cats,pls,prevRng):null;
    // Применяем эффективную ставку прошлого квартала к плановым данным
    var estPlanVatIn=0,estPlanVatOut=0;
    if(rPrev&&rPrev.tot>0){
      var effIn=(rPrev.vVatTotalIn+rPrev.tVatTotalIn)/rPrev.tot;
      estPlanVatIn=Math.round(planInc*effIn);
    }
    if(rPrev&&rPrev.pjOut>0){
      var prevPjVat=(rPrev.vVatTotalOut-rPrev.vVatOffV)+(rPrev.tVatTotalOut-rPrev.tVatOffV);
      var effOut=prevPjVat/rPrev.pjOut;
      estPlanVatOut=Math.round(planOut*effOut);
    }
    var txM=txAll.filter(function(tx){return tx.date&&tx.date>=rng.s0&&tx.date<=rng.s1;});
    if(txM.length){
      var r=calc(txM,txAll,cats,pls,rng);
      r.mVatIn=mVatIn;r.mVatOut=mVatOut;r.mVatBal=mVatIn-mVatOut;
      r.pVatIn=pVatIn;r.pVatOut=pVatOut;r.pVatBal=pVatIn-pVatOut;
      r.planInc=planInc;r.planOut=planOut;
      r.currMon=currMon;r.currMonLabel=MONTHS_RU[parseInt(currMon.slice(5,7))]+' '+currMon.slice(0,4);
      r.prevR=rPrev;
      r.estPlanVatIn=estPlanVatIn;r.estPlanVatOut=estPlanVatOut;
      el.innerHTML=render(r,true);
      renderPoDet(r.poDet);
      attachAdj();
    }else{
      el.innerHTML="<div style='padding:12px;font-size:11px;color:#666'>Нет данных за "+rng.label+" ("+rng.s0+" — "+rng.s1+")</div>";
    }
    var b=document.getElementById("btn");if(b)b.onclick=function(){load(false);};
    var rb=document.getElementById("rst");if(rb)rb.onclick=function(){load(true);};
  }).catch(function(e){
    el.innerHTML="<div style='padding:12px;color:#dc2626'>Ошибка: "+e+"</div>";
    console.error("[DDS]",e);
  });
}

(function(){
  var now=new Date(),cY=now.getFullYear(),cQ=Math.ceil((now.getMonth()+1)/3);
  var defY=cY,defQ=cQ;
  var qs=document.getElementById("qs");
  for(var y=cY;y>=cY-1;y--){
    for(var q=4;q>=1;q--){
      if(y===cY&&q>cQ)continue;
      var o=document.createElement("option");
      o.value=y+":"+q;o.textContent="К"+q+" "+y;
      if(y===defY&&q===defQ)o.selected=true;
      qs.appendChild(o);
    }
  }
  qs.addEventListener("change",function(){load(false);});
})();

load(false);
setInterval(function(){load(false);},5*60*1000);
})();
</script>
</body>
</html>`;
}
