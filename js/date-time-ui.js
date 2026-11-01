/* MHS shared native date/time picker helpers for all portal sections. */
(function(){
 'use strict';
 const pad=n=>String(n).padStart(2,'0');
 const localDate=()=>{const d=new Date();return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());};
 const localTime=()=>{const d=new Date();return pad(d.getHours())+':'+pad(d.getMinutes());};
 const css='.mhs-date-tools{display:flex;gap:6px;flex-wrap:wrap;margin-top:5px}.mhs-picker-shortcut{border:1px solid #cbdad2;background:#f4f8f5;color:#176044;border-radius:7px;padding:4px 10px;font-size:12px;font-weight:700;cursor:pointer}.mhs-picker-shortcut:hover{background:#e5f2ea}.mhs-picker-shortcut:focus-visible{outline:2px solid #16805f;outline-offset:2px}input[type=date],input[type=time],input[type=datetime-local]{min-height:42px;max-width:100%;font:inherit;cursor:pointer}';
 const style=document.createElement('style');style.textContent=css;document.head.appendChild(style);
 function enhance(root){
  const nodes=[];if(root.matches?.('input[type=date],input[type=time],input[type=datetime-local]'))nodes.push(root);
  root.querySelectorAll?.('input[type=date],input[type=time],input[type=datetime-local]').forEach(x=>nodes.push(x));
  nodes.forEach(input=>{
   if(input.dataset.mhsPickerReady==='1')return;
   input.dataset.mhsPickerReady='1';
   const type=input.type,tools=document.createElement('div');tools.className='mhs-date-tools';
   const add=(label,value,clear=false)=>{
    const b=document.createElement('button');b.type='button';b.className='mhs-picker-shortcut';b.textContent=label;
    b.addEventListener('click',()=>{input.value=clear?'':value();input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));input.focus();});
    tools.appendChild(b);
   };
   if(type==='date'){add('Today',localDate);add('Clear',()=>'',true);}
   else if(type==='time'){add('Now',localTime);add('Clear',()=>'',true);}
   else {add('Now',()=>localDate()+'T'+localTime());add('Clear',()=>'',true);}
   input.insertAdjacentElement('afterend',tools);
  });
 }
 function watch(){enhance(document);new MutationObserver(ms=>ms.forEach(m=>m.addedNodes.forEach(n=>{if(n.nodeType===1)enhance(n);}))).observe(document.body,{childList:true,subtree:true});}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',watch);else watch();
})();