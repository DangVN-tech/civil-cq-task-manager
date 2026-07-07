import { useCallback, useState } from 'react'

/** Thông báo hệ điều hành (Web Notification API) — hiện popup ngoài màn hình
 *  khi tab đang chạy nền (thu nhỏ/chuyển tab), không cần focus vào app.
 *  Không hỗ trợ trên Safari iOS/iPadOS ngoài PWA đã cài đặt. */
export function useBrowserNotifications() {
  const supported = typeof window !== 'undefined' && 'Notification' in window
  const [permission, setPermission] = useState<NotificationPermission>(
    supported ? Notification.permission : 'denied',
  )

  const requestPermission = useCallback(async () => {
    if (!supported) return
    const result = await Notification.requestPermission()
    setPermission(result)
  }, [supported])

  return { supported, permission, requestPermission }
}
