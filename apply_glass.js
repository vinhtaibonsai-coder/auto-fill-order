const fs = require('fs');

let html = fs.readFileSync('admin-dashboard/index.html', 'utf8');

// 1. Sidebar and AppShell Backgrounds
// Replace bg-brand-neutralCard with glass-card
html = html.replace(/bg-brand-neutralCard/g, 'glass-card');
// Replace bg-white with glass-card (for cards)
html = html.replace(/\bbg-white\b/g, 'glass-card');
html = html.replace(/\bbg-\[\#FFFFFF\]\b/g, 'glass-card');

// 2. Text colors
html = html.replace(/\btext-\[\#111111\]\b/g, 'text-white');
html = html.replace(/\btext-gray-900\b/g, 'text-white');
html = html.replace(/\btext-gray-800\b/g, 'text-slate-100');
html = html.replace(/\btext-gray-700\b/g, 'text-slate-200');
html = html.replace(/\btext-gray-600\b/g, 'text-slate-300');
html = html.replace(/\btext-gray-500\b/g, 'text-slate-400');
html = html.replace(/\btext-black\b/g, 'text-white');

// 3. Borders
// The brand-borderLight is now 'rgba(255, 255, 255, 0.1)', which works for dark mode
// But if there are border-gray-200 etc.
html = html.replace(/\bborder-gray-200\b/g, 'border-brand-borderLight');
html = html.replace(/\bborder-gray-300\b/g, 'border-brand-borderLight');
html = html.replace(/\bborder-\[\#EAEAEA\]\b/g, 'border-brand-borderLight');

// 4. Inputs and Selects
html = html.replace(/<input([^>]+)class="([^"]*)"/g, '<input=" glass-input"');
html = html.replace(/<select([^>]+)class="([^"]*)"/g, '<select=" glass-input"');
html = html.replace(/<textarea([^>]+)class="([^"]*)"/g, '<textarea=" glass-input"');

// 5. Some specific backgrounds for table headers
html = html.replace(/\bbg-gray-50\b/g, 'bg-white/5');
html = html.replace(/\bbg-brand-neutralBg\/50\b/g, 'bg-white/5');
html = html.replace(/\bbg-gray-100\b/g, 'bg-white/10');
html = html.replace(/\bhover:bg-gray-50\b/g, 'hover:bg-white/10');
html = html.replace(/\bhover:bg-\[\#F7F6F3\]\b/g, 'hover:bg-white/10');

fs.writeFileSync('admin-dashboard/index.html', html, 'utf8');
console.log('Applied Glassmorphism classes to index.html');
