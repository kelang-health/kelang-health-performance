import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
const root = new URL('../', import.meta.url);
const legacy=JSON.parse(fs.readFileSync(new URL('backups/hospital-profile-original.json',root),'utf8').replace(/^\uFEFF/,''));
const facilities=legacy.data.hospital.map((r,i)=>({facility_code:String(r.hcode).padStart(5,'0'),facility_name:r['ศบส.'],short_name:r['ศบส.'].replace('ศบส.',''),area_unit:r.hcode!=='45030',service_unit:true,active:true,display_order:i+1}));
fs.writeFileSync(new URL('src/config/facilities.json',root),JSON.stringify(facilities,null,2));
for (const table of ['s_opd_all','s_dental_2','s_dm_control','s_ht_control','s_epi_complete','s_ht_screen_follow']) {
 try {
 const res=await fetch('https://opendata.moph.go.th/api/report_data',{method:'POST',headers:{'Content-Type':'application/json','Origin':'https://kelang-health.github.io'},body:JSON.stringify({tableName:table,year:'2569',province:'52',type:'json',limit:10000,offset:0}),signal:AbortSignal.timeout(35000)});
 const body=await res.text(); fs.mkdirSync(new URL('data/raw/',root),{recursive:true});fs.writeFileSync(new URL(`data/raw/${table}.json`,root),body);
 let data;try{data=JSON.parse(body);}catch{data=null;}
 const rows=Array.isArray(data)?data:(data?.data??data?.rows??data?.result??[]);
 console.log(JSON.stringify({table,status:res.status,cors:res.headers.get('access-control-allow-origin'),keys:Object.keys(data??{}).slice(0,8),count:Array.isArray(rows)?rows.length:null,sample:Array.isArray(rows)?rows.find(r=>facilities.some(f=>f.facility_code===String(r.hospcode).padStart(5,'0'))):null}));
 }catch(e){console.log(JSON.stringify({table,error:e.message}));}
}
// Use the configured credential helper without printing or storing its token.
try{
 const lines=execFileSync('git',['credential','fill'],{input:'protocol=https\nhost=github.com\n\n',encoding:'utf8',env:{...process.env,GIT_TERMINAL_PROMPT:'0',GCM_INTERACTIVE:'never'}});
 const credentials=Object.fromEntries(lines.trim().split('\n').map(l=>{const p=l.indexOf('=');return [l.slice(0,p),l.slice(p+1)];}));
 const res=await fetch('https://api.github.com/user',{headers:{Authorization:`Bearer ${credentials.password}`,'User-Agent':'Kelang-Health-Performance'}});
 const account=await res.json();console.log(JSON.stringify({githubAuthStatus:res.status,login:account.login}));
}catch(e){console.log('GitHub credential helper not available');}
