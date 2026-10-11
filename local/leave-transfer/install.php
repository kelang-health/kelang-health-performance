<?php
// Author runs this from CLI; no web installer and no credentials in the distribution.
if(PHP_SAPI!=='cli'){http_response_code(403);exit;}
$target=$argv[1]??'';$unit=$argv[2]??'';
if(!is_dir($target)||!is_file($target.'/auth.php')||!preg_match('/^\d{5}$/D',$unit))exit("Usage: php install.php ABSOLUTE_COMPENSATION_DIR FACILITY_CODE\n");
$target=realpath($target);require $target.'/db.php';$pdo=db();
$private=dirname($target,2).'/private/leave-transfer';if(!is_dir($private))mkdir($private,0700,true);$configFile=$private.'/'.basename($target).'.json';
if(is_file($configFile)){$config=json_decode(file_get_contents($configFile),true);if($config['facility_code']!==$unit)throw new RuntimeException('Existing installation scope differs');}
else{$config=['instance'=>'local:'.bin2hex(random_bytes(16)),'facility_code'=>$unit,'trusted_source'=>'cloud:txjuiaiwffsxfcrxpkvd'];file_put_contents($configFile,json_encode($config,JSON_PRETTY_PRINT),LOCK_EX);}
$pdo->exec("CREATE TABLE IF NOT EXISTS compensation_transfer_map(kind VARCHAR(20) NOT NULL,local_key VARCHAR(120) NOT NULL,uuid CHAR(36) NOT NULL,extra_json MEDIUMTEXT NULL,PRIMARY KEY(kind,local_key),UNIQUE KEY(uuid)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
$pdo->exec("CREATE TABLE IF NOT EXISTS compensation_unit_calendars(facility_code VARCHAR(10) NOT NULL,month_start DATE NOT NULL,overrides_json TEXT NOT NULL,verified TINYINT NOT NULL DEFAULT 0,revision BIGINT NOT NULL DEFAULT 1,updated_by BIGINT UNSIGNED NULL,verified_by BIGINT UNSIGNED NULL,verified_at DATETIME NULL,PRIMARY KEY(facility_code,month_start)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
$pdo->exec("CREATE TABLE IF NOT EXISTS compensation_transfer_receipts(package_id CHAR(36) PRIMARY KEY,facility_code VARCHAR(10) NOT NULL,personnel_id BIGINT UNSIGNED NOT NULL,fiscal_year INT NOT NULL,source_instance VARCHAR(120) NOT NULL,packet_hash CHAR(64) NOT NULL,actor BIGINT UNSIGNED NOT NULL,imported_at DATETIME NOT NULL,selected_json TEXT NOT NULL,backup_json MEDIUMTEXT NOT NULL,provenance_json MEDIUMTEXT NOT NULL,KEY scope(facility_code,personnel_id,fiscal_year)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
$pdo->exec("CREATE TABLE IF NOT EXISTS compensation_staff_exchange(personnel_id BIGINT UNSIGNED NOT NULL,fiscal_year INT NOT NULL,kind VARCHAR(20) NOT NULL,item_key VARCHAR(80) NOT NULL,body_json MEDIUMTEXT NOT NULL,revision BIGINT NOT NULL DEFAULT 1,PRIMARY KEY(personnel_id,fiscal_year,kind,item_key)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
foreach(['staff-lib.php'=>'staff_exchange_lib.php','staff-api.php'=>'staff_exchange_api.php','staff-page.php'=>'staff_exchange.php'] as $source=>$dest)copy(__DIR__.'/'.$source,$target.'/'.$dest);
function sx_copy_tree($source,$dest){if(!is_dir($dest))mkdir($dest,0755,true);foreach(scandir($source) as $name){if($name==='.'||$name==='..')continue;if(is_dir($source.'/'.$name))sx_copy_tree($source.'/'.$name,$dest.'/'.$name);else copy($source.'/'.$name,$dest.'/'.$name);}}
sx_copy_tree(dirname(__DIR__,2).'/src/staff',$target.'/src/staff');sx_copy_tree(dirname(__DIR__,2).'/assets/fonts',$target.'/assets/fonts');sx_copy_tree(dirname(__DIR__,2).'/assets/forms',$target.'/assets/forms');
foreach(['lib.php'=>'leave_transfer_lib.php','api.php'=>'leave_transfer_api.php','page.php'=>'leave_transfer.php','unit-calendar.php'=>'leave_unit_calendar.php'] as $source=>$dest)copy(__DIR__.'/'.$source,$target.'/'.$dest);
require __DIR__.'/integrate.php';lt_integrate($target,$private);
$assets=$target.'/assets/leave-transfer';if(!is_dir($assets))mkdir($assets,0755,true);
foreach(['transfer.js','transfer-ui.js','core.js'] as $file)copy(dirname(__DIR__,2).'/src/staff/leave/'.$file,$assets.'/'.$file);
echo json_encode(['installed'=>true,'instance'=>$config['instance'],'facility_code'=>$unit,'personnel_mapping'=>'ADMIN must explicitly link UUID before export/import'],JSON_PRETTY_PRINT)."\n";
