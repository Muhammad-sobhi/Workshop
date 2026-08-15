import{u as y}from"./createLucideIcon-np3numnG.js";import{h as w}from"./main-layout-TlNAfuJB.js";function F(t){if(t==null)return"0.00";const e=typeof t=="string"?parseFloat(t):t;return isNaN(e)?"0.00":e.toFixed(2)}function E(t){if(!t)return"";const e=new Date(t);return isNaN(e.getTime())?String(t):e.toLocaleDateString("ar-EG",{calendar:"gregory"})}function j(t,e,s){const p=Object.keys(s),r=Object.values(s),o=[];o.push(p.join(",")),t.forEach(f=>{const m=r.map(g=>{let i=f[g];return i==null&&(i=""),`"${(""+i).replace(/"/g,'""')}"`});o.push(m.join(","))});const c="\uFEFF"+o.join(`
`),l=new Blob([c],{type:"text/csv;charset=utf-8;"}),d=URL.createObjectURL(l),n=document.createElement("a");n.setAttribute("href",d),n.setAttribute("download",e),n.style.visibility="hidden",document.body.appendChild(n),n.click(),document.body.removeChild(n)}function B(t,e,s,p){var h;const r=window.open("","_blank");if(!r)return;const o=((h=y.getState())==null?void 0:h.settings)||{},c=o.company_name||"ورشة الأثاث الحديث",l=o.phone||"",d=o.address||"",n=o.logo_path?w(o.logo_path):"",f=o.invoice_footer||"تم إصدار هذا المستند تلقائياً من نظام إدارة الورشة";let m=e.map(a=>`<th style="background-color: #1E1B4B; color: #ffffff; padding: 8px 10px; font-size: 11px; font-weight: bold; border: 1px solid #CBD5E1;">${a}</th>`).join(""),g=s.map((a,x)=>{let b=p.map(u=>`<td style="padding: 7px 10px; font-size: 11px; border: 1px solid #E2E8F0; text-align: center;">${a[u]!==null&&a[u]!==void 0?a[u]:"—"}</td>`).join("");return`<tr style="background-color: ${x%2===0?"#FFFFFF":"#F8FAFC"};">${b}</tr>`}).join("");const i=`
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="utf-8">
      <title>${t} - ${c}</title>
      <style>
        @media print {
          @page { size: A4; margin: 10mm; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          button { display: none; }
        }
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 15px; color: #0F172A; line-height: 1.5; background: #fff; direction: rtl; text-align: right; }
        .header-container { display: flex; justify-content: space-between; align-items: center; border-bottom: 2.5px solid #1E1B4B; padding-bottom: 10px; margin-bottom: 15px; }
        .workshop-info h1 { margin: 0; font-size: 18px; font-weight: 900; color: #1E1B4B; }
        .workshop-info p { margin: 2px 0 0 0; font-size: 11px; color: #64748B; font-weight: 500; }
        .doc-info { text-align: left; }
        .doc-info h2 { margin: 0; font-size: 15px; font-weight: 800; color: #D97706; }
        .doc-info p { margin: 2px 0 0 0; font-size: 10px; color: #64748B; }
        table { width: 100%; border-collapse: collapse; margin-top: 15px; }
        .footer { margin-top: 25px; border-top: 1px solid #E2E8F0; padding-top: 8px; text-align: center; font-size: 10px; color: #94A3B8; }
      </style>
    </head>
    <body>
      <div class="header-container">
        <div style="display: flex; align-items: center; gap: 12px;">
          ${n?`<img src="${n}" style="max-height: 50px; max-width: 120px; object-fit: contain;" />`:""}
          <div class="workshop-info">
            <h1>${c}</h1>
            ${l?`<p>📞 هاتف: ${l}</p>`:""}
            ${d?`<p>📍 ${d}</p>`:""}
          </div>
        </div>
        <div class="doc-info">
          <h2>${t}</h2>
          <p>تاريخ التقرير: ${new Date().toLocaleDateString("ar-EG")}</p>
        </div>
      </div>

      <table>
        <thead>
          <tr>${m}</tr>
        </thead>
        <tbody>
          ${g}
        </tbody>
      </table>

      <div class="footer">
        <p>${f} • تاريخ الاستخراج: ${new Date().toLocaleString("ar-EG")}</p>
      </div>

      <script>
        window.onload = function() {
          window.print();
        }
      <\/script>
    </body>
    </html>
  `;r.document.write(i),r.document.close()}export{F as a,B as b,j as e,E as f};
