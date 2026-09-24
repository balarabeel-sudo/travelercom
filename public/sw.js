// Firebase Cloud Messaging service worker.
// Must be served from the site ROOT (i.e. public/firebase-messaging-sw.js in
// the repo, so it's reachable at https://travelercom.vercel.app/firebase-messaging-sw.js)
// — FCM requires this exact scope to deliver background push notifications.
//
// Uses the "compat" SDK via importScripts because service workers can't use
// npm/ES module imports without a bundler step of their own.
importScripts('https://www.gstatic.com/firebasejs/10.13.0/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/10.13.0/firebase-messaging-compat.js')

// Safe to hardcode — Firebase web config is a public identifier, not a secret.
// Security comes from Firebase/Supabase rules, not from hiding this.
firebase.initializeApp({
  apiKey: 'AIzaSyBe_iZWbGVVAs9xUHFkylBwlC8GJN_oLG8',
  authDomain: 'travelercom.firebaseapp.com',
  projectId: 'travelercom',
  storageBucket: 'travelercom.firebasestorage.app',
  messagingSenderId: '841240898296',
  appId: '1:841240898296:web:961ea7e516a4858065690d',
})

const messaging = firebase.messaging()

// Installability requirements for PWA/TWA packaging (PWABuilder, Play Store).
// This worker does not cache anything — it only exists here (rather than a
// second service worker file) to avoid two workers fighting over the same
// root scope, which would break background push notifications above.
self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('fetch', () => {
  // Pass-through: always fetch from network, no caching.
})

// Fires when a push arrives while the app/tab is closed or in the background.
messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || payload.data?.title || 'TravelerCom'
  const body = payload.notification?.body || payload.data?.body || ''
  const actionUrl = payload.data?.action_url || '/'

  self.registration.showNotification(title, {
    body,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: { actionUrl },
  })
})

// Tapping the system notification focuses/opens the app at the right page.
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const actionUrl = event.notification.data?.actionUrl || '/'
  const fullUrl = self.location.origin + '/#' + actionUrl

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.navigate(fullUrl)
          return client.focus()
        }
      }
      if (clients.openWindow) return clients.openWindow(fullUrl)
    })
  )
})
