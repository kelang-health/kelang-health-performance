<?php
require __DIR__.'/auth.php';requireUnitManager();require __DIR__.'/workday_lib.php';require __DIR__.'/leave_transfer_lib.php';
header('Content-Type: application/json; charset=utf-8');header('Cache-Control: no-store');
if($_SERVER['REQUEST_METHOD']!=='POST'){http_response_code(405);echo '{"error":"POST required"}';exit;}
try{if((int)($_SERVER['CONTENT_LENGTH']??0)>2400000)throw new RuntimeException('แฟ้มใหญ่เกินกำหนด');$raw=file_get_contents('php://input',false,null,0,2400001);if(strlen($raw)>2400000)throw new RuntimeException('แฟ้มใหญ่เกินกำหนด');$input=json_decode($raw,true);if(!is_array($input)||!hash_equals(authCsrfToken(),(string)($input['csrf']??'')))throw new RuntimeException('คำขอหมดอายุหรือ CSRF ไม่ถูกต้อง');$p=db();$pid=(int)($input['pid']??0);$fy=(int)($input['fy']??0);lt_person($p,$pid);$action=$input['action']??'';
 if($action==='map'){if(!isAdmin()||!lt_uuid($input['uuid']??null)||empty($input['identity_checked']))throw new RuntimeException('ADMIN ต้องตรวจและเชื่อม UUID บุคลากร');$result=['uuid'=>lt_map($p,'person',$pid,strtolower($input['uuid']))];}
 elseif($action==='snapshot'){$p->beginTransaction();$result=lt_snapshot($p,$pid,$fy);$p->commit();}
 elseif($action==='plan'){$p->beginTransaction();$result=lt_plan($p,$pid,$fy,$input['packet']??[]);$p->commit();}
 elseif($action==='apply')$result=lt_apply($p,$pid,$fy,$input['packet']??[],(string)($input['expected_token']??''),$input['selected']??[],(int)currentUser()['id']);
 elseif($action==='receipt'){$s=$p->prepare('SELECT provenance_json,selected_json,actor,imported_at FROM compensation_transfer_receipts WHERE package_id=? AND personnel_id=? AND fiscal_year=?');$s->execute([(string)($input['package_id']??''),$pid,$fy]);$r=$s->fetch();$result=$r?['provenance'=>json_decode($r['provenance_json']),'selected'=>json_decode($r['selected_json']),'actor'=>$r['actor'],'imported_at'=>$r['imported_at']]:null;}
 elseif($action==='history'){$s=$p->prepare('SELECT package_id,source_instance,imported_at FROM compensation_transfer_receipts WHERE personnel_id=? AND fiscal_year=? ORDER BY imported_at DESC LIMIT 20');$s->execute([$pid,$fy]);$result=$s->fetchAll();}
 else throw new RuntimeException('ไม่รองรับคำสั่งนี้');echo lt_json($result);
}catch(Throwable $e){if(isset($p)&&$p->inTransaction())$p->rollBack();http_response_code(400);echo json_encode(['error'=>$e->getMessage()],JSON_UNESCAPED_UNICODE);}
