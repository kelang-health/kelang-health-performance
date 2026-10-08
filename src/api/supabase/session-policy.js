export const sessionPolicy=Object.freeze({idleMs:30*60*1000,maxMs:8*60*60*1000,warningMs:2*60*1000,touchMs:60*1000});
export function sessionStatus(session,now=Date.now()){
 if(!session)return {remaining:Infinity,reason:null};
 const started=session.hp_started_at,active=session.hp_last_active_at;
 if(!Number.isFinite(started)||!Number.isFinite(active))return {remaining:0,reason:'legacy'};
 const maxRemaining=started+sessionPolicy.maxMs-now,idleRemaining=active+sessionPolicy.idleMs-now;
 return {remaining:Math.min(maxRemaining,idleRemaining),reason:maxRemaining<=idleRemaining?'maximum':'idle'};
}
