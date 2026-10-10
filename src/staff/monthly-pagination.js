// Measure after fonts load; move whole history/closing blocks without shrinking text.
export function paginateMonthlyDocument(doc){
 const pageHeight=297*96/25.4;
 const template=doc.querySelector('template.monthly-continuation');
 if(!template)return;
 let sheet=doc.querySelector('.monthly-sheet');
 while(sheet){
  const bottom=()=>{const last=sheet.lastElementChild;return last?last.getBoundingClientRect().bottom-sheet.getBoundingClientRect().top+parseFloat(doc.defaultView.getComputedStyle(sheet).paddingBottom):0;};
  let moves=0;
  while(bottom()>pageHeight-2){
   const block=sheet.lastElementChild;
   if(!block?.matches('.monthly-history,.monthly-closing'))throw new Error('ข้อมูลส่วนหัวสูงเกินหน้ากระดาษ กรุณาตรวจความยาวข้อความ');
   if(block.getBoundingClientRect().height>pageHeight-180)throw new Error('ข้อมูลหนึ่งรายการยาวเกินหน้ากระดาษ กรุณาตรวจข้อความก่อนพิมพ์');
   let next=sheet.nextElementSibling;
   if(!next?.matches('.monthly-sheet')){next=doc.createElement('main');next.className=sheet.className;next.append(template.content.cloneNode(true));sheet.after(next);}
   next.insertBefore(block,next.querySelector('.monthly-history,.monthly-closing'));
   if(++moves>14)throw new Error('ไม่สามารถจัดหน้าข้อมูลได้ กรุณาตรวจข้อความก่อนพิมพ์');
  }
  sheet=sheet.nextElementSibling?.matches('.monthly-sheet')?sheet.nextElementSibling:null;
 }
}
