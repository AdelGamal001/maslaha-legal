/* Qaadet Maslaha: privacy-light visit counting with PostHog (EU cloud). Loaded after first paint, never blocks rendering.
   No cookies and no localStorage (persistence: 'memory'), no session recording, no person profiles, the IP is not sent, only
   clicks on links and buttons are auto-captured, and nothing loads at all when the browser says Do Not Track.
   The only two outside hosts are the two PostHog ones below (scripts/check-site5.mjs pins them). The key is PostHog's public
   write-only project key, the same project as the game; this site is told apart by $host (maslahagame.com) and surface 'site'.
   Events: $pageview, $pageleave (scroll depth), clicks on a/button, and site_cta { where, lang } on every game Instagram link
   (where = nav | hero | custom | play | footer, from the link's data-cta). */
(()=>{
const w=window,d=document,n=navigator;
if(n.doNotTrack==='1'||w.doNotTrack==='1'||n.msDoNotTrack==='1')return;
const KEY='phc_r4f8hDgcyBiZfSfhaWYjeYGigNkT4E7tvFauUAscDbrU',HOST='https://eu.i.posthog.com',ASSETS='https://eu-assets.i.posthog.com/static/array.js';

/* PostHog's own snippet pattern (https://posthog.com/docs/libraries/js): a stub that queues calls until array.js has loaded and replays them */
const ph=w.posthog=w.posthog||[];
if(ph.__SV)return;
ph._i=[];ph.people=[];
['capture','register'].forEach(m=>{ph[m]=function(){ph.push([m].concat([].slice.call(arguments)))}});
ph.init=function(k,c,name){
  const s=d.createElement('script');s.async=true;s.crossOrigin='anonymous';s.src=ASSETS;d.head.appendChild(s);
  ph._i.push([k,c,name])
};
ph.__SV=1;

/* clicks on the game's Instagram links, counted from the first click on (queued until the library is there) */
d.addEventListener('click',e=>{
  const a=e.target&&e.target.closest&&e.target.closest('a[data-cta]');
  if(a)w.posthog.capture('site_cta',{where:a.dataset.cta,lang:d.documentElement.lang})
},true);

const start=()=>{
  ph.init(KEY,{
    api_host:HOST,
    persistence:'memory',
    disable_session_recording:true,
    capture_pageview:true,
    capture_pageleave:true,
    autocapture:{dom_event_allowlist:['click'],element_allowlist:['a','button']},
    person_profiles:'never',
    ip:false,
    respect_dnt:true,
    capture_heatmaps:false,
    capture_performance:false,
    disable_surveys:true,
    advanced_disable_flags:true,
    advanced_disable_decide:true
  });
  ph.register({surface:'site',lang:d.documentElement.lang})
};
/* after the page has loaded and the browser is idle */
const idle=()=>('requestIdleCallback'in w?w.requestIdleCallback(start,{timeout:4000}):setTimeout(start,1500));
d.readyState==='complete'?idle():w.addEventListener('load',idle,{once:true});
})();
