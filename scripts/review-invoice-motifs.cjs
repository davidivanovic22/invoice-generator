// Read-only asset checks plus browser previews. Uses locally installed Playwright.
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {pathToFileURL}=require('url');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),assets=path.join(root,'public/invoice-motifs'),review=path.join(root,'design-review');
(async()=>{
const manifest=JSON.parse(fs.readFileSync(path.join(review,'invoice-motifs.json'),'utf8'));
assert.equal(manifest.length,12);
const files=manifest.flatMap(m=>m.variants.map(v=>v.file));assert.equal(new Set(files).size,60);
for(const m of manifest){assert.equal(m.variants.length,5);assert.equal(new Set(m.variants.map(v=>v.motifs[0])).size,5,`${m.month}: duplicate lead motif`);assert.equal(new Set(m.variants.map(v=>v.composition)).size,5);for(const v of m.variants){assert.ok(v.motifs.length>=5);const svg=fs.readFileSync(path.join(assets,v.file),'utf8');assert.ok(!/@(?:accent|light|deep|leaf|gold|paper)|undefined|NaN|<image\b/.test(svg));assert.ok((svg.match(/data-motif=/g)||[]).length>=13);}}
const browser=await chromium.launch({headless:true,channel:'chrome'});
try{
const page=await browser.newPage({viewport:{width:1560,height:1000},deviceScaleFactor:1});
const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
await page.goto(pathToFileURL(path.join(review,'motif-gallery.html')).href);await page.locator('img').evaluateAll(imgs=>Promise.all(imgs.map(i=>i.decode())));
const failed=await page.locator('img').evaluateAll(imgs=>imgs.filter(i=>!i.complete||i.naturalWidth!==794).map(i=>i.src));assert.deepEqual(failed,[]);
for(const m of manifest){await page.locator('#'+m.month).screenshot({path:path.join(review,`motifs-${m.month}.png`)});}
await page.locator('button').click();await page.locator('#december').screenshot({path:path.join(review,'motifs-december-with-content.png')});
for(const file of ['01-january.svg','05-october.svg','02-december.svg']){
const svg=fs.readFileSync(path.join(assets,file),'utf8');await page.setContent(`<html><style>body{margin:0;width:794px;height:1123px}</style>${svg}</html>`);await page.setViewportSize({width:794,height:1123});assert.equal(await page.locator('parsererror').count(),0);await page.screenshot({path:path.join(review,`motif-${file.replace('.svg','.png')}`)});
}
assert.deepEqual(errors,[]);console.log('Validated all 60 compositions: distinct leads/layouts, original self-contained SVGs, browser loading, and 16 visual previews.');
}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
