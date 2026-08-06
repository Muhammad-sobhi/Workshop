function m(t){if(t==null)return"0.00";const e=typeof t=="string"?parseFloat(t):t;return isNaN(e)?"0.00":e.toFixed(2)}function h(t){if(!t)return"";const e=new Date(t);return isNaN(e.getTime())?String(t):e.toLocaleDateString("ar-EG",{calendar:"gregory"})}function g(t,e,a){const d=Object.keys(a),l=Object.values(a),i=[];i.push(d.join(",")),t.forEach(r=>{const u=l.map(f=>{let s=r[f];return s==null&&(s=""),`"${(""+s).replace(/"/g,'""')}"`});i.push(u.join(","))});const c="\uFEFF"+i.join(`
`),p=new Blob([c],{type:"text/csv;charset=utf-8;"}),o=URL.createObjectURL(p),n=document.createElement("a");n.setAttribute("href",o),n.setAttribute("download",e),n.style.visibility="hidden",document.body.appendChild(n),n.click(),document.body.removeChild(n)}function y(t,e,a,d){const l=window.open("","_blank");let i=e.map(o=>`<th>${o}</th>`).join(""),c=a.map(o=>`<tr>${d.map(r=>`<td>${o[r]!==null&&o[r]!==void 0?o[r]:"—"}</td>`).join("")}</tr>`).join("");const p=`
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="utf-8">
      <title>${t}</title>
      <style>
        body { font-family: system-ui, -apple-system, sans-serif; padding: 20px; color: #333; }
        h1 { text-align: center; font-size: 20px; margin-bottom: 20px; color: #111; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th, td { border: 1px solid #ddd; padding: 10px; text-align: right; font-size: 12px; }
        th { background-color: #f5f5f5; font-weight: bold; }
        tr:nth-child(even) { background-color: #fafafa; }
        @media print {
          body { padding: 0; }
          button { display: none; }
        }
      </style>
    </head>
    <body>
      <h1>${t}</h1>
      <table>
        <thead>
          <tr>${i}</tr>
        </thead>
        <tbody>
          ${c}
        </tbody>
      </table>
      <script>
        window.onload = function() {
          window.print();
          window.onafterprint = function() { window.close(); };
        }
      <\/script>
    </body>
    </html>
  `;l.document.write(p),l.document.close()}export{m as a,y as b,g as e,h as f};
