import { applications, createI18n } from '@remoteai/i18n';
import { resources } from '@remoteai/i18n/client';

/** Build-time copy comes from the released language package, before the app bundle can run. */
export function startupFallback(base = '/') {
  const messages = applications.web.map(locale => {
    const language = createI18n({ locale, enabledLanguages: applications.web, resources });
    return [locale, language.t('client.mobile.loading'), language.t('client.chat.couldNotLoadSelectToRetry'),
      language.t('client.terminal.retry')];
  });
  return { css: `#personal-startup{position:fixed;inset:0;z-index:99999;display:grid;place-content:center;
gap:18px;padding:24px;background:#f4f4f5;color:#232326;text-align:center;font:16px/1.6 system-ui,sans-serif}
#personal-startup[hidden]{display:none}#personal-startup button{font:inherit;padding:12px 20px;border:1px solid #ddd;
border-radius:24px;background:#fff;color:#232326}#personal-startup small{font:12px/1.5 monospace;color:#65656c}
@media(prefers-color-scheme:dark){#personal-startup{background:#19191b;color:#eee}}
`, script: `(function(){
var copy=${JSON.stringify(messages).replaceAll('<', '\\u003c')};
var locale=(navigator.language||'en').split('-')[0];
var text=copy.filter(function(row){return row[0]===locale})[0]||copy.filter(function(row){return row[0]==='en'})[0];
var code='';
var slow=false;
var retrying=false;
var base=${JSON.stringify(base)};
function panel(){return document.getElementById('personal-startup')}
function completePanel(){var node=panel();return node&&node.querySelector('p')&&node.querySelector('button')&&node.querySelector('small')?node:null}
function update(){var node=completePanel();if(!node)return;node.hidden=false;
node.querySelector('p').textContent=code||retrying?'':text[1];
var button=node.querySelector('button');button.hidden=!code&&!slow;button.disabled=retrying;
button.textContent=retrying?text[1]:code?text[2]:text[3];
node.querySelector('small').textContent=retrying?'':code}
function check(){var root=document.getElementById('root');if(root&&root.firstElementChild){
var node=panel();if(node)node.hidden=true;return true}return false}
window.addEventListener('error',function(event){var target=event.target;
if(target&&target.tagName==='SCRIPT'){code='JS_RESOURCE';if(!check())update()}
else if(event.error){code=event.error.name==='SyntaxError'?'JS_SYNTAX':'JS_STARTUP';if(!check())update()}},true);
document.addEventListener('click',function(event){
var button=event.target&&event.target.closest?event.target.closest('#personal-startup button'):null;
if(!button||retrying||check())return;event.preventDefault();retrying=true;update();
var scope=new URL(base,location.href).href;var prefix='remoteai-shell:'+base+':';
// A slow download can still succeed. Keep the installed shell available during a retry.
var repair=!code||code==='JS_TIMEOUT'?Promise.resolve():Promise.resolve().then(function(){return Promise.all([
'serviceWorker' in navigator?navigator.serviceWorker.getRegistrations().then(function(items){return Promise.all(items.filter(function(item){return item.scope===scope}).map(function(item){return item.unregister()}))}):null,
'caches' in window?caches.keys().then(function(keys){return Promise.all(keys.filter(function(key){return key.indexOf(prefix)===0}).map(function(key){return caches.delete(key)}))}):null
])}).catch(function(){});
Promise.race([repair,new Promise(function(resolve){setTimeout(resolve,2000)})]).then(function(){
if(check())return;
var url=new URL(location.href);url.searchParams.set('_reload',String(Date.now()));location.replace(url.href)
}).catch(function(){retrying=false;code='JS_RETRY';update()});
});
var started=false;
function start(){if(started||!completePanel())return;started=true;update();
var renderObserver=new MutationObserver(function(){if(check())renderObserver.disconnect()});
renderObserver.observe(document.documentElement,{childList:true,subtree:true});check();
setTimeout(function(){if(!check()&&!code){slow=true;update()}},15000);
setTimeout(function(){if(!check()&&!code){code='JS_TIMEOUT';update()}},60000)}
var documentObserver=new MutationObserver(function(){start();if(started)documentObserver.disconnect()});
documentObserver.observe(document.documentElement,{childList:true,subtree:true});start();
})();` };
}
