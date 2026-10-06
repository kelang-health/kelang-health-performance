import fs from 'node:fs';
const base=new URL('../backups/',import.meta.url);
const rows=fs.readFileSync(new URL('import.sql',base),'utf8').split('\n').filter(x=>x.startsWith('insert'));
for(let i=0;i<rows.length;i+=30)fs.writeFileSync(new URL(`import-part-${i/30}.sql`,base),'begin;\n'+rows.slice(i,i+30).join('\n')+'\ncommit;');
console.log(Math.ceil(rows.length/30));
