export const CSS = `
:root{
  --ink:#15181e; --muted:#5d6675; --line:#e3e6eb; --bg:#f6f7f9; --card:#fff;
  --accent:#1c7a4f; --accent-ink:#fff; --accent-soft:#e6f4ec; --warn:#9a5b00; --warn-soft:#fdf1dc;
  --blue:#1d5fbf; --blue-soft:#e5eefb; --danger:#b3261e;
  --radius:10px;
}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;font:15px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:var(--ink);background:var(--bg)}
a{color:var(--blue)}
h1,h2,h3{line-height:1.25;margin:0}
.wrap{max-width:1000px;margin:0 auto;padding:0 20px}
.top{background:#fff;border-bottom:1px solid var(--line)}
.top .wrap{display:flex;align-items:center;gap:18px;min-height:56px;flex-wrap:wrap}
.brand{font-weight:700;font-size:18px;letter-spacing:-.01em;color:var(--ink);text-decoration:none;display:flex;align-items:center;gap:8px}
.brand i{display:inline-grid;place-items:center;width:26px;height:26px;border-radius:7px;background:var(--accent);color:#fff;font-style:normal;font-size:15px}
.ws{color:var(--muted);font-size:13px}
.tabs{display:flex;gap:4px;margin-left:auto;flex-wrap:wrap}
.tabs a{padding:8px 12px;border-radius:8px;text-decoration:none;color:var(--muted);font-weight:600;font-size:14px}
.tabs a.on{background:var(--accent-soft);color:var(--accent)}
main{padding:28px 0 60px}
.head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:18px;flex-wrap:wrap}
.head h1{font-size:22px}
.sub{color:var(--muted);margin:4px 0 0}
.card{background:var(--card);border:1px solid var(--line);border-radius:var(--radius);padding:20px}
.card + .card{margin-top:16px}
.btn{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--line);background:#fff;color:var(--ink);padding:8px 14px;border-radius:8px;font:inherit;font-weight:600;cursor:pointer;text-decoration:none;white-space:nowrap}
.btn:hover{border-color:#c9ced6}
.btn.primary{background:var(--accent);border-color:var(--accent);color:var(--accent-ink)}
.btn.primary:hover{filter:brightness(1.06)}
.btn.ghost{border-color:transparent;color:var(--muted)}
.btn.danger{color:var(--danger)}
.btn.small{padding:5px 10px;font-size:13px}
.row{display:flex;gap:10px;flex-wrap:wrap;align-items:center}
label{display:block;font-weight:600;font-size:13px;margin:0 0 5px}
input[type=text],input[type=email],input[type=date],input[type=number],select,textarea{
  width:100%;border:1px solid #cfd4dc;border-radius:8px;padding:9px 11px;font:inherit;color:var(--ink);background:#fff}
textarea{resize:vertical;min-height:90px;line-height:1.5}
input:focus,select:focus,textarea:focus{outline:2px solid var(--accent);outline-offset:0;border-color:var(--accent)}
.grid{display:grid;gap:14px}
.g2{grid-template-columns:repeat(2,minmax(0,1fr))}
.g3{grid-template-columns:repeat(3,minmax(0,1fr))}
.g4{grid-template-columns:repeat(4,minmax(0,1fr))}
.field{margin-bottom:14px}
.hint{color:var(--muted);font-size:13px;margin:5px 0 0}
table{width:100%;border-collapse:collapse}
th{font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted);text-align:left;padding:8px 10px;border-bottom:1px solid var(--line)}
td{padding:11px 10px;border-bottom:1px solid var(--line);vertical-align:middle}
tr:last-child td{border-bottom:0}
td.num,th.num{text-align:right;font-variant-numeric:tabular-nums}
.list a.title{font-weight:600;color:var(--ink);text-decoration:none}
.list a.title:hover{text-decoration:underline}
.chip{display:inline-block;padding:2px 9px;border-radius:999px;font-size:12px;font-weight:700;background:#eceef2;color:#4a5361}
.chip.sent{background:var(--blue-soft);color:var(--blue)}
.chip.viewed{background:var(--warn-soft);color:var(--warn)}
.chip.accepted{background:var(--accent-soft);color:var(--accent)}
.chip.claude{background:#f3ebff;color:#6a3fc4}
.empty{text-align:center;padding:36px 16px;color:var(--muted)}
.empty h3{color:var(--ink);margin-bottom:6px;font-size:17px}
.copy{display:flex;gap:8px}
.copy input{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13px;background:#f9fafb}
.banner{border-radius:var(--radius);padding:12px 16px;margin-bottom:16px;border:1px solid}
.banner.ok{background:var(--accent-soft);border-color:#bfe3cd;color:#12573a}
.banner.info{background:var(--blue-soft);border-color:#c5d9f6;color:#16468d}
.banner.warn{background:var(--warn-soft);border-color:#f3d9a4;color:#7a4700}
.sec{border:1px solid var(--line);border-radius:8px;padding:12px;margin-bottom:10px;background:#fbfbfc}
.sec .row{justify-content:space-between;margin-bottom:8px}
.items td{padding:6px 4px;border:0}
.items input{padding:7px 9px}
.totals{margin-top:10px;margin-left:auto;max-width:300px}
.totals div{display:flex;justify-content:space-between;padding:4px 0}
.totals .grand{font-weight:700;font-size:17px;border-top:1px solid var(--line);margin-top:4px;padding-top:8px}
.stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-bottom:16px}
.stat{background:#fff;border:1px solid var(--line);border-radius:var(--radius);padding:14px 16px}
.stat b{display:block;font-size:22px}
.stat span{color:var(--muted);font-size:13px}
ol.steps{padding-left:20px;margin:0}
ol.steps li{margin-bottom:10px}
code{background:#eef0f3;border-radius:5px;padding:1px 6px;font-size:13px}
.hero{padding:56px 0 24px;text-align:center}
.hero h1{font-size:38px;letter-spacing:-.02em;max-width:720px;margin:0 auto 14px}
.hero p{font-size:17px;color:var(--muted);max-width:620px;margin:0 auto}
.how{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin:28px 0}
.how .card b{display:block;margin-bottom:4px}
.sticky{position:sticky;bottom:0;background:rgba(246,247,249,.94);backdrop-filter:blur(6px);border-top:1px solid var(--line);padding:12px 0;margin-top:20px}

/* Client-facing proposal */
.doc-bg{background:#eef0f3;min-height:100vh;padding:28px 14px 80px}
.doc{max-width:780px;margin:0 auto;background:#fff;border-radius:12px;box-shadow:0 1px 3px rgba(20,24,30,.08),0 12px 40px rgba(20,24,30,.06);overflow:hidden}
.doc-head{padding:44px 52px 30px;border-bottom:1px solid var(--line)}
.doc-head .from{font-weight:700;color:var(--accent);letter-spacing:.02em;font-size:14px;text-transform:uppercase}
.doc-head h1{font-family:Georgia,"Times New Roman",serif;font-size:34px;font-weight:600;margin:14px 0 18px;letter-spacing:-.01em}
.meta{display:flex;gap:28px;flex-wrap:wrap;color:var(--muted);font-size:14px}
.meta b{display:block;color:var(--ink);font-size:15px}
.doc-body{padding:30px 52px 44px}
.doc-body h2{font-family:Georgia,"Times New Roman",serif;font-size:21px;font-weight:600;margin:30px 0 10px}
.doc-body p{margin:0 0 12px}
.doc-body ul,.doc-body ol{margin:0 0 12px;padding-left:22px}
.doc-body li{margin-bottom:5px}
.intro{font-size:16.5px}
.price th,.price td{padding:11px 8px}
.price tfoot td{border-bottom:0;padding:6px 8px}
.price tfoot tr.grand td{font-weight:700;font-size:18px;border-top:2px solid var(--ink);padding-top:12px}
.accept{margin-top:34px;border:1px solid #bfe3cd;background:var(--accent-soft);border-radius:12px;padding:22px}
.accept h2{margin-top:0}
.accept .row{align-items:flex-end}
.accept .grow{flex:1;min-width:220px}
.done{display:flex;gap:14px;align-items:center}
.done .tick{flex:none;width:44px;height:44px;border-radius:50%;background:var(--accent);color:#fff;display:grid;place-items:center;font-size:22px}
.foot{text-align:center;color:var(--muted);font-size:12.5px;margin-top:18px}
.preview-bar{max-width:780px;margin:0 auto 14px;display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap}

@media (max-width:720px){
  .g2,.g3,.g4,.how,.stats{grid-template-columns:1fr 1fr}
  .g2.stack,.how{grid-template-columns:1fr}
  .tabs{margin-left:0;width:100%;overflow-x:auto;flex-wrap:nowrap;padding-bottom:6px}
  .hero h1{font-size:29px}
  .doc-head{padding:30px 22px 22px}.doc-body{padding:22px 22px 32px}
  .doc-head h1{font-size:27px}
  .hide-sm{display:none}
}
@media print{
  .doc-bg{background:#fff;padding:0}.doc{box-shadow:none}.accept form,.preview-bar,.foot{display:none}
}
`;
