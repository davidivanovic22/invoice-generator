const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const fs=require('node:fs');
exports.seed=async rpc=>{
 const firm=await rpc('paperwork_connect_firm',{p_name:'Tax evidence UI',p_tax_id:'TAX-UI-'+Date.now()});
 const year=randomUUID(),period=randomUUID(),partner=randomUUID(),account=randomUUID(),counter=randomUUID();
 const entity=(kind,data)=>rpc('paperwork_create_accounting_entity',{p_firm:firm,p_kind:kind,p_data:data});
 await entity('year',{id:year,label:2026,startsOn:'2026-01-01',endsOn:'2026-12-31'});await entity('period',{id:period,fiscalYearId:year,startsOn:'2026-01-01',endsOn:'2026-01-31'});await entity('partner',{id:partner,name:'Tax UI partner'});
 await entity('account',{id:account,code:'204.TAX',name:'Tax UI counterpart',requiresPartner:true,validFrom:'2026-01-01'});await entity('account',{id:counter,code:'614.TAX',name:'Tax UI counter',validFrom:'2026-01-01'});
 const docs=[];
 for(const [direction,tax,number] of [['outgoing','20000','=TAX-OUT'],['incoming','10000','TAX-IN']]){
  const id=randomUUID(),journal=randomUUID();const d={id,firmId:firm,partnerId:partner,direction,kind:'invoice',referenceId:null,number,documentDate:'2026-01-15',dueDate:'2026-01-31',description:'Synthetic ordinary supply',currency:'RSD',lines:[{id:'one',description:'Synthetic goods',net:'100000',tax}]};
  const command=(action,data,expected)=>rpc('paperwork_business_document_command',{p_action:action,p_data:data,p_expected:expected,p_key:randomUUID()});
  await command('save',d,'0');await command('approve',{firmId:firm,id},'1');await command('issue',{firmId:firm,id},'1');
  const gross=(BigInt('100000')+BigInt(tax)).toString();await rpc('paperwork_post_document_journal',{p_document:id,p_document_expected:'2',p_draft:{id:journal,firmId:firm,fiscalYearId:year,periodId:period,postingDate:'2026-01-15',description:'Synthetic tax source',lines:[{id:'a',accountId:account,partnerId:partner,debit:direction==='outgoing'?gross:'0',credit:direction==='incoming'?gross:'0',description:''},{id:'b',accountId:counter,debit:direction==='incoming'?gross:'0',credit:direction==='outgoing'?gross:'0',description:''}]},p_expected:'0',p_key:randomUUID()});
  docs.push({id,journal,number,direction});
 }
 return {firm,year,period,docs};
};
exports.run=async({page,selectFirm,rpc,forward,fixture,returnFirm})=>{
 const {firm,year,period,docs}=fixture;
 await selectFirm.selectOption(firm);await page.getByRole('combobox',{name:/^Fiscal year/}).selectOption(year);
 const panel=page.locator('details').filter({has:page.locator('summary').filter({hasText:'PDV profili i interna evidencija'})}).first();await panel.locator('summary').first().click();
 await panel.getByRole('button',{name:'Učitaj PDV evidenciju',exact:true}).click();await panel.getByText('Revizija PDV evidencije: 0',{exact:true}).waitFor();
 await panel.getByLabel('Režim PDV profila').selectOption('regular_vat');await panel.getByLabel('PDV profil od').fill('2026-01-01');await panel.getByLabel('PDV profil do').fill('2026-12-31');await panel.getByLabel('Dokaz PDV profila').fill('Synthetic VAT registration and monthly period proof');
 const confirm=()=>page.getByRole('alertdialog').getByRole('button',{name:'Potvrdi PDV radnju',exact:true}).click();
 await panel.getByRole('button',{name:'Sačuvaj PDV profil'}).click();await confirm();await panel.getByText('Revizija PDV evidencije: 1',{exact:true}).waitFor();
 const taxRead=()=>rpc('paperwork_tax_workspace',{p_firm:firm,p_year:year});const p=(await taxRead()).profiles[0].id;
 const before=await rpc('paperwork_accounting_workspace',{p_firm:firm,p_year:year});
 await panel.getByRole('button',{name:'Unos poreskog događaja'}).click();
 const fill=async doc=>{
  await panel.getByLabel('PDV izvorni dokument').selectOption(doc.id);await panel.getByLabel('PDV profil događaja').selectOption(p);await panel.getByLabel('Knjigovodstveni period PDV događaja').selectOption(period);await panel.getByLabel('Dokaz poreskog događaja').fill('Synthetic ordinary domestic supply; no advance');await panel.getByRole('checkbox').check();
 };
 const keys=[];let drop=true;
 await page.route('**/paperwork_tax_command',async route=>{if(route.request().postDataJSON().p_action==='record'){keys.push(route.request().postDataJSON().p_key);const response=await forward(route);if(drop){drop=false;assert.ok(response.ok());await route.abort('failed');}else await route.fulfill({response});}else await route.fulfill({response:await forward(route)});});
 await fill(docs[0]);await panel.getByRole('button',{name:'Potvrdi poreski događaj'}).click();await confirm();await panel.getByRole('alert').filter({hasText:'nepoznat'}).waitFor();assert.equal(await selectFirm.isDisabled(),true);assert.equal(await panel.getByLabel('Dokaz poreskog događaja').isDisabled(),true);
 await panel.getByRole('button',{name:'Ponovi isti PDV zahtev'}).click();await panel.getByText('Revizija PDV evidencije: 2',{exact:true}).waitFor();assert.equal(keys.length,2);assert.equal(keys[0],keys[1]);
 await panel.getByLabel('PDV kontrola od').fill('2026-01-01');await panel.getByLabel('PDV kontrola do').fill('2026-01-31');await panel.getByText(/Nepokrivenih dokumenata: 1/).waitFor();assert.equal(await panel.getByRole('button',{name:'Izvezi internu PDV kontrolu'}).isDisabled(),true);
 await fill(docs[1]);await panel.getByLabel('Kategorija PDV reda one').selectOption('reduced');await panel.getByLabel('Tačka PDV reda one').selectOption('1');await panel.getByLabel('Klasifikacija PDV reda one').fill('Synthetic bread classification, Article 23 point 1');await panel.getByLabel('Odbitak PDV reda one RSD').fill('50,00');await panel.getByLabel('Dokaz odbitka PDV reda one').fill('Synthetic Article 28 review; only partial input VAT claimed');
 await panel.getByRole('button',{name:'Potvrdi poreski događaj'}).click();await confirm();await panel.getByText('Revizija PDV evidencije: 3',{exact:true}).waitFor();await panel.getByText(/kontrolna razlika 150.00 RSD/).waitFor();
 const after=await rpc('paperwork_accounting_workspace',{p_firm:firm,p_year:year});assert.deepEqual(after.journals,before.journals);
 const downloadPromise=page.waitForEvent('download');await panel.getByRole('button',{name:'Izvezi internu PDV kontrolu'}).click();const download=await downloadPromise;
 const ExcelJS=require('exceljs'),book=new ExcelJS.Workbook();await book.xlsx.load(fs.readFileSync(await download.path()));assert.equal(book.worksheets.length,4);assert.equal(book.getWorksheet('Kontrola').getCell('A1').value,'INTERNA PDV KONTROLA — NIJE PORESKA PRIJAVA');assert.equal(book.getWorksheet('Kontrola').getCell('B13').value,'150.00');assert.ok(book.getWorksheet('Dogadjaji').getColumn(3).values.includes('=TAX-OUT'));
 await panel.getByLabel('Razlog poništenja PDV evidencije').fill('Synthetic tax cancellation');const row=panel.getByRole('table',{name:'Istorija poreskih događaja'}).getByRole('row').filter({hasText:'=TAX-OUT'});await row.getByRole('button',{name:'Poništi poreski događaj'}).click();await confirm();await panel.getByText('Revizija PDV evidencije: 4',{exact:true}).waitFor();assert.equal(await panel.getByRole('button',{name:'Izvezi internu PDV kontrolu'}).isDisabled(),true);
 await rpc('paperwork_reverse_journal',{p_firm:firm,p_journal:docs[0].journal,p_period:period,p_date:'2026-01-20',p_reason:'Synthetic source reversal after tax cancellation',p_expected:'1',p_key:randomUUID()});
 await panel.getByRole('button',{name:'Učitaj PDV evidenciju'}).click();await panel.getByText(/kontrolna razlika -50.00 RSD/).waitFor();assert.equal((await taxRead()).events.length,2);
 // End an already-used profile through the UI, including a lost committed response.
 const endingRequests=[];let dropEnding=true;
 await page.route('**/paperwork_tax_command',async route=>{
  const input=route.request().postDataJSON();const response=await forward(route);
  if(input.p_action==='end_profile'){endingRequests.push(input);if(dropEnding){dropEnding=false;assert.ok(response.ok());await route.abort('failed');return;}}
  await route.fulfill({response});
 });
 await panel.getByLabel('PDV profil zavr\u0161ava zaklju\u010dno sa').fill('2026-11-30');
 await panel.getByLabel('Razlog poništenja PDV evidencije').fill('Synthetic dated new registration proof');
 await panel.getByRole('button',{name:'Zavr\u0161i PDV profil',exact:true}).click();await confirm();
 await panel.getByRole('alert').filter({hasText:'nepoznat'}).waitFor();assert.equal(await selectFirm.isDisabled(),true);
 await panel.getByRole('button',{name:'Ponovi isti PDV zahtev'}).click();await panel.getByText('Revizija PDV evidencije: 5',{exact:true}).waitFor();assert.deepEqual(endingRequests[0],endingRequests[1]);
 await panel.getByRole('button',{name:'Unos PDV profila'}).click();await panel.getByLabel('Re\u017eim PDV profila').selectOption('small_taxpayer');
 await panel.getByLabel('PDV profil od').fill('2026-12-01');await panel.getByLabel('Dokaz PDV profila').fill('Synthetic separately verified December status');
 await panel.getByRole('button',{name:'Sa\u010duvaj PDV profil'}).click();await confirm();await panel.getByText('Revizija PDV evidencije: 6',{exact:true}).waitFor();
 const changed=await taxRead();assert.equal(changed.profiles.length,2);const old=changed.profiles.find(x=>x.id===p);assert.equal(old.validTo,'2026-12-31');assert.equal(old.ending.endsOn,'2026-11-30');assert.equal(changed.profiles.find(x=>x.id!==p).regime,'small_taxpayer');
 const proofDownload=page.waitForEvent('download');await panel.getByRole('button',{name:'Izvezi internu PDV kontrolu'}).click();const proofBook=new ExcelJS.Workbook();await proofBook.xlsx.load(fs.readFileSync(await (await proofDownload).path()));
 assert.equal(proofBook.getWorksheet('Rezimi').getCell('C2').value,'2026-11-30');assert.equal(proofBook.getWorksheet('Rezimi').getCell('K2').value,'2026-12-31');assert.equal(proofBook.getWorksheet('Rezimi').getCell('L2').value,'Synthetic dated new registration proof');
 await selectFirm.selectOption(returnFirm);await page.getByRole('button',{name:'New journal',exact:true}).waitFor();assert.equal(await panel.getByText('Revizija PDV evidencije: 6',{exact:true}).count(),0);
 console.log('PASS: persisted TAX-02 internal profiles/events, no duplicate ledger posting, confirmed deduction, post-commit replay/context freeze, coverage/export guards, textual Excel and immutable cancellation/source reversal.');
};
