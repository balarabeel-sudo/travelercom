function Icon({ name, size = 20, color = 'currentColor', strokeWidth = 2 }: {
  name: string; size?: number; color?: string; strokeWidth?: number
}) {
  const icons: Record<string, JSX.Element> = {
    box: <><path d="M3 7l9-4 9 4-9 4-9-4z" /><path d="M3 7v10l9 4 9-4V7" /><path d="M12 11v10" /></>,
    trendingUp: <><polyline points="3 17 9 11 13 15 21 7" /><polyline points="14 7 21 7 21 14" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 15 14" /></>,
    checkCircle: <><circle cx="12" cy="12" r="9" /><polyline points="8 12 11 15 16 9" /></>,
    clipboard: <><rect x="6" y="4" width="12" height="16" rx="2" /><path d="M9 4V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1" /><path d="M9 10h6M9 14h6" /></>,
    alertCircle: <><circle cx="12" cy="12" r="9" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></>,
    fileText: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /><path d="M9 13h6M9 17h6" /></>,
    plus: <><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></>,
    camera: <><path d="M4 8a2 2 0 0 1 2-2h1.5l1-1.5h7l1 1.5H18a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" /><circle cx="12" cy="13" r="3.5" /></>,
    wallet: <><path d="M3 7a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v2h2a1 1 0 0 1 1 1v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><path d="M16 13h2" /></>,
    logOut: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></>,
    home: <><path d="M4 11l8-7 8 7" /><path d="M6 10v9a1 1 0 0 0 1 1h4v-6h2v6h4a1 1 0 0 0 1-1v-9" /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18" /><path d="M8 3v4M16 3v4" /></>,
    user: <><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-6 8-6s8 2 8 6" /></>,
    menu: <><line x1="4" y1="7" x2="20" y2="7" /><line x1="4" y1="12" x2="20" y2="12" /><line x1="4" y1="17" x2="20" y2="17" /></>,
    plusCircle: <><circle cx="12" cy="12" r="9" /><line x1="12" y1="8" x2="12" y2="16" /><line x1="8" y1="12" x2="16" y2="12" /></>,
    bell: <><path d="M6 8a6 6 0 0 1 12 0c0 4 1.5 5.5 1.5 5.5h-15S6 12 6 8z" /><path d="M9.5 17a2.5 2.5 0 0 0 5 0" /></>,
    helpCircle: <><circle cx="12" cy="12" r="9" /><path d="M9.2 9a2.8 2.8 0 0 1 5.4 1c0 1.8-2.4 2-2.4 3.7" /><line x1="12" y1="17" x2="12.01" y2="17" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" /></>,
    shield: <><path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z" /></>,
    info: <><circle cx="12" cy="12" r="9" /><line x1="12" y1="11" x2="12" y2="16" /><line x1="12" y1="8" x2="12.01" y2="8" /></>,
    chevronRight: <><polyline points="9 6 15 12 9 18" /></>,
    arrowLeft: <><line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" /></>,
    users: <><circle cx="9" cy="8" r="3.2" /><path d="M3.5 19c0-3 2.5-5 5.5-5s5.5 2 5.5 5" /><circle cx="17" cy="9" r="2.6" /><path d="M15.5 14c2.2.3 3.8 1.9 3.8 5" /></>,
    userPlus: <><circle cx="9" cy="8" r="3.2" /><path d="M3.5 19c0-3 2.5-5 5.5-5s5.5 2 5.5 5" /><line x1="18" y1="8" x2="18" y2="14" /><line x1="15" y1="11" x2="21" y2="11" /></>,
    barChart: <><line x1="5" y1="20" x2="5" y2="12" /><line x1="12" y1="20" x2="12" y2="7" /><line x1="19" y1="20" x2="19" y2="15" /></>,
    megaphone: <><path d="M3 10v4a1 1 0 0 0 1 1h2l5 4V5l-5 4H4a1 1 0 0 0-1 1z" /><path d="M16 9a4 4 0 0 1 0 6" /></>,
    star: <><path d="M12 3l2.6 5.6 6.1.6-4.6 4.1 1.3 6-5.4-3.1-5.4 3.1 1.3-6-4.6-4.1 6.1-.6z" /></>,
    edit: <><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></>,
    crown: <><path d="M3 8l4 3 5-6 5 6 4-3-2 10H5L3 8z" /><path d="M5 21h14" /></>,
    moreHorizontal: <><circle cx="5" cy="12" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="19" cy="12" r="1.5" /></>,
    trash: <><path d="M4 7h16" /><path d="M9 7V4h6v3" /><path d="M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13" /></>,
    minus: <><line x1="5" y1="12" x2="19" y2="12" /></>,
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      {icons[name]}
    </svg>
  )
}

export default Icon
