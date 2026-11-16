import { applications, createI18n } from '@remoteai/i18n';
import { resources } from '@remoteai/i18n/client';

/** Build-time copy comes from the released language package, before the app bundle can run. */
export function startupFallback() {
  const messages = applications.web.map(locale => {
    const language = createI18n({ locale, enabledLanguages: applications.web, resources });
    return [locale, language.t('client.mobile.loading'), language.t('client.chat.couldNotLoadSelectToRetry')];
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
function panel(){return document.getElementById('personal-startup')}
function update(failed){var node=panel();if(!node)return;node.hidden=false;
node.querySelector('p').textContent=failed?'':text[1];
node.querySelector('button').hidden=!failed;node.querySelector('button').textContent=text[2];
node.querySelector('small').textContent=failed?code:''}
function check(){var root=document.getElementById('root');if(root&&root.firstElementChild){
var node=panel();if(node)node.hidden=true;return true}return false}
window.addEventListener('error',function(event){var target=event.target;
if(target&&target.tagName==='SCRIPT'){code='JS_RESOURCE';if(!check())update(true)}
else if(event.error){code=event.error.name==='SyntaxError'?'JS_SYNTAX':'JS_STARTUP';if(!check())update(true)}},true);
var started=false;
function start(){if(started||!panel())return;started=true;update(false);
var renderObserver=new MutationObserver(function(){if(check())renderObserver.disconnect()});
renderObserver.observe(document.documentElement,{childList:true,subtree:true});check();
panel().querySelector('button').onclick=function(){var url=new URL(location.href);
url.searchParams.set('_reload',String(Date.now()));location.replace(url.href)};
setTimeout(function(){if(!check()){code=code||'JS_TIMEOUT';update(true)}},15000)}
var documentObserver=new MutationObserver(function(){if(panel()){start();documentObserver.disconnect()}});
documentObserver.observe(document.documentElement,{childList:true,subtree:true});start();
})();` };
}
