"use strict";(()=>{var e={};e.id=2610,e.ids=[2610,2888,660],e.modules={3315:(e,t,a)=>{a.r(t),a.d(t,{config:()=>S,default:()=>v,getServerSideProps:()=>w,getStaticPaths:()=>y,getStaticProps:()=>f,reportWebVitals:()=>j,routeModule:()=>k,unstable_getServerProps:()=>_,unstable_getServerSideProps:()=>A,unstable_getStaticParams:()=>$,unstable_getStaticPaths:()=>P,unstable_getStaticProps:()=>N});var i={};a.r(i),a.d(i,{default:()=>AdminOrderDetail,getServerSideProps:()=>getServerSideProps});var d=a(7093),s=a(5244),r=a(1323),o=a(9209),n=a.n(o),l=a(8831),c=a(997),p=a(1649),u=a(5609),m=a(6933),x=a(3934),g=a(6689),h=a(5754),b=a(1163);function AdminOrderDetail({initialOrder:e,initialMessages:t}){let a=(0,b.useRouter)(),[i,d]=(0,g.useState)(e),[s,r]=(0,g.useState)(t||[]),[o,n]=(0,g.useState)(!1),[l,p]=(0,g.useState)(!1),[u,m]=(0,g.useState)(null),[x,v]=(0,g.useState)({status:"unpaid",paidAmount:0,balance:0}),[f,y]=(0,g.useState)(!1),[w,S]=(0,g.useState)(null);function showToast(e,t="success"){S({message:e,type:t}),setTimeout(()=>S(null),3500)}return(0,g.useEffect)(()=>{},[]),(0,c.jsxs)("div",{className:"p-6",children:[c.jsx("button",{onClick:()=>a.push("/admin"),className:"mb-4 px-3 py-1 border rounded",children:"Back"}),(0,c.jsxs)("h1",{className:"text-2xl font-bold mb-4",children:["Order ",i._id]}),(0,c.jsxs)("div",{className:"bg-white p-4 rounded shadow mb-4",children:[(0,c.jsxs)("div",{children:[c.jsx("strong",{children:"Customer:"})," ",i.customerName||i.userName||i.customerEmail]}),(0,c.jsxs)("div",{children:[c.jsx("strong",{children:"Phone:"})," ",i.whatsapp||i.phone||""]}),(0,c.jsxs)("div",{children:[c.jsx("strong",{children:"Address:"})," ",i.address||""]}),(0,c.jsxs)("div",{className:"mt-2",children:[c.jsx("strong",{children:"Items:"}),c.jsx("ul",{className:"list-disc ml-6 mt-2",children:(i.items||[]).map(e=>(0,c.jsxs)("li",{children:[e.title," \xd7 ",e.qty," — ₹",e.price]},e._id||e.sku))})]})]}),(0,c.jsxs)("div",{className:"flex items-center gap-3 mt-4",children:[c.jsx("button",{onClick:async()=>{n(!0),p(!0);try{let e=await fetch("/api/admin/invoices",{credentials:"include"}),t=await e.json(),a=(t.invoices||[]).find(e=>e.orderId===i._id);if(a)m(a),v({status:a.status||"unpaid",paidAmount:a.paidAmount||0,balance:a.balance||(a.total?a.total-(a.paidAmount||0):0)});else{let e=i.coupon&&i.coupon.discountAmount||0,t=(i.subtotal||0)-e;m(null),v({status:"unpaid",paidAmount:0,balance:t})}}catch(e){console.error("load invoice failed",e)}p(!1)},className:"px-3 py-1 bg-yellow-600 text-white rounded",children:"Update invoice status"}),c.jsx("button",{onClick:async()=>{y(!0);try{let[e,t]=await Promise.all([fetch("/api/admin/invoices",{credentials:"include"}),fetch("/api/admin/invoice-settings",{credentials:"include"})]),a=await e.json().catch(()=>({})),d=await t.json().catch(()=>({})),s=(a.invoices||[]).find(e=>e.orderId===i._id)||u,r=s;if(!r){let e=i.coupon&&i.coupon.discountAmount||0,t=(i.subtotal||0)-e,a=`INV-${Date.now()}`,d=await fetch("/api/admin/invoices",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({invoiceId:a,type:"order",orderId:i._id,payload:i,subtotal:i.subtotal||0,discount:e,total:t})}),s=await d.json().catch(()=>null);r=s&&s.invoice?s.invoice:null}let o=d||{},n=(i.items||[]).map(e=>`<tr><td style="padding:8px;border:1px solid #ddd">${e.title||"Item"}</td><td style="padding:8px;border:1px solid #ddd;text-align:center">${e.qty||1}</td><td style="padding:8px;border:1px solid #ddd;text-align:right">₹${(Number(e.price)||0).toFixed(2)}</td><td style="padding:8px;border:1px solid #ddd;text-align:right">₹${((Number(e.price)||0)*(Number(e.qty)||1)).toFixed(2)}</td></tr>`).join(""),l=Number(i.subtotal||0).toFixed(2),c=Number(i.coupon?.discountAmount||0).toFixed(2),p=Number(i.shipping||0).toFixed(2),m=Number(i.tax||0).toFixed(2),g=Number(i.total||(i.subtotal||0)-(i.coupon?.discountAmount||0)).toFixed(2),h=r?.status||x.status||"unpaid",b=Number(r?.paidAmount??x.paidAmount??0).toFixed(2),v=Number(r?.balance??x.balance??Number(g)-Number(b)).toFixed(2),f=`<div style="position:absolute;right:36px;top:40px;padding:8px 14px;border-radius:6px;background:${"paid"===h?"#16a34a":"partially-paid"===h?"#f59e0b":"#ef4444"};color:#fff;font-weight:700;transform:rotate(-6deg);box-shadow:0 2px 6px rgba(0,0,0,0.12)">${h.toUpperCase()}</div>`,w=`<!doctype html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Invoice ${r?.invoiceId||i._id}</title>
      <style>
        body{font-family:Arial,Helvetica,sans-serif;color:#222;margin:0;padding:24px;background:#fff}
        .container{max-width:900px;margin:0 auto;padding:24px;border:1px solid #f0f0f0}
        .header{display:flex;justify-content:space-between;align-items:center}
        .brand{font-size:20px;font-weight:700}
        .muted{color:#666;font-size:12px}
        table{width:100%;border-collapse:collapse;margin-top:12px}
        th,td{padding:10px;border:1px solid #eee}
        th{background:#fafafa;text-align:left}
        .right{text-align:right}
        .summary{width:360px;margin-left:auto}
        .logo{max-height:80px;max-width:220px;object-fit:contain;border-radius:4px}
        .watermark{position:fixed;top:40%;left:50%;transform:translate(-50%,-50%) rotate(-30deg);font-size:80px;color:rgba(0,0,0,0.04);pointer-events:none;user-select:none}
        .note{font-size:12px;color:#444;margin-top:18px}
        .footer{margin-top:28px;font-size:12px;color:#666}
      </style>
    </head>
    <body>
  <div class="watermark">${o?.watermarkText||"SD Stationary invoice"}</div>
      <div class="container">
        <div class="header">
          <div style="display:flex;align-items:center;gap:12px">
            <img src="/images/logo.jpeg" class="logo" alt="logo" />
            <div>
              <div class="brand">${o?.brandName||"Shree Durga Stationary"}</div>
              <div class="muted">${o?.address||""}</div>
              <div class="muted">Phone: ${o?.phone||""} | Email: ${o?.email||""}</div>
            </div>
          </div>
          <div style="text-align:right;position:relative;min-width:220px">
            ${f}
            <div style="font-size:14px;font-weight:700">Invoice</div>
            <div class="muted">Invoice ID: ${r?.invoiceId||i._id}</div>
            <div class="muted">Date: ${new Date(i.createdAt).toLocaleString()}</div>
          </div>
        </div>

        <hr style="border:none;border-top:1px solid #eee;margin:16px 0" />

        <div>
          <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start">
            <div>
              <strong>Bill To</strong>
              <div>${i.name||""}</div>
              <div class="muted">${i.email||""}</div>
              <div class="muted">${i.phone||""}</div>
              <div class="muted">${i.address||""}</div>
            </div>
          </div>
        </div>

        <h3 style="margin-top:18px">Items</h3>
        <table>
          <thead>
            <tr>
              <th>Product</th>
              <th style="width:90px;text-align:center">Qty</th>
              <th style="width:140px;text-align:right">Unit</th>
              <th style="width:160px;text-align:right">Line Total</th>
            </tr>
          </thead>
          <tbody>
            ${n}
          </tbody>
        </table>

        <div class="summary">
          <table style="border:none;margin-top:12px">
            <tbody>
              <tr><td class="muted" style="border:none;padding:6px">Subtotal</td><td class="right" style="border:none;padding:6px">₹${l}</td></tr>
              <tr><td class="muted" style="border:none;padding:6px">Discount</td><td class="right" style="border:none;padding:6px">- ₹${c}</td></tr>
              <tr><td class="muted" style="border:none;padding:6px">Shipping</td><td class="right" style="border:none;padding:6px">₹${p}</td></tr>
              <tr><td class="muted" style="border:none;padding:6px">Tax</td><td class="right" style="border:none;padding:6px">₹${m}</td></tr>
              <tr><td class="muted" style="border:none;padding:6px">Paid</td><td class="right" style="border:none;padding:6px">₹${b}</td></tr>
              <tr><td style="border-top:1px solid #ddd;padding:8px;font-weight:700">Balance</td><td style="border-top:1px solid #ddd;padding:8px;text-align:right;font-weight:700">₹${v}</td></tr>
              <tr><td style="border-top:1px solid #ddd;padding:8px;font-weight:700">Payable</td><td style="border-top:1px solid #ddd;padding:8px;text-align:right;font-weight:700">₹${g}</td></tr>
            </tbody>
          </table>
        </div>

        <div class="note">
          <strong>Note:</strong> This is a system generated invoice and does not require a physical signature or stamp to be valid.
        </div>

        <div class="footer">
          <div>Authorized by: ${o?.brandName||"Shree Durga Stationary"}</div>
          <div style="margin-top:6px;color:#999;font-size:12px">For any queries, contact ${o?.phone||""} or ${o?.email||""}</div>
        </div>
      </div>
    </body>
    </html>`,S=window.open("about:blank","invoice");if(!S){showToast("Popup blocked. Allow popups to download invoice.","error"),y(!1);return}S.document.write(w),S.document.close(),setTimeout(()=>{try{S.focus(),S.print()}catch(e){}y(!1)},350)}catch(e){console.error("print invoice failed",e),showToast("Unable to print invoice","error"),y(!1)}},className:"px-3 py-1 bg-blue-600 text-white rounded",children:f?"Printing…":"Download Invoice (PDF)"})]}),c.jsx(h.ZP,{message:w?.message,type:w?.type}),o&&c.jsx("div",{className:"fixed inset-0 z-50 flex items-center justify-center bg-black/40",children:(0,c.jsxs)("div",{className:"bg-white p-6 rounded shadow max-w-md w-full",children:[c.jsx("h3",{className:"text-lg font-semibold mb-3",children:"Update invoice status"}),l?c.jsx("div",{children:"Loading…"}):(0,c.jsxs)("div",{className:"space-y-3",children:[(0,c.jsxs)("div",{children:[c.jsx("label",{className:"block text-sm",children:"Status"}),(0,c.jsxs)("select",{value:x.status,onChange:e=>v(t=>({...t,status:e.target.value})),className:"mt-1 w-full border p-2 rounded",children:[c.jsx("option",{value:"unpaid",children:"Unpaid"}),c.jsx("option",{value:"partially-paid",children:"Partially paid"}),c.jsx("option",{value:"paid",children:"Paid"})]})]}),(0,c.jsxs)("div",{children:[c.jsx("label",{className:"block text-sm",children:"Paid amount"}),c.jsx("input",{type:"number",value:x.paidAmount,onChange:e=>{let t=parseFloat(e.target.value)||0,a=(i.subtotal||0)-(i.coupon&&i.coupon.discountAmount||0);v(e=>({...e,paidAmount:t,balance:Math.max(0,a-t)}))},className:"mt-1 w-full border p-2 rounded"})]}),(0,c.jsxs)("div",{children:[c.jsx("label",{className:"block text-sm",children:"Balance"}),c.jsx("input",{type:"number",value:x.balance,onChange:e=>v(t=>({...t,balance:parseFloat(e.target.value)||0})),className:"mt-1 w-full border p-2 rounded"})]}),(0,c.jsxs)("div",{className:"flex justify-end gap-2 mt-4",children:[c.jsx("button",{onClick:()=>n(!1),className:"px-3 py-1 border rounded",children:"Cancel"}),c.jsx("button",{onClick:async()=>{try{let e,t;let a=i.coupon&&i.coupon.discountAmount||0,d=Number(u&&u.total||(i.subtotal||0)-a||0),s=Number(x.paidAmount||0);if(s<0){showToast("Paid amount cannot be negative","error");return}if(s>d){showToast("Paid amount cannot exceed total payable","error");return}let r=x.status;s>=d?r="paid":s>0&&s<d&&(r="partially-paid");let o={status:r,paidAmount:s,balance:Number(x.balance||Math.max(0,d-s))};if(u&&u._id)e=await fetch("/api/admin/invoices",{method:"PUT",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:u._id,...o})}),t=await e.json();else{let s=`INV-${Date.now()}`;e=await fetch("/api/admin/invoices",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({invoiceId:s,type:"order",orderId:i._id,payload:i,subtotal:i.subtotal||0,discount:a,total:d,...o})}),t=await e.json()}e&&e.ok?(n(!1),m(t.invoice||t.invoice),showToast("Invoice saved","success")):(console.error("invoice update failed",t),showToast("Failed to save invoice: "+(t&&t.error),"error"))}catch(e){console.error(e),showToast("Error saving invoice","error")}},className:"px-3 py-1 bg-blue-600 text-white rounded",children:"Save"})]})]})]})}),c.jsx("h2",{className:"text-xl font-semibold mb-2",children:"Related messages"}),c.jsx("div",{className:"space-y-3",children:s.map(e=>(0,c.jsxs)("div",{className:"card",children:[c.jsx("div",{className:"font-semibold",children:e.subject}),(0,c.jsxs)("div",{className:"text-sm text-gray-600",children:["From: ",e.fromName," • ",new Date(e.createdAt).toLocaleString()]}),c.jsx("div",{className:"mt-2 text-sm",children:e.text})]},e._id))})]})}async function getServerSideProps(e){let t=await (0,p.getSession)(e);if(!t||"admin"!==t.user.role)return{redirect:{destination:"/login",permanent:!1}};let{id:a}=e.params;await (0,u.Z)();let i=await m.Z.findById(a).lean(),d=await x.Z.find({orderId:a}).sort({createdAt:-1}).lean();return{props:{initialOrder:JSON.parse(JSON.stringify(i||{})),initialMessages:JSON.parse(JSON.stringify(d||[]))}}}let v=(0,r.l)(i,"default"),f=(0,r.l)(i,"getStaticProps"),y=(0,r.l)(i,"getStaticPaths"),w=(0,r.l)(i,"getServerSideProps"),S=(0,r.l)(i,"config"),j=(0,r.l)(i,"reportWebVitals"),N=(0,r.l)(i,"unstable_getStaticProps"),P=(0,r.l)(i,"unstable_getStaticPaths"),$=(0,r.l)(i,"unstable_getStaticParams"),_=(0,r.l)(i,"unstable_getServerProps"),A=(0,r.l)(i,"unstable_getServerSideProps"),k=new d.PagesRouteModule({definition:{kind:s.x.PAGES,page:"/admin/orders/[id]",pathname:"/admin/orders/[id]",bundlePath:"",filename:""},components:{App:l.default,Document:n()},userland:i})},3934:(e,t,a)=>{a.d(t,{Z:()=>o});var i=a(1185),d=a.n(i);let s=new(d()).Schema({fromUserId:String,fromName:String,fromEmail:String,fromPhone:String,subject:String,text:String,orderId:String,read:{type:Boolean,default:!1},replies:[{from:String,text:String,createdAt:Date}],createdAt:{type:Date,default:Date.now}}),r=d()&&d().models&&d().models.Message?d().models.Message:d().model("Message",s),o=r},1185:e=>{e.exports=require("mongoose")},1649:e=>{e.exports=require("next-auth/react")},2785:e=>{e.exports=require("next/dist/compiled/next-server/pages.runtime.prod.js")},968:e=>{e.exports=require("next/head")},6689:e=>{e.exports=require("react")},6405:e=>{e.exports=require("react-dom")},997:e=>{e.exports=require("react/jsx-runtime")},7147:e=>{e.exports=require("fs")},1017:e=>{e.exports=require("path")},2781:e=>{e.exports=require("stream")},7310:e=>{e.exports=require("url")},9796:e=>{e.exports=require("zlib")}};var t=require("../../../webpack-runtime.js");t.C(e);var __webpack_exec__=e=>t(t.s=e),a=t.X(0,[2761,2006,9209,8450,8831,7671,8943],()=>__webpack_exec__(3315));module.exports=a})();