<?php
require 'D:/AppServ/www/compensation/db.php';
$rows=db()->query("SELECT id,prefix,full_name,position_name,position_level,employment_type,facility_code FROM compensation_personnel WHERE active=1 AND facility_code IN ('06116','06117','06118','06119','06120','06121','06122','45030') ORDER BY facility_code,full_name")->fetchAll();
$out=[];foreach($rows as $r){$out[]=['source_key'=>'compensation:'.$r['id'],'full_name'=>trim($r['prefix'].' '.$r['full_name']),'position_name'=>$r['position_name']??'','position_level'=>$r['position_level']??'','employment_type'=>$r['employment_type']??'','facility_code'=>$r['facility_code']];}
file_put_contents(__DIR__.'/../backups/personnel-import.json',json_encode($out,JSON_UNESCAPED_UNICODE));echo count($out).' active personnel exported with approved field allowlist only';
