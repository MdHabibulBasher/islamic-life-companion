export class NotificationService {
  /**
   * Request permission for browser notifications
   */
  static async requestPermission(): Promise<NotificationPermission> {
    if (!('Notification' in window)) {
      console.log('This browser does not support notifications')
      return 'denied'
    }

    if (Notification.permission === 'granted') {
      return 'granted'
    }

    if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission()
      return permission
    }

    return 'denied'
  }

  /**
   * Send a notification
   */
  static sendNotification(title: string, options?: NotificationOptions) {
    if (Notification.permission === 'granted') {
      try {
        const notification = new Notification(title, {
          icon: '/icon-192.png',
          badge: '/badge-72.png',
          ...options,
        })

        // Auto-close after 5 seconds
        setTimeout(() => notification.close(), 5000)

        return notification
      } catch (error) {
        console.error('Error sending notification:', error)
      }
    }
  }

  /**
   * Send challenge reminder notification
   */
  static sendChallengeReminder(challengeName: string) {
    this.sendNotification(`⏰ Challenge Reminder: ${challengeName}`, {
      body: 'Time to complete your daily challenge!',
      tag: `challenge-${challengeName}`,
      requireInteraction: false,
    })
  }

  /**
   * Send completion celebration notification
   */
  static sendCompletionCelebration(challengeName: string, streak: number) {
    this.sendNotification(`🎉 Congratulations!`, {
      body: `You've completed "${challengeName}"! Streak: ${streak} days 🔥`,
      tag: 'challenge-complete',
      requireInteraction: false,
    })
  }

  /**
   * Send streak alert when streak is broken
   */
  static sendStreakBroken(challengeName: string) {
    this.sendNotification(`⚠️ Streak Broken`, {
      body: `You missed "${challengeName}". Use your grace day to catch up!`,
      tag: 'streak-broken',
      requireInteraction: true,
    })
  }
}
