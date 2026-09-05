import{q as l,j as e}from"./index-CgarCtDG.js";import{D as i,a as o,b as d,c as x,T as m}from"./dialog-PPK1YbOA.js";import{f as h}from"./format-CTVa4sDw.js";import{E as u}from"./eye-DW_vE8-P.js";/**
 * @license lucide-react v0.575.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const g=[["path",{d:"M5 21v-6",key:"1hz6c0"}],["path",{d:"M12 21V3",key:"1lcnhd"}],["path",{d:"M19 21V9",key:"unv183"}]],p=l("chart-no-axes-column",g);/**
 * @license lucide-react v0.575.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const y=[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}],["path",{d:"M12 6v6l4 2",key:"mmk7yg"}]],j=l("clock",y);/**
 * @license lucide-react v0.575.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const N=[["path",{d:"M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5",key:"mvr1a0"}]],f=l("heart",N);/**
 * @license lucide-react v0.575.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const v=[["circle",{cx:"18",cy:"5",r:"3",key:"gq8acd"}],["circle",{cx:"6",cy:"12",r:"3",key:"w7nqdw"}],["circle",{cx:"18",cy:"19",r:"3",key:"1xt0gg"}],["line",{x1:"8.59",x2:"15.42",y1:"13.51",y2:"17.49",key:"47mynk"}],["line",{x1:"15.41",x2:"8.59",y1:"6.51",y2:"10.49",key:"1n3mei"}]],k=l("share-2",v);function t({icon:s,label:n,value:r}){return e.jsxs("div",{className:"flex flex-col gap-1 rounded-xl border bg-muted/30 p-4",children:[e.jsxs("div",{className:"flex items-center gap-1.5 text-xs text-muted-foreground",children:[s,n]}),e.jsx("div",{className:"text-2xl font-bold tabular-nums",children:r})]})}function M({blog:s,open:n,onClose:r}){const{stats:a}=s;return e.jsx(i,{open:n,onOpenChange:c=>!c&&r(),children:e.jsxs(o,{className:"max-w-md",children:[e.jsx(d,{children:e.jsxs(x,{className:"flex items-center gap-2 font-serif text-xl",children:[e.jsx(p,{className:"h-5 w-5 text-primary"}),"Story stats"]})}),e.jsxs("div",{className:"space-y-4 py-2",children:[e.jsxs("div",{className:"rounded-lg border bg-muted/20 px-4 py-3",children:[e.jsx("p",{className:"text-sm font-medium leading-snug",children:s.title||"Untitled"}),s.publishedAt&&e.jsxs("p",{className:"mt-0.5 text-xs text-muted-foreground",children:["Published ",h(new Date(s.publishedAt),"MMM d, yyyy")]})]}),e.jsxs("div",{className:"grid grid-cols-2 gap-3",children:[e.jsx(t,{icon:e.jsx(u,{className:"h-3.5 w-3.5"}),label:"Views",value:a.views.toLocaleString()}),e.jsx(t,{icon:e.jsx(f,{className:"h-3.5 w-3.5"}),label:"Likes",value:a.likes.toLocaleString()}),e.jsx(t,{icon:e.jsx(k,{className:"h-3.5 w-3.5"}),label:"Shares",value:a.shares.toLocaleString()}),e.jsx(t,{icon:e.jsx(j,{className:"h-3.5 w-3.5"}),label:"Reading time",value:`${a.readingTime} min`})]}),e.jsx(t,{icon:e.jsx(m,{className:"h-3.5 w-3.5"}),label:"Word count",value:a.wordCount.toLocaleString()}),s.tags.length>0&&e.jsxs("div",{children:[e.jsx("p",{className:"mb-1.5 text-xs font-medium text-muted-foreground",children:"Tags"}),e.jsx("div",{className:"flex flex-wrap gap-1.5",children:s.tags.map(c=>e.jsx("span",{className:"rounded-full border bg-muted/40 px-2.5 py-0.5 text-xs",children:c},c))})]})]})]})})}export{M as B,p as C,f as H,k as S};
