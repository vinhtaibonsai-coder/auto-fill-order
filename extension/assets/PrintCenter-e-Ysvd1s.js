import{r as u,j as e,C as ft,X as Et,aI as Be,aJ as Vt,E as ht,R as Kt,J as yn,S as vn,aF as _n,aK as xt,aL as Ot,h as gt,ac as ut,T as Ft,ap as jn,q as Sn,aM as Cn,a3 as kn}from"./vendor-react-BXpR8LUz.js";import{a as wn,b as Nn}from"./order-event.taxonomy-CCQqXiQY.js";import{O as pe}from"./storage.esm-B3NCAz6i.js";import"./auth.service.esm-CWU8VhtC.js";import"./auth.session.js-DBqnIR8Z.js";import"./auth.service.js-CWyefUYt.js";import"./storage.js-DoqsBGZp.js";const mt=Object.freeze({A4:{width:"210mm",height:"297mm",widthPx:794,heightPx:1123,label:"A4 (210 x 297 mm) - Khổ văn phòng"},A5:{width:"148mm",height:"210mm",widthPx:559,heightPx:794,label:"A5 (148 x 210 mm) - Nửa tờ A4"},A6:{width:"105mm",height:"148mm",widthPx:397,heightPx:559,label:"A6 (105 x 148 mm) - Chuẩn bưu điện VNPost"},K100:{width:"100mm",height:"150mm",widthPx:378,heightPx:567,label:"100 x 150 mm (K100) - Cuộn in nhiệt TMĐT"},"100X150":{width:"100mm",height:"150mm",widthPx:378,heightPx:567,label:"100 x 150 mm (K100) - Cuộn in nhiệt TMĐT"}});function bt(n){if(!n&&n!==0)return"20mm";const r=String(n).trim().toLowerCase();if(r==="0"||r==="0cm"||r==="0mm")return"0mm";if(r==="2cm"||r==="20mm")return"20mm";if(r==="1.5cm"||r==="15mm")return"15mm";if(r==="1cm"||r==="10mm")return"10mm";if(r==="0.5cm"||r==="5mm")return"5mm";if(r.includes(" "))return r.split(/\s+/).filter(Boolean).map(s=>bt(s)).join(" ");if(r.endsWith("cm")||r.endsWith("mm")||r.endsWith("in")||r.endsWith("px"))return r;const o=parseFloat(r);return isNaN(o)?"20mm":`${o}mm`}const Gt=["212222","222122","222221","121223","121322","131222","122213","122312","132212","221213","221312","231212","112232","122132","122231","113222","123122","123221","223211","221132","221231","213212","223112","312131","311222","321122","321221","312212","322112","322211","212123","212321","232121","111323","131123","131321","112313","132113","132311","211313","231113","231311","112133","112331","132131","113123","113321","133121","313121","211331","231131","213113","213311","213131","311123","311321","331121","312113","312311","332111","314111","221411","431111","111224","111422","121124","121421","141122","141221","112214","112412","122114","122411","142112","142211","241211","221114","413111","241112","134111","111242","121142","121241","114212","124112","124211","411212","421112","421211","212141","214121","412121","111143","111341","131141","114113","114311","411113","411311","113141","114131","311141","411131","211412","211214","211232","2331112"];function Zt(n,r=44){n||(n="NO-TRACKING");const o=String(n).trim(),s=[104];let j=104;for(let _=0;_<o.length;_++){const C=o.charCodeAt(_)-32,g=C>=0&&C<=95?C:0;s.push(g),j+=g*(_+1)}s.push(j%103),s.push(106);let y="";for(const _ of s){const C=Gt[_]||Gt[0];let g=!0;for(const I of C){const h=parseInt(I,10);y+=(g?"1":"0").repeat(h),g=!g}}let c="",P=0;const v=1.35;for(let _=0;_<y.length;_++){if(y[_]==="1"){const C=(P*v).toFixed(1),g=v.toFixed(1);c+=`M${C} 0h${g}v${r}h-${g}z `}P++}const R=(y.length*v).toFixed(1);return`<svg viewBox="0 0 ${R} ${r}" class="barcode-svg vnpost-barcode-svg" style="width: 100%; max-width: ${R}px; height: ${r}px; display: block; margin: 0 auto;" preserveAspectRatio="none"><path d="${c}" fill="#000"/></svg>`}function en(n,r=68){const s=Array.from({length:25},()=>Array(25).fill(null));function j(p,m){for(let x=-1;x<=7;x++)for(let b=-1;b<=7;b++){const N=m+x,S=p+b;S<0||S>=25||N<0||N>=25||(x===-1||x===7||b===-1||b===7?s[N][S]=!1:x===0||x===6||b===0||b===6||x>=2&&x<=4&&b>=2&&b<=4?s[N][S]=!0:s[N][S]=!1)}}j(0,0),j(18,0),j(0,18);for(let p=-2;p<=2;p++)for(let m=-2;m<=2;m++){const x=18+p,b=18+m;s[x][b]=Math.abs(p)===2||Math.abs(m)===2||p===0&&m===0}for(let p=8;p<17;p++)s[6][p]=p%2===0,s[p][6]=p%2===0;s[17][8]=!0;const y=[1,1,1,0,1,1,1,1,1,0,0,0,1,0,0],c=[[8,0],[8,1],[8,2],[8,3],[8,4],[8,5],[8,7],[8,8],[7,8],[5,8],[4,8],[3,8],[2,8],[1,8],[0,8]];for(let p=0;p<15;p++)s[c[p][0]][c[p][1]]=y[p]===1;const P=String(n||""),v=[0,1,0,0],R=Math.min(P.length,28);for(let p=7;p>=0;p--)v.push(R>>p&1);for(let p=0;p<R;p++){const m=P.charCodeAt(p);for(let x=7;x>=0;x--)v.push(m>>x&1)}for(;v.length<28*8&&v.length%8!==0;)v.push(0);for(;v.length<28*8;)v.push(1,1,1,0,1,1,0,0),v.length<28*8&&v.push(0,0,0,1,0,0,0,1);let _=0,C=-1,g=24;for(;g>0;){g===6&&g--;let p=C===-1?24:0;for(;p>=0&&p<25;){for(let m=0;m<2;m++){const x=g-m;if(s[p][x]===null){let b=_<v.length?v[_++]:0;(p+x)%2===0&&(b=b^1),s[p][x]=b===1}}p+=C}C=-C,g-=2}const I=(r/25).toFixed(2);let h="";for(let p=0;p<25;p++)for(let m=0;m<25;m++)if(s[p][m]){const x=(m*I).toFixed(1),b=(p*I).toFixed(1);h+=`M${x} ${b}h${I}v${I}h-${I}z `}return`<svg viewBox="0 0 ${r} ${r}" width="${r}" height="${r}" class="vnpost-qr-svg" style="display: block;"><path d="${h}" fill="#000"/></svg>`}function tn(n){return n==null||isNaN(n)?"0 đ":`${Math.round(Number(n)).toLocaleString("vi-VN")} đ`}function nn(n="",r={}){const o=(n||"").toLowerCase();if(o.includes("hà nội")||o.includes("ha noi")){let c="Hoàn Kiếm";return o.includes("ba đình")||o.includes("phúc xá")?c="Ba Đình":o.includes("đống đa")?c="Đống Đa":o.includes("cầu giấy")?c="Cầu Giấy":o.includes("hai bà trưng")?c="Hai Bà Trưng":o.includes("hoàng mai")?c="Hoàng Mai":o.includes("thanh xuân")?c="Thanh Xuân":o.includes("hà đông")?c="Hà Đông":o.includes("tây hồ")?c="Tây Hồ":o.includes("bắc từ liêm")?c="Bắc Từ Liêm":o.includes("nam từ liêm")?c="Nam Từ Liêm":o.includes("long biên")&&(c="Long Biên"),{line1:"LV/10 - Hà Nội/100920 - KTNT Hà Nội",bcp:`111662 - BCP ${c}`,serviceChar:"C"}}if(o.includes("hồ chí minh")||o.includes("ho chi minh")||o.includes("hcm")||o.includes("sài gòn")){let c="Tân Bình";return o.includes("quận 1")||o.includes("q1")?c="Quận 1":o.includes("quận 3")||o.includes("q3")?c="Quận 3":o.includes("bình thạnh")?c="Bình Thạnh":o.includes("gò vấp")?c="Gò Vấp":o.includes("thủ đức")?c="Thủ Đức":o.includes("quận 7")||o.includes("q7")?c="Quận 7":(o.includes("quận 10")||o.includes("q10"))&&(c="Quận 10"),{line1:"LV/70 - TP. Hồ Chí Minh/700920 - KTNT Tân Bình",bcp:`711800 - BCP ${c}`,serviceChar:"C"}}if(o.includes("đà nẵng")||o.includes("da nang"))return{line1:"LV/55 - TP. Đà Nẵng/550920 - KTNT Đà Nẵng",bcp:"551200 - BCP Hải Châu",serviceChar:"C"};if(o.includes("hải phòng")||o.includes("hai phong"))return{line1:"LV/18 - TP. Hải Phòng/180920 - KTNT Hải Phòng",bcp:"181000 - BCP Lê Chân",serviceChar:"C"};if(o.includes("quảng ninh"))return{line1:"LV/20 - Quảng Ninh/200920 - KTNT Quảng Ninh",bcp:"201000 - BCP Quảng Yên",serviceChar:"C"};if(o.includes("hưng yên"))return{line1:"LV/16 - Hưng Yên/160920 - KTNT Hưng Yên",bcp:"161000 - BCP Kim Động",serviceChar:"C"};if(o.includes("bắc ninh"))return{line1:"LV/22 - Bắc Ninh/220920 - KTNT Bắc Ninh",bcp:"221000 - BCP Trí Quả",serviceChar:"C"};if(o.includes("đồng nai")||o.includes("biên hòa"))return{line1:"LV/81 - Đồng Nai/810920 - KTNT Biên Hòa",bcp:"811000 - BCP Tam Hiệp",serviceChar:"C"};const s=n.split(",").map(c=>c.trim()).filter(Boolean),j=s.length>0?s[s.length-1]:"Việt Nam",y=s.length>1?s[s.length-2]:j;return{line1:`LV/20 - ${j} - KTNT ${j}`,bcp:`BCP ${y}`,serviceChar:"C"}}function sn(n=""){if(!n)return{short:"Việt Nam",full:""};const r=n.split(",").map(s=>s.trim()).filter(Boolean);return r.length<=2?{short:n,full:n}:{short:r.slice(-2).join(", "),full:n}}function Tn(n){if(!n)return 0;const r=n.codAmount!==void 0?n.codAmount:n.cod_amount!==void 0?n.cod_amount:n.cod!==void 0?n.cod:n.tien_thu_ho!==void 0?n.tien_thu_ho:n.totalAmount!==void 0?n.totalAmount:0;if(typeof r=="string"){const o=r.replace(/\D/g,"");return Number(o)||0}return Number(r)||0}function zn(n){if(!n)return"—";const r=[n.orderCode,n.order_code,n.code,n.orderId,n.order_id,n.savedOrderId,n.saved_order_id,n.id];for(const o of r)if(o!=null){const s=String(o).trim();if(s&&s!=="-"&&s!=="—"&&s!=="null"&&s!=="undefined"&&!s.startsWith("sub_")&&!s.startsWith("temp_"))return s}return"—"}function In(n){if(!n)return"";const r=[n.trackingCode,n.tracking_code,n.tracking_number,n.trackingNumber,n.waybillCode,n.waybill_code];for(const o of r)if(o!=null){const s=String(o).trim();if(s&&s!=="-"&&s!=="—"&&!s.toLowerCase().includes("chờ")&&s!=="null"&&s!=="undefined")return s}return""}function An(n){const r=String((n==null?void 0:n.platform)||(n==null?void 0:n.carrier)||(n==null?void 0:n.carrier_id)||(n==null?void 0:n.carrierName)||"").toLowerCase();return r.includes("jt")||r.includes("j&t")?{key:"jt",name:"J&T Express",brandName:"J&T EXPRESS",slogan:"J&T Express - Express Your Online Business. Giao hàng chuẩn xác, tận tâm. Hotline: 1900 1088.",color:"#dc2626",bg:"#fef2f2",border:"#fecaca"}:r.includes("viettel")?{key:"viettelpost",name:"Viettel Post",brandName:"VIETTEL POST",slogan:"Viettel Post - Đi sâu đi xa để gắn kết con người. Hotline: 1900 8095.",color:"#0284c7",bg:"#f0f9ff",border:"#bae6fd"}:r.includes("ghtk")?{key:"ghtk",name:"GHTK",brandName:"GIAO HÀNG TIẾT KIỆM",slogan:"Giao Hàng Tiết Kiệm - Nhanh, Linh hoạt, Thân thiện. Hotline: 1900 6092.",color:"#16a34a",bg:"#f0fdf4",border:"#bbf7d0"}:{key:"vnpost",name:"VNPost",brandName:"VIETNAM POST",slogan:"Vietnam Post tuyển dụng nhân viên toàn quốc. Hotline: 1900 545481.",color:"#d97706",bg:"#fffbeb",border:"#fde68a"}}function on(n){if(!n)return"";const r=n.carrierAccount||n.carrier_account||n.senderName||n.sender_name||n.senderAccount||n.sender_account||n.vnpostAccount||n.vnpost_account;if(r&&r!=="-"&&r!=="—"&&r!=="Mặc định")return String(r).trim();const o=n.name||n.customer_name||n.customerName,s=String(o).match(/\((?:acc|tài khoản|tk)?\s*([^\)]+)\)/i);return s&&s[1]?s[1].trim():""}function Se(n,r={}){if(!n||!r||typeof r!="object")return null;const o=String(n).trim();if(r[o])return r[o];const s=o.toLowerCase();for(const[j,y]of Object.entries(r))if(j&&j.trim().toLowerCase()===s)return y;return null}function rn(n={},r={},o={}){var me,be,Te,Ve,ze,$,ye;const s=(r.paper_size||"A6").toUpperCase(),j=r.orientation||"portrait",y=o.hasFullPiiAccess!==!1,c=n.phone||n.customerPhone||n.recipientPhone||"",P=n.address||n.customerAddress||n.deliveryAddress||"",v=y?c:wn(c),R=y?P:Nn(P),_=Tn(n),C=An(n),g=C.key.toUpperCase(),I=C.brandName,p=(r.custom_slogan||r.customSlogan||"").trim()||C.slogan,m=In(n),x=zn(n),b=m||(x!=="—"?x:"NO_TRACKING"),N=x,S=m||(x!=="—"?x:"NO_TRACKING"),O=nn(P,n),M=sn(R);let ee=[];if(Array.isArray(n.items)&&n.items.length>0)ee=n.items.map(W=>typeof W=="string"?{name:W,quantity:1,code:""}:{name:W.name||W.title||W.product||"Hàng hoá",quantity:W.quantity||W.qty||1,code:W.code||W.sku||""});else{const W=(n.productItem||n.productNote||n.product_note||n.product||n.goodsName||n.goods_name||n.defaultGoodsName||n.productDescription||n.product_description||n.content||n.extraNote||"").trim();W?ee=[{name:W,quantity:n.quantity||n.qty||1,code:n.productCode||n.product_code||(x!=="—"?x:"")}]:ee=[{name:x!=="—"?`Hàng hoá (${x})`:"Hàng hoá tổng hợp",quantity:n.quantity||n.qty||1,code:x!=="—"?x:""}]}const H=((me=ee[0])==null?void 0:me.name)||(x!=="—"?`Hàng hoá (${x})`:"Hàng hoá"),L=W=>!!(W&&typeof W=="string"&&!["mặc định","chưa phân loại","tất cả","all","-","—","default"].includes(W.trim().toLowerCase())),X=on(n),se=o.carrierAccounts||o.carrier_accounts||{},z=L(X)&&Se(X,se)||L(n.senderName)&&Se(n.senderName,se)||L(n.carrierAccount)&&Se(n.carrierAccount,se)||null,ne=L(X)?X:L(n.senderName)?n.senderName.trim():o.carrierAccount||o.defaultCarrierAccount||o.vnpostAccount||"";let E="";o.forceSenderName&&(o.senderName||o.sender_name)?E=o.senderName||o.sender_name:L(X)?E=X:L(n.senderName)?E=n.senderName.trim():L(n.sender_name)?E=n.sender_name.trim():z!=null&&z.name?E=z.name:o.senderName||o.sender_name?E=o.senderName||o.sender_name:L(ne)?E=ne:E=n.senderShopName||n.shopName||n.shop_name||"VĨNH TÀI BONSAI";const ue=ne||E,Le=E&&((be=Se(E,se))==null?void 0:be.phone)||"",Ce=n.senderPhone||n.sender_phone||n.senderMobile||n.sender_mobile||(z==null?void 0:z.phone)||Le||o.senderPhone||o.sender_phone||((Te=o.lastVnpostSenderInfo)==null?void 0:Te.phone)||o.vnpostPhone||n.shopPhone||n.shop_phone||n.pickupPhone||n.pickup_phone||((Ve=n.sender_info)==null?void 0:Ve.phone)||((ze=n.sender)==null?void 0:ze.phone)||o.activeShopPhone||o.userPhone||"",fe=Ce?String(Ce).trim():"",et=E&&(($=Se(E,se))==null?void 0:$.address)||"",tt=n.senderAddress||n.sender_address||(z==null?void 0:z.address)||et||o.senderAddress||o.sender_address||((ye=o.lastVnpostSenderInfo)==null?void 0:ye.address)||n.shopAddress||n.shop_address||"BÌNH NINH, P. Điện Bàn Đông, TP. Đà Nẵng",ke=String(tt).trim(),oe=new Date,we=String(oe.getHours()).padStart(2,"0"),nt=String(oe.getMinutes()).padStart(2,"0"),Ne=String(oe.getDate()).padStart(2,"0"),te=String(oe.getMonth()+1).padStart(2,"0"),Ee=oe.getFullYear(),he=`${we}h${nt} ngày ${Ne}/${te}/${Ee}`;return{paper_size:s,orientation:j,tracking_code:b,order_code:N,barcode_value:S,carrier:g,carrier_brand_name:I,carrier_slogan:p,carrier_account:ue,recipient_name:n.customerName||n.recipientName||n.name||"Khách hàng",recipient_phone:v,recipient_address:R,recipient_address_short:M.short,recipient_address_full:M.full,routing_line1:O.line1,routing_bcp:O.bcp,service_char:O.serviceChar,cod:_,formatted_cod:tn(_),note:n.note||n.orderNote||r.instruction_note||r.instructionNote||"Cho xem hàng; Hàng dễ vỡ, vui lòng nhẹ tay",items:ee,primary_item_name:H,sender_name:E,sender_phone:fe,sender_address:ke,weight_g:n.weight||n.actual_weight||2e3,created_date:oe.toLocaleDateString("vi-VN"),print_time_formatted:he}}function yt(n="A6",r="portrait",o="2cm",s=2){const j=(n||"A6").toUpperCase(),y=mt[j]||mt.A6,c=r==="landscape"?y.height:y.width,P=r==="landscape"?y.width:y.height,v=bt(o),R=j==="A4",_=j==="A5";let C=2;if(typeof s=="number"&&s>0)C=s;else if(typeof s=="string"){const h=s.toLowerCase().trim();if(h==="normal"||h==="1.0"||h==="100%")C=1;else if(h==="large"||h==="1.5"||h==="150%")C=1.5;else if(h==="double"||h==="2.0"||h==="200%")C=2;else{const p=parseFloat(h);!isNaN(p)&&p>0&&(C=p)}}const g=(h,p)=>{const m=R?p:_?(h+p)/2:h;return`${Math.round(m*C*10)/10}px`},I=g(8.5,11);return`
    @page {
      size: ${c} ${P};
      margin: 0;
    }
    *, *::before, *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: Arial, "Helvetica Neue", Helvetica, sans-serif;
      color: #000;
      background: #fff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      margin: 0;
      padding: 0;
    }
    .label-page {
      width: ${c};
      height: ${P};
      padding: ${v};
      page-break-after: always;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      overflow: hidden;
      font-size: ${I};
      line-height: 1.25;
      background: #fff;
      box-sizing: border-box;
      word-break: break-word;
    }
    .vnpost-container {
      width: 100%;
      flex: 1;
      min-height: 0;
      border: 1.5px solid #000;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      box-sizing: border-box;
      background: #fff;
      word-break: break-word;
    }

    /* ROW 1: HEADER & BARCODE */
    .vnpost-row-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px dotted #000;
      padding: 1.5mm 2.5mm;
      flex-shrink: 0;
    }
    .vnpost-logo-col {
      width: 22%;
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      justify-content: center;
    }
    .vnpost-logo-svg {
      width: ${R?"75px":"60px"};
      height: ${R?"36px":"28px"};
    }
    .vnpost-logo-text {
      font-size: ${g(6.5,8)};
      font-weight: 900;
      letter-spacing: 0.5px;
      margin-top: 1px;
      font-family: Arial, sans-serif;
    }
    .vnpost-barcode-col {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 0 1.5mm;
    }
    .vnpost-tracking-code {
      font-family: "Courier New", Courier, monospace;
      font-size: ${g(11.5,14)};
      font-weight: 900;
      letter-spacing: 1px;
      margin-top: 1.5px;
      text-align: center;
    }
    .vnpost-meta-col {
      width: 26%;
      border-left: 1px dotted #000;
      padding-left: 2mm;
      font-size: ${g(8,10)};
      line-height: 1.3;
      display: flex;
      flex-direction: column;
      justify-content: center;
    }
    .vnpost-meta-account {
      font-size: ${g(8.5,10.5)};
      font-weight: 800;
      color: #000;
      margin-top: 2px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    /* ROW 2: ROUTING / HUB */
    .vnpost-row-routing {
      display: flex;
      border-bottom: 1px dotted #000;
      flex-shrink: 0;
    }
    .vnpost-routing-text-col {
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      padding: 1.5mm 2.5mm;
      text-align: center;
    }
    .vnpost-routing-line1 {
      font-size: ${g(10.5,13)};
      font-weight: 800;
      letter-spacing: 0.2px;
    }
    .vnpost-routing-bcp {
      font-size: ${g(14,17.5)};
      font-weight: 900;
      letter-spacing: 0.5px;
      margin-top: 2px;
    }
    .vnpost-routing-code-box {
      width: ${R?"22mm":"17mm"};
      border-left: 1px dotted #000;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: ${g(21,27)};
      font-weight: 900;
      font-family: Arial, sans-serif;
    }

    /* ROW 3: SENDER & RECIPIENT */
    .vnpost-row-parties {
      display: flex;
      border-bottom: 1px dotted #000;
      flex-shrink: 0;
      font-size: ${g(9,11)};
      line-height: 1.35;
    }
    .vnpost-sender-col {
      width: 48%;
      padding: 1.5mm 2.5mm;
      overflow: hidden;
      word-break: break-word;
    }
    .vnpost-recipient-col {
      width: 52%;
      border-left: 1px dotted #000;
      padding: 1.5mm 2.5mm;
      overflow: hidden;
      word-break: break-word;
    }
    .vnpost-party-title {
      font-size: ${g(9.5,11.5)};
      margin-bottom: 2px;
    }
    .vnpost-recipient-highlight {
      font-size: ${g(10,12)};
      font-weight: 900;
    }

    /* ROW 4: INSTRUCTIONS & ITEMS vs SERVICES & COD & QR */
    .vnpost-row-body {
      display: flex;
      flex: 1;
      min-height: 0;
      border-bottom: 1px dotted #000;
    }
    .vnpost-left-body {
      width: 48%;
      display: flex;
      flex-direction: column;
    }
    .vnpost-instructions {
      padding: 1.5mm 2.5mm;
      border-bottom: 1px dotted #000;
      font-size: ${g(8.5,10)};
      line-height: 1.25;
      flex-shrink: 0;
    }
    .vnpost-sec-title {
      font-weight: 800;
      font-size: ${g(9.5,11)};
      margin-bottom: 2px;
    }
    .vnpost-items {
      flex: 1;
      padding: 1.5mm 2.5mm;
      font-size: ${g(8.5,10)};
      line-height: 1.3;
      overflow: hidden;
      word-break: break-word;
    }
    .vnpost-right-body {
      width: 52%;
      border-left: 1px dotted #000;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: 1.5mm 2.5mm;
      font-size: ${g(8.5,10)};
      line-height: 1.3;
    }
    .vnpost-service-title {
      font-weight: 800;
      font-size: ${g(9,10.5)};
      text-transform: uppercase;
      margin-bottom: 2px;
    }
    .vnpost-cod-highlight {
      font-size: ${g(10.5,12.5)};
      font-weight: 900;
      margin: 2px 0;
      color: #000;
    }
    .vnpost-signature-qr-row {
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      margin-top: auto;
      padding-top: 1.5mm;
      flex-shrink: 0;
    }
    .vnpost-signature-box {
      border: 1px solid #000;
      padding: 1mm 1.5mm 2.5mm 1.5mm;
      text-align: center;
      font-size: ${g(7.5,9)};
      width: 60%;
    }
    .vnpost-sig-title {
      font-weight: 700;
      font-size: ${g(8,9.5)};
    }
    .vnpost-sig-date {
      font-style: italic;
      color: #333;
      margin-top: 1.5px;
    }
    .vnpost-qr-box {
      width: 38%;
      display: flex;
      justify-content: flex-end;
      align-items: flex-end;
    }

    .vnpost-row-footer {
      display: flex;
      flex-direction: column;
      padding: 1mm 2.5mm;
      font-size: ${g(7.5,9)};
      line-height: 1.25;
      flex-shrink: 0;
    }
    .vnpost-footer-meta {
      display: flex;
      justify-content: space-between;
      font-size: ${g(8,9.5)};
      margin-bottom: 1px;
    }
    .vnpost-footer-slogan {
      padding-top: 1mm;
      font-size: ${g(7,8.5)};
      text-align: center;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      color: #111;
      flex-shrink: 0;
    }

    @media screen {
      body {
        background: #525659;
        padding: 0;
        margin: 0;
        min-height: 100vh;
        display: flex;
        flex-direction: column;
        align-items: center;
      }
      .screen-toolbar {
        position: sticky;
        top: 0;
        z-index: 99999;
        width: 100%;
        background: #323639;
        color: #f1f5f9;
        padding: 10px 24px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
        box-sizing: border-box;
        font-family: system-ui, -apple-system, sans-serif;
      }
      .labels-container {
        padding: 24px 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 24px;
        width: 100%;
      }
      .label-page {
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35);
        background: #fff;
      }
    }
    @media print {
      .no-print {
        display: none !important;
      }
      body {
        background: #fff;
        padding: 0;
        margin: 0;
      }
      .label-page {
        box-shadow: none;
        margin: 0;
        padding: ${v};
      }
    }
  `}function Pn(n){return n==="JT"?`
      <div style="display: flex; flex-direction: column; align-items: flex-start; justify-content: center; line-height: 1.1;">
        <span style="font-family: 'Arial Black', Impact, sans-serif; font-size: 19px; font-weight: 900; letter-spacing: -0.5px; color: #000;">J&amp;T</span>
        <span style="font-family: Arial, sans-serif; font-size: 7px; font-weight: 900; letter-spacing: 1px; color: #000; text-transform: uppercase;">EXPRESS</span>
      </div>
    `:n==="VIETTELPOST"?`
      <div style="display: flex; flex-direction: column; align-items: flex-start; justify-content: center; line-height: 1.1;">
        <span style="font-family: Arial, sans-serif; font-size: 13px; font-weight: 900; letter-spacing: -0.2px; color: #000;">VIETTEL</span>
        <span style="font-family: Arial, sans-serif; font-size: 7.5px; font-weight: 900; letter-spacing: 0.8px; color: #000;">POST</span>
      </div>
    `:n==="GHTK"?`
      <div style="display: flex; flex-direction: column; align-items: flex-start; justify-content: center; line-height: 1.1;">
        <span style="font-family: 'Arial Black', Arial, sans-serif; font-size: 15px; font-weight: 900; letter-spacing: 0.2px; color: #000;">GHTK</span>
        <span style="font-family: Arial, sans-serif; font-size: 6.5px; font-weight: 800; letter-spacing: 0.4px; color: #000;">TIẾT KIỆM</span>
      </div>
    `:`
    <svg viewBox="0 0 100 45" class="vnpost-logo-svg">
      <path d="M5 25 L25 8 L50 25 L36 29 L25 19 L15 29 Z" fill="#000"/>
      <path d="M25 21 L50 27 L43 32 L25 25 Z" fill="#000"/>
      <path d="M8 27 L25 32 L44 27 L25 37 Z" fill="#000"/>
      <text x="25" y="43" font-family="Arial, Helvetica, sans-serif" font-size="7" font-weight="900" text-anchor="middle" letter-spacing="0.5">VIETNAM POST</text>
    </svg>
  `}function an(n,r={},o={}){const s=rn(n,r,o),j=Zt(s.barcode_value,40),y=en(s.tracking_code!=="NO_TRACKING"?s.tracking_code:s.order_code,64),c=s.items&&s.items.length>0?s.items.map(b=>{const N=String(b.name||b||"").trim(),S=String(b.code||"").trim();let O=N;return S&&!N.includes(S)?O=`${N} (Mã: ${S})`:s.order_code&&s.order_code!=="—"&&!N.includes(s.order_code)&&(O=`${N} (Mã: ${s.order_code})`),`${O} * ${b.quantity||1};`}).join(" "):s.order_code&&s.order_code!=="—"?`${s.primary_item_name} (Mã: ${s.order_code}) * 1;`:`${s.primary_item_name} * 1;`;let P=s.primary_item_name;s.order_code&&s.order_code!=="—"&&!P.includes(s.order_code)&&(P=`${P} (Mã: ${s.order_code})`);const v=o.index!==void 0?o.index+1:1,R=o.total!==void 0?o.total:1;let _=(r.service_title||r.serviceTitle||"").trim();_||(_="TC TMĐT ĐỒNG GIÁ - HÀNG THÔNG THƯỜNG",s.carrier==="JT"?_="J&T EXPRESS - CHUYỂN PHÁT TIÊU CHUẨN":s.carrier==="VIETTELPOST"?_="VIETTEL POST - DỊCH VỤ CHUYỂN PHÁT":s.carrier==="GHTK"&&(_="GIAO HÀNG TIẾT KIỆM - CHUYỂN PHÁT NHANH"));const C=r.show_barcode!==!1&&r.showBarcode!==!1,g=r.show_qr!==!1&&r.showQr!==!1,I=r.show_signature_box!==!1&&r.showSignatureBox!==!1,h=r.show_slogan!==!1&&r.showSlogan!==!1,p=r.show_order_meta!==!1&&r.showOrderMeta!==!1,m=r.show_sender!==!1&&r.showSender!==!1;return`
    <div class="label-page" style="overflow: hidden; word-break: break-word;">
      <div class="vnpost-container" style="overflow: hidden; word-break: break-word;">
        <!-- ROW 1: HEADER & BARCODE -->
        <div class="vnpost-row-header">
          <div class="vnpost-logo-col">
            ${Pn(s.carrier)}
          </div>
          <div class="vnpost-barcode-col">
            ${C?j:""}
            <div class="vnpost-tracking-code">${s.tracking_code&&s.tracking_code!=="NO_TRACKING"&&s.tracking_code!=="-"?s.tracking_code:s.order_code&&s.order_code!=="—"?s.order_code:"CHƯA CÓ VẬN ĐƠN"}</div>
          </div>
          ${p?`
          <div class="vnpost-meta-col">
            <div>Lô:</div>
            <div>Thứ tự:</div>
            <div style="word-break: break-all;">Số ĐH: ${s.order_code}</div>
            ${s.carrier_account?`<div class="vnpost-meta-account">TK: ${s.carrier_account}</div>`:""}
          </div>`:'<div class="vnpost-meta-col" style="visibility: hidden;"></div>'}
        </div>

        <!-- ROW 2: ROUTING / HUB -->
        <div class="vnpost-row-routing">
          <div class="vnpost-routing-text-col">
            <div class="vnpost-routing-line1">${s.routing_line1}</div>
            <div class="vnpost-routing-bcp">${s.routing_bcp}</div>
          </div>
          <div class="vnpost-routing-code-box">
            <span>${s.service_char}</span>
          </div>
        </div>

        <!-- ROW 3: SENDER & RECIPIENT -->
        <div class="vnpost-row-parties">
          ${m?`
          <div class="vnpost-sender-col">
            <div class="vnpost-party-title"><strong>Từ:</strong> <strong>${s.sender_name}</strong> - SĐT: ${s.sender_phone}</div>
            <div style="color: #111;">${s.sender_address}</div>
          </div>`:`
          <div class="vnpost-sender-col" style="visibility: hidden;"></div>
          `}
          <div class="vnpost-recipient-col">
            <div class="vnpost-party-title"><strong>Đến:</strong> <strong>${s.recipient_name}</strong> - <strong>${s.recipient_phone}</strong></div>
            <div>
              <span class="vnpost-recipient-highlight">${s.recipient_address_short}</span>
              ${s.recipient_address_full&&s.recipient_address_full!==s.recipient_address_short?` (${s.recipient_address_full})`:""}
            </div>
          </div>
        </div>

        <!-- ROW 4: INSTRUCTIONS & ITEMS vs SERVICES & COD & QR -->
        <div class="vnpost-row-body">
          <div class="vnpost-left-body">
            <div class="vnpost-instructions">
              <div class="vnpost-sec-title">Chỉ dẫn giao hàng</div>
              <div>- ${s.note}</div>
            </div>
            <div class="vnpost-items">
              <div>- Nội dung: <strong>${P}</strong></div>
              <div>- Hàng hoá: ${c}</div>
            </div>
          </div>
          <div class="vnpost-right-body">
            <div>
              <div class="vnpost-service-title">${_}</div>
              <div style="margin: 2px 0;"><strong>KL (gram): ${s.weight_g} / ***</strong></div>
              <div class="vnpost-cod-highlight"><strong>- COD: ${s.formatted_cod}</strong></div>
              <div>- Thu khác: 0 đ</div>
              <div class="vnpost-cod-highlight"><strong>- Tổng thu: ${s.formatted_cod}</strong></div>
              <div>- Phí huỷ: 0 đ</div>
            </div>

            <div class="vnpost-signature-qr-row">
              ${I?`
              <div class="vnpost-signature-box">
                <div class="vnpost-sig-title">Chữ kí người nhận</div>
                <div class="vnpost-sig-date">Ngày... Tháng... Năm</div>
              </div>`:'<div style="flex: 1;"></div>'}
              ${g?`
              <div class="vnpost-qr-box">
                ${y}
              </div>`:""}
            </div>
          </div>
        </div>

        <!-- ROW 5: FOOTER -->
        <div class="vnpost-row-footer">
          <div class="vnpost-footer-meta">
            <span>Ngày in: ${s.print_time_formatted}</span>
            <span>STT in: ${v}/${R}</span>
          </div>
        </div>
      </div>
      ${h?`
      <div class="vnpost-footer-slogan">
        ${s.carrier_slogan}
      </div>`:""}
    </div>
  `}function Ze(n=[],r={},o={}){const s=(r.paper_size||o.paper_size||o.paperSize||"A6").toUpperCase(),j=r.orientation||o.orientation||"portrait",y=r.margin||o.margin||o.printMargin||"2cm",c=r.font_scale!==void 0?r.font_scale:r.fontScale!==void 0?r.fontScale:o.font_scale!==void 0?o.font_scale:o.fontScale!==void 0?o.fontScale:2,P=yt(s,j,y,c),v=n.length,R=n.map((C,g)=>an(C,{...r,paper_size:s,orientation:j},{...o,index:g,total:v})).join(`
`),_=s==="A4"?"210 x 297 mm":s==="A5"?"148 x 210 mm":s==="K100"||s==="100X150"?"100 x 150 mm":"105 x 148 mm";return`<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>In nhãn vận đơn VNPost (${n.length} nhãn)</title>
  <style id="print-style-sheet">
    ${P}
  </style>
</head>
<body>
  <div class="no-print screen-toolbar">
    <div class="toolbar-info" style="display: flex; flex-direction: column; gap: 4px;">
      <div style="font-weight: 800; font-size: 14px; display: flex; align-items: center; gap: 8px;">
        <span>📄</span>
        <span>Trang in tem vận đơn VNPost chuẩn PDF</span>
        <span style="font-size: 12px; background: #2563eb; color: #fff; padding: 2px 8px; border-radius: 4px; font-weight: 700;">${n.length} nhãn</span>
      </div>
      <div style="font-size: 12px; color: #cbd5e1; display: flex; align-items: center; flex-wrap: wrap; gap: 10px;">
        <div style="display: flex; align-items: center; gap: 5px;">
          <span>Khổ giấy:</span>
          <select id="tb-paper-size" style="background: #1e293b; color: #f8fafc; border: 1px solid #475569; padding: 3px 6px; border-radius: 4px; font-size: 12px; font-weight: 600; cursor: pointer;">
            <option value="A6" ${s==="A6"?"selected":""}>A6 (105 x 148 mm - Chuẩn VNPost)</option>
            <option value="A5" ${s==="A5"?"selected":""}>A5 (148 x 210 mm)</option>
            <option value="A4" ${s==="A4"?"selected":""}>A4 (210 x 297 mm)</option>
            <option value="K100" ${s==="K100"||s==="100X150"?"selected":""}>K100 (100 x 150 mm - Tem nhiệt)</option>
          </select>
          <span id="tb-dim-badge" style="background: #334155; color: #94a3b8; padding: 2px 6px; border-radius: 3px; font-size: 11px;">
            ${_}
          </span>
        </div>
        <div style="display: flex; align-items: center; gap: 5px;">
          <span>Canh lề:</span>
          <select id="tb-margin" style="background: #1e293b; color: #f8fafc; border: 1px solid #475569; padding: 3px 6px; border-radius: 4px; font-size: 12px; font-weight: 600; cursor: pointer;">
            <option value="0mm" ${y==="0mm"||y==="0"?"selected":""}>0mm (Sát viền tem)</option>
            <option value="2mm" ${y==="2mm"?"selected":""}>2mm (Khuyên dùng K100/A6)</option>
            <option value="5mm" ${y==="5mm"?"selected":""}>5mm (Viền gọn gàng)</option>
            <option value="10mm" ${y==="10mm"||y==="1cm"?"selected":""}>10mm (Cách lề 1cm)</option>
            <option value="15mm" ${y==="15mm"?"selected":""}>15mm (Cách lề 1.5cm)</option>
            <option value="20mm" ${y==="20mm"||y==="2cm"?"selected":""}>20mm (Cách lề 2cm - Khổ A4/A5)</option>
          </select>
        </div>
        <div style="display: flex; align-items: center; gap: 5px;">
          <span>Cỡ chữ:</span>
          <select id="tb-font-scale" style="background: #1e293b; color: #f8fafc; border: 1px solid #475569; padding: 3px 6px; border-radius: 4px; font-size: 12px; font-weight: 600; cursor: pointer;">
            <option value="2" ${Number(c)===2||String(c)==="2"||String(c)==="2.0"?"selected":""}>Gấp đôi (200% - Rõ to mặc định)</option>
            <option value="1.5" ${Number(c)===1.5||String(c)==="1.5"?"selected":""}>Lớn (150%)</option>
            <option value="1" ${Number(c)===1||String(c)==="1"||String(c)==="1.0"?"selected":""}>Chuẩn (100%)</option>
            <option value="2.5" ${Number(c)===2.5||String(c)==="2.5"?"selected":""}>Cực lớn (250%)</option>
          </select>
        </div>
        <button id="tb-btn-set-default" type="button" style="background: #334155; color: #f1f5f9; border: 1px solid #64748b; padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; cursor: pointer;" title="Lưu khổ giấy, lề và cỡ chữ hiện tại làm mặc định">
          ⭐ Đặt làm mặc định
        </button>
      </div>
    </div>
    <div class="toolbar-actions" style="display: flex; align-items: center; gap: 8px;">
      <button id="btn-print" type="button" data-action="print" data-trigger="window.print()" class="btn-print" style="background: #2563eb; color: #fff; border: none; padding: 8px 16px; border-radius: 6px; font-weight: 700; font-size: 13px; cursor: pointer; display: flex; align-items: center; gap: 6px;">
        🖨️ In ngay / Lưu PDF (Ctrl+P)
      </button>
      <button id="btn-close" type="button" data-action="close" data-trigger="window.close()" class="btn-close" style="background: #475569; color: #f8fafc; border: none; padding: 8px 12px; border-radius: 6px; font-weight: 600; font-size: 13px; cursor: pointer;">
        ✕ Đóng
      </button>
    </div>
  </div>

  <div class="labels-container">
    ${R}
  </div>

  <!-- CSP-safe print trigger: window.print() automation and toolbar actions handled externally by wirePrintTabControls -->
</body>
</html>`}const Rn={PAPER_DIMENSIONS:mt,normalizeMarginCss:bt,formatVnd:tn,generateBarcodeSvg:Zt,generateQrCodeSvg:en,extractVnpostRouting:nn,formatVnpostRecipientAddress:sn,generateLabelModel:rn,getCarrierAccount:on,findCarrierAccount:Se,getPrintCss:yt,renderHtmlLabel:an,renderBulkHtmlDocument:Ze};typeof globalThis<"u"&&(globalThis.LabelRenderer=Rn);function Q(n,...r){if(n){for(const o of r)if(n[o]!==void 0&&n[o]!==null)return n[o]}}function Je(n){return n?String(n).normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/đ/g,"d").replace(/Đ/g,"D").toLowerCase():""}function qt(n){return n?String(n).replace(/\D/g,""):""}function De(n){if(!n&&n!==0)return{mode:"uniform",mm:20,vMm:10,hMm:20};const r=String(n).trim().toLowerCase();if(r.includes(" ")){const s=r.split(/\s+/).filter(Boolean).map(c=>c.endsWith("cm")?parseFloat(c)*10:parseFloat(c)||0),j=s[0]!==void 0?s[0]:10,y=s[1]!==void 0?s[1]:s[0]!==void 0?s[0]:20;return{mode:"split",mm:j,vMm:j,hMm:y}}let o=20;if(r==="0"||r==="0cm"||r==="0mm")o=0;else if(r==="2cm"||r==="20mm")o=20;else if(r==="1.5cm"||r==="15mm")o=15;else if(r==="1cm"||r==="10mm")o=10;else if(r==="0.5cm"||r==="5mm")o=5;else if(r.endsWith("cm"))o=parseFloat(r)*10;else if(r.endsWith("mm"))o=parseFloat(r);else{const s=parseFloat(r);isNaN(s)||(o=s)}return{mode:"uniform",mm:isNaN(o)?20:o,vMm:10,hMm:20}}function Ut(n){if(!n)return 0;const r=n.codAmount!==void 0?n.codAmount:n.cod_amount!==void 0?n.cod_amount:n.cod!==void 0?n.cod:n.tien_thu_ho!==void 0?n.tien_thu_ho:n.totalAmount!==void 0?n.totalAmount:0;if(typeof r=="string"){const o=r.replace(/\D/g,"");return Number(o)||0}return Number(r)||0}function Wn(n){if(!n)return"—";const r=n.orderCode||n.order_code||n.code||"";if(r&&r!=="-"&&r!=="—")return String(r).trim();const o=String(n.savedOrderId||n.saved_order_id||"").trim();return o&&!o.startsWith("sub_")&&o!=="-"&&o!=="—"?o:"—"}function Yt(n){if(!n)return"";const r=n.trackingCode||n.tracking_code||n.tracking_number||"";return r&&r!=="-"&&r!=="—"&&r!=="chờ cập nhật mã"?String(r).trim():""}function Qt(n){const r=String(Q(n,"platform","carrier","carrier_id","carrierName")||"").toLowerCase();return r.includes("jt")||r.includes("j&t")?{key:"jt",name:"J&T Express",color:"#dc2626",bg:"#fef2f2",border:"#fecaca"}:r.includes("viettel")?{key:"viettelpost",name:"Viettel Post",color:"#0284c7",bg:"#f0f9ff",border:"#bae6fd"}:r.includes("ghtk")?{key:"ghtk",name:"GHTK",color:"#16a34a",bg:"#f0fdf4",border:"#bbf7d0"}:{key:"vnpost",name:"VNPost",color:"#d97706",bg:"#fffbeb",border:"#fde68a"}}function Xt(n){const r=Q(n,"carrierAccount","carrier_account","senderAccount","sender_account","vnpostAccount","vnpost_account");if(r&&r!=="-"&&r!=="—"&&r!=="Mặc định")return r;const o=Q(n,"name","customer_name","customerName"),s=String(o).match(/\((?:acc|tài khoản|tk)?\s*([^\)]+)\)/i);return s&&s[1]?s[1].trim():""}function Jt(n){const r=Q(n,"shipping_fee_payer","collect_fee","collectFee","shippingFeePayer");if(r===!0||r==="true"||r===1||r==="1")return!0;const o=String(r||"").toUpperCase();return o==="RECIPIENT"||o==="BUYER"||o==="KHÁCH"||o==="NGƯỜI NHẬN"}function Hn(n,r,o,s,j=2){if(!n)return;const y=()=>{try{const c=n.document;if(!c)return;(!c.title||c.title==="about:blank")&&(c.title="In tem vận đơn VNPost chuẩn PDF");const P=c.getElementById("btn-print");P&&(P.onclick=h=>{var p;(p=h==null?void 0:h.preventDefault)==null||p.call(h);try{n.focus(),n.print()}catch(m){console.error("Print trigger error:",m)}});const v=c.getElementById("btn-close");v&&(v.onclick=h=>{var p;(p=h==null?void 0:h.preventDefault)==null||p.call(h);try{n.close()}catch{}}),n.onkeydown=h=>{if((h.ctrlKey||h.metaKey)&&(h.key==="p"||h.key==="P")){h.preventDefault();try{n.focus(),n.print()}catch{}}};const R=(h,p,m)=>{var x;try{const b=m!==void 0?m:parseFloat((x=c.getElementById("tb-font-scale"))==null?void 0:x.value)||j||2,N=yt(h,"portrait",p,b);let S=c.getElementById("print-style-sheet");S||(S=c.createElement("style"),S.id="print-style-sheet",c.head.appendChild(S)),S.textContent=N;const O=c.getElementById("tb-dim-badge");if(O){const M={A4:"210 x 297 mm",A5:"148 x 210 mm",A6:"105 x 148 mm",K100:"100 x 150 mm","100X150":"100 x 150 mm"};O.textContent=M[String(h).toUpperCase()]||"105 x 148 mm"}}catch(b){console.warn("Error updating print styles:",b)}},_=c.getElementById("tb-paper-size");_&&(_.value=r,_.onchange=h=>{var b,N;const p=h.target.value,m=((b=c.getElementById("tb-margin"))==null?void 0:b.value)||o,x=parseFloat((N=c.getElementById("tb-font-scale"))==null?void 0:N.value)||j||2;R(p,m,x),s&&s(p,m,!1,x)});const C=c.getElementById("tb-margin");C&&(C.value=o,C.onchange=h=>{var b,N;const p=h.target.value,m=((b=c.getElementById("tb-paper-size"))==null?void 0:b.value)||r,x=parseFloat((N=c.getElementById("tb-font-scale"))==null?void 0:N.value)||j||2;R(m,p,x),s&&s(m,p,!1,x)});const g=c.getElementById("tb-font-scale");g&&(g.value=String(j||2),g.onchange=h=>{var b,N;const p=parseFloat(h.target.value)||2,m=((b=c.getElementById("tb-paper-size"))==null?void 0:b.value)||r,x=((N=c.getElementById("tb-margin"))==null?void 0:N.value)||o;R(m,x,p),s&&s(m,x,!1,p)});const I=c.getElementById("tb-btn-set-default");I&&(I.onclick=h=>{var N,S,O,M,ee;(N=h==null?void 0:h.preventDefault)==null||N.call(h);const p=((S=c.getElementById("tb-paper-size"))==null?void 0:S.value)||r,m=((O=c.getElementById("tb-margin"))==null?void 0:O.value)||o,x=parseFloat((M=c.getElementById("tb-font-scale"))==null?void 0:M.value)||j||2;try{typeof chrome<"u"&&((ee=chrome.storage)!=null&&ee.local)&&chrome.storage.local.set({default_paper_size:p,print_paper_size:p,default_print_margin:m,print_margin:m,default_font_scale:x,print_font_scale:x}),typeof localStorage<"u"&&(localStorage.setItem("default_paper_size",p),localStorage.setItem("print_paper_size",p),localStorage.setItem("default_print_margin",m),localStorage.setItem("print_margin",m),localStorage.setItem("default_font_scale",String(x)),localStorage.setItem("print_font_scale",String(x)))}catch{}s&&s(p,m,!0,x);const b=I.innerHTML;I.innerHTML="✓ Đã lưu mặc định!",I.style.background="#16a34a",I.style.borderColor="#15803d",I.style.color="#ffffff",setTimeout(()=>{try{I.innerHTML=b,I.style.background="#334155",I.style.borderColor="#64748b",I.style.color="#f1f5f9"}catch{}},2500)}),setTimeout(()=>{try{n.focus(),n.print()}catch{}},450)}catch(c){console.warn("Error setting up print tab:",c)}};if(n.document&&(n.document.readyState==="complete"||n.document.readyState==="interactive"))y();else{y();try{n.addEventListener("DOMContentLoaded",y),n.addEventListener("load",y)}catch{}}}function Kn(){const[n,r]=u.useState([]),[o,s]=u.useState([]),[j,y]=u.useState(!1),[c,P]=u.useState(()=>typeof window<"u"&&window.__af_global_search||""),[v,R]=u.useState("all"),[_,C]=u.useState(""),[g,I]=u.useState(""),[h,p]=u.useState("all"),[m,x]=u.useState("all"),[b,N]=u.useState("all"),[S,O]=u.useState("all"),[M,ee]=u.useState("UNPRINTED"),[H,L]=u.useState("A6"),[X,se]=u.useState("A6"),[z,ne]=u.useState(2),[E,ue]=u.useState(2),[Le,Ce]=u.useState(!1),[fe,et]=u.useState([]),[tt,ke]=u.useState(!1),[oe,we]=u.useState(""),[nt,Ne]=u.useState(!1),[te,Ee]=u.useState(null),[he,me]=u.useState({}),[be,Te]=u.useState(null),[Ve,ze]=u.useState(!1),[$,ye]=u.useState({service_title:"",instruction_note:"Cho xem hàng; Hàng dễ vỡ, vui lòng nhẹ tay",custom_slogan:"",show_barcode:!0,show_qr:!0,show_signature_box:!0,show_slogan:!0,show_sender:!0,show_order_meta:!0}),[W,F]=u.useState(1),[le,ln]=u.useState(50),[cn,vt]=u.useState(""),[J,_t]=u.useState(""),[Ie,jt]=u.useState(""),[Ae,St]=u.useState("BÌNH NINH, P. Điện Bàn Đông, TP. Đà Nẵng"),[Pe,Ct]=u.useState({}),[it,kt]=u.useState(null),[Ke,wt]=u.useState(!1),[ce,re]=u.useState(""),[A,ae]=u.useState("20mm"),[Re,Oe]=u.useState("20mm"),[xe,ve]=u.useState("uniform"),[_e,je]=u.useState(20),[We,Fe]=u.useState(10),[He,Ge]=u.useState(20),[Nt,st]=u.useState(null);u.useEffect(()=>{hn(),dn()},[]);function qe(t,a="info"){st({message:t,type:a}),setTimeout(()=>{st(d=>(d==null?void 0:d.message)===t?null:d)},3500)}function ot(t){var a;if(t){se(t),L(t);try{typeof chrome<"u"&&((a=chrome.storage)!=null&&a.local)&&chrome.storage.local.set({default_paper_size:t,print_paper_size:t}),typeof localStorage<"u"&&(localStorage.setItem("default_paper_size",t),localStorage.setItem("print_paper_size",t))}catch{}qe(`Đã lưu "${t}" làm khổ giấy in mặc định!`,"paper")}}function rt(t){var d;if(!t&&t!==0)return;const a=String(t).trim();Oe(a),ae(a);try{typeof chrome<"u"&&((d=chrome.storage)!=null&&d.local)&&chrome.storage.local.set({default_print_margin:a,print_margin:a}),typeof localStorage<"u"&&(localStorage.setItem("default_print_margin",a),localStorage.setItem("print_margin",a))}catch{}qe(`Đã lưu mức căn lề "${a}" làm mặc định!`,"margin")}function Tt(t){var d;const a=parseFloat(t)||2;ue(a),ne(a);try{typeof chrome<"u"&&((d=chrome.storage)!=null&&d.local)&&chrome.storage.local.set({default_font_scale:a,print_font_scale:a}),typeof localStorage<"u"&&(localStorage.setItem("default_font_scale",String(a)),localStorage.setItem("print_font_scale",String(a)))}catch{}qe(`Đã lưu cỡ chữ ${Math.round(a*100)}% làm mặc định!`,"font")}function Me(t){const a=Math.max(0,Math.min(50,Math.round(Number(t)||0)));je(a);const d=`${a}mm`;ae(d),U({printMargin:d})}function at(t,a){const d=Math.max(0,Math.min(50,Math.round(Number(t)||0))),i=Math.max(0,Math.min(50,Math.round(Number(a)||0)));Fe(d),Ge(i);const f=`${d}mm ${i}mm`;ae(f),U({printMargin:f})}async function dn(){var t;try{let a=null;const d=typeof pe<"u"?pe:globalThis.OrderStorage||null;if(d&&typeof d.getActiveShop=="function"&&(a=await d.getActiveShop().catch(()=>null)),typeof chrome<"u"&&((t=chrome.storage)!=null&&t.local))chrome.storage.local.get(["vnpost_session","active_shop_name","activeShop","carrier_account","carrier_accounts","last_vnpost_sender_info","senderAccount","sender_name","senderName","sender_phone","senderPhone","sender_address","senderAddress","print_margin","default_print_margin","print_paper_size","default_paper_size","print_font_scale","default_font_scale","order_default_settings","print_template_config"],i=>{var ge,Qe,Xe,At,Pt,Rt,Wt,Ht,Mt,$t,Bt,Dt,Lt;i!=null&&i.carrier_accounts&&Ct(i.carrier_accounts),i!=null&&i.last_vnpost_sender_info&&kt(i.last_vnpost_sender_info);const f=(i==null?void 0:i.sender_name)||(i==null?void 0:i.senderName)||((ge=i==null?void 0:i.last_vnpost_sender_info)==null?void 0:ge.name)||(i==null?void 0:i.carrier_account)||(i==null?void 0:i.active_shop_name)||((Qe=i==null?void 0:i.vnpost_session)==null?void 0:Qe.active_shop_name)||((Xe=i==null?void 0:i.vnpost_session)==null?void 0:Xe.userName)||(i==null?void 0:i.senderAccount)||(a==null?void 0:a.sender_name)||(a==null?void 0:a.senderName)||(a==null?void 0:a.name)||"";f&&(_t(f),vt(f));const l=(i==null?void 0:i.sender_phone)||(i==null?void 0:i.senderPhone)||((At=i==null?void 0:i.last_vnpost_sender_info)==null?void 0:At.phone)||((Rt=(Pt=i==null?void 0:i.carrier_accounts)==null?void 0:Pt[f])==null?void 0:Rt.phone)||((Wt=i==null?void 0:i.vnpost_session)==null?void 0:Wt.userPhone)||((Ht=i==null?void 0:i.vnpost_session)==null?void 0:Ht.phone)||((Mt=i==null?void 0:i.vnpost_session)==null?void 0:Mt.sender_phone)||(($t=i==null?void 0:i.order_default_settings)==null?void 0:$t.senderPhone)||(a==null?void 0:a.sender_phone)||(a==null?void 0:a.senderPhone)||(a==null?void 0:a.phone)||"";l&&jt(l);const T=(i==null?void 0:i.sender_address)||(i==null?void 0:i.senderAddress)||((Bt=i==null?void 0:i.last_vnpost_sender_info)==null?void 0:Bt.address)||((Lt=(Dt=i==null?void 0:i.carrier_accounts)==null?void 0:Dt[f])==null?void 0:Lt.address)||(a==null?void 0:a.sender_address)||(a==null?void 0:a.senderAddress)||"";T&&St(T);let w=i==null?void 0:i.default_paper_size;if(!w&&typeof localStorage<"u")try{w=localStorage.getItem("default_paper_size")}catch{}w||(w=(i==null?void 0:i.print_paper_size)||"A6"),se(w);let Z=i==null?void 0:i.print_paper_size;if(!Z&&typeof localStorage<"u")try{Z=localStorage.getItem("print_paper_size")}catch{}L(Z||w);let B=i==null?void 0:i.default_print_margin;if(!B&&typeof localStorage<"u")try{B=localStorage.getItem("default_print_margin")}catch{}B||(B=(i==null?void 0:i.print_margin)||"20mm"),Oe(B);let q=i==null?void 0:i.print_margin;if(!q&&typeof localStorage<"u")try{q=localStorage.getItem("print_margin")}catch{}q||(q=B),ae(q);const k=De(q);ve(k.mode),je(k.mm),Fe(k.vMm),Ge(k.hMm);let D=i==null?void 0:i.default_font_scale;if(!D&&typeof localStorage<"u")try{D=localStorage.getItem("default_font_scale")}catch{}const V=parseFloat(D)||2;ue(V);let Y=i==null?void 0:i.print_font_scale;if(!Y&&typeof localStorage<"u")try{Y=localStorage.getItem("print_font_scale")}catch{}if(ne(parseFloat(Y)||V),i!=null&&i.print_template_config)ye(ie=>({...ie,...i.print_template_config}));else try{const ie=localStorage.getItem("print_template_config");ie&&ye(bn=>({...bn,...JSON.parse(ie)}))}catch{}});else if(typeof localStorage<"u"){const i=localStorage.getItem("default_paper_size")||"A6";se(i),L(localStorage.getItem("print_paper_size")||i);const f=localStorage.getItem("default_print_margin")||"20mm";Oe(f),ae(localStorage.getItem("print_margin")||f);const l=De(f);ve(l.mode),je(l.mm),Fe(l.vMm),Ge(l.hMm);const T=parseFloat(localStorage.getItem("default_font_scale"))||2;ue(T),ne(parseFloat(localStorage.getItem("print_font_scale"))||T)}}catch{}}function U(t){var f;const a=t.senderName!==void 0?t.senderName:J,d=t.senderPhone!==void 0?t.senderPhone:Ie,i=t.senderAddress!==void 0?t.senderAddress:Ae;if(t.senderName!==void 0&&(_t(t.senderName),vt(t.senderName)),t.senderPhone!==void 0&&jt(t.senderPhone),t.senderAddress!==void 0&&St(t.senderAddress),t.printMargin!==void 0){ae(t.printMargin);const l=De(t.printMargin);ve(l.mode),je(l.mm),Fe(l.vMm),Ge(l.hMm)}if(t.paperSize!==void 0&&L(t.paperSize),t.fontScale!==void 0){const l=parseFloat(t.fontScale)||2;ne(l)}try{if(typeof chrome<"u"&&((f=chrome.storage)!=null&&f.local)){const l={sender_name:a,senderName:a,sender_phone:d,senderPhone:d,sender_address:i,senderAddress:i,print_margin:t.printMargin!==void 0?t.printMargin:A,print_paper_size:t.paperSize!==void 0?t.paperSize:H,print_font_scale:t.fontScale!==void 0?t.fontScale:z};a&&a.trim()&&(l.carrier_account=a.trim()),chrome.storage.local.set(l)}typeof localStorage<"u"&&(t.printMargin!==void 0&&localStorage.setItem("print_margin",t.printMargin),t.paperSize!==void 0&&localStorage.setItem("print_paper_size",t.paperSize),t.fontScale!==void 0&&localStorage.setItem("print_font_scale",String(t.fontScale)))}catch{}}async function pn(){var t,a,d,i;wt(!0),re("");try{let f=null;if(typeof chrome<"u"&&chrome.tabs&&chrome.tabs.query)try{const l=await new Promise(T=>{chrome.tabs.query({url:"*://*.vnpost.vn/*"},T)});if(l&&l.length>0)for(const T of l)try{const w=await new Promise(Z=>{chrome.tabs.sendMessage(T.id,{action:"GET_VNPOST_SENDER_INFO"},B=>{chrome.runtime.lastError?Z(null):Z(B)})});if(w&&w.success&&w.info&&w.info.name){f=w.info;break}}catch{}}catch{}if(!f&&typeof chrome<"u"&&((t=chrome.storage)!=null&&t.local)){const l=await new Promise(T=>{chrome.storage.local.get(["last_vnpost_sender_info","carrier_accounts","carrier_account"],T)});if((a=l==null?void 0:l.last_vnpost_sender_info)!=null&&a.name)f=l.last_vnpost_sender_info;else if(l!=null&&l.carrier_account&&((d=l==null?void 0:l.carrier_accounts)!=null&&d[l.carrier_account]))f=l.carrier_accounts[l.carrier_account];else if(l!=null&&l.carrier_accounts&&Object.keys(l.carrier_accounts).length>0){const T=Object.keys(l.carrier_accounts)[0];f=l.carrier_accounts[T]}}if(f&&f.name){const l={senderName:f.name,senderPhone:f.phone||"",senderAddress:f.address||""};U(l),kt(f),typeof chrome<"u"&&((i=chrome.storage)!=null&&i.local)&&chrome.storage.local.get(["carrier_accounts"],T=>{const w=(T==null?void 0:T.carrier_accounts)||{};w[f.name]={name:f.name,phone:f.phone||"",address:f.address||"",carrier:"vnpost",updatedAt:Date.now()},chrome.storage.local.set({carrier_accounts:w,carrier_account:f.name,last_vnpost_sender_info:w[f.name]}),Ct(w)}),re(`✅ Đã lấy thành công tài khoản: ${f.name}${f.phone?" - SĐT: "+f.phone:""}`),setTimeout(()=>re(""),5e3)}else re("⚠️ Chưa tìm thấy thông tin VNPost. Hãy mở trang tạo đơn my.vnpost.vn rồi bấm lại!"),setTimeout(()=>re(""),5500)}catch(f){re("❌ Lỗi khi đồng bộ: "+(f.message||"Không xác định")),setTimeout(()=>re(""),5e3)}finally{wt(!1)}}function fn(t){!t||!t.name||(U({senderName:t.name,senderPhone:t.phone||"",senderAddress:t.address||""}),re(`👉 Đã áp dụng tài khoản người gửi: ${t.name}`),setTimeout(()=>re(""),3500))}function de(t){var d;const a={...$,...t};ye(a);try{typeof chrome<"u"&&((d=chrome.storage)!=null&&d.local)&&chrome.storage.local.set({print_template_config:a}),typeof localStorage<"u"&&localStorage.setItem("print_template_config",JSON.stringify(a))}catch{}}async function hn(){y(!0);try{let t=[];const a=typeof pe<"u"?pe:globalThis.OrderStorage||null;a&&typeof a.getSubmittedOrders=="function"&&(t=await a.getSubmittedOrders().catch(()=>[]));const d=(t||[]).filter(i=>{if(!i)return!1;const f=String(Q(i,"customerName","name","recipientName","customer_name")||"").trim(),l=String(Q(i,"phone","customerPhone","recipientPhone")||"").trim(),T=String(Q(i,"orderCode","order_code","trackingCode","tracking_code","id")||"").trim();return(f||l)&&T});r(d),s([])}catch(t){console.warn("[PrintCenter] Load orders failed:",t)}finally{y(!1)}}const Ue=u.useMemo(()=>{const t=new Date,a=new Date(t.getFullYear(),t.getMonth(),t.getDate(),0,0,0,0),d=new Date(t.getFullYear(),t.getMonth(),t.getDate(),23,59,59,999);if(v==="today")return{start:a,end:d};if(v==="yesterday"){const i=new Date(a);i.setDate(i.getDate()-1);const f=new Date(d);return f.setDate(f.getDate()-1),{start:i,end:f}}if(v==="7days"){const i=new Date(a);return i.setDate(i.getDate()-6),{start:i,end:d}}if(v==="thisMonth")return{start:new Date(t.getFullYear(),t.getMonth(),1,0,0,0,0),end:d};if(v==="lastMonth"){const i=new Date(t.getFullYear(),t.getMonth()-1,1,0,0,0,0),f=new Date(t.getFullYear(),t.getMonth(),0,23,59,59,999);return{start:i,end:f}}if(v==="custom"&&(_||g)){const i=_?new Date(_+"T00:00:00"):new Date(0),f=g?new Date(g+"T23:59:59"):new Date(864e13);return{start:i,end:f}}return null},[v,_,g]),K=u.useMemo(()=>{const t=c.trim(),a=Je(t),d=qt(t);return n.filter(i=>{const f=i.print_count&&i.print_count>0||!!i.last_printed_at;if(M==="UNPRINTED"&&f||M==="PRINTED"&&!f)return!1;if(Ue){const l=new Date(Q(i,"submittedAt","submitted_at","createdAt","created_at","submittedDate","submitted_date")||0);if(!Number.isNaN(l.getTime())&&(l<Ue.start||l>Ue.end))return!1}if(h!=="all"){const l=Qt(i);if(h!==l.key)return!1}if(m!=="all"){const l=Jt(i);if(m==="recipient"&&!l||m==="sender"&&l)return!1}if(b!=="all"){const T=!!Yt(i);if(b==="has_tracking"&&!T||b==="no_tracking"&&T)return!1}if(S!=="all"){const l=String(Q(i,"status")||"submitted").toLowerCase();if(S==="delivered"&&l!=="delivered"&&l!=="90"||S==="delivery_failed"&&l!=="delivery_failed"||S==="delivering"&&l!=="delivering"&&l!=="70"||S==="out_for_delivery"&&l!=="out_for_delivery"&&l!=="80"||S==="returned"&&l!=="returned"&&l!=="100"||S==="processing"&&l!=="processing"&&l!=="accepted"&&l!=="50"||S==="pending_pickup"&&l!=="pending_pickup"&&l!=="pending"&&l!=="1"||S==="submitted"&&l!=="submitted"&&l!=="created"&&l!=="0"&&l!==""||S==="cancelled"&&l!=="cancelled"&&l!=="canceled"||S==="reconciled"&&l!=="reconciled")return!1}if(t){const l=String(Q(i,"customerName","name","recipientName","customer_name")||""),T=Je(l),w=qt(Q(i,"phone","customerPhone","recipientPhone")),Z=String(Q(i,"orderCode","order_code","code")||"").toLowerCase(),B=String(Q(i,"trackingCode","tracking_code","tracking_number")||"").toLowerCase(),q=Je(Xt(i)),k=Je(Q(i,"address","customerAddress","deliveryAddress")||""),D=T.includes(a),V=d?w.includes(d)||w.endsWith(d):!1,Y=Z.includes(t.toLowerCase()),ge=B.includes(t.toLowerCase()),Qe=q.includes(a),Xe=k.includes(a);if(!D&&!V&&!Y&&!ge&&!Qe&&!Xe)return!1}return!0})},[n,M,Ue,h,m,b,S,c]),lt=u.useMemo(()=>n.filter(t=>!t.print_count||t.print_count===0).length,[n]),xn=u.useMemo(()=>n.filter(t=>t.print_count&&t.print_count>0).length,[n]),G=u.useMemo(()=>n.filter(t=>o.includes(t.order_code||t.orderCode||t.id)),[n,o]),ct=u.useMemo(()=>G.reduce((t,a)=>t+Ut(a),0),[G]);u.useMemo(()=>G.some(t=>t.print_count&&t.print_count>0||!!t.last_printed_at),[G]);const $e=u.useMemo(()=>{if(le==="ALL")return K;const t=Number(le),a=(W-1)*t;return K.slice(a,a+t)},[K,W,le]),Ye=u.useMemo(()=>le==="ALL"||!K.length?1:Math.ceil(K.length/Number(le)),[K,le]);function gn(){o.length===K.length?s([]):s(K.map(t=>t.order_code||t.orderCode||t.id))}function un(t){o.includes(t)?s(o.filter(a=>a!==t)):s([...o,t])}function dt(t){var a;t&&((a=navigator.clipboard)==null||a.writeText(t),Te(t),setTimeout(()=>Te(null),2e3))}function zt(t=null){const a=t||G;!a||a.length===0||(et(a),Ce(!0))}function It(t=null){const a=t||G;if(!a||a.length===0)return;a.some(i=>i.print_count&&i.print_count>0||!!i.last_printed_at)?(we(""),ke(!0)):pt("",a)}async function pt(t="",a=null){ke(!1);const d=a||(Le?fe:G);if(!d||d.length===0)return;const i=Ze(d,{...$,paper_size:H,margin:A,font_scale:z},{carrierAccount:J,senderName:J,senderPhone:Ie,senderAddress:Ae,defaultCarrierAccount:J,carrierAccounts:Pe,lastVnpostSenderInfo:it,font_scale:z});let f=null;try{f=window.open("","_blank"),f&&(f.document.open(),f.document.write(i),f.document.close())}catch(k){console.warn("Direct open blank failed, trying Blob URL fallback:",k)}if(!f)try{const k=new Blob([i],{type:"text/html;charset=utf-8"}),D=URL.createObjectURL(k);f=window.open(D,"_blank")}catch{}if(!f){alert("Trình duyệt chặn mở popup in. Vui lòng cấp quyền cho phép mở tab in trong cài đặt (Pop-ups and redirects -> Allow).");return}Hn(f,H,A,(k,D,V,Y)=>{L(k),ae(D),Y!==void 0&&ne(Y),V&&(se(k),Oe(D),Y!==void 0&&ue(Y),qe(`Đã lưu khổ giấy (${k}), lề (${D}), cỡ chữ (${Math.round((Y||z)*100)}%) làm mặc định!`,"save"))},z);const l={};d.forEach(k=>{const D=k.order_code||k.orderCode||k.id;l[D]="PRINTED"}),me(l);const T=typeof pe<"u"?pe:globalThis.OrderStorage||null;let w=null;if(T&&typeof T.getActiveShop=="function")try{const k=await T.getActiveShop();w=k?k.id||k:null}catch{}const Z=`print_job_${Date.now()}_${Math.random().toString(36).substring(2,9)}`;let B=null;const q=typeof SupabaseCloud<"u"?SupabaseCloud:globalThis.SupabaseCloud||null;if(w&&q&&typeof q.rpc=="function")try{const k=d.map(V=>({order_id:String(V.order_code||V.orderCode||V.id),tracking_code:String(V.trackingCode||V.tracking_code||V.order_code||V.orderCode||V.id)})),D=await q.rpc("create_print_job_idempotent",{p_shop_id:w,p_template_id:null,p_idempotency_key:Z,p_copies:1,p_printer_profile:H==="A5"?"A5_STANDARD":"A6_STANDARD",p_items:k});D&&D.job_id&&(B=D.job_id)}catch(k){console.warn("[PrintCenter] create_print_job_idempotent RPC warning:",k)}Ee({id:B||"job_"+Date.now(),server_job_id:B,shop_id:w,idempotency_key:Z,created_at:new Date().toISOString(),reprint_reason:t,orders:d}),Ne(!0)}async function mn(){if(te)try{const t=typeof SupabaseCloud<"u"?SupabaseCloud:globalThis.SupabaseCloud||null;if(te.server_job_id&&te.shop_id&&t&&typeof t.rpc=="function")try{const d=te.orders.map(i=>{const f=i.order_code||i.orderCode||i.id,l=he[f]||"PRINTED";return{order_id:String(f),tracking_code:String(i.trackingCode||i.tracking_code||f),status:l,reprint_reason:te.reprint_reason||null,error:null}});await t.rpc("confirm_print_job_items",{p_shop_id:te.shop_id,p_job_id:te.server_job_id,p_item_results:d})}catch(d){console.warn("[PrintCenter] confirm_print_job_items RPC warning:",d)}const a=typeof pe<"u"?pe:globalThis.OrderStorage||null;if(a&&typeof a.saveSubmittedOrders=="function"){const d=n.map(i=>{const f=i.order_code||i.orderCode||i.id,l=he[f];return l==="PRINTED"||l==="REPRINTED"?{...i,print_count:(i.print_count||0)+1,last_printed_at:new Date().toISOString()}:i});await a.saveSubmittedOrders(d),r(d)}Ne(!1),Ee(null)}catch(t){console.error("[PrintCenter] Confirm failed:",t)}}return e.jsxs("div",{className:"print-center-container",style:{padding:"20px 32px",width:"100%",maxWidth:"100%",boxSizing:"border-box",margin:"0 auto",fontFamily:"Inter, -apple-system, sans-serif",color:"var(--text-main, #0f172a)"},children:[Nt&&e.jsxs("div",{style:{position:"fixed",top:"20px",right:"24px",zIndex:999999,background:"#0f172a",color:"#ffffff",padding:"12px 18px",borderRadius:"10px",boxShadow:"0 12px 28px rgba(0, 0, 0, 0.28)",display:"flex",alignItems:"center",gap:"12px",fontSize:"13px",fontWeight:700,border:"1px solid #334155",animation:"fadeIn 0.2s ease-out"},children:[e.jsx(ft,{size:18,color:"#22c55e"}),e.jsx("span",{children:Nt.message}),e.jsx("button",{type:"button",onClick:()=>st(null),style:{background:"transparent",border:"none",color:"#94a3b8",cursor:"pointer",display:"flex",alignItems:"center",padding:"2px"},children:e.jsx(Et,{size:15})})]}),e.jsx("style",{children:`
        .pc-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 8px 14px;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s ease;
          border: 1px solid transparent;
          outline: none;
        }
        .pc-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .pc-btn-primary {
          background: #2563eb;
          color: #ffffff;
          box-shadow: 0 1px 2px rgba(37, 99, 235, 0.2);
        }
        .pc-btn-primary:hover:not(:disabled) {
          background: #1d4ed8;
        }
        .pc-btn-secondary {
          background: #ffffff;
          color: #334155;
          border-color: #cbd5e1;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
        }
        .pc-btn-secondary:hover:not(:disabled) {
          background: #f8fafc;
          border-color: #94a3b8;
        }
        .pc-card {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
        }
        .pc-tab-btn {
          padding: 7px 14px;
          border-radius: 7px;
          font-size: 12.5px;
          font-weight: 600;
          cursor: pointer;
          border: none;
          background: transparent;
          color: #64748b;
          transition: all 0.15s;
        }
        .pc-tab-btn.active {
          background: #ffffff;
          color: #0f172a;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }
        .pc-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 12.5px;
          text-align: left;
        }
        .pc-table th {
          background: #f8fafc;
          padding: 12px 14px;
          font-weight: 700;
          color: #475569;
          font-size: 11.5px;
          letter-spacing: 0.3px;
          text-transform: uppercase;
          border-bottom: 1px solid #e2e8f0;
          white-space: nowrap;
        }
        .pc-table td {
          padding: 12px 14px;
          border-bottom: 1px solid #f1f5f9;
          vertical-align: middle;
        }
        .pc-table tr:hover td {
          background: #f8fafc;
        }
        .pc-table tr.selected td {
          background: #eff6ff;
        }
        .pc-badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 3px 8px;
          border-radius: 9999px;
          font-size: 11px;
          font-weight: 600;
          line-height: 1;
        }
      `}),e.jsxs("div",{style:{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:"16px",marginBottom:"20px"},children:[e.jsxs("div",{style:{display:"flex",alignItems:"center",gap:"14px"},children:[e.jsx("div",{style:{width:"44px",height:"44px",borderRadius:"10px",background:"#eff6ff",display:"flex",alignItems:"center",justifyContent:"center",color:"#2563eb"},children:e.jsx(Be,{size:24})}),e.jsxs("div",{children:[e.jsx("h1",{style:{margin:0,fontSize:"20px",fontWeight:800,color:"var(--text-main, #0f172a)",letterSpacing:"-0.3px"},children:"Trung tâm in nhãn vận đơn hàng loạt"}),e.jsx("p",{style:{margin:"3px 0 0 0",fontSize:"13px",color:"#64748b"},children:"Chuẩn hóa mẫu in nhiệt A6/A5 đa hãng (VNPost, J&T Express, Viettel Post, GHTK), hỗ trợ chống in trùng và kiểm soát lịch sử"})]})]}),e.jsxs("div",{style:{display:"flex",alignItems:"center",gap:"10px",flexWrap:"wrap"},children:[e.jsxs("div",{style:{display:"flex",alignItems:"center",gap:"8px",background:"#ffffff",padding:"6px 12px",borderRadius:"8px",border:"1px solid #cbd5e1",fontSize:"12.5px"},children:[e.jsx("span",{style:{color:"#64748b",fontWeight:600},children:"Khổ giấy:"}),e.jsxs("select",{value:H,onChange:t=>{const a=t.target.value;L(a),U({paperSize:a})},style:{border:"none",background:"transparent",fontWeight:800,color:"#0f172a",outline:"none",cursor:"pointer"},children:[e.jsx("option",{value:"A6",children:"A6 (105 x 148 mm - Bưu điện)"}),e.jsx("option",{value:"A5",children:"A5 (148 x 210 mm)"}),e.jsx("option",{value:"A4",children:"A4 (210 x 297 mm)"}),e.jsx("option",{value:"K100",children:"100 x 150 mm (K100 TMĐT)"})]}),H===X?e.jsx("span",{style:{fontSize:"11px",background:"#dcfce7",color:"#15803d",padding:"2px 7px",borderRadius:"4px",fontWeight:700,display:"inline-flex",alignItems:"center",gap:"3px"},children:"⭐ Khổ mặc định"}):e.jsx("button",{type:"button",onClick:()=>ot(H),style:{fontSize:"11px",background:"#eff6ff",color:"#2563eb",border:"1px solid #bfdbfe",padding:"2px 8px",borderRadius:"4px",fontWeight:700,cursor:"pointer"},title:"Lưu khổ giấy này làm mặc định cho tất cả lần in sau",children:"⭐ Đặt làm mặc định"})]}),e.jsxs("div",{style:{display:"flex",alignItems:"center",gap:"8px",background:"#ffffff",padding:"6px 12px",borderRadius:"8px",border:"1px solid #cbd5e1",fontSize:"12.5px"},children:[e.jsx("span",{style:{color:"#64748b",fontWeight:600},children:"Căn lề:"}),e.jsx("span",{style:{fontWeight:800,color:"#0f172a"},children:A}),A===Re?e.jsx("span",{style:{fontSize:"11px",background:"#fef3c7",color:"#b45309",padding:"2px 7px",borderRadius:"4px",fontWeight:700},children:"⭐ Lề mặc định"}):e.jsx("button",{type:"button",onClick:()=>rt(A),style:{fontSize:"11px",background:"#eff6ff",color:"#2563eb",border:"1px solid #bfdbfe",padding:"2px 8px",borderRadius:"4px",fontWeight:700,cursor:"pointer"},title:"Lưu mức lề này làm mặc định cho tất cả lần in sau",children:"⭐ Đặt làm mặc định"})]}),e.jsxs("div",{style:{display:"flex",alignItems:"center",gap:"8px",background:"#ffffff",padding:"6px 12px",borderRadius:"8px",border:"1px solid #cbd5e1",fontSize:"12.5px"},children:[e.jsx("span",{style:{color:"#64748b",fontWeight:600},children:"Cỡ chữ:"}),e.jsxs("select",{value:z,onChange:t=>{const a=parseFloat(t.target.value)||2;ne(a),U({fontScale:a})},style:{border:"none",background:"transparent",fontWeight:800,color:"#0f172a",outline:"none",cursor:"pointer"},children:[e.jsx("option",{value:"2",children:"Gấp đôi (200% - Rõ to mặc định)"}),e.jsx("option",{value:"1.5",children:"Lớn (150%)"}),e.jsx("option",{value:"1",children:"Chuẩn (100%)"}),e.jsx("option",{value:"2.5",children:"Cực lớn (250%)"})]}),Math.abs(Number(z)-Number(E))<.05?e.jsx("span",{style:{fontSize:"11px",background:"#ede9fe",color:"#6d28d9",padding:"2px 7px",borderRadius:"4px",fontWeight:700},children:"⭐ Chữ mặc định"}):e.jsx("button",{type:"button",onClick:()=>Tt(z),style:{fontSize:"11px",background:"#eff6ff",color:"#2563eb",border:"1px solid #bfdbfe",padding:"2px 8px",borderRadius:"4px",fontWeight:700,cursor:"pointer"},title:"Lưu cỡ chữ này làm mặc định cho tất cả lần in sau",children:"⭐ Đặt làm mặc định"})]}),e.jsxs("button",{onClick:()=>ze(!0),className:"pc-btn pc-btn-secondary",style:{display:"flex",alignItems:"center",gap:"6px"},title:"Tùy chỉnh tiêu đề dịch vụ, chỉ dẫn giao hàng, câu slogan và các thành phần tem in",children:[e.jsx(Vt,{size:15,style:{color:"#7c3aed"}}),e.jsx("span",{children:"🎨 Chỉnh sửa trang in mẫu"})]}),e.jsxs("button",{onClick:()=>zt(G),disabled:G.length===0,className:"pc-btn pc-btn-secondary",title:"Xem trước mẫu in thực tế của các đơn đã chọn",children:[e.jsx(ht,{size:15}),e.jsxs("span",{children:["Xem trước (",G.length,")"]})]}),e.jsxs("button",{onClick:()=>It(G),disabled:G.length===0,className:"pc-btn pc-btn-primary",style:{display:"flex",alignItems:"center",gap:"6px"},title:"Mở tab in chuẩn PDF VNPost (Xem trước, Lưu PDF hoặc In nhiệt)",children:[e.jsx(Be,{size:15}),e.jsxs("span",{children:["In ",G.length," nhãn PDF"]})]})]})]}),e.jsxs("div",{style:{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(210px, 1fr))",gap:"12px",marginBottom:"16px"},children:[e.jsxs("div",{className:"pc-card",style:{padding:"14px 16px"},children:[e.jsx("div",{style:{fontSize:"11px",fontWeight:700,color:"#64748b",textTransform:"uppercase",marginBottom:"6px"},children:"Tổng đơn hàng"}),e.jsxs("div",{style:{fontSize:"24px",fontWeight:800,color:"#0f172a"},children:[n.length," ",e.jsx("span",{style:{fontSize:"13px",fontWeight:500,color:"#64748b"},children:"đơn"})]})]}),e.jsxs("div",{className:"pc-card",style:{padding:"14px 16px"},children:[e.jsx("div",{style:{fontSize:"11px",fontWeight:700,color:"#b45309",textTransform:"uppercase",marginBottom:"6px"},children:"Chưa in nhãn"}),e.jsxs("div",{style:{fontSize:"24px",fontWeight:800,color:"#d97706"},children:[lt," ",e.jsx("span",{style:{fontSize:"13px",fontWeight:500,color:"#64748b"},children:"đơn"})]})]}),e.jsxs("div",{className:"pc-card",style:{padding:"14px 16px"},children:[e.jsx("div",{style:{fontSize:"11px",fontWeight:700,color:"#2563eb",textTransform:"uppercase",marginBottom:"6px"},children:"Đang chọn in"}),e.jsxs("div",{style:{fontSize:"24px",fontWeight:800,color:"#2563eb"},children:[G.length," ",e.jsx("span",{style:{fontSize:"13px",fontWeight:500,color:"#64748b"},children:"đơn"})]})]}),e.jsxs("div",{className:"pc-card",style:{padding:"14px 16px"},children:[e.jsx("div",{style:{fontSize:"11px",fontWeight:700,color:"#059669",textTransform:"uppercase",marginBottom:"6px"},children:"Tổng tiền COD đã chọn"}),e.jsxs("div",{style:{fontSize:"22px",fontWeight:800,color:"#059669"},children:[ct.toLocaleString("vi-VN")," ",e.jsx("span",{style:{fontSize:"13px",fontWeight:600},children:"đ"})]})]})]}),e.jsxs("div",{className:"pc-card",style:{padding:"14px 18px",marginBottom:"14px",background:"#f8fafc",border:"1px solid #e2e8f0"},children:[e.jsxs("div",{style:{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:"10px",marginBottom:"10px"},children:[e.jsxs("div",{style:{display:"flex",alignItems:"center",gap:"8px"},children:[e.jsx("span",{style:{fontSize:"13.5px",fontWeight:800,color:"#1e293b"},children:"👤 Thông tin người gửi (Đồng bộ tài khoản bưu cục)"}),e.jsx("span",{style:{fontSize:"11px",background:"#e0f2fe",color:"#0369a1",padding:"2px 8px",borderRadius:"4px",fontWeight:700},children:"Chuẩn PDF MyVNPost"})]}),e.jsx("div",{style:{display:"flex",alignItems:"center",gap:"10px"},children:e.jsxs("button",{type:"button",onClick:pn,disabled:Ke,style:{display:"inline-flex",alignItems:"center",gap:"6px",background:"#0284c7",color:"#ffffff",border:"none",borderRadius:"6px",padding:"6px 14px",fontSize:"12px",fontWeight:700,cursor:Ke?"not-allowed":"pointer",boxShadow:"0 1px 3px rgba(2, 132, 199, 0.3)",transition:"all 0.2s"},title:"Lấy thông tin Tên, SĐT, Địa chỉ người gửi từ tài khoản VNPost đang mở và lưu vào hệ thống",children:[e.jsx(Kt,{size:13,className:Ke?"animate-spin":""}),e.jsx("span",{children:Ke?"Đang lấy từ VNPost...":"📥 Lấy từ trang VNPost"})]})})]}),e.jsxs("div",{style:{display:"flex",gap:"12px",alignItems:"center",flexWrap:"wrap"},children:[e.jsxs("div",{style:{flex:"1 1 200px",minWidth:"180px"},children:[e.jsx("div",{style:{fontSize:"11px",fontWeight:700,color:"#475569",marginBottom:"4px"},children:"👤 TÊN NGƯỜI GỬI (TÀI KHOẢN VNPOST)"}),e.jsx("input",{type:"text",value:J,onChange:t=>U({senderName:t.target.value}),placeholder:"VD: NGUYỄN THANH NHỰT",style:{width:"100%",padding:"8px 10px",border:"1px solid #cbd5e1",borderRadius:"6px",fontSize:"12.5px",fontWeight:700,color:"#0f172a",outline:"none",background:"#ffffff",boxSizing:"border-box"},title:"Tên người gửi (Ưu tiên tên tài khoản VNPost)"})]}),e.jsxs("div",{style:{flex:"1 1 150px",minWidth:"140px"},children:[e.jsx("div",{style:{fontSize:"11px",fontWeight:700,color:"#475569",marginBottom:"4px"},children:"📞 SĐT NGƯỜI GỬI (CHÍNH XÁC)"}),e.jsx("input",{type:"text",value:Ie,onChange:t=>U({senderPhone:t.target.value}),placeholder:"Nhập SĐT người gửi...",style:{width:"100%",padding:"8px 10px",border:"1px solid #cbd5e1",borderRadius:"6px",fontSize:"12.5px",fontWeight:700,color:"#2563eb",outline:"none",background:"#ffffff",boxSizing:"border-box"},title:"Số điện thoại người gửi (Lấy đúng SĐT tài khoản người gửi, không dùng số mặc định)"})]}),e.jsxs("div",{style:{flex:"2 1 280px",minWidth:"220px"},children:[e.jsx("div",{style:{fontSize:"11px",fontWeight:700,color:"#475569",marginBottom:"4px"},children:"🏠 ĐỊA CHỈ NGƯỜI GỬI"}),e.jsx("input",{type:"text",value:Ae,onChange:t=>U({senderAddress:t.target.value}),placeholder:"Địa chỉ gửi hàng...",style:{width:"100%",padding:"8px 10px",border:"1px solid #cbd5e1",borderRadius:"6px",fontSize:"12.5px",color:"#334155",outline:"none",background:"#ffffff",boxSizing:"border-box"}})]})]}),ce&&e.jsx("div",{style:{marginTop:"10px",padding:"7px 12px",borderRadius:"6px",fontSize:"12px",fontWeight:600,background:ce.startsWith("✅")||ce.startsWith("👉")?"#ecfdf5":"#fffbeb",color:ce.startsWith("✅")||ce.startsWith("👉")?"#065f46":"#92400e",border:`1px solid ${ce.startsWith("✅")||ce.startsWith("👉")?"#a7f3d0":"#fde68a"}`},children:ce}),Object.keys(Pe).length>0&&e.jsxs("div",{style:{display:"flex",alignItems:"center",gap:"8px",flexWrap:"wrap",marginTop:"10px",paddingTop:"10px",borderTop:"1px dashed #cbd5e1"},children:[e.jsx("span",{style:{fontSize:"11px",color:"#64748b",fontWeight:700,textTransform:"uppercase"},children:"Tài khoản VNPost đã lưu:"}),Object.entries(Pe).map(([t,a])=>{const d=J.trim().toLowerCase()===t.trim().toLowerCase();return e.jsxs("button",{type:"button",onClick:()=>fn(a),style:{display:"inline-flex",alignItems:"center",gap:"5px",background:d?"#0284c7":"#ffffff",color:d?"#ffffff":"#0f172a",border:`1.5px solid ${d?"#0284c7":"#cbd5e1"}`,borderRadius:"6px",padding:"3px 10px",fontSize:"11.5px",fontWeight:d?800:600,cursor:"pointer",boxShadow:d?"0 1px 3px rgba(2,132,199,0.3)":"none",transition:"all 0.15s"},title:`Chọn tài khoản ${t} (${a.phone||"Chưa có SĐT"})`,children:[e.jsxs("span",{children:["👤 ",t]}),a.phone&&e.jsxs("span",{style:{opacity:d?.9:.7,fontSize:"10.5px"},children:["(",a.phone,")"]})]},t)})]})]}),e.jsxs("div",{className:"pc-card",style:{padding:"16px 20px",marginBottom:"16px",background:"#ffffff",border:"1.5px solid #cbd5e1"},children:[e.jsxs("div",{style:{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:"10px",marginBottom:"16px",borderBottom:"1px solid #e2e8f0",paddingBottom:"10px"},children:[e.jsxs("div",{style:{display:"flex",alignItems:"center",gap:"10px"},children:[e.jsx("div",{style:{width:"32px",height:"32px",borderRadius:"8px",background:"#eff6ff",display:"flex",alignItems:"center",justifyContent:"center",color:"#2563eb"},children:e.jsx(yn,{size:18})}),e.jsxs("div",{children:[e.jsx("h2",{style:{margin:0,fontSize:"14.5px",fontWeight:800,color:"#0f172a"},children:"📐 Cấu hình khổ giấy & Căng lề in mặc định (Rõ ràng & Trực quan)"}),e.jsx("div",{style:{fontSize:"12px",color:"#64748b"},children:"Thiết lập khổ giấy và độ căng lề in tem nhãn. Hệ thống tự động ghi nhớ làm mặc định cho mọi lượt in."})]})]}),e.jsxs("div",{style:{display:"flex",alignItems:"center",gap:"8px",fontSize:"12px"},children:[e.jsxs("span",{style:{background:"#f1f5f9",color:"#475569",padding:"4px 10px",borderRadius:"6px",fontWeight:700},children:["Khổ mặc định: ",e.jsx("strong",{style:{color:"#2563eb"},children:X})]}),e.jsxs("span",{style:{background:"#fef3c7",color:"#b45309",padding:"4px 10px",borderRadius:"6px",fontWeight:700},children:["Lề mặc định: ",e.jsx("strong",{style:{color:"#b45309"},children:Re})]})]})]}),e.jsxs("div",{style:{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(340px, 1fr))",gap:"20px"},children:[e.jsxs("div",{style:{background:"#f8fafc",padding:"14px",borderRadius:"10px",border:"1px solid #e2e8f0"},children:[e.jsxs("div",{style:{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"12px"},children:[e.jsxs("div",{style:{fontSize:"12.5px",fontWeight:800,color:"#1e293b",display:"flex",alignItems:"center",gap:"6px"},children:[e.jsx("span",{children:"📄"}),e.jsx("span",{children:"1. CHỌN & THIẾT LẬP KHỔ GIẤY MẶC ĐỊNH"})]}),e.jsxs("span",{style:{fontSize:"11px",color:"#64748b"},children:["Đang dùng: ",e.jsx("strong",{style:{color:"#0f172a"},children:H})]})]}),e.jsx("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px",marginBottom:"12px"},children:[{id:"A6",title:"A6 (105 x 148 mm)",badge:"Chuẩn VNPost",desc:"Tem nhiệt bưu điện VNPost, Viettel Post, J&T Express"},{id:"A5",title:"A5 (148 x 210 mm)",badge:"Nửa trang A4",desc:"In văn phòng máy in laser, in kim, giấy chia đôi"},{id:"A4",title:"A4 (210 x 297 mm)",badge:"Khổ A4 lớn",desc:"In văn phòng tiêu chuẩn kèm phiếu xuất kho"},{id:"K100",title:"100 x 150 mm (K100)",badge:"Tem cuộn TMĐT",desc:"Khổ cuộn in nhiệt phổ biến Shopee, TikTok, Lazada"}].map(t=>{const a=H===t.id,d=X===t.id;return e.jsxs("div",{onClick:()=>{L(t.id),U({paperSize:t.id})},style:{padding:"10px 12px",borderRadius:"8px",border:a?"2px solid #2563eb":"1px solid #cbd5e1",background:a?"#eff6ff":"#ffffff",cursor:"pointer",transition:"all 0.15s ease",position:"relative",display:"flex",flexDirection:"column",justifyContent:"space-between",minHeight:"88px"},children:[e.jsxs("div",{children:[e.jsxs("div",{style:{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"4px"},children:[e.jsx("span",{style:{fontSize:"13px",fontWeight:800,color:a?"#1d4ed8":"#0f172a"},children:t.title}),e.jsx("span",{style:{fontSize:"10px",background:a?"#bfdbfe":"#f1f5f9",color:a?"#1e40af":"#475569",padding:"1px 6px",borderRadius:"4px",fontWeight:700},children:t.badge})]}),e.jsx("div",{style:{fontSize:"11px",color:"#64748b",lineHeight:1.35,marginBottom:"8px"},children:t.desc})]}),e.jsxs("div",{style:{display:"flex",alignItems:"center",justifyContent:"space-between",marginTop:"auto",borderTop:"1px dashed #e2e8f0",paddingTop:"6px"},children:[d?e.jsxs("span",{style:{fontSize:"11px",fontWeight:800,color:"#16a34a",display:"flex",alignItems:"center",gap:"3px"},children:[e.jsx(ft,{size:13,color:"#16a34a"}),e.jsx("span",{children:"Đang là mặc định"})]}):e.jsx("button",{type:"button",onClick:i=>{i.stopPropagation(),ot(t.id)},style:{fontSize:"11px",fontWeight:700,padding:"3px 8px",borderRadius:"4px",border:"1px solid #bfdbfe",background:"#eff6ff",color:"#2563eb",cursor:"pointer"},title:`Đặt ${t.id} làm khổ giấy mặc định`,children:"⭐ Đặt làm mặc định"}),a&&!d&&e.jsx("span",{style:{fontSize:"10px",color:"#2563eb",fontWeight:700},children:"Đang chọn"})]})]},t.id)})}),e.jsxs("div",{style:{fontSize:"11.5px",color:"#475569",background:"#eff6ff",padding:"8px 10px",borderRadius:"6px",border:"1px solid #dbeafe",display:"flex",alignItems:"center",gap:"6px"},children:[e.jsx("span",{children:"💡"}),e.jsxs("span",{children:["Khổ giấy in mặc định: ",e.jsx("strong",{style:{color:"#1d4ed8"},children:X}),". Khổ giấy này sẽ được tự động áp dụng khi in đơn hàng loạt."]})]})]}),e.jsxs("div",{style:{background:"#f8fafc",padding:"14px",borderRadius:"10px",border:"1px solid #e2e8f0"},children:[e.jsxs("div",{style:{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"12px"},children:[e.jsxs("div",{style:{fontSize:"12.5px",fontWeight:800,color:"#1e293b",display:"flex",alignItems:"center",gap:"6px"},children:[e.jsx("span",{children:"📏"}),e.jsx("span",{children:"2. ĐIỀU CHỈNH CĂNG LỀ IN (CANH LỀ CHÍNH XÁC)"})]}),e.jsxs("div",{style:{fontSize:"12px",fontWeight:800,color:"#b45309",background:"#fef3c7",padding:"2px 8px",borderRadius:"4px"},children:["Mức lề: ",A]})]}),e.jsxs("div",{style:{marginBottom:"12px"},children:[e.jsx("div",{style:{fontSize:"11px",fontWeight:700,color:"#64748b",marginBottom:"6px"},children:"MỨC CĂNG LỀ NHANH THÔNG DỤNG:"}),e.jsx("div",{style:{display:"flex",gap:"6px",flexWrap:"wrap"},children:[{label:"2cm (20mm) - Chuẩn VNPost",val:"20mm",desc:"Cách lề 2cm theo yêu cầu bưu cục"},{label:"1.5cm (15mm)",val:"15mm",desc:"Thoáng đẹp văn phòng"},{label:"1cm (10mm)",val:"10mm",desc:"Tiêu chuẩn tiết kiệm"},{label:"5mm",val:"5mm",desc:"Lề hẹp"},{label:"0mm (Sát lề)",val:"0mm",desc:"Sát viền in nhiệt"}].map(t=>{const a=A===t.val||t.val==="20mm"&&A==="2cm"||t.val==="10mm"&&A==="1cm"||t.val==="5mm"&&A==="0.5cm"||t.val==="0mm"&&A==="0cm";return e.jsx("button",{type:"button",onClick:()=>{ae(t.val);const d=De(t.val);ve("uniform"),je(d.mm),U({printMargin:t.val})},style:{fontSize:"11px",padding:"5px 10px",borderRadius:"6px",fontWeight:700,cursor:"pointer",border:a?"1.5px solid #2563eb":"1px solid #cbd5e1",background:a?"#eff6ff":"#ffffff",color:a?"#1d4ed8":"#334155"},title:t.desc,children:t.label},t.val)})})]}),e.jsxs("div",{style:{display:"flex",gap:"6px",marginBottom:"12px"},children:[e.jsxs("button",{type:"button",onClick:()=>{ve("uniform"),Me(_e)},style:{flex:1,padding:"6px 10px",borderRadius:"6px",fontSize:"11.5px",fontWeight:700,cursor:"pointer",border:xe==="uniform"?"1px solid #2563eb":"1px solid #cbd5e1",background:xe==="uniform"?"#2563eb":"#ffffff",color:xe==="uniform"?"#ffffff":"#475569"},children:["⬛ Căn đều 4 cạnh (",_e,"mm)"]}),e.jsxs("button",{type:"button",onClick:()=>{ve("split"),at(We,He)},style:{flex:1,padding:"6px 10px",borderRadius:"6px",fontSize:"11.5px",fontWeight:700,cursor:"pointer",border:xe==="split"?"1px solid #2563eb":"1px solid #cbd5e1",background:xe==="split"?"#2563eb":"#ffffff",color:xe==="split"?"#ffffff":"#475569"},children:["⬚ Căn riêng (Dọc: ",We,"mm / Ngang: ",He,"mm)"]})]}),xe==="uniform"?e.jsxs("div",{style:{background:"#ffffff",padding:"10px 12px",borderRadius:"8px",border:"1px solid #e2e8f0",marginBottom:"12px"},children:[e.jsxs("div",{style:{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"8px"},children:[e.jsx("span",{style:{fontSize:"11.5px",fontWeight:700,color:"#334155"},children:"Khoảng cách lề (Cả 4 cạnh):"}),e.jsxs("div",{style:{display:"flex",alignItems:"center",gap:"4px"},children:[e.jsx("input",{type:"number",min:"0",max:"40",value:_e,onChange:t=>Me(t.target.value),style:{width:"56px",padding:"4px 6px",borderRadius:"4px",border:"1px solid #94a3b8",fontSize:"13px",fontWeight:800,textAlign:"center",color:"#0f172a"}}),e.jsx("span",{style:{fontSize:"12px",fontWeight:700,color:"#64748b"},children:"mm"})]})]}),e.jsx("input",{type:"range",min:"0",max:"35",step:"1",value:_e,onChange:t=>Me(t.target.value),style:{width:"100%",cursor:"pointer",accentColor:"#2563eb"}}),e.jsxs("div",{style:{display:"flex",justifyContent:"space-between",fontSize:"10px",color:"#94a3b8",marginTop:"2px",marginBottom:"8px"},children:[e.jsx("span",{children:"0mm (Sát mép)"}),e.jsx("span",{children:"10mm (1cm)"}),e.jsx("span",{style:{color:"#2563eb",fontWeight:800},children:"20mm (2cm chuẩn)"}),e.jsx("span",{children:"35mm"})]}),e.jsx("div",{style:{display:"flex",gap:"6px"},children:[{label:"-5mm",step:-5},{label:"-1mm",step:-1},{label:"+1mm",step:1},{label:"+5mm",step:5}].map(t=>e.jsx("button",{type:"button",onClick:()=>Me(_e+t.step),style:{flex:1,padding:"4px 0",fontSize:"11px",fontWeight:700,borderRadius:"4px",border:"1px solid #cbd5e1",background:"#f8fafc",color:"#334155",cursor:"pointer"},children:t.label},t.label))})]}):e.jsxs("div",{style:{background:"#ffffff",padding:"10px 12px",borderRadius:"8px",border:"1px solid #e2e8f0",marginBottom:"12px"},children:[e.jsxs("div",{style:{marginBottom:"8px"},children:[e.jsxs("div",{style:{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"4px"},children:[e.jsx("span",{style:{fontSize:"11.5px",fontWeight:700,color:"#334155"},children:"Lề Trên & Dưới (Dọc):"}),e.jsxs("span",{style:{fontSize:"12px",fontWeight:800,color:"#2563eb"},children:[We," mm"]})]}),e.jsx("input",{type:"range",min:"0",max:"35",step:"1",value:We,onChange:t=>at(t.target.value,He),style:{width:"100%",cursor:"pointer",accentColor:"#2563eb"}})]}),e.jsxs("div",{children:[e.jsxs("div",{style:{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"4px"},children:[e.jsx("span",{style:{fontSize:"11.5px",fontWeight:700,color:"#334155"},children:"Lề Trái & Phải (Ngang):"}),e.jsxs("span",{style:{fontSize:"12px",fontWeight:800,color:"#2563eb"},children:[He," mm"]})]}),e.jsx("input",{type:"range",min:"0",max:"35",step:"1",value:He,onChange:t=>at(We,t.target.value),style:{width:"100%",cursor:"pointer",accentColor:"#2563eb"}})]})]}),e.jsxs("div",{style:{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:"8px",paddingTop:"4px"},children:[e.jsxs("div",{style:{fontSize:"11.5px",color:"#475569"},children:["Lề mặc định: ",e.jsx("strong",{style:{color:"#b45309"},children:Re})]}),A===Re?e.jsxs("span",{style:{fontSize:"11.5px",fontWeight:800,color:"#16a34a",display:"flex",alignItems:"center",gap:"4px"},children:[e.jsx(ft,{size:14,color:"#16a34a"}),e.jsx("span",{children:"Mức lề này đang là mặc định"})]}):e.jsxs("button",{type:"button",onClick:()=>rt(A),className:"pc-btn",style:{background:"#2563eb",color:"#ffffff",fontSize:"11.5px",padding:"5px 12px",fontWeight:700,borderRadius:"6px"},title:"Lưu mức lề hiện tại làm mặc định cho tất cả lần in sau",children:['⭐ Đặt mức lề "',A,'" làm mặc định']})]})]})]})]}),e.jsxs("div",{className:"pc-card",style:{padding:"16px",marginBottom:"16px",width:"100%",boxSizing:"border-box"},children:[e.jsxs("div",{style:{display:"flex",gap:"12px",alignItems:"center",flexWrap:"wrap",marginBottom:"12px",width:"100%",boxSizing:"border-box"},children:[e.jsxs("div",{style:{flex:"1 1 300px",position:"relative",minWidth:"240px"},children:[e.jsx(vn,{size:16,color:"#64748b",style:{position:"absolute",left:"12px",top:"50%",transform:"translateY(-50%)"}}),e.jsx("input",{type:"text",placeholder:"Tìm theo Tên khách, SĐT (đầy đủ hoặc 4 số cuối), Mã đơn, Vận đơn, Tài khoản bưu điện...",value:c,onChange:t=>{P(t.target.value),F(1)},style:{width:"100%",padding:"9px 12px 9px 36px",border:"1px solid #cbd5e1",borderRadius:"8px",fontSize:"13px",outline:"none",boxSizing:"border-box"}}),c&&e.jsx("button",{onClick:()=>{P(""),F(1)},style:{position:"absolute",right:"10px",top:"50%",transform:"translateY(-50%)",background:"none",border:"none",color:"#94a3b8",cursor:"pointer",fontSize:"14px"},children:"✕"})]}),e.jsx("div",{style:{display:"flex",gap:"4px",background:"#f1f5f9",border:"1px solid #e2e8f0",padding:"3px",borderRadius:"8px",flexWrap:"wrap"},children:[{id:"all",label:"Tất cả"},{id:"today",label:"Hôm nay"},{id:"yesterday",label:"Hôm qua"},{id:"7days",label:"7 ngày qua"},{id:"thisMonth",label:"Tháng này"},{id:"lastMonth",label:"Tháng trước"},{id:"custom",label:"Tùy chỉnh 🗓️"}].map(t=>e.jsx("button",{type:"button",onClick:()=>{R(t.id),F(1)},style:{padding:"6px 12px",borderRadius:"6px",border:"none",fontSize:"12px",fontWeight:v===t.id?700:500,background:v===t.id?"#ffffff":"transparent",color:v===t.id?"#2563eb":"#64748b",boxShadow:v===t.id?"0 1px 3px rgba(0,0,0,0.08)":"none",cursor:"pointer",transition:"all 0.15s ease"},children:t.label},t.id))})]}),e.jsxs("div",{style:{display:"flex",gap:"12px",alignItems:"center",flexWrap:"wrap",paddingTop:"10px",borderTop:"1px solid #f1f5f9",width:"100%",boxSizing:"border-box"},children:[v==="custom"&&e.jsxs("div",{style:{display:"flex",alignItems:"center",gap:"6px",fontSize:"13px"},children:[e.jsx(_n,{size:15,color:"#64748b"}),e.jsx("input",{type:"date",value:_,onChange:t=>{C(t.target.value),F(1)},style:{padding:"5px 8px",border:"1px solid #cbd5e1",borderRadius:"6px",fontSize:"12px"}}),e.jsx("span",{children:"đến"}),e.jsx("input",{type:"date",value:g,onChange:t=>{I(t.target.value),F(1)},style:{padding:"5px 8px",border:"1px solid #cbd5e1",borderRadius:"6px",fontSize:"12px"}})]}),e.jsxs("div",{style:{display:"flex",alignItems:"center",gap:"6px",fontSize:"13px"},children:[e.jsx("span",{style:{color:"#64748b",fontWeight:500},children:"Hãng:"}),e.jsxs("select",{value:h,onChange:t=>{p(t.target.value),F(1)},style:{padding:"5px 10px",border:"1px solid #cbd5e1",borderRadius:"6px",fontSize:"12px",background:"#ffffff",color:"#0f172a"},children:[e.jsx("option",{value:"all",children:"Tất cả hãng"}),e.jsx("option",{value:"vnpost",children:"VNPost (Bưu điện)"}),e.jsx("option",{value:"jt",children:"J&T Express"}),e.jsx("option",{value:"viettelpost",children:"Viettel Post"}),e.jsx("option",{value:"ghtk",children:"GHTK"})]})]}),e.jsxs("div",{style:{display:"flex",alignItems:"center",gap:"6px",fontSize:"13px"},children:[e.jsx("span",{style:{color:"#64748b",fontWeight:500},children:"Cước phí:"}),e.jsxs("select",{value:m,onChange:t=>{x(t.target.value),F(1)},style:{padding:"5px 10px",border:"1px solid #cbd5e1",borderRadius:"6px",fontSize:"12px",background:"#ffffff",color:"#0f172a"},children:[e.jsx("option",{value:"all",children:"Tất cả hình thức"}),e.jsx("option",{value:"recipient",children:"Khách (Người nhận) trả"}),e.jsx("option",{value:"sender",children:"Shop (Người gửi) trả"})]})]}),e.jsxs("div",{style:{display:"flex",alignItems:"center",gap:"6px",fontSize:"13px"},children:[e.jsx("span",{style:{color:"#64748b",fontWeight:500},children:"Vận đơn:"}),e.jsxs("select",{value:b,onChange:t=>{N(t.target.value),F(1)},style:{padding:"5px 10px",border:"1px solid #cbd5e1",borderRadius:"6px",fontSize:"12px",background:"#ffffff",color:"#0f172a"},children:[e.jsx("option",{value:"all",children:"Tất cả"}),e.jsx("option",{value:"has_tracking",children:"Đã có mã vận đơn"}),e.jsx("option",{value:"no_tracking",children:"Chưa có mã vận đơn"})]})]}),e.jsxs("div",{style:{display:"flex",alignItems:"center",gap:"6px",fontSize:"13px"},children:[e.jsx("span",{style:{color:"#64748b",fontWeight:500},children:"Giao hàng:"}),e.jsxs("select",{value:S,onChange:t=>{O(t.target.value),F(1)},style:{padding:"5px 10px",border:"1px solid #cbd5e1",borderRadius:"6px",fontSize:"12px",background:"#ffffff",color:"#0f172a"},children:[e.jsx("option",{value:"all",children:"Tất cả trạng thái"}),e.jsx("option",{value:"submitted",children:"Tạo đơn"}),e.jsx("option",{value:"pending_pickup",children:"Chờ lấy hàng"}),e.jsx("option",{value:"processing",children:"Nhận hàng"}),e.jsx("option",{value:"delivering",children:"Đang vận chuyển"}),e.jsx("option",{value:"out_for_delivery",children:"Đang phát hàng"}),e.jsx("option",{value:"delivered",children:"Phát hàng thành công"}),e.jsx("option",{value:"delivery_failed",children:"Phát không thành công"}),e.jsx("option",{value:"returned",children:"Chuyển hoàn"}),e.jsx("option",{value:"cancelled",children:"Đã hủy"}),e.jsx("option",{value:"reconciled",children:"Đối soát"})]})]}),e.jsxs("div",{style:{display:"flex",alignItems:"center",gap:"6px",fontSize:"13px",marginLeft:"auto"},children:[e.jsx("span",{style:{color:"#64748b",fontWeight:500},children:"In ấn:"}),e.jsxs("div",{style:{display:"inline-flex",background:"#f1f5f9",padding:"2px",borderRadius:"6px",gap:"2px"},children:[e.jsxs("button",{type:"button",onClick:()=>{ee("UNPRINTED"),F(1)},style:{padding:"4px 8px",borderRadius:"5px",border:"none",fontSize:"11.5px",fontWeight:M==="UNPRINTED"?700:500,background:M==="UNPRINTED"?"#ffffff":"transparent",color:M==="UNPRINTED"?"#d97706":"#64748b",cursor:"pointer"},children:["Chưa in (",lt,")"]}),e.jsxs("button",{type:"button",onClick:()=>{ee("PRINTED"),F(1)},style:{padding:"4px 8px",borderRadius:"5px",border:"none",fontSize:"11.5px",fontWeight:M==="PRINTED"?700:500,background:M==="PRINTED"?"#ffffff":"transparent",color:M==="PRINTED"?"#2563eb":"#64748b",cursor:"pointer"},children:["Đã in (",xn,")"]}),e.jsxs("button",{type:"button",onClick:()=>{ee("ALL"),F(1)},style:{padding:"4px 8px",borderRadius:"5px",border:"none",fontSize:"11.5px",fontWeight:M==="ALL"?700:500,background:M==="ALL"?"#ffffff":"transparent",color:M==="ALL"?"#0f172a":"#64748b",cursor:"pointer"},children:["Tất cả (",n.length,")"]})]})]})]})]}),e.jsxs("div",{className:"pc-card",style:{overflow:"hidden",marginBottom:"16px",width:"100%",boxSizing:"border-box"},children:[e.jsxs("div",{style:{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 16px",background:"#f8fafc",borderBottom:"1px solid #e2e8f0",flexWrap:"wrap",gap:"10px"},children:[e.jsxs("div",{style:{display:"flex",alignItems:"center",gap:"8px",fontSize:"13px"},children:[e.jsxs("span",{style:{fontWeight:600,color:"#475569"},children:["Đang chọn: ",e.jsx("strong",{style:{color:o.length>0?"#2563eb":"#64748b"},children:o.length})," / ",e.jsx("strong",{children:K.length})," đơn"]}),ct>0&&e.jsxs("span",{style:{fontSize:"12px",background:"#dcfce7",color:"#166534",padding:"2px 8px",borderRadius:"4px",fontWeight:700},children:["Tổng COD: ",ct.toLocaleString("vi-VN")," đ"]})]}),e.jsxs("div",{style:{display:"flex",alignItems:"center",gap:"8px",flexWrap:"wrap"},children:[e.jsxs("button",{type:"button",onClick:()=>{const a=K.filter(d=>!d.print_count||d.print_count===0).map(d=>d.order_code||d.orderCode||d.id);s(a)},className:"pc-btn pc-btn-secondary",style:{padding:"5px 10px",fontSize:"12px"},title:"Chọn tất cả các đơn chưa in trong danh sách lọc",children:[e.jsx(xt,{size:13,style:{color:"#d97706"}}),e.jsxs("span",{children:["Chọn tất cả chưa in (",lt,")"]})]}),e.jsx("button",{type:"button",onClick:()=>{const t=$e.map(a=>a.order_code||a.orderCode||a.id);s(Array.from(new Set([...o,...t])))},className:"pc-btn pc-btn-secondary",style:{padding:"5px 10px",fontSize:"12px"},title:"Chọn toàn bộ đơn hiển thị trong trang hiện tại",children:e.jsxs("span",{children:["Chọn trang này (",$e.length,")"]})}),o.length>0&&e.jsxs("button",{type:"button",onClick:()=>s([]),className:"pc-btn pc-btn-secondary",style:{padding:"5px 10px",fontSize:"12px",color:"#ef4444"},title:"Bỏ chọn tất cả các đơn",children:[e.jsx(Et,{size:13}),e.jsxs("span",{children:["Bỏ chọn (",o.length,")"]})]})]})]}),e.jsx("div",{style:{overflowX:"auto",width:"100%"},children:e.jsxs("table",{className:"pc-table",children:[e.jsx("thead",{children:e.jsxs("tr",{children:[e.jsx("th",{style:{width:"44px",textAlign:"center"},children:e.jsx("button",{onClick:gn,style:{background:"transparent",border:"none",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",color:"#475569"},title:o.length===K.length?"Bỏ chọn tất cả":"Chọn tất cả",children:o.length===K.length&&K.length>0?e.jsx(xt,{size:17,style:{color:"#2563eb"}}):e.jsx(Ot,{size:17})})}),e.jsx("th",{style:{minWidth:"150px"},children:"MÃ ĐƠN / VẬN ĐƠN"}),e.jsx("th",{style:{minWidth:"130px"},children:"HÃNG & CƯỚC"}),e.jsx("th",{style:{minWidth:"140px"},children:"NGƯỜI NHẬN"}),e.jsx("th",{style:{minWidth:"220px"},children:"ĐỊA CHỈ GIAO HÀNG"}),e.jsx("th",{style:{minWidth:"200px"},children:"HÀNG HÓA & TRỌNG LƯỢNG"}),e.jsx("th",{style:{minWidth:"110px"},children:"TIỀN THU (COD)"}),e.jsx("th",{style:{minWidth:"130px"},children:"TRẠNG THÁI IN & LỊCH SỬ"}),e.jsx("th",{style:{textAlign:"right",paddingRight:"18px",minWidth:"100px"},children:"THAO TÁC"})]})}),e.jsx("tbody",{children:j?e.jsx("tr",{children:e.jsxs("td",{colSpan:9,style:{padding:"40px",textAlign:"center",color:"#64748b"},children:[e.jsx(Kt,{size:20,className:"spin",style:{margin:"0 auto 8px auto",display:"block",color:"#2563eb"}}),"Đang nạp danh sách đơn hàng..."]})}):$e.length===0?e.jsx("tr",{children:e.jsxs("td",{colSpan:9,style:{padding:"40px",textAlign:"center",color:"#64748b"},children:[e.jsx("div",{style:{fontSize:"14px",fontWeight:600,color:"#334155",marginBottom:"4px"},children:"Không tìm thấy đơn hàng nào"}),e.jsx("div",{style:{fontSize:"12px"},children:c?"Thử thay đổi từ khóa tìm kiếm.":"Chưa có đơn hàng nào trong bộ lọc này."})]})}):$e.map(t=>{const a=t.order_code||t.orderCode||t.id,d=o.includes(a),i=t.print_count&&t.print_count>0||!!t.last_printed_at,f=Yt(t),l=Wn(t),T=t.customerName||t.name||t.recipientName||"Khách hàng",w=t.phone||t.customerPhone||t.recipientPhone||"",Z=Ut(t),B=Qt(t),q=Xt(t)||cn,k=Jt(t),D=String(t.productItem||t.productNote||t.product||t.goodsName||"Hàng hoá tổng hợp").trim(),V=t.weight||t.actual_weight||2e3,Y=t.note||t.orderNote||"",ge=t.created_at||t.createdDate||t.date;return e.jsxs("tr",{className:d?"selected":"",children:[e.jsx("td",{style:{textAlign:"center"},children:e.jsx("button",{onClick:()=>un(a),style:{background:"transparent",border:"none",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"},children:d?e.jsx(xt,{size:17,style:{color:"#2563eb"}}):e.jsx(Ot,{size:17,style:{color:"#94a3b8"}})})}),e.jsxs("td",{children:[e.jsxs("div",{style:{display:"flex",alignItems:"center",gap:"6px"},children:[e.jsx("span",{style:{fontWeight:800,color:"#0f172a",fontSize:"13px"},children:l}),l&&l!=="—"&&e.jsx("button",{onClick:()=>dt(l),style:{border:"none",background:"transparent",cursor:"pointer",padding:"1px",color:"#94a3b8"},title:"Sao chép mã đơn",children:be===l?e.jsx(gt,{size:12,color:"#16a34a"}):e.jsx(ut,{size:12})})]}),f?e.jsxs("div",{style:{display:"inline-flex",alignItems:"center",gap:"4px",marginTop:"3px"},children:[e.jsx("span",{style:{fontFamily:"Courier New, monospace",fontSize:"11.5px",fontWeight:700,color:"#2563eb",background:"#eff6ff",padding:"1px 5px",borderRadius:"3px"},children:f}),e.jsx("button",{onClick:()=>dt(f),style:{border:"none",background:"transparent",cursor:"pointer",padding:"1px",color:"#94a3b8"},title:"Sao chép mã vận đơn",children:be===f?e.jsx(gt,{size:12,color:"#16a34a"}):e.jsx(ut,{size:12})})]}):e.jsx("div",{style:{fontSize:"11px",color:"#94a3b8",fontStyle:"italic",marginTop:"2px"},children:"Chưa có vận đơn"}),ge&&e.jsxs("div",{style:{fontSize:"11px",color:"#64748b",marginTop:"2px"},children:["📅 ",new Date(ge).toLocaleDateString("vi-VN")]})]}),e.jsxs("td",{children:[e.jsxs("div",{style:{display:"flex",alignItems:"center",gap:"5px",flexWrap:"wrap"},children:[e.jsx("span",{style:{display:"inline-block",padding:"2px 7px",borderRadius:"4px",fontSize:"11px",fontWeight:700,background:B.bg,color:B.color,border:`1px solid ${B.border}`},children:B.name}),e.jsx("span",{style:{fontSize:"10.5px",fontWeight:600,padding:"2px 5px",borderRadius:"4px",background:k?"#fef3c7":"#f1f5f9",color:k?"#b45309":"#475569"},children:k?"Khách trả":"Shop trả"})]}),q&&e.jsxs("div",{style:{fontSize:"11px",color:"#64748b",marginTop:"3px"},children:["TK: ",e.jsx("strong",{children:q})]})]}),e.jsxs("td",{children:[e.jsx("div",{style:{fontWeight:700,color:"#0f172a",fontSize:"13px"},children:T}),w&&e.jsxs("div",{style:{display:"inline-flex",alignItems:"center",gap:"4px",marginTop:"3px"},children:[e.jsx("span",{style:{fontSize:"12px",fontWeight:700,color:"#2563eb",fontFamily:"Courier New, monospace"},children:w}),e.jsx("button",{onClick:()=>dt(w),style:{border:"none",background:"transparent",cursor:"pointer",padding:"1px",color:"#94a3b8"},title:"Sao chép SĐT",children:be===w?e.jsx(gt,{size:12,color:"#16a34a"}):e.jsx(ut,{size:12})})]})]}),e.jsx("td",{style:{maxWidth:"300px",lineHeight:1.4},children:e.jsx("div",{style:{color:"#334155",wordBreak:"break-word",fontSize:"12.5px"},children:t.address||"—"})}),e.jsxs("td",{style:{maxWidth:"260px"},children:[e.jsxs("div",{style:{fontWeight:600,color:"#0f172a",fontSize:"12.5px",display:"flex",alignItems:"flex-start",gap:"4px"},children:[e.jsx("span",{style:{flexShrink:0},children:"📦"}),e.jsx("span",{style:{wordBreak:"break-word"},children:D})]}),e.jsxs("div",{style:{display:"flex",gap:"8px",fontSize:"11px",color:"#64748b",marginTop:"3px"},children:[e.jsxs("span",{children:["SL: ",e.jsx("strong",{children:t.quantity||t.qty||1})]}),e.jsx("span",{children:"•"}),e.jsxs("span",{children:["KL: ",e.jsxs("strong",{children:[V,"g"]})]})]}),Y&&e.jsxs("div",{style:{fontSize:"11px",color:"#d97706",marginTop:"2px",wordBreak:"break-word",fontStyle:"italic"},children:["📝 ",Y]})]}),e.jsx("td",{children:e.jsxs("div",{style:{fontWeight:800,color:"#0f172a",fontSize:"13.5px"},children:[Number(Z).toLocaleString("vi-VN")," đ"]})}),e.jsx("td",{children:i?e.jsxs("div",{children:[e.jsxs("span",{className:"pc-badge",style:{background:"#fef3c7",color:"#b45309",border:"1px solid #fde68a"},children:[e.jsx(Ft,{size:11}),e.jsxs("span",{children:["Đã in ",t.print_count||1," lần"]})]}),t.last_printed_at&&e.jsxs("div",{style:{fontSize:"10.5px",color:"#64748b",marginTop:"3px"},children:["Lần cuối: ",new Date(t.last_printed_at).toLocaleTimeString("vi-VN",{hour:"2-digit",minute:"2-digit"})]})]}):e.jsx("span",{className:"pc-badge",style:{background:"#f1f5f9",color:"#475569"},children:"Chưa in"})}),e.jsx("td",{style:{textAlign:"right",paddingRight:"14px"},children:e.jsxs("div",{style:{display:"inline-flex",gap:"6px"},children:[e.jsx("button",{onClick:()=>zt([t]),className:"pc-btn pc-btn-secondary",style:{padding:"5px 9px",fontSize:"12px"},title:"Xem trước nhãn đơn này",children:e.jsx(ht,{size:13})}),e.jsxs("button",{onClick:()=>It([t]),className:"pc-btn pc-btn-primary",style:{padding:"5px 11px",fontSize:"12px"},title:"In ngay nhãn này",children:[e.jsx(Be,{size:13}),e.jsx("span",{children:"In"})]})]})})]},a)})})]})}),K.length>0&&e.jsxs("div",{style:{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 16px",background:"#f8fafc",borderTop:"1px solid #e2e8f0",flexWrap:"wrap",gap:"12px"},children:[e.jsxs("div",{style:{fontSize:"12.5px",color:"#64748b"},children:["Hiển thị ",e.jsx("strong",{style:{color:"#0f172a"},children:$e.length})," / ",e.jsx("strong",{children:K.length})," đơn hàng (Đã chọn: ",e.jsx("strong",{style:{color:"#2563eb"},children:G.length}),")"]}),e.jsxs("div",{style:{display:"flex",alignItems:"center",gap:"12px"},children:[e.jsxs("div",{style:{display:"flex",alignItems:"center",gap:"6px",fontSize:"12.5px",color:"#64748b"},children:[e.jsx("span",{children:"Hiển thị:"}),e.jsxs("select",{value:le,onChange:t=>{const a=t.target.value==="ALL"?"ALL":Number(t.target.value);ln(a),F(1)},style:{border:"1px solid #cbd5e1",borderRadius:"6px",background:"#ffffff",padding:"3px 8px",fontSize:"12px"},children:[e.jsx("option",{value:25,children:"25 đơn/trang"}),e.jsx("option",{value:50,children:"50 đơn/trang"}),e.jsx("option",{value:100,children:"100 đơn/trang"}),e.jsx("option",{value:200,children:"200 đơn/trang"}),e.jsxs("option",{value:"ALL",children:["Tất cả (",K.length,")"]})]})]}),le!=="ALL"&&Ye>1&&e.jsxs("div",{style:{display:"flex",alignItems:"center",gap:"4px"},children:[e.jsx("button",{onClick:()=>F(t=>Math.max(1,t-1)),disabled:W===1,className:"pc-btn pc-btn-secondary",style:{padding:"4px 8px"},children:e.jsx(jn,{size:14})}),e.jsxs("span",{style:{fontSize:"12px",fontWeight:600,color:"#334155",padding:"0 6px"},children:[W," / ",Ye]}),e.jsx("button",{onClick:()=>F(t=>Math.min(Ye,t+1)),disabled:W===Ye,className:"pc-btn pc-btn-secondary",style:{padding:"4px 8px"},children:e.jsx(Sn,{size:14})})]})]})]})]}),Le&&e.jsx("div",{style:{position:"fixed",inset:0,background:"rgba(15, 23, 42, 0.65)",backdropFilter:"blur(3px)",zIndex:1e4,display:"flex",alignItems:"center",justifyContent:"center",padding:"20px"},children:e.jsxs("div",{style:{background:"#ffffff",borderRadius:"16px",boxShadow:"0 25px 50px -12px rgba(0, 0, 0, 0.25)",width:"920px",maxWidth:"96vw",height:"88vh",display:"flex",flexDirection:"column",overflow:"hidden"},children:[e.jsxs("div",{style:{padding:"14px 20px",borderBottom:"1px solid #e2e8f0",display:"flex",alignItems:"center",justifyContent:"space-between",background:"#f8fafc"},children:[e.jsxs("div",{style:{display:"flex",alignItems:"center",gap:"10px"},children:[e.jsx("div",{style:{width:"32px",height:"32px",borderRadius:"8px",background:"#eff6ff",display:"flex",alignItems:"center",justifyContent:"center",color:"#2563eb"},children:e.jsx(ht,{size:18})}),e.jsxs("div",{children:[e.jsxs("h3",{style:{margin:0,fontSize:"15px",fontWeight:800,color:"#0f172a"},children:["Xem trước mẫu nhãn vận đơn (",fe.length," nhãn — Khổ ",H,")"]}),e.jsx("div",{style:{fontSize:"12px",color:"#64748b"},children:"Bố cục tem nhiệt chuẩn đa hãng (VNPost, J&T Express, Viettel Post, GHTK): Mã vạch Code128, mã QR, luồng phân hướng BCP, chi tiết thu hộ COD"})]})]}),e.jsxs("div",{style:{display:"flex",alignItems:"center",gap:"8px"},children:[e.jsxs("button",{onClick:()=>pt("",fe),className:"pc-btn pc-btn-primary",style:{padding:"6px 14px"},children:[e.jsx(Be,{size:14}),e.jsxs("span",{children:["In ngay (",fe.length," nhãn)"]})]}),e.jsx("button",{onClick:()=>Ce(!1),className:"pc-btn pc-btn-secondary",style:{padding:"6px 12px"},children:"Đóng"})]})]}),e.jsx("div",{style:{flex:1,background:"#cbd5e1",padding:"16px",overflow:"hidden"},children:e.jsx("iframe",{title:"VNPost Label Live Preview",srcDoc:Ze(fe,{...$,paper_size:H,margin:A,font_scale:z},{carrierAccount:J,senderName:J,senderPhone:Ie,senderAddress:Ae,defaultCarrierAccount:J,carrierAccounts:Pe,lastVnpostSenderInfo:it,font_scale:z}),style:{width:"100%",height:"100%",border:"none",borderRadius:"8px",background:"#e2e8f0"}})})]})}),Ve&&e.jsx("div",{style:{position:"fixed",inset:0,background:"rgba(15, 23, 42, 0.7)",backdropFilter:"blur(3px)",zIndex:10002,display:"flex",alignItems:"center",justifyContent:"center",padding:"16px"},children:e.jsxs("div",{style:{background:"#ffffff",borderRadius:"16px",boxShadow:"0 25px 50px -12px rgba(0, 0, 0, 0.3)",width:"1180px",maxWidth:"98vw",height:"92vh",display:"flex",flexDirection:"column",overflow:"hidden"},children:[e.jsxs("div",{style:{padding:"14px 20px",borderBottom:"1px solid #e2e8f0",display:"flex",alignItems:"center",justifyContent:"space-between",background:"#f8fafc"},children:[e.jsxs("div",{style:{display:"flex",alignItems:"center",gap:"10px"},children:[e.jsx("div",{style:{width:"34px",height:"34px",borderRadius:"8px",background:"#f3e8ff",display:"flex",alignItems:"center",justifyContent:"center",color:"#7c3aed"},children:e.jsx(Vt,{size:20})}),e.jsxs("div",{children:[e.jsx("h3",{style:{margin:0,fontSize:"16px",fontWeight:800,color:"#0f172a"},children:"🎨 Chỉnh sửa trang in mẫu vận đơn (Trực quan & Thời gian thực)"}),e.jsx("div",{style:{fontSize:"12px",color:"#64748b"},children:"Tùy biến tiêu đề dịch vụ, chỉ dẫn giao hàng, câu khẩu hiệu và các thành phần tem nhiệt A6/A5. Thay đổi được cập nhật ngay lập tức."})]})]}),e.jsxs("div",{style:{display:"flex",alignItems:"center",gap:"8px"},children:[e.jsxs("button",{type:"button",onClick:()=>{de({service_title:"",instruction_note:"Cho xem hàng; Hàng dễ vỡ, vui lòng nhẹ tay",custom_slogan:"",show_barcode:!0,show_qr:!0,show_signature_box:!0,show_slogan:!0,show_sender:!0,show_order_meta:!0})},className:"pc-btn pc-btn-secondary",style:{fontSize:"12px",padding:"6px 12px"},title:"Đặt lại các trường và công tắc về mặc định chuẩn",children:[e.jsx(Cn,{size:13}),e.jsx("span",{children:"Khôi phục mặc định"})]}),e.jsx("button",{type:"button",onClick:()=>ze(!1),className:"pc-btn pc-btn-primary",style:{fontSize:"12px",padding:"6px 16px"},children:"Hoàn tất & Đóng"})]})]}),e.jsxs("div",{style:{flex:1,display:"flex",minHeight:0,overflow:"hidden"},children:[e.jsxs("div",{style:{width:"470px",flexShrink:0,borderRight:"1px solid #e2e8f0",padding:"18px 20px",overflowY:"auto",background:"#ffffff",display:"flex",flexDirection:"column",gap:"16px"},children:[e.jsxs("div",{style:{background:"#f8fafc",padding:"12px 14px",borderRadius:"10px",border:"1px solid #e2e8f0"},children:[e.jsxs("div",{style:{fontSize:"12px",fontWeight:800,color:"#1e293b",marginBottom:"10px",display:"flex",alignItems:"center",justifyContent:"space-between"},children:[e.jsxs("div",{style:{display:"flex",alignItems:"center",gap:"6px"},children:[e.jsx("span",{children:"📐"}),e.jsx("span",{children:"KHỔ GIẤY & CĂNG LỀ IN MẪU"})]}),e.jsx("span",{style:{fontSize:"11px",color:"#64748b"},children:"Cập nhật ngay vào xem trước 👉"})]}),e.jsxs("div",{style:{marginBottom:"10px"},children:[e.jsxs("div",{style:{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"4px"},children:[e.jsx("span",{style:{fontSize:"11px",fontWeight:700,color:"#475569"},children:"Khổ giấy tem:"}),H===X?e.jsxs("span",{style:{fontSize:"10.5px",color:"#16a34a",fontWeight:800},children:["⭐ Đang là mặc định (",X,")"]}):e.jsxs("button",{type:"button",onClick:()=>ot(H),style:{fontSize:"10.5px",background:"#eff6ff",color:"#2563eb",border:"1px solid #bfdbfe",borderRadius:"4px",padding:"1px 6px",fontWeight:700,cursor:"pointer"},children:["⭐ Đặt ",H," làm mặc định"]})]}),e.jsxs("select",{value:H,onChange:t=>{const a=t.target.value;L(a),U({paperSize:a})},style:{width:"100%",padding:"6px 10px",borderRadius:"6px",border:"1px solid #cbd5e1",fontSize:"12.5px",fontWeight:700,color:"#0f172a",background:"#ffffff"},children:[e.jsx("option",{value:"A6",children:"A6 (105 x 148 mm - Bưu điện VNPost / J&T)"}),e.jsx("option",{value:"A5",children:"A5 (148 x 210 mm - Nửa tờ A4)"}),e.jsx("option",{value:"A4",children:"A4 (210 x 297 mm - Khổ lớn văn phòng)"}),e.jsx("option",{value:"K100",children:"100 x 150 mm (K100 - Tem nhiệt cuộn TMĐT)"})]})]}),e.jsxs("div",{children:[e.jsxs("div",{style:{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"4px"},children:[e.jsxs("span",{style:{fontSize:"11px",fontWeight:700,color:"#475569"},children:["Căn lề trang in (",A,"):"]}),A===Re?e.jsx("span",{style:{fontSize:"10.5px",color:"#16a34a",fontWeight:800},children:"⭐ Đang là mặc định"}):e.jsx("button",{type:"button",onClick:()=>rt(A),style:{fontSize:"10.5px",background:"#eff6ff",color:"#2563eb",border:"1px solid #bfdbfe",borderRadius:"4px",padding:"1px 6px",fontWeight:700,cursor:"pointer"},children:"⭐ Đặt lề này làm mặc định"})]}),e.jsx("div",{style:{display:"flex",gap:"4px",flexWrap:"wrap",marginBottom:"6px"},children:[{label:"2cm Chuẩn",val:"20mm"},{label:"1.5cm",val:"15mm"},{label:"1cm",val:"10mm"},{label:"5mm",val:"5mm"},{label:"0mm Sát mép",val:"0mm"}].map(t=>e.jsx("button",{type:"button",onClick:()=>{ae(t.val);const a=De(t.val);je(a.mm),U({printMargin:t.val})},style:{fontSize:"10.5px",padding:"3px 8px",borderRadius:"4px",border:A===t.val||t.val==="20mm"&&A==="2cm"?"1px solid #2563eb":"1px solid #cbd5e1",background:A===t.val||t.val==="20mm"&&A==="2cm"?"#eff6ff":"#ffffff",color:A===t.val||t.val==="20mm"&&A==="2cm"?"#1d4ed8":"#475569",fontWeight:700,cursor:"pointer"},children:t.label},t.val))}),e.jsx("input",{type:"range",min:"0",max:"35",step:"1",value:_e,onChange:t=>Me(t.target.value),style:{width:"100%",cursor:"pointer",accentColor:"#2563eb"}})]}),e.jsxs("div",{style:{marginTop:"10px"},children:[e.jsxs("div",{style:{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"4px"},children:[e.jsx("span",{style:{fontSize:"11px",fontWeight:700,color:"#475569"},children:"Cỡ chữ in:"}),Math.abs(Number(z)-Number(E))<.05?e.jsxs("span",{style:{fontSize:"10.5px",color:"#16a34a",fontWeight:800},children:["⭐ Đang là mặc định (",Math.round(E*100),"%)"]}):e.jsxs("button",{type:"button",onClick:()=>Tt(z),style:{fontSize:"10.5px",background:"#eff6ff",color:"#2563eb",border:"1px solid #bfdbfe",borderRadius:"4px",padding:"1px 6px",fontWeight:700,cursor:"pointer"},children:["⭐ Đặt ",Math.round(z*100),"% làm mặc định"]})]}),e.jsxs("select",{value:z,onChange:t=>{const a=parseFloat(t.target.value)||2;ne(a),U({fontScale:a})},style:{width:"100%",padding:"6px 10px",borderRadius:"6px",border:"1px solid #cbd5e1",fontSize:"12.5px",fontWeight:700,color:"#0f172a",background:"#ffffff"},children:[e.jsx("option",{value:"2",children:"Gấp đôi (200% - Rõ to mặc định)"}),e.jsx("option",{value:"1.5",children:"Lớn (150%)"}),e.jsx("option",{value:"1",children:"Chuẩn (100%)"}),e.jsx("option",{value:"2.5",children:"Cực lớn (250%)"})]})]})]}),e.jsxs("div",{children:[e.jsxs("div",{style:{fontSize:"12px",fontWeight:700,color:"#1e293b",marginBottom:"6px",display:"flex",alignItems:"center",gap:"6px"},children:[e.jsx("span",{children:"🏷️"}),e.jsx("span",{children:"TIÊU ĐỀ DỊCH VỤ VẬN CHUYỂN"})]}),e.jsx("input",{type:"text",value:$.service_title||"",onChange:t=>de({service_title:t.target.value}),placeholder:"Mặc định: Tự động theo hãng (VD: TC TMĐT ĐỒNG GIÁ...)",style:{width:"100%",padding:"8px 10px",border:"1px solid #cbd5e1",borderRadius:"6px",fontSize:"12.5px",outline:"none",boxSizing:"border-box",color:"#0f172a",fontWeight:600}}),e.jsx("div",{style:{display:"flex",gap:"5px",flexWrap:"wrap",marginTop:"6px"},children:[{label:"Tự động hãng",val:""},{label:"Đồng giá TMĐT",val:"TC TMĐT ĐỒNG GIÁ - HÀNG THÔNG THƯỜNG"},{label:"Chuyển phát tiêu chuẩn",val:"CHUYỂN PHÁT TIÊU CHUẨN"},{label:"Chuyển phát nhanh",val:"CHUYỂN PHÁT NHANH HỎA TỐC"}].map(t=>e.jsx("button",{type:"button",onClick:()=>de({service_title:t.val}),style:{fontSize:"11px",padding:"3px 8px",background:($.service_title||"")===t.val?"#eff6ff":"#f1f5f9",color:($.service_title||"")===t.val?"#2563eb":"#475569",border:`1px solid ${($.service_title||"")===t.val?"#bfdbfe":"#e2e8f0"}`,borderRadius:"5px",cursor:"pointer"},children:t.label},t.label))})]}),e.jsxs("div",{children:[e.jsxs("div",{style:{fontSize:"12px",fontWeight:700,color:"#1e293b",marginBottom:"6px",display:"flex",alignItems:"center",gap:"6px"},children:[e.jsx("span",{children:"📝"}),e.jsx("span",{children:"CHỈ DẪN GIAO HÀNG (MẶC ĐỊNH CHO ĐƠN)"})]}),e.jsx("textarea",{rows:3,value:$.instruction_note||"",onChange:t=>de({instruction_note:t.target.value}),placeholder:"Nhập chỉ dẫn giao hàng (áp dụng khi đơn hàng không có ghi chú riêng)...",style:{width:"100%",padding:"8px 10px",border:"1px solid #cbd5e1",borderRadius:"6px",fontSize:"12.5px",outline:"none",boxSizing:"border-box",color:"#0f172a",fontFamily:"inherit",resize:"vertical"}}),e.jsx("div",{style:{display:"flex",gap:"5px",flexWrap:"wrap",marginTop:"6px"},children:["Cho xem hàng, không cho thử","Không cho xem hàng","Cho thử hàng","Hàng dễ vỡ, xin nhẹ tay"].map(t=>e.jsx("button",{type:"button",onClick:()=>de({instruction_note:t}),style:{fontSize:"11px",padding:"3px 8px",background:"#f1f5f9",color:"#475569",border:"1px solid #e2e8f0",borderRadius:"5px",cursor:"pointer"},children:t},t))})]}),e.jsxs("div",{children:[e.jsxs("div",{style:{fontSize:"12px",fontWeight:700,color:"#1e293b",marginBottom:"6px",display:"flex",alignItems:"center",gap:"6px"},children:[e.jsx("span",{children:"📣"}),e.jsx("span",{children:"KHẨU HIỆU / CÂU CẢM ƠN CHÂN TRANG"})]}),e.jsx("input",{type:"text",value:$.custom_slogan||"",onChange:t=>de({custom_slogan:t.target.value}),placeholder:"Mặc định: Theo hãng (VD: Vietnam Post hotline 1900 545481...)",style:{width:"100%",padding:"8px 10px",border:"1px solid #cbd5e1",borderRadius:"6px",fontSize:"12.5px",outline:"none",boxSizing:"border-box",color:"#0f172a"}}),e.jsx("div",{style:{display:"flex",gap:"5px",flexWrap:"wrap",marginTop:"6px"},children:[{label:"Theo hãng",val:""},{label:"Cảm ơn khách hàng",val:"VĨNH TÀI BONSAI - CẢM ƠN QUÝ KHÁCH ĐÃ MUA HÀNG VÀ ỦNG HỘ SHOP!"},{label:"Quay video khi mở",val:"QUÝ KHÁCH VUI LÒNG QUAY VIDEO CLIP KHI MỞ HÀNG ĐỂ ĐƯỢC HỖ TRỢ ĐỔI TRẢ NHANH CHÓNG"}].map(t=>e.jsx("button",{type:"button",onClick:()=>de({custom_slogan:t.val}),style:{fontSize:"11px",padding:"3px 8px",background:($.custom_slogan||"")===t.val?"#eff6ff":"#f1f5f9",color:($.custom_slogan||"")===t.val?"#2563eb":"#475569",border:`1px solid ${($.custom_slogan||"")===t.val?"#bfdbfe":"#e2e8f0"}`,borderRadius:"5px",cursor:"pointer"},children:t.label},t.label))})]}),e.jsxs("div",{style:{borderTop:"1px solid #f1f5f9",paddingTop:"12px"},children:[e.jsxs("div",{style:{fontSize:"12px",fontWeight:700,color:"#1e293b",marginBottom:"8px",display:"flex",alignItems:"center",gap:"6px"},children:[e.jsx("span",{children:"👁️"}),e.jsx("span",{children:"CÁC THÀNH PHẦN HIỂN THỊ TRÊN TEM"})]}),e.jsx("div",{style:{display:"flex",flexDirection:"column",gap:"8px"},children:[{key:"show_barcode",label:"Mã vạch vận đơn (Code 128)",desc:"Mã vạch quét nhanh tại bưu điện"},{key:"show_qr",label:"Mã QR Code phân hướng (25x25)",desc:"Mã vuông quét tại trung tâm khai thác"},{key:"show_signature_box",label:"Khung chữ ký người nhận",desc:"Ô ký xác nhận nhận hàng và ghi ngày tháng"},{key:"show_order_meta",label:"Cột Số ĐH / Lô / Thứ tự",desc:"Góc phải trên cùng thể hiện Số đơn và mã TK"},{key:"show_sender",label:"Thông tin người gửi (Shop)",desc:"Tên, SĐT và địa chỉ của shop người gửi"},{key:"show_slogan",label:"Khẩu hiệu chân trang",desc:"Dòng chữ nhỏ dưới đáy trang in"}].map(t=>e.jsxs("label",{style:{display:"flex",alignItems:"flex-start",gap:"10px",padding:"8px 10px",borderRadius:"6px",background:$[t.key]!==!1?"#f8fafc":"#f1f5f9",border:"1px solid #e2e8f0",cursor:"pointer"},children:[e.jsx("input",{type:"checkbox",checked:$[t.key]!==!1,onChange:a=>de({[t.key]:a.target.checked}),style:{marginTop:"2px",cursor:"pointer"}}),e.jsxs("div",{children:[e.jsx("div",{style:{fontSize:"12.5px",fontWeight:700,color:"#0f172a"},children:t.label}),e.jsx("div",{style:{fontSize:"11px",color:"#64748b"},children:t.desc})]})]},t.key))})]})]}),e.jsxs("div",{style:{flex:1,background:"#cbd5e1",padding:"16px",display:"flex",flexDirection:"column",minWidth:0,overflow:"hidden"},children:[e.jsxs("div",{style:{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"8px",color:"#334155",fontSize:"12px",fontWeight:600},children:[e.jsxs("div",{style:{display:"flex",alignItems:"center",gap:"6px"},children:[e.jsx(kn,{size:14,color:"#2563eb"}),e.jsx("span",{children:"Xem trước mẫu in thời gian thực (Cập nhật tức thì)"})]}),e.jsxs("div",{children:["Khổ in: ",e.jsx("strong",{children:H})," • Canh lề: ",e.jsx("strong",{children:A})," • Cỡ chữ: ",e.jsxs("strong",{children:[Math.round(z*100),"%"]})]})]}),e.jsx("div",{style:{flex:1,minHeight:0,borderRadius:"8px",overflow:"hidden",boxShadow:"0 4px 12px rgba(0,0,0,0.15)",background:"#fff"},children:e.jsx("iframe",{title:"Live Template Preview",srcDoc:Ze([n.length>0?n[0]:{order_code:"DH-VNP-SAMPLE",tracking_code:"CP889977665VN",carrierAccount:J||"NGUYỄN THANH NHỰT",customerName:"Nguyễn Văn An",phone:"0912345678",address:"28 Ngõ 65, Phường Phúc Xá, Ba Đình, TP. Hà Nội",productItem:"Cây Sanh Nam Điền Dáng Trực (Kèm chậu)",weight:2e3,codAmount:35e4,platform:"vnpost",note:$.instruction_note||"Cho xem hàng; Hàng dễ vỡ, vui lòng nhẹ tay"}],{...$,paper_size:H,margin:A,font_scale:z},{carrierAccount:J,senderName:J,senderPhone:Ie,senderAddress:Ae,defaultCarrierAccount:J,carrierAccounts:Pe,lastVnpostSenderInfo:it,font_scale:z}),style:{width:"100%",height:"100%",border:"none",background:"#e2e8f0"}})})]})]})]})}),tt&&e.jsx("div",{style:{position:"fixed",inset:0,background:"rgba(15, 23, 42, 0.6)",backdropFilter:"blur(2px)",zIndex:10001,display:"flex",alignItems:"center",justifyContent:"center",padding:"20px"},children:e.jsxs("div",{style:{background:"#ffffff",borderRadius:"14px",boxShadow:"0 20px 25px -5px rgba(0, 0, 0, 0.2)",maxWidth:"460px",width:"100%",padding:"22px"},children:[e.jsxs("div",{style:{display:"flex",alignItems:"center",gap:"10px",color:"#b45309",marginBottom:"10px"},children:[e.jsx(Ft,{size:22}),e.jsx("h3",{style:{margin:0,fontSize:"16px",fontWeight:800,color:"#0f172a"},children:"Cảnh báo: Danh sách có đơn đã in nhãn"})]}),e.jsx("p",{style:{fontSize:"13px",color:"#475569",lineHeight:1.5,margin:"0 0 14px 0"},children:"Trong danh sách chọn có đơn hàng đã được in nhãn vận đơn trước đó. Để kiểm soát chặt chẽ và chống gian lận/in trùng lặp, vui lòng nhập lý do in lại:"}),e.jsx("textarea",{rows:3,value:oe,onChange:t=>we(t.target.value),placeholder:"Ví dụ: Rách giấy in nhiệt, kẹt máy in, đổi thông tin người nhận...",style:{width:"100%",padding:"10px",border:"1px solid #cbd5e1",borderRadius:"8px",fontSize:"13px",outline:"none",boxSizing:"border-box",fontFamily:"inherit",marginBottom:"10px"}}),e.jsx("div",{style:{display:"flex",gap:"6px",flexWrap:"wrap",marginBottom:"16px"},children:["Rách giấy in","Kẹt máy in","In mờ/hết mực","Sửa thông tin đơn"].map(t=>e.jsx("button",{onClick:()=>we(t),style:{fontSize:"11.5px",padding:"3px 8px",background:"#f1f5f9",border:"1px solid #e2e8f0",borderRadius:"6px",cursor:"pointer",color:"#475569"},children:t},t))}),e.jsxs("div",{style:{display:"flex",justifyContent:"flex-end",gap:"8px"},children:[e.jsx("button",{onClick:()=>ke(!1),className:"pc-btn pc-btn-secondary",children:"Hủy bỏ"}),e.jsx("button",{onClick:()=>pt(oe),disabled:!oe.trim(),className:"pc-btn",style:{background:"#d97706",color:"#fff"},children:"Xác nhận in lại"})]})]})}),nt&&e.jsx("div",{style:{position:"fixed",inset:0,background:"rgba(15, 23, 42, 0.6)",backdropFilter:"blur(2px)",zIndex:10001,display:"flex",alignItems:"center",justifyContent:"center",padding:"20px"},children:e.jsxs("div",{style:{background:"#ffffff",borderRadius:"14px",boxShadow:"0 20px 25px -5px rgba(0, 0, 0, 0.2)",maxWidth:"520px",width:"100%",padding:"22px"},children:[e.jsxs("div",{style:{display:"flex",alignItems:"center",gap:"10px",color:"#2563eb",marginBottom:"10px"},children:[e.jsx(Be,{size:22}),e.jsx("h3",{style:{margin:0,fontSize:"16px",fontWeight:800,color:"#0f172a"},children:"Xác nhận kết quả in từ máy in"})]}),e.jsx("p",{style:{fontSize:"13px",color:"#475569",lineHeight:1.5,margin:"0 0 14px 0"},children:"Hộp thoại in vừa được mở. Vui lòng xác nhận những đơn hàng đã được máy in nhãn xuất ra thành công:"}),e.jsx("div",{style:{maxHeight:"240px",overflowY:"auto",border:"1px solid #e2e8f0",borderRadius:"8px",marginBottom:"16px"},children:((te==null?void 0:te.orders)||[]).map(t=>{const a=t.order_code||t.orderCode||t.id,d=he[a]||"PRINTED";return e.jsxs("div",{style:{padding:"8px 12px",borderBottom:"1px solid #f1f5f9",display:"flex",alignItems:"center",justifyContent:"space-between",fontSize:"12.5px"},children:[e.jsxs("div",{children:[e.jsx("strong",{style:{color:"#0f172a"},children:t.order_code||t.orderCode}),e.jsxs("span",{style:{color:"#64748b",marginLeft:"6px"},children:["(",t.customerName||t.name||"Khách",")"]})]}),e.jsxs("div",{style:{display:"flex",gap:"6px"},children:[e.jsx("button",{onClick:()=>me({...he,[a]:"PRINTED"}),style:{padding:"3px 8px",borderRadius:"6px",fontSize:"11px",fontWeight:700,cursor:"pointer",border:d==="PRINTED"?"1px solid #86efac":"1px solid #cbd5e1",background:d==="PRINTED"?"#dcfce7":"#ffffff",color:d==="PRINTED"?"#15803d":"#64748b"},children:"In thành công"}),e.jsx("button",{onClick:()=>me({...he,[a]:"FAILED"}),style:{padding:"3px 8px",borderRadius:"6px",fontSize:"11px",fontWeight:700,cursor:"pointer",border:d==="FAILED"?"1px solid #fca5a5":"1px solid #cbd5e1",background:d==="FAILED"?"#fee2e2":"#ffffff",color:d==="FAILED"?"#b91c1c":"#64748b"},children:"In lỗi"})]})]},a)})}),e.jsxs("div",{style:{display:"flex",justifyContent:"flex-end",gap:"8px"},children:[e.jsx("button",{onClick:()=>Ne(!1),className:"pc-btn pc-btn-secondary",children:"Đóng / Bỏ qua"}),e.jsx("button",{onClick:mn,className:"pc-btn pc-btn-primary",children:"Lưu kết quả in"})]})]})})]})}export{Kn as default,Qt as detectCarrier,Ut as extractCodAmount,Wn as extractOrderCode,Yt as extractTrackingCode,Xt as getCarrierAccount,Jt as isRecipientPayingFee,De as parseMarginToValues,Hn as wirePrintTabControls};
