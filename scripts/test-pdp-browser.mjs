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

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'kono-pdp-ui-'));
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const fixture = `
import React from 'react';
import { createRoot } from 'react-dom/client';
import ProductDetail from './src/components/storefront/ProductDetail';
import { StorefrontHeader, StorefrontFooter } from './src/components/storefront/StorefrontShell';
import baseStyles from './src/components/storefront/storefront.module.css';
const variants=[{id:'black-m',inStock:true,priceOverride:520000,color:{id:'black',name:'Black',hexCode:'#000000'},size:{id:'m',name:'M',sortOrder:1}},{id:'black-l',inStock:false,priceOverride:550000,color:{id:'black',name:'Black',hexCode:'#000000'},size:{id:'l',name:'L',sortOrder:2}},{id:'blue-m',inStock:true,priceOverride:620000,color:{id:'blue',name:'Blue',hexCode:'#233747'},size:{id:'m',name:'M',sortOrder:1}}];
const product={id:'p',name:'KONO Black Cargo Pants V2',slug:'mock-cargo',basePrice:450000,shortDescription:'Form follows identity. Independent by design.',description:'Product description from an automated test fixture.',categories:[{category:{id:'c',name:'Pants'}}],collections:[],variants,images:[{id:'front',url:'/front.svg',alt:'Front view',imageType:'FRONT_VIEW',sortOrder:0,isPrimary:false},{id:'multi',url:'/multi.svg',alt:'Front and back',imageType:'MULTI_VIEW',sortOrder:9,isPrimary:true},{id:'bad',url:'/broken.png',alt:'Missing image',imageType:'DETAIL',sortOrder:2,isPrimary:false},{id:'chart',url:'/chart.svg',alt:'Size chart',imageType:'SIZE_CHART',sortOrder:1,isPrimary:false}]};
if(location.search.includes('single'))product.images=product.images.filter(image=>image.imageType==='MULTI_VIEW'||image.imageType==='SIZE_CHART');
if(location.search.includes('independent'))product.images=product.images.filter(image=>image.imageType!=='MULTI_VIEW');
let items=JSON.parse(sessionStorage.getItem('mock-bag')||'[]');window.__requests=[];window.__fail=false;
const limit=id=>id==='black-m'?3:id==='blue-m'?1:0;
window.fetch=async(url,init={})=>{
 window.__requests.push({url,method:init.method||'GET',body:init.body?JSON.parse(init.body):null});
 const ok=data=>Response.json({success:true,data});
 if(url.startsWith('/api/cart/availability')){const id=new URL(url,location.origin).searchParams.get('variantId');return ok({variantId:id,price:variants.find(x=>x.id===id).priceOverride,maxQuantity:limit(id),currentQuantity:items.find(x=>x.variantId===id)?.quantity||0,inStock:limit(id)>0});}
 if(url==='/api/cart'){
  if(init.method==='PUT'){if(window.__fail){window.__fail=false;return Response.json({success:false,message:'Mock network failure'},{status:503});}const b=JSON.parse(init.body);if(b.quantity>limit(b.variantId))return Response.json({success:false,message:'Stock limit'},{status:409});items=items.filter(x=>x.variantId!==b.variantId);const v=variants.find(x=>x.id===b.variantId);if(b.quantity)items.push({variantId:v.id,productId:'p',name:product.name,slug:product.slug,imageUrl:'/broken.png',color:v.color.name,size:v.size.name,quantity:b.quantity,price:v.priceOverride,maxQuantity:limit(v.id)});}
  sessionStorage.setItem('mock-bag',JSON.stringify(items));return ok({items});
 }
 throw Error('Unmocked API request: '+url);
};
createRoot(document.getElementById('root')).render(<div className={baseStyles.storefront}><StorefrontHeader /><ProductDetail slug={product.slug} initial={[product]} /><StorefrontFooter /></div>);
`;
let server, chrome, ws;
try {
  const bundle = await build({ stdin: { contents: fixture, resolveDir: process.cwd(), loader: 'tsx' }, bundle: true, write: false, platform: 'browser', format: 'iife', jsx: 'automatic', tsconfig: 'tsconfig.json', plugins: [{name:'test-next-stubs',setup(build){build.onResolve({filter:/^next\/(link|image)$/},args=>({path:args.path,namespace:'test-next'}));build.onLoad({filter:/.*/,namespace:'test-next'},args=>({resolveDir:process.cwd(),loader:'jsx',contents:args.path==='next/link'?`import React from 'react';export default function Link({children,...props}){return <a {...props}>{children}</a>}`:`import React from 'react';export default function Image({fill,unoptimized,fetchPriority,...props}){return <img {...props}/>}`}));}}], outdir:'out', define: { 'process.env.NODE_ENV': '"development"' } });
  const compiler = await compile('@import "tailwindcss";', { base: process.cwd(), onDependency() {} });
  const scanner = new Scanner({ sources: [{ base: path.join(process.cwd(), 'src'), pattern: '**/*.{tsx,ts}', negated: false }] });
  const css = compiler.build(scanner.scan()) + (bundle.outputFiles.find(x=>x.path.endsWith('.css'))?.text||'');
  server = http.createServer((req,res)=>{ if(req.url==='/bundle.js'){res.setHeader('Content-Type','text/javascript');res.end(bundle.outputFiles.find(x=>x.path.endsWith('.js')).text);}else if(req.url==='/style.css'){res.setHeader('Content-Type','text/css');res.end(css); }else if(req.url==='/broken.png'){res.statusCode=404;res.end();}else if(req.url.endsWith('.svg')){res.setHeader('Content-Type','image/svg+xml');res.end('<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="600"><rect width="500" height="600" fill="#ddd"/><rect x="500" width="500" height="600" fill="#aaa"/><text x="100" y="300" font-size="48">FRONT</text><text x="600" y="300" font-size="48">BACK</text></svg>');}else{res.setHeader('Content-Type','text/html');res.end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><style>body{margin:0;background:white;font-family:Arial}#root{width:100%;margin:auto}</style><div id="root"></div><script src="/bundle.js"></script>');} });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base='http://127.0.0.1:'+server.address().port;
  if(process.argv.includes('--preview')){console.log('Mock PDP preview (no database or real uploads): '+base);await new Promise(resolve=>process.once('SIGINT',resolve));server.close();process.exit(0);}
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
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  await send('Page.navigate',{url:base});await wait('document.querySelector("h1")?.textContent.includes("KONO Black")');
  const button=async label=>evaluate(`[...document.querySelectorAll('button')].find(x=>x.textContent.trim()===${JSON.stringify(label)})?.disabled`);
  await wait(`[...document.querySelectorAll('button')].some(x=>x.textContent.trim()==='ADD TO BAG')`);
  assert.equal(await button('ADD TO BAG'),true,'No purchase before size selected');
  assert.equal(await evaluate('document.querySelector("[aria-label=\\\"Product image gallery\\\"] img").getAttribute("src")'),'/multi.svg','Primary first');
  assert.equal(await evaluate('document.querySelector("[aria-label=\\\"Product image gallery\\\"]").querySelectorAll("img[src*=chart]").length'),0,'Chart excluded');
  assert.equal(await evaluate('getComputedStyle(document.querySelector("[aria-label=\\\"Product image gallery\\\"] img")).objectFit'),'contain');
  await evaluate(`[...document.querySelectorAll('button')].find(b=>b.getClientRects().length&&b.getAttribute('aria-label')?.startsWith('Expand product image')).focus()`);
  await evaluate('document.activeElement.click()');await wait('document.querySelector("dialog[open]")');
  await action('Next preview image');assert.equal(await evaluate('document.querySelector("dialog[open] img").getAttribute("src")'),'/front.svg');
  await evaluate(`(()=>{const e=document.querySelector('input[type=range]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,'2');e.dispatchEvent(new Event('input',{bubbles:true}));})()`);await wait('document.querySelector("output").textContent==="200%"');
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await wait('!document.querySelector("dialog[open]")');assert.equal(await evaluate('document.activeElement.getAttribute("aria-label")?.startsWith("Expand product image")'),true,'Escape restores focus to Expand');
  await action('Open Size Guide');await wait('document.querySelector("dialog[open] img")');assert.equal(await evaluate('document.querySelector("dialog[open] img").getAttribute("src")'),'/chart.svg');await action('Close preview');
  await action('View image 3');await delay(600);await wait('document.body.innerText.includes("IMAGE UNAVAILABLE")');
  await evaluate('document.querySelector("[aria-label=\\\"Product image gallery\\\"]").focus()');await send('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowLeft',code:'ArrowLeft',windowsVirtualKeyCode:37});await wait('document.querySelector("[aria-label=\\\"View image 2\\\"]").getAttribute("aria-pressed")==="true"');
  await action('Size L — hết hàng');await wait('document.body.innerText.includes("Out of Stock")');assert.equal(await button('ADD TO BAG'),true);
  await action('Size M');await wait(`document.querySelector('[aria-label="Increase quantity"]')?.disabled === false`);
  await action('Increase quantity');await action('Increase quantity');assert.equal(await evaluate('document.querySelector("[aria-label=\\\"Increase quantity\\\"]").disabled'),true);
  await evaluate('window.__fail=true');await click('ADD TO BAG');await wait('document.body.innerText.includes("Mock network failure")');await click('Kiểm tra lại tồn kho');await wait(`!document.querySelector("[role=alert]") && document.body.innerText.includes("In Stock")`);
  const before=await evaluate('window.__requests.filter(x=>x.method==="PUT").length');
  await evaluate(`(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='ADD TO BAG');b.click();b.click();})()`);await wait('document.body.innerText.includes("\u0110\u00e3 th\u00eam v\u00e0o gi\u1ecf h\u00e0ng.")');assert.equal(await evaluate('window.__requests.filter(x=>x.method==="PUT").length'),before+1,'Double click sends one mutation');assert.equal(await button('ADD TO BAG'),true,'Cart quantity counts toward stock');
  await action('Open shopping bag, 3 items');await wait('document.querySelector("dialog[open]")');assert.equal(await evaluate('document.querySelector("dialog[open] output")?.textContent === "3"'),true);
  assert.equal(await evaluate('document.querySelector("dialog[open] img") === null'),true,'Broken thumbnail fallback');
  const drawerBefore=await evaluate('window.__requests.filter(x=>x.method==="PUT").length');
  await evaluate(`(()=>{const b=document.querySelector('dialog[open] button[aria-label^="Decrease quantity"]');b.click();b.click();})()`);await wait('document.querySelector("dialog[open] output")?.textContent === "2"');assert.equal(await evaluate('window.__requests.filter(x=>x.method==="PUT").length'),drawerBefore+1,'Drawer double click sends one update');
  await evaluate('window.__fail=true');await action('Increase quantity of KONO Black Cargo Pants V2');await wait('document.querySelector("dialog[open] [role=alert]")');assert.equal(await evaluate('document.querySelector("dialog[open] output").textContent'),'2','Failure preserves quantity');
  await click('Thử lại');await wait('!document.querySelector("dialog[open] [role=alert]")');
  await action('Increase quantity of KONO Black Cargo Pants V2');await wait('document.querySelector("dialog[open] output")?.textContent === "3"');
  assert.equal(await evaluate('[...document.querySelectorAll("dialog[open] button")].find(x=>x.getAttribute("aria-label")?.startsWith("Increase quantity"))?.disabled'),true);
  assert.equal(await evaluate('/(?:tối đa|Còn \d+ sản phẩm|Giá xác nhận)/i.test(document.body.innerText)'),false,'No exact stock copy');
  for(const width of [375,390,768,1024,1440,1920]){await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<768});assert.equal(await evaluate('document.querySelector("dialog[open]").scrollWidth > document.querySelector("dialog[open]").clientWidth'),false,'Drawer fits '+width); const shot=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(scratch,'drawer-'+width+'.png'),Buffer.from(shot.data,'base64'));}
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});assert.equal(await evaluate('document.querySelector("dialog[open]").contains(document.activeElement)'),true,'Focus stays in drawer');
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await wait('!document.querySelector("dialog[open]")');
  await send('Page.reload');await wait('[...document.querySelectorAll("button")].some(x=>x.getAttribute("aria-label")==="Open shopping bag, 3 items")');
  await action('Open shopping bag, 3 items');await wait('document.querySelector("dialog[open] output")?.textContent === "3"');
  await action('Remove KONO Black Cargo Pants V2 from bag');await wait('document.querySelector("dialog[open]")?.textContent.includes("MAKE IT YOURS.")');assert.equal(await evaluate('document.querySelector("dialog[open] output")'),null);
  await action('Close shopping bag');
  await action('Size M');await wait('document.body.innerText.includes("In Stock")');
  await click('Blue');assert.equal(await button('ADD TO BAG'),true);await action('Size M');await wait(`document.querySelector('[aria-label="Increase quantity"]')?.disabled`);assert.equal(await evaluate('document.querySelector("[aria-label=\\\"Increase quantity\\\"]").disabled'),true);
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:900,deviceScaleFactor:1,mobile:true});
  await action('View image 1');await delay(300);
  await action('Previous product image');await wait(`document.querySelector('[aria-label="View image 3"]').getAttribute("aria-pressed")==="true"`);
  await action('Next product image');await wait(`document.querySelector('[aria-label="View image 1"]').getAttribute("aria-pressed")==="true"`);
  for(const width of [375,390,768,1024,1440,1920]){await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<768});await delay(120);assert.equal(await evaluate('document.documentElement.scrollWidth>innerWidth'),false,'No overflow at '+width);const layout=await evaluate(`(()=>{const gallery=document.querySelector('[aria-label="Product image gallery"]');const panel=document.querySelector('h1').parentElement;const g=gallery.getBoundingClientRect(),p=panel.getBoundingClientRect();const button=[...panel.querySelectorAll('button')].find(x=>x.textContent.trim()==='ADD TO BAG');const q=panel.querySelector('output[aria-label="Quantity"]').parentElement;return {gallery:g.width,panel:p.width,gap:p.left-g.right,stacked:p.top>=g.bottom-1,button:button.getBoundingClientRect().width,quantityHeight:q.getBoundingClientRect().height,stockLines:[...panel.querySelectorAll('[role="status"]')].filter(x=>/In Stock|Out of Stock|Low Stock/.test(x.textContent)).length,objectFit:getComputedStyle(gallery.querySelector('img')).objectFit}})()`);assert.equal(layout.stockLines,1,'One stock status at '+width);assert.equal(layout.objectFit,'contain');assert.ok(Math.abs(layout.button-layout.panel)<2,'Button fits panel');assert.ok(layout.quantityHeight<50,'Quantity stays on one row');if(width>=1024){assert.ok(layout.panel<=420.5);if(width>=1440){assert.ok(layout.panel>=360);assert.ok(layout.gallery/(layout.gallery+layout.panel)>=.72 && layout.gallery/(layout.gallery+layout.panel)<=.75);}else assert.ok(layout.panel>=339);assert.equal(layout.stacked,false);}if(width<=900)assert.equal(layout.stacked,true);console.log(JSON.stringify({width,...layout}));const controls=await evaluate(`(()=>{const visible=[...document.querySelectorAll('button')].filter(b=>b.getClientRects().length);return visible.filter(b=>b.getAttribute('aria-label')?.startsWith('Expand product image')).map(b=>{const controls=b.parentElement,box=controls.parentElement.getBoundingClientRect(),r=b.getBoundingClientRect(),next=controls.querySelector('button[aria-label^="Next product image"]')?.getBoundingClientRect();return {right:box.right-r.right,bottom:box.bottom-r.bottom,width:r.width,height:r.height,overlap:next?!(r.top>=next.bottom||r.bottom<=next.top||r.right<=next.left||r.left>=next.right):false}})})()`);assert.ok(controls.length>0);for(const c of controls){assert.ok(c.right>=16&&c.right<=20);assert.ok(c.bottom>=16&&c.bottom<=20);assert.ok(c.width>=44&&c.height>=44);assert.equal(c.overlap,false,'Expand does not overlap Next at '+width);}const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});fs.writeFileSync(path.join(scratch,'pdp-'+width+'.png'),Buffer.from(shot.data,'base64'));}
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});await evaluate('scrollTo(0,0)');
  assert.equal(await evaluate(`getComputedStyle(document.querySelector('[aria-label="Product image gallery"]')).display`),'grid');
  await evaluate('scrollTo(0,400)');await delay(100);assert.ok(Math.abs(await evaluate('document.querySelector("h1").parentElement.getBoundingClientRect().top')-24)<2,'Panel sticks while scrolling');
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:500,deviceScaleFactor:1,mobile:false});await wait('document.querySelector("h1").parentElement.dataset.sticky === "false"');assert.equal(await evaluate('getComputedStyle(document.querySelector("h1").parentElement).position'),'static','Tall panel remains reachable');
  await send('Page.navigate',{url:base+'?single'});await wait(`document.querySelector('[aria-label="Product image gallery"]')?.children.length===1`);
  assert.equal(await evaluate(`getComputedStyle(document.querySelector('[aria-label="Product image gallery"]')).display`),'flex','Single MULTI_VIEW is not split into grid');
  assert.equal(await evaluate(`[...document.querySelectorAll('button[aria-label^="Next product image"],button[aria-label^="Previous product image"]')].filter(b=>b.getClientRects().length).length`),0,'Single photo has no navigation arrows');
  assert.equal(await evaluate(`getComputedStyle(document.querySelector('[aria-label="Product image gallery"] img')).objectFit`),'contain');
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});const singleShot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});fs.writeFileSync(path.join(scratch,'single-multi-1440.png'),Buffer.from(singleShot.data,'base64'));
  await evaluate('scrollTo(0,120)');assert.equal(await evaluate(`Math.round(document.querySelector('[aria-label="Expand product image"]').parentElement.getBoundingClientRect().bottom-document.querySelector('[aria-label="Expand product image"]').getBoundingClientRect().bottom)`),18,'Expand stays anchored after scroll');await evaluate('scrollTo(0,0)');
  await action('Expand product image');await wait('document.querySelector("dialog[open] img")');await action('Close preview');
  await send('Page.navigate',{url:base+'?independent'});await wait(`document.querySelector('[aria-label="Product image gallery"]')?.children.length===2`);
  assert.equal(await evaluate(`getComputedStyle(document.querySelector('[aria-label="Product image gallery"]')).gridTemplateColumns.split(' ').length`),2,'Independent photos use two columns');
  await action('Zoom image 2');await wait('document.querySelector("dialog[open]")');await action('Close preview');
  const independentShot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});fs.writeFileSync(path.join(scratch,'independent-1440.png'),Buffer.from(independentShot.data,'base64'));
  await send('Page.navigate',{url:base});await wait(`document.querySelector('[aria-label="Product image gallery"]')?.children.length===3`);
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:900,deviceScaleFactor:1,mobile:true});await send('Emulation.setTouchEmulationEnabled',{enabled:true});await evaluate('scrollTo(0,0)');
  const rect=await evaluate(`(()=>{const r=document.querySelector('[aria-label="Product image gallery"]').getBoundingClientRect();return {x:r.left+r.width*.8,y:r.top+150}})()`);
  await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:rect.x,y:rect.y}]});for(let i=1;i<=6;i++){await send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:rect.x-i*35,y:rect.y}]});await delay(25);}await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await wait('document.querySelector("[aria-label=\\\"View image 2\\\"]").getAttribute("aria-pressed")==="true"');
  console.log(JSON.stringify({result:'PASS',checks:['primary/order','MULTI_VIEW contain','chart excluded and Size Guide modal','preview/zoom/escape/keyboard','404 fallback','color-size selection','sold-out variant','net stock limit','add failure/retry','double-submit lock','Zustand bag','drawer quantity/remove/failure/retry','reload persistence','drawer keyboard','thumbnail fallback','no stock copy','mobile swipe','375/390/768/1024/1440/1920','72-75% large desktop gallery and 420px panel cap','single stock status','overlay positions and hit targets','Expand click and focus restoration','carousel wraparound','independent photo grid','single MULTI_VIEW','sticky scroll and short viewport fallback'],artifacts:scratch}));
} finally {
  ws?.close();chrome?.kill();server?.close();
}
