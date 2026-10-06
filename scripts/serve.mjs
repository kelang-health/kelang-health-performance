import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(process.cwd(),'dist');const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml'};
http.createServer((req,res)=>{const file=path.resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]));if(file!==root&&!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}let target=file;if(fs.existsSync(target)&&fs.statSync(target).isDirectory())target=path.join(target,'index.html');if(!fs.existsSync(target)){res.writeHead(404).end('Not found');return;}res.setHeader('Content-Type',types[path.extname(target)]??'application/octet-stream');res.setHeader('Cache-Control','no-store');fs.createReadStream(target).pipe(res);}).listen(4173,'127.0.0.1',()=>console.log('Preview http://127.0.0.1:4173'));
