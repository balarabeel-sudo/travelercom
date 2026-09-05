                  </div>
                  <div onClick={(e) => toggleFavorite(e, h.id)} style={{ position: 'absolute', top: '8px', right: '8px', width: '28px', height: '28px', borderRadius: '50%', background: 'rgba(255,255,255,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: favoriteIds.has(h.id) ? COLORS.secondary : '#94a3b8' }}>
                    <Icon name="heart" size={14} color={favoriteIds.has(h.id) ? COLORS.secondary : '#94a3b8'} filled={favoriteIds.has(h.id)} />
                  </div>
                  {h.id === lowestPriceId && (
                    <span style={{ position: 'absolute', top: '8px', left: '8px', background: COLORS.secondary, color: 'white', fontSize: '9.5px', fontWeight: 700, padding: '4px 8px', borderRadius: '20px' }}>Best Value</span>
                  )}
                  {h.id === topRatedId && h.id !== lowestPriceId && (
                    <span style={{ position: 'absolute', top: '8px', left: '8px', background: COLORS.primary, color: 'white', fontSize: '9.5px', fontWeight: 700, padding: '4px 8px', borderRadius: '20px' }}>Top Rated</span>
                  )}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: '14.5px', fontWeight: 800, color: COLORS.text }}>{h.title}</p>
                  <p style={{ fontSize: '11.5px', color: COLORS.textMuted, marginTop: '2px', display: 'flex', alignItems: 'center', gap: '3px' }}><Icon name="mapPin" size={11} color={COLORS.textMuted} /> {h.destination}</p>

                  {h.avgRating !== null && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '6px', flexWrap: 'wrap' }}>
                      <span style={{ background: '#DCFCE7', color: COLORS.green, fontSize: '11px', fontWeight: 800, padding: '2px 6px', borderRadius: '6px' }}>{h.avgRating.toFixed(1)}</span>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: COLORS.primary }}>{ratingLabel(h.avgRating)}</span>
                      <span style={{ fontSize: '11px', color: COLORS.textMuted }}>({h.reviewCount.toLocaleString()})</span>
                    </div>
                  )}

                  {h.amenities && h.amenities.length > 0 && (
                    <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', marginTop: '8px' }}>
                      {h.amenities.slice(0, 3).map((a) => (
                        <span key={a} style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '9.5px', fontWeight: 700, background: COLORS.bg, border: `1px solid ${COLORS.border}`, color: COLORS.textMuted, padding: '3px 7px', borderRadius: '20px' }}>
                          <Icon name={AMENITY_ICON[a] || 'check'} size={10} color={COLORS.textMuted} /> {a}
                        </span>
                      ))}
                      {h.amenities.length > 3 && (
                        <span style={{ fontSize: '9.5px', color: COLORS.textMuted, alignSelf: 'center' }}>+{h.amenities.length - 3} more</span>
                      )}
                    </div>
                  )}

                  <div style={{ marginTop: '8px' }}>
                    <p style={{ fontSize: '15px', fontWeight: 800, color: COLORS.primary }}>₦{Number(h.price).toLocaleString()} <span style={{ fontSize: '10.5px', color: COLORS.textMuted, fontWeight: 400 }}>/night</span></p>
                    {h.seats_available !== null && (
                      <p style={{ fontSize: '10.5px', fontWeight: 700, color: h.seats_available === 0 ? '#DC2626' : COLORS.green }}>
                        {h.seats_available === 0 ? 'Fully booked' : `${h.seats_available} rooms available`}
                      </p>
                    )}
                  </div>
                  <span style={{ display: 'inline-block', marginTop: '8px', padding: '8px 16px', background: COLORS.secondary, color: 'white', borderRadius: '9px', fontWeight: 700, fontSize: '12px' }}>View Details</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function FilterChip({ icon, label, active, onClick }: { icon: string; label: string; active: boolean; onClick: () => void }) {
  return (
    <span onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0,
      fontSize: '12px', fontWeight: 700, padding: '9px 14px', borderRadius: '20px', cursor: 'pointer',
      background: active ? COLORS.primary : COLORS.card,
      color: active ? 'white' : COLORS.text,
      border: `1px solid ${active ? COLORS.primary : COLORS.border}`,
    }}>
      <Icon name={icon} size={13} color={active ? 'white' : COLORS.text} /> {label}
    </span>
  )
}

export default Hotels
