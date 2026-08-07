const fs = require('fs');

let html = fs.readFileSync('admin-dashboard/index.html', 'utf8');

// Replace hex colors explicitly
html = html.replace(/bg-\[\#FFFFFF\]/g, 'glass-card');
html = html.replace(/text-\[\#111111\]/g, 'text-white');
html = html.replace(/text-\[\#2F3437\]/g, 'text-slate-100');
html = html.replace(/text-\[\#787774\]/g, 'text-slate-300');
html = html.replace(/border-\[\#EAEAEA\]/g, 'border-brand-borderLight');
html = html.replace(/bg-\[\#111111\]/g, 'bg-slate-900/80');
html = html.replace(/border-\[\#333333\]/g, 'border-white/10');
html = html.replace(/hover:bg-\[\#F7F6F3\]/g, 'hover:bg-white/10');

// Replace background whites that might have been missed
html = html.replace(/bg-white/g, 'glass-card');
html = html.replace(/text-gray-900/g, 'text-white');
html = html.replace(/text-gray-800/g, 'text-slate-100');
html = html.replace(/text-gray-700/g, 'text-slate-200');
html = html.replace(/text-gray-600/g, 'text-slate-300');
html = html.replace(/text-gray-500/g, 'text-slate-400');
html = html.replace(/border-gray-200/g, 'border-brand-borderLight');
html = html.replace(/border-gray-300/g, 'border-brand-borderLight');
html = html.replace(/border-gray-100/g, 'border-brand-borderLight');
html = html.replace(/bg-gray-50/g, 'bg-white/5');
html = html.replace(/bg-gray-100/g, 'bg-white/10');
html = html.replace(/hover:bg-gray-50/g, 'hover:bg-white/10');

fs.writeFileSync('admin-dashboard/index.html', html, 'utf8');
console.log('Fixed remaining hardcoded light mode colors');
