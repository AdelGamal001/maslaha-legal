/* Qaadet Maslaha, the «real numbers» box: visitors and Instagram followers come from the same-origin stats.json (a GitHub Action writes it),
   the live tile asks the game server's /stats once a minute. Vanilla; no tracking, no cookies, nothing stored. A number that is not there yet
   shows «soon», a live count that cannot be fetched shows a dash and hides its pulse dot. Counts up once when the box scrolls into view
   (not under prefers-reduced-motion). The page works without this file. */
(()=>{
const d=document,box=d.getElementById('real');if(!box)return;
const rm=matchMedia('(prefers-reduced-motion: reduce)').matches,
D=box.dataset,T={},V={},done={};
let seen=false;
box.querySelectorAll('.rt').forEach(t=>{T[t.dataset.k]=t;V[t.dataset.k]=undefined});
const num=n=>String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g,',');
const ok=n=>typeof n==='number'&&isFinite(n)&&n>=0;

function paint(k){
  const t=T[k],b=t.querySelector('b'),v=V[k];
  if(v===undefined)return;
  if(!ok(v)){t.dataset.state=k==='live'?'off':'soon';b.textContent=k==='live'?D.none:D.soon;return}
  t.dataset.state='on';b.style.setProperty('--n',num(v).length);
  if(seen&&!rm&&!done[k]){
    done[k]=1;let t0;
    const f=ts=>{t0=t0||ts;const p=Math.min(1,(ts-t0)/1100);b.textContent=num(v*(1-(1-p)**3));p<1?requestAnimationFrame(f):b.textContent=num(v)};
    b.textContent='0';requestAnimationFrame(f)
  }else b.textContent=num(v)
}
const all=()=>Object.keys(T).forEach(paint);

/* count up once, the first time the box is on screen */
if('IntersectionObserver'in window){
  new IntersectionObserver((es,o)=>{if(es.some(e=>e.isIntersecting)){seen=true;o.disconnect();all()}},{threshold:.35}).observe(box)
}else seen=true;

const get=(url,ms)=>{const c=new AbortController(),id=setTimeout(()=>c.abort(),ms);
  return fetch(url,{cache:'no-cache',credentials:'omit',referrerPolicy:'no-referrer',signal:c.signal}).then(r=>{if(!r.ok)throw 0;return r.json()}).finally(()=>clearTimeout(id))};

/* «last updated», in Cairo time, Western digits */
function stamp(iso){
  const x=new Date(iso);if(isNaN(x))return;
  let p;try{p=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Africa/Cairo',day:'numeric',month:'numeric',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(x).map(q=>[q.type,q.value]))}catch(e){return}
  const u=box.querySelector('.upd'),m=D.months.split(',')[p.month-1];
  u.textContent=D.updated+' '+(+p.day)+' '+m+(d.documentElement.lang==='ar'?'،':',')+' '+p.hour+':'+p.minute;u.hidden=false
}

get(D.json,8000).then(j=>{
  V.visitors=ok(j.visitors30d)?j.visitors30d:null;V.ig=ok(j.igFollowers)?j.igFollowers:null;
  paint('visitors');paint('ig');if(j.updatedAt&&(V.visitors!=null||V.ig!=null))stamp(j.updatedAt)
}).catch(()=>{V.visitors=V.ig=null;paint('visitors');paint('ig')});

const live=()=>{if(d.hidden&&V.live!==undefined)return;
  get(D.live,8000).then(j=>{V.live=ok(j.players)?j.players:null}).catch(()=>{V.live=null}).then(()=>paint('live'))};
live();setInterval(live,60000);
d.addEventListener('visibilitychange',()=>{if(!d.hidden)live()});
})();
