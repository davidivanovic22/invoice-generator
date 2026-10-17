import ExcelJS from 'exceljs';
import { taxPeriodReport,taxProfileEnd,type TaxWorkspace } from '../../domain/accounting/taxEvidence';
import { formatRsd } from './money';

export const taxWorkbook=async(w:TaxWorkspace,from:string,to:string)=>{
 const r=taxPeriodReport(w,from,to);if(!r.complete)throw new Error('incomplete_tax_evidence');
 const book=new ExcelJS.Workbook();
 const summary=book.addWorksheet('Kontrola');
 summary.addRows([['INTERNA PDV KONTROLA — NIJE PORESKA PRIJAVA'],['Firma',r.firmId],['Godina ID',r.yearId],['Od',from],['Do',to],['Revizija evidencije',r.revision],['Verzija',r.profile.policyId],['Režim',r.profile.regime],['Dokaz režima',r.profile.evidence],['Izlazni PDV RSD',formatRsd(r.output)],['Ulazni PDV računa RSD',formatRsd(r.input)],['Izričito potvrđen odbitak RSD',formatRsd(r.deductible)],['Kontrolna razlika RSD',formatRsd(r.difference)],['Obuhvat','Samo potvrđeni obični domaći RSD računi; nije kontrola kompletnog konta PDV, prijava ili dokaz predaje.']]);
 const rows=book.addWorksheet('Dogadjaji');
 rows.addRows([['Događaj ID','Dokument ID','Broj','Datum','Smer','Red ID','Kategorija','Osnovica RSD','PDV RSD','Odbitak RSD','Tačka čl. 23','Dokaz klasifikacije','Dokaz odbitka','Dokaz događaja','Verzija'],...r.rows.map(l=>[l.eventId,l.documentId,l.number,l.taxDate,l.direction,l.lineId,l.category,formatRsd(l.net),formatRsd(l.tax),formatRsd(l.deductible),l.reducedPoint||'',l.classificationEvidence,l.deductionEvidence,l.evidence,l.policyId])]);
 const history=book.addWorksheet('Istorija');
 history.addRows([['Događaj ID','Dokument ID','Datum','Status','Razlog poništenja','Autor','Vreme'],...w.events.filter(e=>e.taxDate>=from&&e.taxDate<=to).map(e=>[e.id,e.documentId,e.taxDate,e.cancelled?'Poništen':'Aktivan',e.cancelReason||'',e.createdBy,e.createdAt])]);
 const profiles=book.addWorksheet('Rezimi');profiles.addRows([['Profil ID','Od','Do','Pravna forma','Režim','Period','Status','Dokaz','Razlog poništenja','Verzija','Prvobitno do','Razlog zavrsetka','Autor zavrsetka','Vreme zavrsetka'],...w.profiles.map(p=>[p.id,p.validFrom,taxProfileEnd(p),p.legalForm,p.regime,p.frequency,p.cancelled?'Poništen':'Aktivan',p.evidence,p.cancelReason||'',p.policyId,p.validTo,p.ending?.reason||'',p.ending?.createdBy||'',p.ending?.createdAt||''])]);
 book.eachSheet(s=>{s.eachRow(row=>row.eachCell(cell=>{if(typeof cell.value!=='string')throw new Error('non_text_tax_export');cell.numFmt='@';}));s.columns.forEach(c=>{c.width=26;});});
 return book.xlsx.writeBuffer();
};
export const downloadTaxWorkbook=async(w:TaxWorkspace,from:string,to:string)=>{
 const bytes=await taxWorkbook(w,from,to),url=URL.createObjectURL(new Blob([bytes],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));
 try{const a=document.createElement('a');a.href=url;a.download=`interna-pdv-kontrola-${w.firmId}-${from}-${to}.xlsx`;a.click();}finally{URL.revokeObjectURL(url);}
};
