const CACHE="24i-shell-v7";
const APP_ICON="/icon-192.png?v=3";

self.addEventListener("install",(event)=>{
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then((cache)=>cache.addAll(["/","/offline.html",APP_ICON])));
});

self.addEventListener("activate",(event)=>{
  event.waitUntil(
    caches.keys().then((keys)=>Promise.all(keys.filter((key)=>key!==CACHE).map((key)=>caches.delete(key))))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener("fetch",(event)=>{
  if(event.request.method!=="GET")return;
  event.respondWith(
    fetch(event.request).catch(()=>caches.match(event.request).then((response)=>response||caches.match("/offline.html")))
  );
});

self.addEventListener("push",(event)=>{
  const data=event.data?.json()||{};
  event.waitUntil(Promise.all([
    self.registration.showNotification(data.title||"24i Production",{
      body:data.body,
      icon:APP_ICON,
      badge:APP_ICON,
      data:{url:data.deepLink||"/"}
    }),
    // Tell open pages something new arrived so they refresh right away (e.g. the chat).
    self.clients.matchAll({type:"window",includeUncontrolled:true}).then((list)=>list.forEach((c)=>c.postMessage({type:"push",deepLink:data.deepLink||"/"})))
  ]));
});

self.addEventListener("notificationclick",(event)=>{
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data.url));
});
