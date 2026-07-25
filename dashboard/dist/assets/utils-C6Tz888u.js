function f(t){if(t==null)return"0.00";const n=typeof t=="string"?parseFloat(t):t;return isNaN(n)?"0.00":n.toFixed(2)}function m(t,n,d){const r=Object.keys(d),s=Object.values(d),i=[];i.push(r.join(",")),t.forEach(l=>{const u=s.map(b=>{let a=l[b];return a==null&&(a=""),`"${(""+a).replace(/"/g,'""')}"`});i.push(u.join(","))});const c="\uFEFF"+i.join(`
`),p=new Blob([c],{type:"text/csv;charset=utf-8;"}),e=URL.createObjectURL(p),o=document.createElement("a");o.setAttribute("href",e),o.setAttribute("download",n),o.style.visibility="hidden",document.body.appendChild(o),o.click(),document.body.removeChild(o)}function y(t,n,d,r){const s=window.open("","_blank");let i=n.map(e=>`<th>${e}</th>`).join(""),c=d.map(e=>`<tr>${r.map(l=>`<td>${e[l]!==null&&e[l]!==void 0?e[l]:"—"}</td>`).join("")}</tr>`).join("");const p=`
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
  `;s.document.write(p),s.document.close()}export{y as a,m as e,f};
