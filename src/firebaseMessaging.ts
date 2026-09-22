import { initializeApp } from 'firebase/app'
import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging'

// Safe to hardcode — Firebase web config is a public identifier, not a secret.
const firebaseConfig = {
  apiKey: 'AIzaSyBe_iZWbGVVAs9xUHFkylBwlC8GJN_oLG8',
  authDomain: 'travelercom.firebaseapp.com',
  projectId: 'travelercom',
  storageBucket: 'travelercom.firebasestorage.app',
  messagingSenderId: '841240898296',
  appId: '1:841240898296:web:961ea7e516a4858065690d',
}

// Public VAPID key from Firebase Console → Project settings → Cloud Messaging
// → Web Push certificates. Public by design (pairs with the private key that
// stays server-side in Firebase) — safe in client code.
const VAPID_KEY = 'BPcUFFrAvjQg2X2o6hjwacsZF1J0yjBrHjIs5slYMRg8IoOc_YURMh7EjqfwdM7F3kieYGvX2ZVlvxRR1JDAOzc'

const firebaseApp = initializeApp(firebaseConfig)

/**
 * Asks the browser for notification permission (if not already decided),
 * registers the FCM service worker, and returns a device token to save
 * against the signed-in user. Returns null if the browser doesn't support
 * push (e.g. iOS Safari not installed to home screen) or permission is denied.
 */
export async function requestPushToken(): Promise<string | null> {
  const supported = await isSupported().catch(() => false)
  if (!supported) return null

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return null

  try {
    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js')
    const messaging = getMessaging(firebaseApp)
    const token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: registration })
    return token || null
  } catch (err) {
    console.error('Push token request failed:', err)
    return null
  }
}

/**
 * Listens for pushes that arrive while the app is open and in focus (FCM
 * delivers these to the page directly, not through the service worker).
 * Call once, e.g. in PushNotificationSetup.tsx.
 */
export async function listenForegroundMessages(onMessageReceived: (title: string, body: string, actionUrl: string) => void) {
  const supported = await isSupported().catch(() => false)
  if (!supported) return
  const messaging = getMessaging(firebaseApp)
  onMessage(messaging, (payload) => {
    const title = payload.notification?.title || payload.data?.title || 'TravelerCom'
    const body = payload.notification?.body || payload.data?.body || ''
    const actionUrl = payload.data?.action_url || '/'
    onMessageReceived(title, body, actionUrl)
  })
}
