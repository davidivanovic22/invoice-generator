// Integration review in an isolated browser profile; user invoices are not touched.
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),dir=path.join(root,'build'),review=path.join(root,'design-review');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'public/invoice-motifs/manifest.json'),'utf8'));
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.json':'application/json','.png':'image/png','.ico':'image/x-icon'};
const server=http.createServer((req,res)=>{let file=path.resolve(dir,'.'+decodeURIComponent(req.url.split('?')[0]));if(!file.startsWith(dir+path.sep)&&file!==dir){res.writeHead(403);res.end();return;}if(!fs.existsSync(file)||fs.statSync(file).isDirectory())file=path.join(dir,'index.html');res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');fs.createReadStream(file).pipe(res);});
const party={name:'Studio North',address:'Bulevar 24',cityCountry:'Belgrade, Serbia',taxIdLabel:'Tax ID',taxIdValue:'123456789',regIdLabel:'Reg. No.',regIdValue:'987654',iban:'RS35105008123123123123'};
function invoice(month){return{id:'motif-review',invoiceNumber:'INV-2026-024',billingPeriod:month.month+' 2026',issueDate:'2026-10-02',dueDate:'2026-10-16',serviceDate:'2026-09-30',currency:'EUR',vatPercent:0,issuer:party,client:{...party,name:'Client Company',address:'24 Park Lane',cityCountry:'London, UK',iban:''},note:'Thank you for your business. Payment due within 14 days.',items:[{id:'one',serviceName:'Design services',description:'Visual design and consulting',hours:80,rate:30},{id:'two',serviceName:'Development',description:'Application development',hours:40,rate:40}],editorSettings:{baseFontSize:14,titleFontSize:40,accentColor:'#2563eb',logoWidth:128,logoHeight:80,signatureWidth:180,signatureHeight:56,elements:[],templateMode:'auto-month',templateVariantIndex:0,useTemplateAccentColor:true}};}
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;let browser;
try{browser=await chromium.launch({headless:true,channel:'chrome'});const context=await browser.newContext({viewport:{width:1660,height:1400},acceptDownloads:true});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(url+'/invoices');
for(const month of manifest){const data=invoice(month);await page.evaluate(data=>localStorage.setItem('invoice-generator',JSON.stringify({invoices:[data],activeInvoiceId:data.id})),data);await page.reload();await page.locator('img[aria-hidden="true"]').first().waitFor();
for(let i=0;i<5;i++){await page.getByRole('button',{name:month.variants[i].name,exact:true}).click();const expected='/invoice-motifs/'+month.variants[i].file;await page.waitForFunction(expected=>Array.from(document.querySelectorAll('img[aria-hidden="true"]')).every(img=>img.getAttribute('src')===expected&&img.complete&&img.naturalWidth===794),expected);assert.equal(await page.getByRole('button',{name:month.variants[i].name,exact:true}).getAttribute('aria-pressed'),'true');}
if(['january','october','december'].includes(month.month)){
const selected=month.month==='december'?1:month.month==='january'?0:4;
await page.getByRole('button',{name:month.variants[selected].name,exact:true}).click();await page.locator('[data-pdf-page] > img').evaluate(img=>img.decode());
await page.evaluate(()=>{const holder=document.createElement('div');holder.id='visual-review-page';holder.style='position:fixed;inset:0;z-index:999999;background:white;overflow:auto;';holder.appendChild(document.querySelector('[data-pdf-page]').cloneNode(true));document.body.appendChild(holder);});
await page.locator('#visual-review-page [data-pdf-page]').screenshot({path:path.join(review,`invoice-motifs-${month.month}.png`)});
await page.locator('#visual-review-page').evaluate(n=>n.remove());
}
}
// Regression check for the duplicated previews reported in the picker.
for(const variant of manifest[11].variants){assert.equal(await page.getByRole('button',{name:variant.name,exact:true}).locator('img').count(),1);}
const picker=page.getByText('Theme design',{exact:true}).locator('..');
await picker.screenshot({path:path.join(review,'invoice-design-picker.png')});
await page.setViewportSize({width:980,height:1000});
await picker.screenshot({path:path.join(review,'invoice-design-picker-narrow.png')});
const overflow=await picker.evaluate(node=>node.scrollWidth>node.clientWidth+2);assert.equal(overflow,false,'Picker must scroll inside its card strip, not widen the preview pane');
await page.setViewportSize({width:1660,height:1400});
await page.getByRole('button',{name:/Finish & export/}).click();const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Download this invoice as PDF',exact:true}).click();const download=await downloadPromise;await download.saveAs(path.join(review,'invoice-motifs-december.pdf'));const pdf=fs.readFileSync(path.join(review,'invoice-motifs-december.pdf'));assert.equal(pdf.subarray(0,4).toString(),'%PDF');assert.ok(pdf.length>20000);assert.deepEqual(errors,[]);
console.log('App review passed: all 12 months x 5 selections agree in editor and print, 3 actual invoice screenshots, and a successful PDF download.');
}finally{if(browser)await browser.close();server.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
