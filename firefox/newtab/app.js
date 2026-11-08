const feeds = [
 {category:"world",label:"Actualidad",icon:"◉",url:"https://feeds.bbci.co.uk/news/world/rss.xml"},
 {category:"sport",label:"Deportes",icon:"⚽",url:"https://feeds.bbci.co.uk/sport/rss.xml"},
 {category:"business",label:"Finanzas",icon:"▥",url:"https://feeds.bbci.co.uk/news/business/rss.xml"},
 {category:"entertainment",label:"Entretenimiento",icon:"▣",url:"https://feeds.bbci.co.uk/news/entertainment_and_arts/rss.xml"},
 {category:"technology",label:"Tecnología",icon:"▦",url:"https://feeds.bbci.co.uk/news/technology/rss.xml"}
];
const grid=document.querySelector("#news-grid"),updated=document.querySelector("#updated");
let stories=[],selected="all";
document.querySelector("#search-form").addEventListener("submit",event=>{event.preventDefault();const q=document.querySelector("#query").value.trim();if(q)location.href="https://duckduckgo.com/?q="+encodeURIComponent(q)});
document.querySelectorAll(".filter").forEach(button=>button.addEventListener("click",()=>{document.querySelector(".filter.active")?.classList.remove("active");button.classList.add("active");selected=button.dataset.category;render()}));
function textOf(parent,tag){return parent.getElementsByTagName(tag)[0]?.textContent?.trim()||""}
function safeDate(value){const date=new Date(value);return Number.isNaN(date.getTime())?0:date.getTime()}
function escapeHTML(value){return String(value).replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]))}
function safeImage(item){
 const node=item.getElementsByTagName("media:thumbnail")[0]||item.getElementsByTagName("media:content")[0]||item.querySelector("enclosure[type^='image/']");
 const url=node?.getAttribute("url")||node?.getAttribute("href")||"";
 return /^https:\/\//i.test(url)?url:"";
}
function render(){
 const visible=stories.filter(item=>selected==="all"||item.category===selected).slice(0,12);
 if(!visible.length){grid.innerHTML='<div class="empty">No hay titulares disponibles en esta categoría por ahora.</div>';return}
 grid.innerHTML=visible.map(item=>{
  const title=escapeHTML(item.title),summary=escapeHTML(item.description.slice(0,150));
  const date=item.date?new Intl.DateTimeFormat("es-MX",{day:"numeric",month:"short"}).format(new Date(item.date)):"";
  const visual=item.image?'<div class="story-visual"><img src="'+escapeHTML(item.image)+'" alt="" loading="lazy" referrerpolicy="no-referrer"></div>':'<div class="story-visual fallback-visual">'+item.icon+'</div>';
  return '<article class="story">'+visual+'<div class="story-meta"><span>'+item.label+'</span><time>'+date+'</time></div><h3><a href="'+escapeHTML(item.link)+'" target="_blank" rel="noopener noreferrer">'+title+'</a></h3><p>'+summary+'</p><a class="read" href="'+escapeHTML(item.link)+'" target="_blank" rel="noopener noreferrer">Leer noticia <span aria-hidden="true">↗</span></a></article>';
 }).join("");
}
async function loadFeed(feed){
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),6500);
 try{
  const response=await fetch(feed.url,{signal:controller.signal,cache:"no-store"});
  if(!response.ok)throw new Error("HTTP "+response.status);
  const xml=new DOMParser().parseFromString(await response.text(),"application/xml");
  if(xml.querySelector("parsererror"))throw new Error("RSS inválido");
  return [...xml.querySelectorAll("item")].slice(0,8).map(item=>({category:feed.category,label:feed.label,icon:feed.icon,title:textOf(item,"title"),description:textOf(item,"description").replace(/<[^>]*>/g,"").trim(),link:textOf(item,"link"),date:textOf(item,"pubDate"),image:safeImage(item)})).filter(item=>item.title&&/^https:\/\//i.test(item.link));
 }catch(error){console.warn("Linden news feed unavailable:",feed.category,error);return[]}finally{clearTimeout(timeout)}
}
(async()=>{const results=await Promise.all(feeds.map(loadFeed));stories=results.flat().sort((a,b)=>safeDate(b.date)-safeDate(a.date));render();updated.textContent=stories.length?"Actualizado "+new Intl.DateTimeFormat("es-MX",{hour:"2-digit",minute:"2-digit"}).format(new Date()):"Noticias temporalmente no disponibles"})();
