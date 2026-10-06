export async function request(url,options={},retry=0){
 let lastError;
 for(let attempt=0;attempt<=retry;attempt++){
  const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),25000);
  try{const response=await fetch(url,{...options,signal:controller.signal});if(!response.ok){const body=await response.text();let reason;try{reason=JSON.parse(body).message??JSON.parse(body).error_description;}catch{}const error=new Error(reason??`เชื่อมต่อไม่สำเร็จ (HTTP ${response.status})`);error.status=response.status;throw error;}if(response.status===204)return null;return await response.json();}
  catch(e){lastError=e;if([400,401,403,404,409,429].includes(e.status))throw e;if(e.name==='AbortError')lastError=new Error('การเชื่อมต่อใช้เวลานานเกินกำหนด');}
  finally{clearTimeout(timeout);}
 }
 throw lastError;
}
