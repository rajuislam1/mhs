/* Load the active Supabase notice ticker on every public page. */
(function(){
 'use strict';
 document.addEventListener('DOMContentLoaded',async()=>{
  const target=document.getElementById('tickerItems');if(!target)return;
  try{
   if(!window.mhsSupabaseReady){
    await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='js/supabase.js';s.onload=resolve;s.onerror=()=>reject(new Error('Supabase client could not load'));document.head.appendChild(s);});
   }
   const sb=await window.mhsSupabaseReady;
   const {data,error}=await sb.from('notice_tickers').select('message,link_url').eq('is_active',true).order('display_order').limit(1).maybeSingle();
   if(error)throw error;
   if(data?.message){target.replaceChildren();const span=document.createElement('span');span.textContent=data.message;target.appendChild(span);}
  }catch(error){console.warn('MHS ticker refresh unavailable:',error?.message||error);}
 });
})();