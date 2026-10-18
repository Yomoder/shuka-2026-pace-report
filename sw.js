/* Offline app shell for this repository only.
 * Release rule: bump VERSION and regenerate every ASSETS hash whenever files change.
 * Failed/incomplete installs leave the previously active version usable.
 * No automatic page reload: a saved update is shown on the next full opening.
 */
'use strict';
const VERSION = '2026.10.18-pwa.1';
const ASSETS = [
  {
    "file": "index.html",
    "sha256": "3a8b256d00701a6bccf560001075db2b408b634b3a5633484bdc893d65d6ff4c"
  },
  {
    "file": "manifest.webmanifest",
    "sha256": "11925422eece65a9255ed85de863e641987207ae308cbd0b26208a3d90f6b200"
  },
  {
    "file": "icons/icon-192.png",
    "sha256": "a28bc7998041ac3ce8b12fee8b6035680702dc38d7abd787729613025c837e4f"
  },
  {
    "file": "icons/icon-512.png",
    "sha256": "3b2ffa99c0dda92fdb9f40c7280cc4958144a42b7e0b047ce4b892cf20efd03c"
  },
  {
    "file": "icons/apple-touch-icon.png",
    "sha256": "8413cccb5a3a9b1e37fccf233c132e7b952520fff22686c252b608e977f24afb"
  }
];
const BASE = new URL(self.registration.scope);
const PREFIX = 'horii-shuka-2026:' + BASE.href + ':';
const CACHE_NAME = PREFIX + VERSION + ':' + ASSETS[0].sha256.slice(0,12);
const INDEX_URL = new URL('index.html',BASE).href;
const URLS = ASSETS.map(asset=>new URL(asset.file,BASE).href);
const hex=bytes=>Array.from(new Uint8Array(bytes),v=>v.toString(16).padStart(2,'0')).join('');
self.addEventListener('install',event=>{
 event.waitUntil((async()=>{
  // Fetch and verify the complete release before making it available.
  const entries=await Promise.all(ASSETS.map(async asset=>{
   const url=new URL(asset.file,BASE).href;
   const response=await fetch(new Request(url,{cache:'reload',credentials:'omit',redirect:'error'}));
   if(!response.ok)throw new Error('Offline asset unavailable: '+asset.file);
   const digest=hex(await crypto.subtle.digest('SHA-256',await response.clone().arrayBuffer()));
   if(digest!==asset.sha256)throw new Error('Offline release integrity mismatch: '+asset.file);
   return {url,response};
  }));
  const cache=await caches.open(CACHE_NAME);
  await Promise.all(entries.map(entry=>cache.put(entry.url,entry.response)));
  await self.skipWaiting();
 })());
});
self.addEventListener('activate',event=>{
 event.waitUntil((async()=>{
  const keys=await caches.keys();
  await Promise.all(keys.filter(key=>key.startsWith(PREFIX)&&key!==CACHE_NAME).map(key=>caches.delete(key)));
  await self.clients.claim();
 })());
});
self.addEventListener('fetch',event=>{
 if(event.request.method!=='GET')return;
 const url=new URL(event.request.url);
 if(url.origin!==BASE.origin)return;
 const canonical=url.origin+url.pathname;
 let key;
 if(event.request.mode==='navigate'&&(canonical===BASE.href||canonical===INDEX_URL))key=INDEX_URL;
 else if(URLS.includes(canonical))key=canonical;
 else return;
 event.respondWith((async()=>{
  const saved=await caches.match(key,{cacheName:CACHE_NAME});
  // Do not mix newer network responses into this verified release cache.
  return saved||fetch(event.request);
 })());
});
self.addEventListener('message',event=>{
 if(event.data?.type!=='GET_OFFLINE_STATUS'||!event.ports[0])return;
 event.waitUntil((async()=>{
  const matches=await Promise.all(URLS.map(url=>caches.match(url,{cacheName:CACHE_NAME})));
  event.ports[0].postMessage({version:VERSION,ready:matches.every(Boolean),cacheName:CACHE_NAME});
 })());
});
