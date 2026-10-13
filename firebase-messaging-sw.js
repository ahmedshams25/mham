/* Service Worker - بيت العز
   مسؤول عن استقبال الإشعارات والتطبيق مقفول (الخلفية) */
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

firebase.initializeApp({
    apiKey: "AIzaSyCzRPZ5HFE95Gge_PPjglx9SJVMwBIYyKo",
    authDomain: "design-control.firebaseapp.com",
    projectId: "design-control",
    storageBucket: "design-control.firebasestorage.app",
    messagingSenderId: "924894268278",
    appId: "1:924894268278:web:542d4933750845d45e0857"
});

const messaging = firebase.messaging();

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

// الرسائل بتوصل "data only" من الـ Cloud Function، ونحن اللي بنعرضها
messaging.onBackgroundMessage((payload) => {
    const d = payload.data || {};
    return self.registration.showNotification(d.title || 'بيت العز ❤️', {
        body: d.body || '',
        icon: 'icons/icon-192.png',
        badge: 'icons/icon-192.png',
        tag: d.tag || 'bait-alez',
        dir: 'rtl',
        lang: 'ar',
        data: { url: d.url || './' }
    });
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const target = new URL((event.notification.data && event.notification.data.url) || './', self.registration.scope).href;
    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
            for (const c of list) {
                if ('focus' in c) return c.focus();
            }
            return self.clients.openWindow(target);
        })
    );
});
