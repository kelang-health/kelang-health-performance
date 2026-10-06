import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
export async function github(path,method='GET',body){
 const lines=execFileSync('git',['credential','fill'],{input:'protocol=https\nhost=github.com\n\n',encoding:'utf8',env:{...process.env,GIT_TERMINAL_PROMPT:'0',GCM_INTERACTIVE:'never'}});
 const credentials=Object.fromEntries(lines.trim().split('\n').map(l=>{const p=l.indexOf('=');return [l.slice(0,p),l.slice(p+1)];}));
 const response=await fetch(`https://api.github.com${path}`,{method,headers:{Authorization:`Bearer ${credentials.password}`,'User-Agent':'Kelang-Health-Performance','Accept':'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28',...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
 const text=await response.text();const data=text?JSON.parse(text):null;
 if(!response.ok)throw new Error(`GitHub ${method} ${path}: HTTP ${response.status} ${data?.message??''}`);
 return data;
}
if(process.argv[2]==='create'){
 let repo;try{repo=await github('/repos/kelang-health/kelang-health-performance');}catch(e){if(!e.message.includes('404'))throw e;repo=await github('/user/repos','POST',{name:'kelang-health-performance',description:'ระบบติดตามและเปรียบเทียบผลงานสุขภาพ หน่วยบริการสังกัดเทศบาลเมืองเขลางค์นคร',private:false,auto_init:false});}
 console.log(JSON.stringify({url:repo.html_url,default_branch:repo.default_branch}));
}
if(process.argv[2]==='pages'){
 let pages;try{pages=await github('/repos/kelang-health/kelang-health-performance/pages');}catch(e){if(!e.message.includes('404'))throw e;pages=await github('/repos/kelang-health/kelang-health-performance/pages','POST',{build_type:'workflow'});}
 console.log(JSON.stringify({url:pages.html_url,status:pages.status,build_type:pages.build_type}));
}
if(process.argv[2]==='status'){
 const runs=await github('/repos/kelang-health/kelang-health-performance/actions/runs?per_page=5');console.log(JSON.stringify(runs.workflow_runs.map(r=>({id:r.id,name:r.name,status:r.status,conclusion:r.conclusion,url:r.html_url})),null,2));
}
