// Eligibility comes from the applicant's personnel position, not the editor's role.
export function isMedicalDoctor(position){
 const title=String(position||'').trim();
 return /^(?:นายแพทย์|แพทย์หญิง|แพทย์(?!แผนไทย|แผนจีน)|น\.?พ\.|พ\.?ญ\.)/.test(title);
}
export function withoutNonDoctorTraining(fields,position){
 const result={...fields};
 if(!isMedicalDoctor(position)){
  for(const key of Object.keys(result))if(key.startsWith('training_'))delete result[key];
  result.training_status=1;
 }
 return result;
}
