// Browser integration test of the real component, with an isolated in-memory API.
// No Next server, authentication cookie, .env, database or Cloudinary account is used.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { build } from 'esbuild';
import { compile } from '@tailwindcss/node';
import { Scanner } from '@tailwindcss/oxide';

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'kono-media-ui-'));
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const fixture = `
import React from 'react';
import { createRoot } from 'react-dom/client';
import MediaManager from './src/components/admin/products/MediaManager';
const art = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="300"><rect width="400" height="300" fill="#ddd"/><rect x="400" width="400" height="300" fill="#aaa"/><text x="80" y="160" font-size="36">FRONT</text><text x="490" y="160" font-size="36">BACK</text></svg>');
let images = Array.from({length: location.search ? 24 : 3}, (_,i)=>({id:'image-'+i,productId:'mock-product',url:i===2?'data:image/png;base64,broken':art,alt:'Original description '+i,sortOrder:i,isPrimary:i===0,imageType:i===0?'MULTI_VIEW':i===1?'SIZE_CHART':'FRONT_VIEW'}));
window.__requests=[]; window.__transfers=0; window.__failAttach=false; window.__failEdit=false;
window.fetch=async (url,init={})=>{
 const method=init.method||'GET'; const body=init.body?JSON.parse(init.body):{}; window.__requests.push({url,method,body});
 const ok=data=>Response.json({success:true,data});
 if(url==='/api/admin/media/sign')return ok({uploadUrl:'https://api.cloudinary.com/v1_1/mock/image/upload',apiKey:'synthetic',signature:'synthetic',params:{overwrite:'false'},uploadToken:'synthetic',publicId:'mock/'+window.__requests.length,maxBytes:10485760});
 if(method==='POST'){if(window.__failAttach){window.__failAttach=false;return Response.json({success:false,message:'Verification temporarily unavailable.'},{status:502});} const image={...images[0],id:body.publicId,isPrimary:false,sortOrder:images.length,imageType:body.imageType,alt:body.alt};images.push(image);return ok(image);}
 if(url.endsWith('/media/reorder')){images=body.ids.map((id,i)=>({...images.find(x=>x.id===id),sortOrder:i}));return ok(images);}
 if(method==='PATCH'){if(window.__failEdit){window.__failEdit=false;return Response.json({success:false,message:'Could not save. Try again.'},{status:503});}const id=decodeURIComponent(url.split('/').pop());if(body.isPrimary)images=images.map(x=>({...x,isPrimary:false}));images=images.map(x=>x.id===id?{...x,...body}:x);return ok(images.find(x=>x.id===id));}
 if(method==='DELETE'){const id=url.split('/').pop();const image=images.find(x=>x.id===id);images=images.filter(x=>x.id!==id);return ok(image);}
 return ok(images);
};
window.XMLHttpRequest=class {upload={};withCredentials=false;status=200;open(method,url){if(!url.startsWith('https://api.cloudinary.com/'))throw Error('Unexpected destination');}send(body){window.__transfers++;if(body.has('api_secret'))throw Error('Secret in upload');setTimeout(()=>this.upload.onprogress?.({lengthComputable:true,loaded:50,total:100}),100);setTimeout(()=>this.onload?.(),700);}};
createRoot(document.getElementById('root')).render(<MediaManager productId="mock-product" productName="KONO Black Cargo Pants V2" initialImages={images}/>);
`;
let server, chrome, ws;
try {
  const bundle = await build({ stdin: { contents: fixture, resolveDir: process.cwd(), loader: 'tsx' }, bundle: true, write: false, platform: 'browser', format: 'iife', jsx: 'automatic', tsconfig: 'tsconfig.json', define: { 'process.env.NODE_ENV': '"development"' } });
  const compiler = await compile('@import "tailwindcss";', { base: process.cwd(), onDependency() {} });
  const scanner = new Scanner({ sources: [{ base: path.join(process.cwd(), 'src'), pattern: '**/*.{tsx,ts}', negated: false }] });
  const css = compiler.build(scanner.scan());
  server = http.createServer((req,res)=>{ if(req.url==='/bundle.js'){res.setHeader('Content-Type','text/javascript');res.end(bundle.outputFiles[0].text);}else if(req.url==='/style.css'){res.setHeader('Content-Type','text/css');res.end(css);}else{res.setHeader('Content-Type','text/html');res.end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><style>body{margin:0;padding:24px;background:#f5f5f5;font-family:Arial}#root{max-width:1400px;margin:auto}</style><div id="root"></div><script src="/bundle.js"></script>');} });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base='http://127.0.0.1:'+server.address().port;
  chrome=spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--remote-debugging-port=0','--remote-allow-origins=*','--user-data-dir='+path.join(scratch,'chrome'),'--no-first-run','--disable-background-networking','--disable-gpu','about:blank'],{windowsHide:true,stdio:'ignore'});
  let port;for(let i=0;i<60;i++){try{port=fs.readFileSync(path.join(scratch,'chrome','DevToolsActivePort'),'utf8').split('\n')[0];break;}catch{await delay(100);}}
  assert.ok(port,'Chrome debugging port');
  const pages=await(await fetch('http://127.0.0.1:'+port+'/json')).json();
  ws=new WebSocket(pages.find(p=>p.type==='page').webSocketDebuggerUrl);await new Promise(resolve=>ws.addEventListener('open',resolve,{once:true}));
  let sequence=0; const pending=new Map(); const events=[];
  ws.addEventListener('message',event=>{const message=JSON.parse(event.data);if(message.id){const task=pending.get(message.id);pending.delete(message.id);if(message.error)task.reject(Error(message.error.message));else task.resolve(message.result);}else events.push(message);});
  const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++sequence;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
  const evaluate=async expression=>{const result=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true,userGesture:true});if(result.exceptionDetails)throw Error(result.exceptionDetails.text+': '+result.exceptionDetails.exception?.description);return result.result.value;};
  const wait=async expression=>{for(let i=0;i<80;i++){if(await evaluate(`Boolean(${expression})`))return;await delay(50);}throw Error('Timed out: '+expression);};
  const click=async text=>{assert.equal(await evaluate(`(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()===${JSON.stringify(text)});if(!b||b.disabled)return false;b.click();return true})()`),true,'Clickable '+text);await delay(40);};
  const action=async name=>{assert.equal(await evaluate(`(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.getAttribute('aria-label')===${JSON.stringify(name)});if(!b||b.disabled)return false;b.click();return true})()`),true,name);await delay(50);};
  const columns=()=>evaluate(`getComputedStyle(document.querySelector('article').parentElement).gridTemplateColumns.split(' ').length`);
  const overflow=()=>evaluate(`document.documentElement.scrollWidth>innerWidth || [...document.querySelectorAll('article')].some(x=>x.scrollWidth>x.clientWidth)`);
  await send('Page.enable');await send('Page.setInterceptFileChooserDialog',{enabled:true});
  await send('Emulation.setDeviceMetricsOverride',{width:1536,height:1100,deviceScaleFactor:1,mobile:false});
  await send('Page.navigate',{url:base});await wait('document.querySelectorAll("article").length===3');
  assert.equal(await columns(),4);assert.equal(await overflow(),false);
  assert.equal(await evaluate('getComputedStyle(document.querySelector("article img")).objectFit'),'contain');
  await wait('document.body.innerText.includes("Image unavailable")');
  const snap=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});fs.writeFileSync(path.join(scratch,'desktop.png'),Buffer.from(snap.data,'base64'));
  assert.equal(await evaluate(`getComputedStyle([...document.querySelectorAll('button')].find(x=>x.textContent.includes('Browse Files'))).backgroundColor`),'oklch(0.145 0 none)','Primary button has visible dark background');
  await click('Browse Files');await delay(100);assert.ok(events.some(x=>x.method==='Page.fileChooserOpened'),'Browse opens native picker');
  const file=path.join(scratch,'mock.png');fs.writeFileSync(file,Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==','base64'));
  const doc=await send('DOM.getDocument');const node=await send('DOM.querySelector',{nodeId:doc.root.nodeId,selector:'input[type=file]'});await send('DOM.setFileInputFiles',{nodeId:node.nodeId,files:[file]});await wait('document.body.innerText.includes("mock.png")');
  assert.equal(await evaluate('window.__transfers'),0);
  await evaluate(`(()=>{const zone=document.querySelector('input[type=file]').parentElement;const data=new DataTransfer();data.items.add(new File(['mock'],'drop.webp',{type:'image/webp'}));zone.dispatchEvent(new DragEvent('dragover',{bubbles:true,cancelable:true,dataTransfer:data}));window.__dropData=data;})()`);
  assert.equal(await evaluate('window.__requests.length'),0,'Hover does not upload');
  await evaluate(`document.querySelector('input[type=file]').parentElement.dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:window.__dropData}))`);
  await wait('document.body.innerText.includes("drop.webp")');
  await evaluate('window.__failAttach=true');await click('Upload selected');await wait('document.querySelector("progress")?.value===50');await wait('document.body.innerText.includes("Retry verification")');
  assert.equal(await evaluate('window.__transfers'),1);await click('Retry verification');await wait('document.querySelectorAll("article").length===4');assert.equal(await evaluate('window.__transfers'),1,'Retry never reuploads asset');
  await click('Upload selected');await wait('document.querySelectorAll("article").length===5');assert.equal(await evaluate('window.__transfers'),2);
  await action('Edit details for image 1');await wait('document.querySelector("dialog[open] textarea")');
  await evaluate(`(()=>{const el=document.querySelector('textarea');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(el,'Edited mock description');el.dispatchEvent(new Event('input',{bubbles:true}));const select=document.querySelector('dialog[open] select');select.value='DETAIL';select.dispatchEvent(new Event('change',{bubbles:true}));window.__failEdit=true;})()`);
  await click('Save image details');await wait('document.querySelector("dialog[open] [role=alert]")');await click('Save image details');await wait('!document.querySelector("dialog[open]")');assert.equal(await evaluate('document.querySelector("article").textContent.includes("Edited mock description")'),true);
  await action('Set image 2 as primary');await wait('document.querySelectorAll("article")[1].textContent.includes("PRIMARY")');
  await action('Move image 2 earlier');await wait('window.__requests.some(x=>x.url.endsWith("/media/reorder"))');
  await action('Preview image 1');await wait('document.querySelector("dialog[open] input[type=range]")');
  assert.equal(await evaluate('getComputedStyle(document.querySelector("dialog[open] img")).objectFit'),'contain');
  await evaluate(`(()=>{const el=document.querySelector('input[type=range]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,'2');el.dispatchEvent(new Event('input',{bubbles:true}));})()`);await wait('document.querySelector("output").textContent==="200%"');await click('Close preview');
  await action('Remove image 2');await wait('document.querySelector("dialog[open]")');await click('Cancel');assert.equal(await evaluate('window.__requests.filter(x=>x.method==="DELETE").length'),0);
  await action('Remove image 2');await click('Confirm removal');await wait('document.querySelectorAll("article").length===4');
  for(const [width,count] of [[1280,3],[768,2],[390,1],[430,2]]){await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<768});await delay(100);assert.equal(await columns(),count,'Columns at '+width);assert.equal(await overflow(),false,'No overflow at '+width);}
  const mobile=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});fs.writeFileSync(path.join(scratch,'mobile.png'),Buffer.from(mobile.data,'base64'));
  await send('Page.navigate',{url:base+'?full'});await wait('document.querySelectorAll("article").length===24');assert.equal(await evaluate('document.querySelector("input[type=file]").disabled'),true);assert.equal(await overflow(),false);
  console.log(JSON.stringify({result:'PASS',checks:['native file picker','multi-file queue/drop without auto upload','byte progress','failed attach and retry without duplicate transfer','edit type/alt and save error in modal','primary','reorder','preview/zoom','delete cancel/confirm','broken URL placeholder','MULTI_VIEW/SIZE_CHART contain','responsive 390/430/768/1280/1536','24-image limit'],artifacts:scratch}));
} finally {
  ws?.close();chrome?.kill();server?.close();
}
