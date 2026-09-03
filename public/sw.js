const CACHE="24i-shell-v2";

self.addEventListener("install",(event)=>{
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then((cache)=>cache.addAll(["/","/offline.html","/icon.svg"])));
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
  event.waitUntil(self.registration.showNotification(data.title||"24i Production",{
    body:data.body,
    icon:"/icon.svg",
    data:{url:data.deepLink||"/"}
  }));
});

self.addEventListener("notificationclick",(event)=>{
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data.url));
});
