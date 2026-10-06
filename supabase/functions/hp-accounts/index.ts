import {handleRequest} from './core.js';
Deno.serve(req=>handleRequest(req,{SUPABASE_URL:Deno.env.get('SUPABASE_URL'),SUPABASE_SERVICE_ROLE_KEY:Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}));
