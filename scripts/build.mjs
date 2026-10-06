import fs from 'node:fs';
import path from 'node:path';
const base=path.resolve(new URL('../',import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1'));
const out=path.join(base,'dist');fs.mkdirSync(out,{recursive:true});
// Explicit allowlist: never package backups, credentials, database SQL or tools.
for(const file of ['index.html','404.html','.nojekyll'])if(fs.existsSync(path.join(base,file)))fs.copyFileSync(path.join(base,file),path.join(out,file));
for(const dir of ['assets','src'])fs.cpSync(path.join(base,dir),path.join(out,dir),{recursive:true});
fs.mkdirSync(path.join(out,'data'),{recursive:true});
if(fs.existsSync(path.join(base,'data/hdc-snapshot.json')))fs.copyFileSync(path.join(base,'data/hdc-snapshot.json'),path.join(out,'data/hdc-snapshot.json'));
const paths=[];const walk=p=>fs.readdirSync(p,{withFileTypes:true}).forEach(f=>f.isDirectory()?walk(path.join(p,f.name)):paths.push(path.join(p,f.name)));walk(out);
for(const file of paths){const body=fs.readFileSync(file,'utf8');if(/sb_secret_|"role"\s*:\s*"service_role"|BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY/.test(body))throw new Error('Forbidden secret detected in public build');}
console.log(`Built ${paths.length} public files in dist/`);
