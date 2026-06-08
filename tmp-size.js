const fs=require('fs'),path=require('path');
function walk(d,r=[]){
  fs.readdirSync(d).forEach(f=>{
    const p=path.join(d,f);
    const s=fs.statSync(p);
    if(s.isDirectory())walk(p,r);
    else if(p.endsWith('.ts'))r.push({f:p.replace(process.cwd()+path.sep,''),l:fs.readFileSync(p,'utf8').split('\n').length});
  });
  return r;
}
walk('.').sort((a,b)=>b.l-a.l).slice(0,20).forEach(x=>console.log(String(x.l).padStart(5),x.f));
