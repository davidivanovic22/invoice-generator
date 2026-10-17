import { useEffect,useRef,useState } from 'react';
import type { AccountingWorkspace } from '../../domain/accounting/commands';
import { stockCommandSchema,stockPreview,parseQuantity,formatQuantity,type StockCommand,type StockWorkspace } from '../../domain/accounting/inventory';
import { AccountingError,type SupabaseAccountingRepository } from '../../infrastructure/accountingRepository';
import { Button } from '../../ui/Button';
import { useFeedback } from '../../ui/Feedback';
import { parseRsd,formatRsd } from './money';
import { downloadStock } from './inventoryFiles';
const field='rounded-lg border border-slate-300 px-3 py-2 text-sm';
export const InventoryPanel=({repo,workspace,disabled,onState}:{repo:SupabaseAccountingRepository;workspace:AccountingWorkspace;disabled:boolean;onState:(dirty:boolean,busy:boolean)=>void})=>{
 const {confirm}=useFeedback();const [data,setData]=useState<StockWorkspace|null>(null),[selected,setSelected]=useState(''),[busy,setBusy]=useState(false),[dirty,setDirty]=useState(false),[pending,setPending]=useState<StockCommand|null>(null),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [sku,setSku]=useState(''),[name,setName]=useState(''),[warehouse,setWarehouse]=useState(''),[unit,setUnit]=useState('kom'),[account,setAccount]=useState(''),[quantity,setQuantity]=useState(''),[value,setValue]=useState(''),[counter,setCounter]=useState(''),[partner,setPartner]=useState(''),[external,setExternal]=useState(''),[reason,setReason]=useState('');
 const periods=workspace.periods.filter(p=>p.status==='open');const [period,setPeriod]=useState(periods[0]?.id||''),[date,setDate]=useState(periods[0]?.startsOn||'');
 const token=useRef(0);useEffect(()=>()=>{token.current++;},[]);
 useEffect(()=>{onState(dirty||Boolean(pending),busy||Boolean(pending));},[dirty,busy,pending,onState]);
 const lock=disabled||busy||Boolean(pending),item=data?.items.find(i=>i.id===selected),write=workspace.capabilities.includes('post_journal'),manage=workspace.capabilities.includes('manage_chart'),reverse=write&&workspace.capabilities.includes('reverse_journal');
 const load=async()=>{const n=++token.current;setBusy(true);setError('');try{const r=await repo.stockWorkspace(workspace.firmId);if(n===token.current)setData(r);}catch{if(n===token.current){setData(null);setError('Zalihe nisu mogle da budu proverene. Osvežite pregled pre knjiženja.');}}finally{if(n===token.current)setBusy(false);}};
 const mark=()=>{setDirty(true);setError('');setNotice('');};
 const run=async(c:StockCommand)=>{setBusy(true);setPending(c);setError('');setNotice('');try{await repo.stockCommand(c);setPending(null);setDirty(false);setQuantity('');setValue('');setExternal('');setReason('');setNotice('Komanda zaliha potvrđena.');await load();}catch(e){const code=e instanceof AccountingError?e.code:'unavailable';if(code==='unavailable'||code==='invalid_response')setError('Ishod je nepoznat. Ponovite isti zahtev pre izmene ili izlaska.');else{setPending(null);setError('Komanda odbijena. Proverite reviziju, raspoloživu količinu, konta, datum, period i kasnije promete.');}}finally{setBusy(false);}};
 const propose=async(action:StockCommand['action'],targetId?:string)=>{
 let c:StockCommand;try{
 const common={firmId:workspace.firmId,itemId:action==='create'?crypto.randomUUID():selected,expectedRevision:action==='create'?'0':item?.revision};
 const post={...common,fiscalYearId:workspace.yearId,periodId:period,postingDate:date};
 const d=action==='create'?{...common,sku,name,warehouse,unit,accountId:account}:action==='cancel'?{...post,targetId,reason}:{...post,journalId:crypto.randomUUID(),quantity:parseQuantity(quantity),counterAccountId:counter,...(partner?{partnerId:partner}:{}),externalId:external,...(action==='receipt'?{value:parseRsd(value)}:{})};
 c=stockCommandSchema.parse({action,data:d,idempotencyKey:crypto.randomUUID()});
 if(action!=='create'){const p=periods.find(p=>p.id===period);if(!p||date<p.startsOn||date>p.endsOn||!item||item.externalMovements)throw new Error('context');}
 }catch{setError('Proverite artikal, skladište, količinu do tri decimale, RSD vrednost, izvor, konta i otvoren period.');return;}
 setBusy(true);onState(true,true);
 try{
 const lines=c.action==='create'?null:c.action==='cancel'?(await repo.read(workspace.firmId,c.data.targetId))?.draft.lines.map(l=>({accountId:l.accountId,partnerId:l.partnerId||null,debit:l.credit,credit:l.debit})):stockPreview(c,data!);
 if(c.action!=='create'&&!lines)throw new Error('journal');
 const message=<><p>{c.action==='create'?`${sku} · ${name} · ${warehouse} · ${unit}`:`${item?.sku} · ${item?.warehouse} · ${date} · ${c.action==='cancel'?reason:external}`}</p>{lines&&<table aria-label="Pregled naloga zaliha"><thead><tr><th>Konto</th><th>Partner</th><th>Duguje RSD</th><th>Potražuje RSD</th></tr></thead><tbody>{lines.map((l,n)=><tr key={n}><td>{workspace.accounts.find(a=>a.id===l.accountId)?.code||l.accountId}</td><td>{workspace.partners.find(p=>p.id===l.partnerId)?.name||'—'}</td><td>{formatRsd(l.debit)}</td><td>{formatRsd(l.credit)}</td></tr>)}</tbody></table>}</>;
 if(await confirm({title:c.action==='create'?'Sačuvaj artikal?':'Potvrdi knjiženje zaliha?',message,confirmLabel:'Potvrdi zalihe'}))await run(c);
 }catch{setError('Nalog zaliha nije mogao da bude proveren. Osvežite pregled i proverite količinu i vrednost.');}finally{setBusy(false);}
 };
 const input=(label:string,v:string,set:(v:string)=>void,type='text')=><label>{label}<input className={field} type={type} value={v} onChange={e=>{set(e.target.value);mark();}}/></label>;
 const accounts=(label:string,v:string,set:(v:string)=>void,stock=false)=><label>{label}<select className={field} value={v} onChange={e=>{set(e.target.value);mark();}}><option value="">Izaberite konto</option>{workspace.accounts.filter(a=>a.active&&a.allowsPosting&&(!stock||!a.requiresPartner)).map(a=><option key={a.id} value={a.id}>{a.code} · {a.name}</option>)}</select></label>;
 const movements=data?.movements.filter(m=>m.itemId===selected)||[],cancelled=new Set(data?.cancellations.map(c=>c.movementId)),latest=[...movements].reverse().find(m=>!cancelled.has(m.id));
 return <details className="rounded-xl border p-4"><summary>Zalihe i kartice artikala</summary><section aria-label="Evidencija zaliha" className="space-y-3"><p>Količina do tri decimale; vrednost u RSD. Izlaz po pokretnom proseku. Svaki prijem/izlaz potvrđuje povezani nalog.</p>{error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
 {pending&&<Button disabled={busy} onClick={()=>void run(pending)}>Ponovi isti zahtev zaliha</Button>}
 <Button disabled={lock||dirty} onClick={()=>void load()}>Učitaj zalihe</Button>
 {manage&&<fieldset disabled={lock} className="flex flex-wrap gap-3">{input('Šifra artikla',sku,setSku)}{input('Naziv artikla',name,setName)}{input('Skladište artikla',warehouse,setWarehouse)}{input('Jedinica mere',unit,setUnit)}{accounts('Konto zaliha',account,setAccount,true)}<Button onClick={()=>void propose('create')}>Sačuvaj artikal</Button></fieldset>}
 {data&&<><label>Artikal zaliha<select disabled={lock||dirty} className={field} value={selected} onChange={e=>{setSelected(e.target.value);setError('');setNotice('');}}><option value="">Izaberite artikal</option>{data.items.map(i=><option key={i.id} value={i.id}>{i.warehouse} · {i.sku} · {i.name}</option>)}</select></label>
 <table aria-label="Stanje zaliha"><thead><tr><th>Skladište / artikal</th><th>Količina</th><th>Vrednost RSD</th></tr></thead><tbody>{data.items.map(i=><tr key={i.id}><td>{i.warehouse} · {i.sku} · {i.name}</td><td>{formatQuantity(i.quantity)} {i.unit}</td><td>{formatRsd(i.value)}</td></tr>)}</tbody></table>
 <Button disabled={lock||dirty||data.items.some(i=>i.externalMovements)} onClick={()=>{setBusy(true);void downloadStock(data,workspace).catch(()=>setError('Izvoz nije uspeo.')).finally(()=>setBusy(false));}}>Izvezi zalihe i kartice</Button>
 {item&&<><p>Artikal {item.sku}: {formatQuantity(item.quantity)} {item.unit} · {formatRsd(item.value)} RSD · revizija {item.revision}</p>{item.externalMovements&&<p role="alert">Konto zaliha ima samostalna knjiženja. Usaglasite knjigu pre novih promena zaliha.</p>}
 {write&&<fieldset disabled={lock||item.externalMovements} className="flex flex-wrap gap-3"><label>Period zaliha<select className={field} value={period} onChange={e=>{setPeriod(e.target.value);mark();}}>{periods.map(p=><option key={p.id} value={p.id}>{p.startsOn} — {p.endsOn}</option>)}</select></label>{input('Datum zaliha',date,setDate,'date')}{input('Količina zaliha',quantity,setQuantity)}{input('Ukupna vrednost prijema RSD',value,setValue)}{accounts('Protivkonto zaliha',counter,setCounter)}<label>Partner zaliha<select className={field} value={partner} onChange={e=>{setPartner(e.target.value);mark();}}><option value="">Bez partnera</option>{workspace.partners.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>{input('ID dokumenta i stavke zaliha',external,setExternal)}<Button onClick={()=>void propose('receipt')}>Knjiži prijem zaliha</Button><Button disabled={item.quantity==='0'} onClick={()=>void propose('issue')}>Knjiži izlaz zaliha</Button>{reverse&&<>{input('Razlog storna zaliha',reason,setReason)}<Button disabled={!latest||!reason.trim()} onClick={()=>void propose('cancel',latest?.id)}>Storniraj poslednji promet zaliha</Button></>}</fieldset>}
 <table aria-label="Kartica artikla"><thead><tr><th>Datum</th><th>Izvor / nalog</th><th>Vrsta</th><th>Količina</th><th>RSD</th><th>Stanje</th></tr></thead><tbody>{movements.map(m=><tr key={m.id}><td>{m.postingDate}</td><td>{m.externalId} · {m.id}</td><td>{m.kind==='receipt'?'Prijem':'Izlaz'}</td><td>{formatQuantity(m.quantity)}</td><td>{formatRsd(m.value)}</td><td>{cancelled.has(m.id)?'Stornirano':'Aktivno'}</td></tr>)}</tbody></table>{data.cancellations.filter(c=>c.itemId===item.id).map(c=><p key={c.movementId}>Storno {c.movementId} · {c.postingDate} · {c.reason} · {c.journalId}</p>)}</>}
 <p>Kontrola knjige: {data.accounts.map(a=>`${workspace.accounts.find(x=>x.id===a.id)?.code||a.id}: ${formatRsd(a.balance)} RSD`).join(' · ')}</p></>}
 {dirty&&!pending&&<Button disabled={busy} onClick={()=>{setDirty(false);setQuantity('');setValue('');setExternal('');setReason('');setSku('');setName('');setWarehouse('');setAccount('');}}>Odbaci unos zaliha</Button>}
 </section></details>;
};
