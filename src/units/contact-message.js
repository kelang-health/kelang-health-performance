import {escapeHtml as e} from '../utils/core.js';
export const CONTACT_MESSAGE_LIMIT=500;
export function validateContactMessage(value){const text=String(value??'').trim();if(text.length>CONTACT_MESSAGE_LIMIT)throw new Error('ข้อมูลติดต่อเพิ่มเติมไม่เกิน 500 ตัวอักษร');return text;}
export function contactMessageHtml(value){const text=validateContactMessage(value);return text.split(/(https:\/\/[^\s<>"']+)/g).map(part=>{if(!part.startsWith('https://'))return e(part);try{const url=new URL(part);if(url.protocol!=='https:')return e(part);return `<a href="${e(url.href)}" target="_blank" rel="noopener noreferrer">${e(part)}</a>`;}catch{return e(part);}}).join('');}
