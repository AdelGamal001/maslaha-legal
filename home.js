/* Qaadet Maslaha home: vanilla, no libraries, no requests. Reveals, count-ups, rolling queue digits,
   the ink line between steps (IntersectionObserver, no scroll handler), one rAF-throttled scroll tick
   for the progress bar and the hero parallax. Everything is skipped under prefers-reduced-motion. */
(()=>{
const d=document,$=s=>d.querySelector(s),$$=s=>[...d.querySelectorAll(s)],
rm=matchMedia('(prefers-reduced-motion: reduce)').matches,
pad=n=>String(n).padStart(3,'0');

/* rolling digits: each column is a 0-9 strip moved with translateY (transform only) */
const roll=(el,v)=>{
  if(!el._c){
    el.classList.add('roll');el.textContent='';el._c=[];
    for(let i=0;i<v.length;i++){const c=d.createElement('span');c.className='rd';
      c.innerHTML='<s>'+'0123456789'.replace(/./g,'<i>$&</i>')+'</s>';el.append(c);el._c.push(c.firstChild)}
  }
  el._c.forEach((s,i)=>{s.style.transitionDelay=rm?'0s':i*110+'ms';s.style.transform='translateY(-'+(+v[i])+'em)'})
};
const rollEls=$$('[data-roll]');
rollEls.forEach(e=>{const to=e.dataset.roll;roll(e,rm?to:'000');if(!rm)setTimeout(()=>roll(e,to),500)});

/* hero queue counter ticks like a ticket machine */
const num=$('#num');
if(num&&!rm){let v=12;setInterval(()=>{v=v>=46?12:v+1;roll(num,pad(v))},2600)}

/* reveal once, staggered by arrival order within a batch; the fan flips in the same way */
const io=new IntersectionObserver(es=>{let n=0;es.forEach(e=>{if(!e.isIntersecting)return;
  const t=e.target;t.style.setProperty('--i',n++);t.classList.add('in');io.unobserve(t)})},{threshold:.18,rootMargin:'0px 0px -6% 0px'});
$$('.reveal,.fan').forEach(e=>{if(e.classList.contains('rung')&&matchMedia('(max-width:860px)').matches)e.classList.add('in');else io.observe(e)});

/* stats count up */
const cu=new IntersectionObserver(es=>es.forEach(e=>{if(!e.isIntersecting)return;const b=e.target;cu.unobserve(b);
  if(rm)return;const to=+b.dataset.to;let t0;
  const f=t=>{t0=t0||t;const k=Math.min(1,(t-t0)/1200);b.textContent=Math.round(to*(1-(1-k)**3));k<1&&requestAnimationFrame(f)};
  b.textContent='0';requestAnimationFrame(f)}),{threshold:.6});
$$('.stat b').forEach(b=>cu.observe(b));

/* the ink line: 12 invisible markers per step; each marker that has crossed the 72% line adds 1/12 of --fill */
const N=12,mk=new Map();
const ln=new IntersectionObserver(es=>es.forEach(e=>{const m=mk.get(e.target);
  m.p[m.k]=e.isIntersecting||e.boundingClientRect.top<0;
  m.s.style.setProperty('--fill',(m.p.filter(Boolean).length/N).toFixed(3))}),{rootMargin:'0px 0px -28% 0px'});
$$('.stepx').forEach(s=>{
  if(rm){s.style.setProperty('--fill',1);return}
  const l=s.querySelector('.inkline'),p=Array(N).fill(false);
  for(let k=0;k<N;k++){const u=d.createElement('u');u.style.top=k/N*100+'%';l.append(u);mk.set(u,{s,p,k});ln.observe(u)}
});

/* small live counters inside the step pictures (a place in line, the boss countdown) */
const qn=$('.qn'),cd=$('.cd');
if(!rm){
  if(qn){let q=3;setInterval(()=>{q=q<=0?3:q-1;qn.textContent=q||qn.dataset.go},1500)}
  if(cd){let t=60;const sm=cd.querySelector('small').outerHTML;setInterval(()=>{t=t<=0?60:t-1;cd.innerHTML=t+sm},1000)}
}

/* scroll tick: top progress bar + a gentle hero parallax (max 12px) */
const bar=$('.qprog i'),art=$('.art');let tick=0;
const upd=()=>{tick=0;const h=d.documentElement,y=h.scrollTop;
  if(bar)bar.style.transform='scaleX('+(y/((h.scrollHeight-h.clientHeight)||1)).toFixed(4)+')';
  if(art&&!rm&&y<innerHeight)art.style.setProperty('--py',Math.min(12,y*.04).toFixed(1)+'px')};
addEventListener('scroll',()=>{tick||(tick=requestAnimationFrame(upd))},{passive:true});upd();
})();
