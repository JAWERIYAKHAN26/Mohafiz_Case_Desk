import { createHash } from 'node:crypto';
export const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const xml = value => String(value).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, c => `\\u${c.charCodeAt(0).toString(16).padStart(4,'0')}`).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
export function spreadsheet(snapshot) {
  const longText=[];
  const cell=value=>`<Cell><Data ss:Type="String">${xml(value)}</Data></Cell>`;
  const tables=['cases','notes','links','field_reports'].map(name=>{
    const records=snapshot[name]||[];
    const columns=[...new Set(records.flatMap(row=>Object.keys(row)))];
    const rows=records.map((record,index)=>'<Row>'+columns.map(key=>{
      const value=record[key]===null?'':typeof record[key]==='object'?JSON.stringify(record[key]):String(record[key]??'');
      if(value.length>24000){
        const chars=Array.from(value);
        for(let start=0,part=1;start<chars.length;start+=12000,part++)longText.push({sheet:name,row:index+2,field:key,part,text:chars.slice(start,start+12000).join('')});
        return cell(`[Full value in Long text: ${name}, row ${index+2}, field ${key}]`);
      }
      return cell(value);
    }).join('')+'</Row>');
    return `<Worksheet ss:Name="${name}"><Table><Row>${columns.map(cell).join('')}</Row>${rows.join('')}</Table></Worksheet>`;
  });
  tables.push('<Worksheet ss:Name="Long text"><Table><Row>'+['sheet','row','field','part','text'].map(cell).join('')+'</Row>'+longText.map(row=>'<Row>'+Object.values(row).map(cell).join('')+'</Row>').join('')+'</Table></Worksheet>');
  return Buffer.from('<?xml version="1.0" encoding="UTF-8"?><?mso-application progid="Excel.Sheet"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">'+tables.join('')+'</Workbook>','utf8');
}
export async function storeAndVerify(storage,path,bytes,contentType) {
  const expected=digest(bytes);
  const upload=await storage.upload(path,bytes,{contentType,upsert:false});
  // A prior worker may have uploaded this immutable path before a crash.
  // A failed upload never permits deletion unless the existing bytes independently match.
  const downloaded=await storage.download(path);
  if(downloaded.error)throw new Error(`Archive readback failed (${path}); no cases deleted.`);
  const saved=Buffer.from(await downloaded.data.arrayBuffer());
  if(saved.length!==bytes.length||digest(saved)!==expected)throw new Error(`Archive checksum mismatch (${path}); no cases deleted.`);
  return {path,sha256:expected,bytes:bytes.length};
}
