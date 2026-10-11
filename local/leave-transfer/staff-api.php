<?php
require __DIR__.'/auth.php';requireUnitManager();require __DIR__.'/workday_lib.php';require __DIR__.'/leave_transfer_lib.php';require __DIR__.'/staff_exchange_lib.php';
header('Content-Type: application/json; charset=utf-8');header('Cache-Control: no-store');
try{if($_SERVER['REQUEST_METHOD']!=='POST'||(int)($_SERVER['CONTENT_LENGTH']??0)>4600000)throw new RuntimeException('คำขอผิดรูปแบบหรือใหญ่เกินกำหนด');$raw=file_get_contents('php://input',false,null,0,4600001);if(strlen($raw)>4600000)throw new RuntimeException('คำขอใหญ่เกินกำหนด');$in=json_decode($raw,true);if(!is_array($in)||!hash_equals(authCsrfToken(),(string)($in['csrf']??'')))throw new RuntimeException('CSRF ไม่ถูกต้อง');$p=db();$pid=(int)($in['pid']??0);$fy=(int)($in['fy']??0);lt_person($p,$pid);if($fy<2500||$fy>2700)throw new RuntimeException('ปีไม่ถูกต้อง');
 switch($in['action']??''){
 case 'snapshot':$p->beginTransaction();$out=sx_snapshot($p,$pid,$fy);$p->commit();break;
 case 'apply':$out=sx_apply($p,$pid,$fy,$in['part']??'',$in['packet']??[],$in['before']??[]);break;
 case 'save':$p->beginTransaction();$out=sx_save($p,$pid,$fy,$in['document']??[],(int)($in['revision']??0));$p->commit();break;
 default:throw new RuntimeException('ไม่รองรับคำสั่ง');}echo lt_json($out);
}catch(Throwable $e){if(isset($p)&&$p->inTransaction())$p->rollBack();http_response_code(400);echo lt_json(['error'=>$e->getMessage()]);}
